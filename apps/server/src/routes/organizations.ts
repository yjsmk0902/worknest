import type { FastifyInstance } from "fastify";
import type { Auth } from "../lib/auth";
import type { Database } from "@worknest/db";
import { createRequireAuth, createRequireOrgRole } from "../middleware/auth";
import { OrganizationService } from "../services/organization-service";
import {
  createOrganizationInput,
  updateOrganizationInput,
  createOrgInvitationInput,
  updateOrgMemberInput,
  cursorPaginationQuery,
  uuidParam,
} from "@worknest/shared";

/**
 * Organization routes.
 */
export async function organizationRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const requireAdmin = createRequireOrgRole(db, "admin");
  const requireMember = createRequireOrgRole(db, "member");
  const service = new OrganizationService(db);

  // ── GET /api/v1/organizations ──────────────────────────────────────

  app.get(
    "/api/v1/organizations",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Organizations"],
        summary: "List organizations the current user belongs to",
      },
    },
    async (request, reply) => {
      const pagination = cursorPaginationQuery.parse(request.query);
      const result = await service.listByUser(request.user!.id, pagination);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/organizations ─────────────────────────────────────

  app.post(
    "/api/v1/organizations",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Organizations"],
        summary: "Create a new organization (creator becomes owner)",
      },
    },
    async (request, reply) => {
      const body = createOrganizationInput.parse(request.body);
      const org = await service.create(request.user!.id, body);
      return reply.status(201).send({ data: org });
    },
  );

  // ── GET /api/v1/organizations/by-slug/:slug ────────────────────────

  app.get(
    "/api/v1/organizations/by-slug/:slug",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Organizations"],
        summary: "Get organization details by slug (current user must be a member)",
      },
    },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const org = await service.getBySlug(slug, request.user!.id);
      return reply.status(200).send({ data: org });
    },
  );

  // ── GET /api/v1/organizations/:id ──────────────────────────────────

  app.get(
    "/api/v1/organizations/:id",
    {
      preHandler: [requireAuth, requireMember],
      schema: {
        tags: ["Organizations"],
        summary: "Get organization details",
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      const org = await service.getById(id);
      return reply.status(200).send({ data: org });
    },
  );

  // ── PATCH /api/v1/organizations/:id ────────────────────────────────

  app.patch(
    "/api/v1/organizations/:id",
    {
      preHandler: [requireAuth, requireAdmin],
      schema: {
        tags: ["Organizations"],
        summary: "Update organization (admin+)",
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      const body = updateOrganizationInput.parse(request.body);
      const org = await service.update(id, body);
      return reply.status(200).send({ data: org });
    },
  );

  // ── DELETE /api/v1/organizations/:id ───────────────────────────────
  // Owner check is enforced in service.softDelete()

  app.delete(
    "/api/v1/organizations/:id",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Organizations"],
        summary: "Soft delete organization (owner only)",
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      await service.softDelete(id, request.user!.id);
      return reply.status(204).send();
    },
  );

  // ── GET /api/v1/organizations/:id/members ──────────────────────────

  app.get(
    "/api/v1/organizations/:id/members",
    {
      preHandler: [requireAuth, requireMember],
      schema: {
        tags: ["Organizations"],
        summary: "List organization members",
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      const pagination = cursorPaginationQuery.parse(request.query);
      const result = await service.listMembers(id, pagination);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/organizations/:id/invitations ─────────────────────

  app.post(
    "/api/v1/organizations/:id/invitations",
    {
      preHandler: [requireAuth, requireAdmin],
      schema: {
        tags: ["Organizations"],
        summary: "Create an invitation to the organization",
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      const body = createOrgInvitationInput.parse(request.body);
      const result = await service.createInvitation(id, request.user!.id, body);
      return reply.status(201).send({ data: result.invitation });
    },
  );

  // ── GET /api/v1/organizations/:id/invitations ──────────────────────

  app.get(
    "/api/v1/organizations/:id/invitations",
    {
      preHandler: [requireAuth, requireAdmin],
      schema: {
        tags: ["Organizations"],
        summary: "List pending invitations for the organization",
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      const pagination = cursorPaginationQuery.parse(request.query);
      const result = await service.listInvitations(id, pagination);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/invitations/:id/resend ─────────────────────────────

  app.post(
    "/api/v1/invitations/:id/resend",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Organizations"],
        summary: "Resend a pending invitation (refreshes token and expiry)",
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      const result = await service.resendInvitation(id, request.user!.id);
      return reply.status(200).send({ data: result.invitation });
    },
  );

  // ── DELETE /api/v1/invitations/:id ─────────────────────────────────

  app.delete(
    "/api/v1/invitations/:id",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Organizations"],
        summary: "Cancel a pending invitation",
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      await service.cancelInvitation(id, request.user!.id);
      return reply.status(204).send();
    },
  );

  // ── PATCH /api/v1/org-members/:id ──────────────────────────────────

  app.patch(
    "/api/v1/org-members/:id",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Organizations"],
        summary: "Change an organization member's role",
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      const body = updateOrgMemberInput.parse(request.body);
      await service.updateMemberRole(id, body.role, request.user!.id);
      return reply.status(200).send({ data: { success: true } });
    },
  );

  // ── DELETE /api/v1/org-members/:id ─────────────────────────────────

  app.delete(
    "/api/v1/org-members/:id",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Organizations"],
        summary: "Remove a member from the organization",
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      await service.removeMember(id, request.user!.id);
      return reply.status(204).send();
    },
  );
}
