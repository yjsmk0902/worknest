import type { FastifyInstance } from "fastify";
import type { Auth } from "../lib/auth";
import type { Database } from "@worknest/db";
import { createRequireAuth } from "../middleware/auth";
import { updateProfileInput } from "@worknest/shared";
import { users } from "@worknest/db";
import { eq } from "drizzle-orm";
import { AppError } from "../lib/errors";

/**
 * Profile routes for the currently authenticated user.
 *
 * - GET  /api/v1/my/profile
 * - PATCH /api/v1/my/profile
 */
export async function profileRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);

  // ── GET /api/v1/my/profile ─────────────────────────────────────────

  app.get(
    "/api/v1/my/profile",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Profile"],
        summary: "Get current user profile",
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .then((rows) => rows[0]);

      if (!user) {
        throw AppError.notFound("user");
      }

      return reply.status(200).send({
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt.toISOString(),
        },
      });
    },
  );

  // ── PATCH /api/v1/my/profile ───────────────────────────────────────

  app.patch(
    "/api/v1/my/profile",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Profile"],
        summary: "Update current user profile",
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const body = updateProfileInput.parse(request.body);

      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (body.name !== undefined) updates.name = body.name;
      if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;

      const updated = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, userId))
        .returning()
        .then((rows) => rows[0]);

      if (!updated) {
        throw AppError.notFound("user");
      }

      return reply.status(200).send({
        data: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          avatarUrl: updated.avatarUrl,
          createdAt: updated.createdAt.toISOString(),
        },
      });
    },
  );
}
