import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Auth } from "../lib/auth";
import type { Database } from "@worknest/db";
import { createRequireAuth } from "../middleware/auth";
import { LabelService } from "../services/label-service";
import {
  createLabelInput,
  updateLabelInput,
} from "@worknest/shared";

// ── Param schemas ──────────────────────────────────────────────────────

const projectIdParam = z.object({ projectId: z.string().uuid() });
const labelIdParam = z.object({
  projectId: z.string().uuid(),
  labelId: z.string().uuid(),
});

/**
 * Label routes.
 */
export async function labelRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const service = new LabelService(db);

  // ── GET /api/v1/projects/:projectId/labels ────────────────────────

  app.get(
    "/api/v1/projects/:projectId/labels",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Labels"],
        summary: "List labels for a project",
      },
    },
    async (request, reply) => {
      const { projectId } = projectIdParam.parse(request.params);
      const result = await service.list(projectId, request.user!.id);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/projects/:projectId/labels ───────────────────────

  app.post(
    "/api/v1/projects/:projectId/labels",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Labels"],
        summary: "Create a label (admin/member only)",
      },
    },
    async (request, reply) => {
      const { projectId } = projectIdParam.parse(request.params);
      const body = createLabelInput.parse(request.body);
      const label = await service.create(projectId, request.user!.id, body);
      return reply.status(201).send({ data: label });
    },
  );

  // ── PATCH /api/v1/projects/:projectId/labels/:labelId ─────────────

  app.patch(
    "/api/v1/projects/:projectId/labels/:labelId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Labels"],
        summary: "Update a label (admin/member only)",
      },
    },
    async (request, reply) => {
      const { labelId } = labelIdParam.parse(request.params);
      const body = updateLabelInput.parse(request.body);
      const label = await service.update(labelId, request.user!.id, body);
      return reply.status(200).send({ data: label });
    },
  );

  // ── DELETE /api/v1/projects/:projectId/labels/:labelId ────────────

  app.delete(
    "/api/v1/projects/:projectId/labels/:labelId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Labels"],
        summary: "Delete a label (admin only)",
      },
    },
    async (request, reply) => {
      const { labelId } = labelIdParam.parse(request.params);
      await service.delete(labelId, request.user!.id);
      return reply.status(204).send();
    },
  );
}
