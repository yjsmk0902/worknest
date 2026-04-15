import type { Database } from '@worknest/db';
import {
  addProjectMemberInput,
  checkPrefixQuery,
  createProjectInput,
  cursorPaginationQuery,
  updateProjectInput,
  updateProjectMemberInput,
} from '@worknest/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Auth } from '../lib/auth';
import { createRequireAuth } from '../middleware/auth';
import { ProjectService } from '../services/project-service';

// ── Param schemas for nested routes ────────────────────────────────────

const workspaceIdParam = z.object({ workspaceId: z.string().uuid() });
const projectIdParam = z.object({ projectId: z.string().uuid() });
const projectMemberIdParam = z.object({
  projectId: z.string().uuid(),
  memberId: z.string().uuid(),
});

/**
 * Project routes.
 */
export async function projectRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const service = new ProjectService(db);

  // ── POST /api/v1/workspaces/:workspaceId/projects ─────────────────

  app.post(
    '/api/v1/workspaces/:workspaceId/projects',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Projects'],
        summary: 'Create a new project in a workspace',
      },
    },
    async (request, reply) => {
      const { workspaceId } = workspaceIdParam.parse(request.params);
      const body = createProjectInput.parse(request.body);
      const project = await service.create(workspaceId, request.user?.id, body);
      return reply.status(201).send({ data: project });
    },
  );

  // ── GET /api/v1/workspaces/:workspaceId/projects ──────────────────

  app.get(
    '/api/v1/workspaces/:workspaceId/projects',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Projects'],
        summary: 'List projects the caller is a member of in this workspace',
      },
    },
    async (request, reply) => {
      const { workspaceId } = workspaceIdParam.parse(request.params);
      const pagination = cursorPaginationQuery.parse(request.query);
      const result = await service.listByWorkspace(workspaceId, request.user?.id, pagination);
      return reply.status(200).send(result);
    },
  );

  // ── GET /api/v1/workspaces/:workspaceId/projects/check-prefix ─────

  app.get(
    '/api/v1/workspaces/:workspaceId/projects/check-prefix',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Projects'],
        summary: 'Check if a project prefix is available',
      },
    },
    async (request, reply) => {
      const { workspaceId } = workspaceIdParam.parse(request.params);
      const { prefix } = checkPrefixQuery.parse(request.query);
      const result = await service.checkPrefix(workspaceId, prefix);
      return reply.status(200).send({ data: result });
    },
  );

  // ── GET /api/v1/workspaces/:workspaceId/projects/sidebar ──────────

  app.get(
    '/api/v1/workspaces/:workspaceId/projects/sidebar',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Projects'],
        summary: 'Lightweight project list for sidebar',
      },
    },
    async (request, reply) => {
      const { workspaceId } = workspaceIdParam.parse(request.params);
      const result = await service.listForSidebar(workspaceId, request.user?.id);
      return reply.status(200).send(result);
    },
  );

  // ── GET /api/v1/workspaces/:workspaceId/projects/:projectId ───────

  app.get(
    '/api/v1/workspaces/:workspaceId/projects/:projectId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Projects'],
        summary: 'Get project details',
      },
    },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const project = await service.getById(projectId, request.user?.id);
      return reply.status(200).send({ data: project });
    },
  );

  // ── PATCH /api/v1/workspaces/:workspaceId/projects/:projectId ─────

  app.patch(
    '/api/v1/workspaces/:workspaceId/projects/:projectId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Projects'],
        summary: 'Update project (admin only)',
      },
    },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const body = updateProjectInput.parse(request.body);
      const project = await service.update(projectId, request.user?.id, body);
      return reply.status(200).send({ data: project });
    },
  );

  // ── DELETE /api/v1/workspaces/:workspaceId/projects/:projectId ────

  app.delete(
    '/api/v1/workspaces/:workspaceId/projects/:projectId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Projects'],
        summary: 'Soft delete project (admin only)',
      },
    },
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      await service.softDelete(projectId, request.user?.id);
      return reply.status(204).send();
    },
  );

  // ── GET /api/v1/projects/:projectId/members ───────────────────────

  app.get(
    '/api/v1/projects/:projectId/members',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Projects'],
        summary: 'List project members',
      },
    },
    async (request, reply) => {
      const { projectId } = projectIdParam.parse(request.params);
      const pagination = cursorPaginationQuery.parse(request.query);
      const result = await service.listMembers(projectId, request.user?.id, pagination);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/projects/:projectId/members ──────────────────────

  app.post(
    '/api/v1/projects/:projectId/members',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Projects'],
        summary: 'Add a member to a project (admin only)',
      },
    },
    async (request, reply) => {
      const { projectId } = projectIdParam.parse(request.params);
      const body = addProjectMemberInput.parse(request.body);
      const member = await service.addMember(projectId, request.user?.id, body);
      return reply.status(201).send({ data: member });
    },
  );

  // ── PATCH /api/v1/projects/:projectId/members/:memberId ───────────

  app.patch(
    '/api/v1/projects/:projectId/members/:memberId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Projects'],
        summary: "Update a project member's role (admin only)",
      },
    },
    async (request, reply) => {
      const { projectId, memberId } = projectMemberIdParam.parse(request.params);
      const body = updateProjectMemberInput.parse(request.body);
      await service.updateMemberRole(projectId, request.user?.id, memberId, body.role);
      return reply.status(200).send({ data: { success: true } });
    },
  );

  // ── DELETE /api/v1/projects/:projectId/members/:memberId ──────────

  app.delete(
    '/api/v1/projects/:projectId/members/:memberId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Projects'],
        summary: 'Remove a member from a project (admin only)',
      },
    },
    async (request, reply) => {
      const { projectId, memberId } = projectMemberIdParam.parse(request.params);
      await service.removeMember(projectId, request.user?.id, memberId);
      return reply.status(204).send();
    },
  );
}
