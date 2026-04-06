import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { eq, and, isNull } from "drizzle-orm";
import { issues, projectMembers, wikiPages, wikiSpaceMembers, type Database } from "@worknest/db";
import type { Auth } from "../lib/auth";
import {
  subscribe,
  unsubscribe,
  unsubscribeAll,
  getSubscribers,
  parseChannel,
} from "./channels";

// ── Connection Manager ─────────────────────────────────────────────────

/** Map userId -> Set of active WebSocket connections */
const connectionsByUser = new Map<string, Set<WebSocket>>();

function addConnection(userId: string, ws: WebSocket): void {
  let conns = connectionsByUser.get(userId);
  if (!conns) {
    conns = new Set();
    connectionsByUser.set(userId, conns);
  }
  conns.add(ws);
}

function removeConnection(userId: string, ws: WebSocket): void {
  const conns = connectionsByUser.get(userId);
  if (!conns) return;
  conns.delete(ws);
  if (conns.size === 0) {
    connectionsByUser.delete(userId);
  }
}

// ── Message Types ──────────────────────────────────────────────────────

interface SubscribeMessage {
  type: "subscribe";
  channel: string;
}

interface UnsubscribeMessage {
  type: "unsubscribe";
  channel: string;
}

interface PingMessage {
  type: "ping";
}

type ClientMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;

interface ServerEvent {
  type: string;
  payload: unknown;
  actor?: { id: string; name: string };
  timestamp: string;
}

// ── Broadcast Helper ───────────────────────────────────────────────────

/**
 * Broadcast an event to all subscribers of a channel.
 * Optionally exclude a specific WebSocket (e.g., the sender).
 */
export function broadcast(
  channel: string,
  event: ServerEvent,
  exclude?: WebSocket,
): void {
  const subscribers = getSubscribers(channel);
  const message = JSON.stringify(event);

  for (const ws of subscribers) {
    if (ws === exclude) continue;
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}

/**
 * Send an event to a specific user (all their connections).
 */
export function sendToUser(userId: string, event: ServerEvent): void {
  const conns = connectionsByUser.get(userId);
  if (!conns) return;

  const message = JSON.stringify(event);
  for (const ws of conns) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}

// ── WebSocket Route Registration ───────────────────────────────────────

/**
 * Register the WebSocket upgrade handler at /api/v1/ws.
 *
 * Authentication is performed by validating the Better Auth session cookie
 * during the upgrade handshake.
 */
export async function websocketHandler(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;

  app.get(
    "/api/v1/ws",
    { websocket: true },
    async (socket: WebSocket, request) => {
      // ── Authenticate ─────────────────────────────────────────────
      let userId: string;
      let userName: string;

      try {
        const session = await auth.api.getSession({
          headers: request.headers as unknown as Headers,
        });

        if (!session?.user) {
          socket.close(4401, "session_expired");
          return;
        }

        userId = session.user.id;
        userName = session.user.name;
      } catch {
        socket.close(4401, "session_expired");
        return;
      }

      // ── Register connection ──────────────────────────────────────
      addConnection(userId, socket);

      // Auto-subscribe to personal channel
      subscribe(socket, `user:${userId}`);

      request.log.info({ userId }, "WebSocket connected");

      // ── Message handling ─────────────────────────────────────────
      socket.on("message", async (raw) => {
        let msg: ClientMessage;
        try {
          msg = JSON.parse(raw.toString()) as ClientMessage;
        } catch {
          socket.send(
            JSON.stringify({ type: "error", payload: { message: "Invalid JSON" } }),
          );
          return;
        }

        switch (msg.type) {
          case "subscribe": {
            const parsed = msg.channel ? parseChannel(msg.channel) : null;
            if (!parsed) {
              socket.send(
                JSON.stringify({
                  type: "error",
                  payload: { message: "Invalid channel format" },
                }),
              );
              return;
            }

            // Verify project membership before subscribing
            if (parsed.type === "project") {
              try {
                const member = await db
                  .select({ id: projectMembers.id })
                  .from(projectMembers)
                  .where(
                    and(
                      eq(projectMembers.projectId, parsed.id),
                      eq(projectMembers.userId, userId),
                    ),
                  )
                  .limit(1)
                  .then((rows) => rows[0]);

                if (!member) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      payload: { message: "Not a member of this project" },
                    }),
                  );
                  return;
                }
              } catch (err) {
                request.log.error({ err, channel: msg.channel }, "Failed to verify project membership");
                socket.send(
                  JSON.stringify({
                    type: "error",
                    payload: { message: "Authorization check failed" },
                  }),
                );
                return;
              }
            }

            // Verify project membership before subscribing to an issue channel
            if (parsed.type === "issue") {
              try {
                // Look up the issue to find its project
                const issue = await db
                  .select({ projectId: issues.projectId })
                  .from(issues)
                  .where(and(eq(issues.id, parsed.id), isNull(issues.deletedAt)))
                  .limit(1)
                  .then((rows) => rows[0]);

                if (!issue) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      payload: { message: "Issue not found" },
                    }),
                  );
                  return;
                }

                // Verify user is a member of the project
                const member = await db
                  .select({ id: projectMembers.id })
                  .from(projectMembers)
                  .where(
                    and(
                      eq(projectMembers.projectId, issue.projectId),
                      eq(projectMembers.userId, userId),
                    ),
                  )
                  .limit(1)
                  .then((rows) => rows[0]);

                if (!member) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      payload: { message: "Not a member of this project" },
                    }),
                  );
                  return;
                }
              } catch (err) {
                request.log.error({ err, channel: msg.channel }, "Failed to verify issue project membership");
                socket.send(
                  JSON.stringify({
                    type: "error",
                    payload: { message: "Authorization check failed" },
                  }),
                );
                return;
              }
            }

            // Verify wiki space membership before subscribing to a page channel
            if (parsed.type === "page") {
              try {
                // Look up the page to find its wiki space
                const page = await db
                  .select({ wikiSpaceId: wikiPages.wikiSpaceId })
                  .from(wikiPages)
                  .where(eq(wikiPages.id, parsed.id))
                  .limit(1)
                  .then((rows) => rows[0]);

                if (!page) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      payload: { message: "Page not found" },
                    }),
                  );
                  return;
                }

                // Verify user is a member of the wiki space
                const member = await db
                  .select({ id: wikiSpaceMembers.id })
                  .from(wikiSpaceMembers)
                  .where(
                    and(
                      eq(wikiSpaceMembers.wikiSpaceId, page.wikiSpaceId),
                      eq(wikiSpaceMembers.userId, userId),
                    ),
                  )
                  .limit(1)
                  .then((rows) => rows[0]);

                if (!member) {
                  socket.send(
                    JSON.stringify({
                      type: "error",
                      payload: { message: "Not a member of this wiki space" },
                    }),
                  );
                  return;
                }
              } catch (err) {
                request.log.error({ err, channel: msg.channel }, "Failed to verify wiki space membership");
                socket.send(
                  JSON.stringify({
                    type: "error",
                    payload: { message: "Authorization check failed" },
                  }),
                );
                return;
              }
            }

            subscribe(socket, msg.channel);
            socket.send(
              JSON.stringify({ type: "subscribed", channel: msg.channel }),
            );
            break;
          }

          case "unsubscribe": {
            if (msg.channel) {
              unsubscribe(socket, msg.channel);
              socket.send(
                JSON.stringify({ type: "unsubscribed", channel: msg.channel }),
              );
            }
            break;
          }

          case "ping": {
            socket.send(JSON.stringify({ type: "pong" }));
            break;
          }

          default:
            socket.send(
              JSON.stringify({
                type: "error",
                payload: { message: `Unknown message type: ${(msg as { type: string }).type}` },
              }),
            );
        }
      });

      // ── Cleanup on disconnect ────────────────────────────────────
      socket.on("close", () => {
        removeConnection(userId, socket);
        unsubscribeAll(socket);
        request.log.info({ userId }, "WebSocket disconnected");
      });

      socket.on("error", (err) => {
        request.log.error({ userId, error: err.message }, "WebSocket error");
        removeConnection(userId, socket);
        unsubscribeAll(socket);
      });
    },
  );
}
