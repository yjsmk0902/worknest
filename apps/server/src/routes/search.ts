import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { Auth } from "../lib/auth";
import { workspaceMembers, type Database } from "@worknest/db";
import { createRequireAuth } from "../middleware/auth";
import { SearchService } from "../services/search-service";
import { searchQuery } from "@worknest/shared";
import { AppError } from "../lib/errors";

// ── Param Schemas ──────────────────────────────────────────────────────

const workspaceIdParam = z.object({ workspaceId: z.string().uuid() });

/**
 * Search routes.
 *
 * Mounted under /api/v1/workspaces/:workspaceId/search
 */
export async function searchRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const service = new SearchService(db);

  // ── GET /api/v1/workspaces/:workspaceId/search ──────────────────────

  app.get(
    "/api/v1/workspaces/:workspaceId/search",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Search"],
        summary: "Search issues, wiki pages, and projects in a workspace",
        params: workspaceIdParam,
        querystring: searchQuery,
      },
    },
    async (request, reply) => {
      const { workspaceId } = workspaceIdParam.parse(request.params);
      const callerUserId = request.user!.id;

      // Verify caller is a workspace member
      const member = await db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, callerUserId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!member) {
        throw AppError.forbidden("You are not a member of this workspace");
      }

      const query = searchQuery.parse(request.query);
      const result = await service.search(workspaceId, callerUserId, query);
      return reply.status(200).send({ data: result });
    },
  );
}
