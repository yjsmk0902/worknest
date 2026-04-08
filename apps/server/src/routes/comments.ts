import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Auth } from "../lib/auth";
import type { Database } from "@worknest/db";
import { createRequireAuth } from "../middleware/auth";
import { CommentService } from "../services/comment-service";
import {
  createCommentInput,
  updateCommentInput,
  toggleReactionInput,
} from "@worknest/shared";
import {
  broadcastCommentCreated,
  broadcastCommentUpdated,
  broadcastCommentDeleted,
  broadcastReactionToggled,
} from "../websocket/comment-events";

// ── Param Schemas ──────────────────────────────────────────────────────

const issueIdParam = z.object({ issueId: z.string().uuid() });
const pageIdParam = z.object({ pageId: z.string().uuid() });
const commentIdParam = z.object({ commentId: z.string().uuid() });
const reactionEmojiParam = z.object({
  commentId: z.string().uuid(),
  emoji: z.string().min(1),
});

/**
 * Comment and reaction routes.
 *
 * Comments can belong to issues or wiki pages. Reactions are toggled on comments.
 */
export async function commentRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const service = new CommentService(db);

  // ── GET /api/v1/issues/:issueId/comments ─────────────────────────

  app.get(
    "/api/v1/issues/:issueId/comments",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Comments"],
        summary: "List comments for an issue",
      },
    },
    async (request, reply) => {
      const { issueId } = issueIdParam.parse(request.params);
      const result = await service.listByIssue(issueId, request.user!.id);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/issues/:issueId/comments ────────────────────────

  app.post(
    "/api/v1/issues/:issueId/comments",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Comments"],
        summary: "Create a comment on an issue",
      },
    },
    async (request, reply) => {
      const { issueId } = issueIdParam.parse(request.params);
      const body = createCommentInput.parse(request.body);
      const comment = await service.create(
        request.user!.id,
        body,
        issueId,
        undefined,
      );

      // Broadcast via WebSocket
      broadcastCommentCreated(`issue:${issueId}`, comment);

      return reply.status(201).send({ data: comment });
    },
  );

  // ── GET /api/v1/wiki-pages/:pageId/comments ─────────────────────

  app.get(
    "/api/v1/wiki-pages/:pageId/comments",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Comments"],
        summary: "List comments for a wiki page",
      },
    },
    async (request, reply) => {
      const { pageId } = pageIdParam.parse(request.params);
      const result = await service.listByPage(pageId, request.user!.id);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/wiki-pages/:pageId/comments ────────────────────

  app.post(
    "/api/v1/wiki-pages/:pageId/comments",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Comments"],
        summary: "Create a comment on a wiki page",
      },
    },
    async (request, reply) => {
      const { pageId } = pageIdParam.parse(request.params);
      const body = createCommentInput.parse(request.body);
      const comment = await service.create(
        request.user!.id,
        body,
        undefined,
        pageId,
      );

      // Broadcast via WebSocket
      broadcastCommentCreated(`page:${pageId}`, comment);

      return reply.status(201).send({ data: comment });
    },
  );

  // ── GET /api/v1/comments/:commentId ──────────────────────────────

  app.get(
    "/api/v1/comments/:commentId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Comments"],
        summary: "Get a comment by ID",
      },
    },
    async (request, reply) => {
      const { commentId } = commentIdParam.parse(request.params);
      const comment = await service.getById(commentId, request.user!.id);
      return reply.status(200).send({ data: comment });
    },
  );

  // ── PATCH /api/v1/comments/:commentId ────────────────────────────

  app.patch(
    "/api/v1/comments/:commentId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Comments"],
        summary: "Update a comment (author only)",
      },
    },
    async (request, reply) => {
      const { commentId } = commentIdParam.parse(request.params);
      const body = updateCommentInput.parse(request.body);
      const comment = await service.update(
        commentId,
        request.user!.id,
        body,
      );

      // Broadcast via WebSocket
      const channel = service.getChannel(comment);
      broadcastCommentUpdated(channel, comment);

      return reply.status(200).send({ data: comment });
    },
  );

  // ── DELETE /api/v1/comments/:commentId ───────────────────────────

  app.delete(
    "/api/v1/comments/:commentId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Comments"],
        summary: "Soft delete a comment (author only)",
      },
    },
    async (request, reply) => {
      const { commentId } = commentIdParam.parse(request.params);
      const deleted = await service.delete(commentId, request.user!.id);

      // Broadcast via WebSocket
      const channel = service.getChannel(deleted);
      broadcastCommentDeleted(channel, { id: commentId });

      return reply.status(204).send();
    },
  );

  // ── POST /api/v1/comments/:commentId/reactions ───────────────────

  app.post(
    "/api/v1/comments/:commentId/reactions",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Reactions"],
        summary: "Toggle a reaction on a comment",
      },
    },
    async (request, reply) => {
      const { commentId } = commentIdParam.parse(request.params);
      const body = toggleReactionInput.parse(request.body);
      const result = await service.toggleReaction(
        commentId,
        request.user!.id,
        body,
      );

      // Get comment for channel info
      const comment = await service.getById(commentId, request.user!.id);
      const channel = service.getChannel(comment);
      broadcastReactionToggled(channel, {
        commentId,
        emoji: result.emoji,
        added: result.added,
        userId: request.user!.id,
      });

      return reply.status(200).send({ data: result });
    },
  );

  // ── DELETE /api/v1/comments/:commentId/reactions/:emoji ──────────

  app.delete(
    "/api/v1/comments/:commentId/reactions/:emoji",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Reactions"],
        summary: "Remove a specific reaction from a comment",
      },
    },
    async (request, reply) => {
      const { commentId, emoji } = reactionEmojiParam.parse(request.params);

      // Get comment info before deletion for the broadcast channel
      const comment = await service.getById(commentId, request.user!.id);

      await service.removeReaction(commentId, request.user!.id, emoji);

      const channel = service.getChannel(comment);
      broadcastReactionToggled(channel, {
        commentId,
        emoji,
        added: false,
        userId: request.user!.id,
      });

      return reply.status(204).send();
    },
  );
}
