import type { FastifyInstance } from "fastify";
import type { Auth } from "../lib/auth";
import type { Database } from "@worknest/db";
import { z } from "zod";
import { createRequireAuth } from "../middleware/auth";
import { CycleService } from "../services/cycle-service";
import {
  createCycleInput,
  updateCycleInput,
  addCycleIssueInput,
  completeCycleInput,
} from "@worknest/shared";

// ── Param Schemas ──────────────────────────────────────────────────────

const projectParams = z.object({ projectId: z.string().uuid() });
const cycleParams = z.object({ cycleId: z.string().uuid() });
const cycleIssueParams = z.object({
  cycleId: z.string().uuid(),
  issueId: z.string().uuid(),
});

/**
 * Cycle routes.
 *
 * Project-scoped CRUD:
 *   GET    /api/v1/projects/:projectId/cycles
 *   POST   /api/v1/projects/:projectId/cycles
 *
 * Cycle-level operations:
 *   GET    /api/v1/cycles/:cycleId
 *   PATCH  /api/v1/cycles/:cycleId
 *   DELETE /api/v1/cycles/:cycleId
 *   POST   /api/v1/cycles/:cycleId/activate
 *   POST   /api/v1/cycles/:cycleId/complete
 *   GET    /api/v1/cycles/:cycleId/progress
 *
 * Cycle-issue operations:
 *   POST   /api/v1/cycles/:cycleId/issues
 *   DELETE /api/v1/cycles/:cycleId/issues/:issueId
 *   GET    /api/v1/cycles/:cycleId/issues
 */
export async function cycleRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const service = new CycleService(db);

  // ── GET /api/v1/projects/:projectId/cycles ─────────────────────────

  app.get(
    "/api/v1/projects/:projectId/cycles",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Cycles"],
        summary: "List cycles in a project",
      },
    },
    async (request, reply) => {
      const { projectId } = projectParams.parse(request.params);
      const result = await service.list(projectId, request.user!.id);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/projects/:projectId/cycles ────────────────────────

  app.post(
    "/api/v1/projects/:projectId/cycles",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Cycles"],
        summary: "Create a new cycle in a project",
        body: createCycleInput,
      },
    },
    async (request, reply) => {
      const { projectId } = projectParams.parse(request.params);
      const body = createCycleInput.parse(request.body);
      const cycle = await service.create(projectId, request.user!.id, body);
      return reply.status(201).send({ data: cycle });
    },
  );

  // ── GET /api/v1/cycles/:cycleId ────────────────────────────────────

  app.get(
    "/api/v1/cycles/:cycleId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Cycles"],
        summary: "Get a cycle by ID",
      },
    },
    async (request, reply) => {
      const { cycleId } = cycleParams.parse(request.params);
      const cycle = await service.getById(cycleId, request.user!.id);
      return reply.status(200).send({ data: cycle });
    },
  );

  // ── PATCH /api/v1/cycles/:cycleId ──────────────────────────────────

  app.patch(
    "/api/v1/cycles/:cycleId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Cycles"],
        summary: "Update a cycle",
        body: updateCycleInput,
      },
    },
    async (request, reply) => {
      const { cycleId } = cycleParams.parse(request.params);
      const body = updateCycleInput.parse(request.body);
      const cycle = await service.update(cycleId, request.user!.id, body);
      return reply.status(200).send({ data: cycle });
    },
  );

  // ── DELETE /api/v1/cycles/:cycleId ─────────────────────────────────

  app.delete(
    "/api/v1/cycles/:cycleId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Cycles"],
        summary: "Delete a draft cycle",
      },
    },
    async (request, reply) => {
      const { cycleId } = cycleParams.parse(request.params);
      await service.delete(cycleId, request.user!.id);
      return reply.status(204).send();
    },
  );

  // ── POST /api/v1/cycles/:cycleId/activate ──────────────────────────

  app.post(
    "/api/v1/cycles/:cycleId/activate",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Cycles"],
        summary: "Activate a cycle (only one active per project)",
      },
    },
    async (request, reply) => {
      const { cycleId } = cycleParams.parse(request.params);
      const cycle = await service.activate(cycleId, request.user!.id);
      return reply.status(200).send({ data: cycle });
    },
  );

  // ── POST /api/v1/cycles/:cycleId/complete ──────────────────────────

  app.post(
    "/api/v1/cycles/:cycleId/complete",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Cycles"],
        summary: "Complete a cycle with optional carryover to target cycle",
        body: completeCycleInput,
      },
    },
    async (request, reply) => {
      const { cycleId } = cycleParams.parse(request.params);
      const body = completeCycleInput.parse(request.body);
      const cycle = await service.complete(cycleId, request.user!.id, body);
      return reply.status(200).send({ data: cycle });
    },
  );

  // ── GET /api/v1/cycles/:cycleId/progress ───────────────────────────

  app.get(
    "/api/v1/cycles/:cycleId/progress",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Cycles"],
        summary: "Get cycle progress (issues by status category)",
      },
    },
    async (request, reply) => {
      const { cycleId } = cycleParams.parse(request.params);
      const progress = await service.getProgress(cycleId, request.user!.id);
      return reply.status(200).send({ data: progress });
    },
  );

  // ── POST /api/v1/cycles/:cycleId/issues ────────────────────────────

  app.post(
    "/api/v1/cycles/:cycleId/issues",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Cycles"],
        summary: "Add an issue to a cycle",
        body: addCycleIssueInput,
      },
    },
    async (request, reply) => {
      const { cycleId } = cycleParams.parse(request.params);
      const { issueId } = addCycleIssueInput.parse(request.body);
      const cycleIssue = await service.addIssue(
        cycleId,
        request.user!.id,
        issueId,
      );
      return reply.status(201).send({ data: cycleIssue });
    },
  );

  // ── DELETE /api/v1/cycles/:cycleId/issues/:issueId ─────────────────

  app.delete(
    "/api/v1/cycles/:cycleId/issues/:issueId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Cycles"],
        summary: "Remove an issue from a cycle",
      },
    },
    async (request, reply) => {
      const { cycleId, issueId } = cycleIssueParams.parse(request.params);
      await service.removeIssue(cycleId, request.user!.id, issueId);
      return reply.status(204).send();
    },
  );

  // ── GET /api/v1/cycles/:cycleId/issues ─────────────────────────────

  app.get(
    "/api/v1/cycles/:cycleId/issues",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Cycles"],
        summary: "List active issues in a cycle",
      },
    },
    async (request, reply) => {
      const { cycleId } = cycleParams.parse(request.params);
      const result = await service.listIssues(cycleId, request.user!.id);
      return reply.status(200).send(result);
    },
  );
}
