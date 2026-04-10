import type { FastifyInstance } from "fastify";
import type { Auth } from "../lib/auth";
import type { Database } from "@worknest/db";
import { z } from "zod";
import { createRequireAuth } from "../middleware/auth";
import { IssueService } from "../services/issue-service";
import { ActivityService } from "../services/activity-service";
import {
  createIssueInput,
  updateIssueInput,
  issueListQuery,
  bulkUpdateInput,
  cursorPaginationQuery,
} from "@worknest/shared";

// ── Param Schemas ──────────────────────────────────────────────────────

const projectParams = z.object({ projectId: z.string().uuid() });
const projectIssueParams = z.object({
  projectId: z.string().uuid(),
  issueId: z.string().uuid(),
});
const assigneeRemoveParams = z.object({
  projectId: z.string().uuid(),
  issueId: z.string().uuid(),
  userId: z.string().min(1),
});
const labelRemoveParams = z.object({
  projectId: z.string().uuid(),
  issueId: z.string().uuid(),
  labelId: z.string().uuid(),
});

// ── Body Schemas ───────────────────────────────────────────────────────

const addAssigneeBody = z.object({ userId: z.string().min(1) });
const addLabelBody = z.object({ labelId: z.string().uuid() });

/**
 * Issue routes.
 *
 * Mounted under /api/v1/projects/:projectId/issues
 */
export async function issueRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const service = new IssueService(db);
  const activityService = new ActivityService(db);

  // ── POST /api/v1/projects/:projectId/issues ───────────────────────

  app.post(
    "/api/v1/projects/:projectId/issues",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issues"],
        summary: "Create a new issue in a project",
      },
    },
    async (request, reply) => {
      const { projectId } = projectParams.parse(request.params);
      const body = createIssueInput.parse(request.body);
      const issue = await service.create(projectId, request.user!.id, body);
      return reply.status(201).send({ data: issue });
    },
  );

  // ── GET /api/v1/projects/:projectId/issues ────────────────────────

  app.get(
    "/api/v1/projects/:projectId/issues",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issues"],
        summary: "List issues in a project with optional filters, sorting, and cursor pagination",
      },
    },
    async (request, reply) => {
      const { projectId } = projectParams.parse(request.params);
      const query = issueListQuery.parse(request.query);
      const result = await service.list(projectId, request.user!.id, query);
      return reply.status(200).send(result);
    },
  );

  // ── GET /api/v1/projects/:projectId/issues/stats ───────────────────

  app.get(
    "/api/v1/projects/:projectId/issues/stats",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issues"],
        summary: "Get issue count stats grouped by status",
      },
    },
    async (request, reply) => {
      const { projectId } = projectParams.parse(request.params);
      const query = issueListQuery.parse(request.query);
      const result = await service.stats(projectId, request.user!.id, query);
      return reply.status(200).send(result);
    },
  );

  // ── PATCH /api/v1/projects/:projectId/issues/bulk ─────────────────

  app.patch(
    "/api/v1/projects/:projectId/issues/bulk",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issues"],
        summary: "Bulk update multiple issues",
      },
    },
    async (request, reply) => {
      const { projectId } = projectParams.parse(request.params);
      const body = bulkUpdateInput.parse(request.body);
      const result = await service.bulkUpdate(projectId, request.user!.id, body);
      return reply.status(200).send({ data: result });
    },
  );

  // ── GET /api/v1/projects/:projectId/issues/:issueId ───────────────

  app.get(
    "/api/v1/projects/:projectId/issues/:issueId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issues"],
        summary: "Get an issue by ID",
      },
    },
    async (request, reply) => {
      const { issueId } = projectIssueParams.parse(request.params);
      const issue = await service.getById(issueId, request.user!.id);
      return reply.status(200).send({ data: issue });
    },
  );

  // ── PATCH /api/v1/projects/:projectId/issues/:issueId ─────────────

  app.patch(
    "/api/v1/projects/:projectId/issues/:issueId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issues"],
        summary: "Update an issue",
      },
    },
    async (request, reply) => {
      const { issueId } = projectIssueParams.parse(request.params);
      const body = updateIssueInput.parse(request.body);
      const issue = await service.update(issueId, request.user!.id, body);
      return reply.status(200).send({ data: issue });
    },
  );

  // ── DELETE /api/v1/projects/:projectId/issues/:issueId ────────────

  app.delete(
    "/api/v1/projects/:projectId/issues/:issueId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issues"],
        summary: "Soft delete an issue",
      },
    },
    async (request, reply) => {
      const { issueId } = projectIssueParams.parse(request.params);
      await service.softDelete(issueId, request.user!.id);
      return reply.status(204).send();
    },
  );

  // ── GET /api/v1/projects/:projectId/issues/:issueId/sub-issues ────

  app.get(
    "/api/v1/projects/:projectId/issues/:issueId/sub-issues",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issues"],
        summary: "List sub-issues for an issue",
      },
    },
    async (request, reply) => {
      const { issueId } = projectIssueParams.parse(request.params);
      const result = await service.listSubIssues(issueId, request.user!.id);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/projects/:projectId/issues/:issueId/assignees ────

  app.post(
    "/api/v1/projects/:projectId/issues/:issueId/assignees",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issues"],
        summary: "Add an assignee to an issue",
      },
    },
    async (request, reply) => {
      const { issueId } = projectIssueParams.parse(request.params);
      const { userId } = addAssigneeBody.parse(request.body);
      const assignee = await service.addAssignee(issueId, request.user!.id, userId);
      return reply.status(201).send({ data: assignee });
    },
  );

  // ── DELETE /api/v1/projects/:projectId/issues/:issueId/assignees/:userId

  app.delete(
    "/api/v1/projects/:projectId/issues/:issueId/assignees/:userId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issues"],
        summary: "Remove an assignee from an issue",
      },
    },
    async (request, reply) => {
      const { issueId, userId } = assigneeRemoveParams.parse(request.params);
      await service.removeAssignee(issueId, request.user!.id, userId);
      return reply.status(204).send();
    },
  );

  // ── POST /api/v1/projects/:projectId/issues/:issueId/labels ───────

  app.post(
    "/api/v1/projects/:projectId/issues/:issueId/labels",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issues"],
        summary: "Add a label to an issue",
      },
    },
    async (request, reply) => {
      const { issueId } = projectIssueParams.parse(request.params);
      const { labelId } = addLabelBody.parse(request.body);
      const issueLabel = await service.addLabel(issueId, request.user!.id, labelId);
      return reply.status(201).send({ data: issueLabel });
    },
  );

  // ── DELETE /api/v1/projects/:projectId/issues/:issueId/labels/:labelId

  app.delete(
    "/api/v1/projects/:projectId/issues/:issueId/labels/:labelId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issues"],
        summary: "Remove a label from an issue",
      },
    },
    async (request, reply) => {
      const { issueId, labelId } = labelRemoveParams.parse(request.params);
      await service.removeLabel(issueId, request.user!.id, labelId);
      return reply.status(204).send();
    },
  );

  // ── GET /api/v1/projects/:projectId/issues/:issueId/activities ────

  app.get(
    "/api/v1/projects/:projectId/issues/:issueId/activities",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Issues"],
        summary: "List activities for an issue",
      },
    },
    async (request, reply) => {
      const { issueId } = projectIssueParams.parse(request.params);
      const pagination = cursorPaginationQuery.parse(request.query);
      const result = await activityService.listByIssue(
        issueId,
        request.user!.id,
        pagination.cursor,
        pagination.limit,
      );
      return reply.status(200).send(result);
    },
  );
}
