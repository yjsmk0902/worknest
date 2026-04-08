import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Auth } from "../lib/auth";
import type { Database } from "@worknest/db";
import { createRequireAuth } from "../middleware/auth";
import { ViewService } from "../services/view-service";
import {
  createViewInput,
  updateViewInput,
} from "@worknest/shared";

// ── Param schemas ──────────────────────────────────────────────────────

const projectIdParam = z.object({ projectId: z.string().uuid() });
const viewIdParam = z.object({ viewId: z.string().uuid() });

/**
 * View routes.
 *
 * CRUD endpoints for project-scoped saved views (filters, sorts, grouping).
 */
export async function viewRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const service = new ViewService(db);

  // ── GET /api/v1/projects/:projectId/views ────────────────────────

  app.get(
    "/api/v1/projects/:projectId/views",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Views"],
        summary: "List views for a project",
      },
    },
    async (request, reply) => {
      const { projectId } = projectIdParam.parse(request.params);
      const result = await service.list(projectId, request.user!.id);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/projects/:projectId/views ───────────────────────

  app.post(
    "/api/v1/projects/:projectId/views",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Views"],
        summary: "Create a new view",
      },
    },
    async (request, reply) => {
      const { projectId } = projectIdParam.parse(request.params);
      const body = createViewInput.parse(request.body);
      const view = await service.create(projectId, request.user!.id, body);
      return reply.status(201).send({ data: view });
    },
  );

  // ── GET /api/v1/views/:viewId ───────────────────────────────────

  app.get(
    "/api/v1/views/:viewId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Views"],
        summary: "Get a view by ID",
      },
    },
    async (request, reply) => {
      const { viewId } = viewIdParam.parse(request.params);
      const view = await service.getById(viewId, request.user!.id);
      return reply.status(200).send({ data: view });
    },
  );

  // ── PATCH /api/v1/views/:viewId ──────────────────────────────────

  app.patch(
    "/api/v1/views/:viewId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Views"],
        summary: "Update a view",
      },
    },
    async (request, reply) => {
      const { viewId } = viewIdParam.parse(request.params);
      const body = updateViewInput.parse(request.body);
      const view = await service.update(viewId, request.user!.id, body);
      return reply.status(200).send({ data: view });
    },
  );

  // ── DELETE /api/v1/views/:viewId ─────────────────────────────────

  app.delete(
    "/api/v1/views/:viewId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Views"],
        summary: "Delete a view",
      },
    },
    async (request, reply) => {
      const { viewId } = viewIdParam.parse(request.params);
      await service.delete(viewId, request.user!.id);
      return reply.status(204).send();
    },
  );
}
