import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Auth } from "../lib/auth";
import type { Database } from "@worknest/db";
import { createRequireAuth, createRequireWsRole } from "../middleware/auth";
import { WorkspaceService } from "../services/workspace-service";
import {
  createWorkspaceInput,
  updateWorkspaceInput,
  createWsInvitationInput,
  updateWsMemberInput,
  cursorPaginationQuery,
  uuidParam,
} from "@worknest/shared";

// ── Param schemas for nested routes ────────────────────────────────────

const orgIdParam = z.object({ orgId: z.string().uuid() });
const wsIdParam = z.object({ id: z.string().uuid() });

/**
 * Workspace routes.
 */
export async function workspaceRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const requireWsAdmin = createRequireWsRole(db, "admin");
  const requireWsMember = createRequireWsRole(db, "member");
  const service = new WorkspaceService(db);

  // ── GET /api/v1/organizations/:orgId/workspaces ────────────────────

  app.get(
    "/api/v1/organizations/:orgId/workspaces",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Workspaces"],
        summary: "List workspaces in an organization",
        params: orgIdParam,
        querystring: cursorPaginationQuery,
      },
    },
    async (request, reply) => {
      const { orgId } = orgIdParam.parse(request.params);
      const pagination = cursorPaginationQuery.parse(request.query);
      const result = await service.listByOrg(orgId, request.user!.id, pagination);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/organizations/:orgId/workspaces ───────────────────

  app.post(
    "/api/v1/organizations/:orgId/workspaces",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Workspaces"],
        summary: "Create a new workspace (org admin+ required)",
        params: orgIdParam,
        body: createWorkspaceInput,
      },
    },
    async (request, reply) => {
      const { orgId } = orgIdParam.parse(request.params);
      const body = createWorkspaceInput.parse(request.body);
      const ws = await service.create(orgId, request.user!.id, body);
      return reply.status(201).send({ data: ws });
    },
  );

  // ── GET /api/v1/workspaces/:id ─────────────────────────────────────

  app.get(
    "/api/v1/workspaces/:id",
    {
      preHandler: [requireAuth, requireWsMember],
      schema: {
        tags: ["Workspaces"],
        summary: "Get workspace details",
        params: wsIdParam,
      },
    },
    async (request, reply) => {
      const { id } = wsIdParam.parse(request.params);
      const ws = await service.getById(id);
      return reply.status(200).send({ data: ws });
    },
  );

  // ── PATCH /api/v1/workspaces/:id ───────────────────────────────────

  app.patch(
    "/api/v1/workspaces/:id",
    {
      preHandler: [requireAuth, requireWsAdmin],
      schema: {
        tags: ["Workspaces"],
        summary: "Update workspace (admin only)",
        params: wsIdParam,
        body: updateWorkspaceInput,
      },
    },
    async (request, reply) => {
      const { id } = wsIdParam.parse(request.params);
      const body = updateWorkspaceInput.parse(request.body);
      const ws = await service.update(id, body);
      return reply.status(200).send({ data: ws });
    },
  );

  // ── DELETE /api/v1/workspaces/:id ──────────────────────────────────

  app.delete(
    "/api/v1/workspaces/:id",
    {
      preHandler: [requireAuth, requireWsAdmin],
      schema: {
        tags: ["Workspaces"],
        summary: "Soft delete workspace (admin only)",
        params: wsIdParam,
      },
    },
    async (request, reply) => {
      const { id } = wsIdParam.parse(request.params);
      await service.softDelete(id, request.user!.id);
      return reply.status(204).send();
    },
  );

  // ── GET /api/v1/workspaces/:id/members ─────────────────────────────

  app.get(
    "/api/v1/workspaces/:id/members",
    {
      preHandler: [requireAuth, requireWsMember],
      schema: {
        tags: ["Workspaces"],
        summary: "List workspace members",
        params: wsIdParam,
        querystring: cursorPaginationQuery,
      },
    },
    async (request, reply) => {
      const { id } = wsIdParam.parse(request.params);
      const pagination = cursorPaginationQuery.parse(request.query);
      const result = await service.listMembers(id, pagination);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/workspaces/:id/invitations ────────────────────────

  app.post(
    "/api/v1/workspaces/:id/invitations",
    {
      preHandler: [requireAuth, requireWsAdmin],
      schema: {
        tags: ["Workspaces"],
        summary: "Create a workspace invitation",
        params: wsIdParam,
        body: createWsInvitationInput,
      },
    },
    async (request, reply) => {
      const { id } = wsIdParam.parse(request.params);
      const body = createWsInvitationInput.parse(request.body);
      const result = await service.createInvitation(id, request.user!.id, body);
      return reply.status(201).send({ data: result.invitation });
    },
  );

  // ── GET /api/v1/workspaces/:id/invitations ─────────────────────────

  app.get(
    "/api/v1/workspaces/:id/invitations",
    {
      preHandler: [requireAuth, requireWsAdmin],
      schema: {
        tags: ["Workspaces"],
        summary: "List pending workspace invitations",
        params: wsIdParam,
        querystring: cursorPaginationQuery,
      },
    },
    async (request, reply) => {
      const { id } = wsIdParam.parse(request.params);
      const pagination = cursorPaginationQuery.parse(request.query);
      const result = await service.listInvitations(id, pagination);
      return reply.status(200).send(result);
    },
  );

  // ── PATCH /api/v1/workspace-members/:id ────────────────────────────

  app.patch(
    "/api/v1/workspace-members/:id",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Workspaces"],
        summary: "Change a workspace member's role",
        params: uuidParam,
        body: updateWsMemberInput,
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      const body = updateWsMemberInput.parse(request.body);
      await service.updateMemberRole(id, body.role);
      return reply.status(200).send({ data: { success: true } });
    },
  );

  // ── DELETE /api/v1/workspace-members/:id ────────────────────────────

  app.delete(
    "/api/v1/workspace-members/:id",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Workspaces"],
        summary: "Remove a member from the workspace",
        params: uuidParam,
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      await service.removeMember(id);
      return reply.status(204).send();
    },
  );
}
