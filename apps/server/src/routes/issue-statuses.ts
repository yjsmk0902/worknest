import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import type { Auth } from "../lib/auth";
import {
  issueStatuses,
  projectMembers,
  type Database,
} from "@worknest/db";
import { createRequireAuth } from "../middleware/auth";
import { AppError } from "../lib/errors";

// ── Param schemas ──────────────────────────────────────────────────────

const projectIdParam = z.object({ projectId: z.string().uuid() });
const statusIdParam = z.object({
  projectId: z.string().uuid(),
  statusId: z.string().uuid(),
});

// ── Update schema ──────────────────────────────────────────────────────

const updateIssueStatusInput = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color")
    .optional(),
});

/**
 * Issue status routes.
 */
export async function issueStatusRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);

  // ── GET /api/v1/projects/:projectId/statuses ──────────────────────

  app.get(
    "/api/v1/projects/:projectId/statuses",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issue Statuses"],
        summary: "List issue statuses for a project",
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
        .from(issueStatuses)
        .where(eq(issueStatuses.projectId, projectId))
        .orderBy(issueStatuses.sortOrder);

      return reply.status(200).send({
        data: rows.map((row) => ({
          id: row.id,
          projectId: row.projectId,
          name: row.name,
          color: row.color,
          sortOrder: row.sortOrder,
          category: row.category,
          isDefault: row.isDefault,
        })),
      });
    },
  );

  // ── PATCH /api/v1/projects/:projectId/statuses/:statusId ──────────

  app.patch(
    "/api/v1/projects/:projectId/statuses/:statusId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issue Statuses"],
        summary: "Update an issue status (admin only)",
      },
    },
    async (request, reply) => {
      const { projectId, statusId } = statusIdParam.parse(request.params);
      const body = updateIssueStatusInput.parse(request.body);

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
        throw AppError.forbidden("Only project admins can update statuses");
      }

      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.color !== undefined) updates.color = body.color;

      const [updated] = await db
        .update(issueStatuses)
        .set(updates)
        .where(
          and(
            eq(issueStatuses.id, statusId),
            eq(issueStatuses.projectId, projectId),
          ),
        )
        .returning();

      if (!updated) {
        throw AppError.notFound("issue status");
      }

      return reply.status(200).send({
        data: {
          id: updated.id,
          projectId: updated.projectId,
          name: updated.name,
          color: updated.color,
          sortOrder: updated.sortOrder,
          category: updated.category,
          isDefault: updated.isDefault,
        },
      });
    },
  );
}
