import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { Auth } from "../lib/auth";
import {
  issueTypes,
  projectMembers,
  type Database,
} from "@worknest/db";
import { createRequireAuth } from "../middleware/auth";
import { AppError } from "../lib/errors";

// ── Param schemas ──────────────────────────────────────────────────────

const projectIdParam = z.object({ projectId: z.string().uuid() });
const typeIdParam = z.object({
  projectId: z.string().uuid(),
  typeId: z.string().uuid(),
});

// ── Update schema ──────────────────────────────────────────────────────

const updateIssueTypeInput = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().min(1).max(10).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color")
    .optional(),
});

/**
 * Issue type routes.
 */
export async function issueTypeRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);

  // ── GET /api/v1/projects/:projectId/types ─────────────────────────

  app.get(
    "/api/v1/projects/:projectId/types",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issue Types"],
        summary: "List issue types for a project",
        params: projectIdParam,
      },
    },
    async (request, reply) => {
      const { projectId } = projectIdParam.parse(request.params);

      // Verify membership
      const member = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, request.user!.id),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!member) {
        throw AppError.forbidden("You are not a member of this project");
      }

      const rows = await db
        .select()
        .from(issueTypes)
        .where(eq(issueTypes.projectId, projectId))
        .orderBy(issueTypes.sortOrder);

      return reply.status(200).send({
        data: rows.map((row) => ({
          id: row.id,
          projectId: row.projectId,
          name: row.name,
          icon: row.icon,
          color: row.color,
          sortOrder: row.sortOrder,
        })),
      });
    },
  );

  // ── PATCH /api/v1/projects/:projectId/types/:typeId ───────────────

  app.patch(
    "/api/v1/projects/:projectId/types/:typeId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issue Types"],
        summary: "Update an issue type (admin only)",
        params: typeIdParam,
        body: updateIssueTypeInput,
      },
    },
    async (request, reply) => {
      const { projectId, typeId } = typeIdParam.parse(request.params);
      const body = updateIssueTypeInput.parse(request.body);

      // Verify admin
      const member = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, request.user!.id),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!member || member.role !== "admin") {
        throw AppError.forbidden("Only project admins can update issue types");
      }

      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.icon !== undefined) updates.icon = body.icon;
      if (body.color !== undefined) updates.color = body.color;

      const [updated] = await db
        .update(issueTypes)
        .set(updates)
        .where(
          and(
            eq(issueTypes.id, typeId),
            eq(issueTypes.projectId, projectId),
          ),
        )
        .returning();

      if (!updated) {
        throw AppError.notFound("issue type");
      }

      return reply.status(200).send({
        data: {
          id: updated.id,
          projectId: updated.projectId,
          name: updated.name,
          icon: updated.icon,
          color: updated.color,
          sortOrder: updated.sortOrder,
        },
      });
    },
  );
}
