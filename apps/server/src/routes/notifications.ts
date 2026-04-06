import type { FastifyInstance } from "fastify";
import type { Auth } from "../lib/auth";
import type { Database } from "@worknest/db";
import { z } from "zod";
import { createRequireAuth } from "../middleware/auth";
import { NotificationService } from "../services/notification-service";
import { cursorPaginationQuery } from "@worknest/shared";
import { AppError } from "../lib/errors";

// ── Param Schemas ──────────────────────────────────────────────────────

const notificationParams = z.object({
  notificationId: z.string().uuid(),
});

/**
 * Notification routes for the currently authenticated user.
 *
 * - GET    /api/v1/my/notifications              — list notifications (cursor pagination)
 * - GET    /api/v1/my/notifications/unread-count  — unread count
 * - PATCH  /api/v1/notifications/:notificationId  — mark as read
 * - PATCH  /api/v1/my/notifications/read-all      — mark all as read
 * - DELETE /api/v1/notifications/:notificationId  — delete notification
 */
export async function notificationRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const service = new NotificationService(db);

  // ── GET /api/v1/my/notifications ──────────────────────────────────

  app.get(
    "/api/v1/my/notifications",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Notifications"],
        summary: "List notifications for current user",
        querystring: cursorPaginationQuery,
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const { cursor, limit } = cursorPaginationQuery.parse(request.query);

      const result = await service.list(userId, cursor, limit);
      return reply.status(200).send(result);
    },
  );

  // ── GET /api/v1/my/notifications/unread-count ─────────────────────

  app.get(
    "/api/v1/my/notifications/unread-count",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Notifications"],
        summary: "Get unread notification count",
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const count = await service.getUnreadCount(userId);
      return reply.status(200).send({ data: { count } });
    },
  );

  // ── PATCH /api/v1/notifications/:notificationId ───────────────────

  app.patch(
    "/api/v1/notifications/:notificationId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Notifications"],
        summary: "Mark a notification as read",
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const { notificationId } = notificationParams.parse(request.params);

      const updated = await service.markAsRead(notificationId, userId);
      if (!updated) {
        throw AppError.notFound("notification");
      }

      return reply.status(200).send({
        data: {
          id: updated.id,
          userId: updated.userId,
          issueId: updated.issueId,
          pageId: updated.pageId,
          type: updated.type,
          message: updated.message,
          readAt: updated.readAt?.toISOString() ?? null,
          createdAt: updated.createdAt.toISOString(),
        },
      });
    },
  );

  // ── PATCH /api/v1/my/notifications/read-all ───────────────────────

  app.patch(
    "/api/v1/my/notifications/read-all",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Notifications"],
        summary: "Mark all notifications as read",
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const updatedCount = await service.markAllAsRead(userId);

      return reply.status(200).send({
        data: { updated: updatedCount },
      });
    },
  );

  // ── DELETE /api/v1/notifications/:notificationId ──────────────────

  app.delete(
    "/api/v1/notifications/:notificationId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Notifications"],
        summary: "Delete a notification",
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const { notificationId } = notificationParams.parse(request.params);

      const deleted = await service.delete(notificationId, userId);
      if (!deleted) {
        throw AppError.notFound("notification");
      }

      return reply.status(204).send();
    },
  );
}
