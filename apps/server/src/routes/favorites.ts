import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Auth } from "../lib/auth";
import type { Database } from "@worknest/db";
import { createRequireAuth } from "../middleware/auth";
import { FavoriteService } from "../services/favorite-service";
import { createFavoriteInput, updateFavoriteInput } from "@worknest/shared";

// ── Param Schemas ──────────────────────────────────────────────────────

const favoriteIdParam = z.object({ favoriteId: z.string().uuid() });

/**
 * Favorites routes.
 *
 * User-scoped bookmark management for quick access to projects, issues,
 * wiki pages, or wiki spaces.
 */
export async function favoriteRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const service = new FavoriteService(db);

  // ── GET /api/v1/my/favorites ────────────────────────────────────────

  app.get(
    "/api/v1/my/favorites",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Favorites"],
        summary: "List the current user's favorites",
      },
    },
    async (request, reply) => {
      const result = await service.list(request.user!.id);
      return reply.status(200).send({ data: result });
    },
  );

  // ── POST /api/v1/my/favorites ───────────────────────────────────────

  app.post(
    "/api/v1/my/favorites",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Favorites"],
        summary: "Add an item to favorites",
      },
    },
    async (request, reply) => {
      const body = createFavoriteInput.parse(request.body);
      const result = await service.create(request.user!.id, body);
      return reply.status(201).send({ data: result });
    },
  );

  // ── PATCH /api/v1/favorites/:favoriteId ─────────────────────────────

  app.patch(
    "/api/v1/favorites/:favoriteId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Favorites"],
        summary: "Update a favorite's sort order (for drag-and-drop reorder)",
      },
    },
    async (request, reply) => {
      const { favoriteId } = favoriteIdParam.parse(request.params);
      const body = updateFavoriteInput.parse(request.body);
      const result = await service.update(
        favoriteId,
        request.user!.id,
        body,
      );
      return reply.status(200).send({ data: result });
    },
  );

  // ── DELETE /api/v1/favorites/:favoriteId ─────────────────────────────

  app.delete(
    "/api/v1/favorites/:favoriteId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Favorites"],
        summary: "Remove an item from favorites",
      },
    },
    async (request, reply) => {
      const { favoriteId } = favoriteIdParam.parse(request.params);
      await service.delete(favoriteId, request.user!.id);
      return reply.status(204).send();
    },
  );
}
