import type { Database } from '@worknest/db';
import {
  addWikiSpaceMemberInput,
  createWikiSpaceInput,
  updateWikiSpaceInput,
  updateWikiSpaceMemberInput,
} from '@worknest/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Auth } from '../lib/auth';
import { createRequireAuth } from '../middleware/auth';
import { WikiSpaceService } from '../services/wiki-space-service';

// ── Param schemas ──────────────────────────────────────────────────────

const workspaceIdParam = z.object({ workspaceId: z.string().uuid() });
const spaceIdParam = z.object({ spaceId: z.string().uuid() });
const spaceAndMemberParam = z.object({
  spaceId: z.string().uuid(),
  memberId: z.string().uuid(),
});

/**
 * Wiki space routes.
 *
 * CRUD endpoints for workspace-scoped wiki spaces and their members.
 */
export async function wikiSpaceRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const service = new WikiSpaceService(db);

  // ── GET /api/v1/workspaces/:workspaceId/wiki-spaces ─────────────

  app.get(
    '/api/v1/workspaces/:workspaceId/wiki-spaces',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Spaces'],
        summary: 'List wiki spaces for a workspace',
      },
    },
    async (request, reply) => {
      const { workspaceId } = workspaceIdParam.parse(request.params);
      const result = await service.list(workspaceId, request.user?.id);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/workspaces/:workspaceId/wiki-spaces ────────────

  app.post(
    '/api/v1/workspaces/:workspaceId/wiki-spaces',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Spaces'],
        summary: 'Create a new wiki space',
      },
    },
    async (request, reply) => {
      const { workspaceId } = workspaceIdParam.parse(request.params);
      const body = createWikiSpaceInput.parse(request.body);
      const space = await service.create(workspaceId, request.user?.id, body);
      return reply.status(201).send({ data: space });
    },
  );

  // ── GET /api/v1/wiki-spaces/:spaceId ────────────────────────────

  app.get(
    '/api/v1/wiki-spaces/:spaceId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Spaces'],
        summary: 'Get a wiki space by ID',
      },
    },
    async (request, reply) => {
      const { spaceId } = spaceIdParam.parse(request.params);
      const space = await service.getById(spaceId, request.user?.id);
      return reply.status(200).send({ data: space });
    },
  );

  // ── PATCH /api/v1/wiki-spaces/:spaceId ──────────────────────────

  app.patch(
    '/api/v1/wiki-spaces/:spaceId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Spaces'],
        summary: 'Update a wiki space',
      },
    },
    async (request, reply) => {
      const { spaceId } = spaceIdParam.parse(request.params);
      const body = updateWikiSpaceInput.parse(request.body);
      const space = await service.update(spaceId, request.user?.id, body);
      return reply.status(200).send({ data: space });
    },
  );

  // ── DELETE /api/v1/wiki-spaces/:spaceId ─────────────────────────

  app.delete(
    '/api/v1/wiki-spaces/:spaceId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Spaces'],
        summary: 'Delete a wiki space',
      },
    },
    async (request, reply) => {
      const { spaceId } = spaceIdParam.parse(request.params);
      await service.delete(spaceId, request.user?.id);
      return reply.status(204).send();
    },
  );

  // ── GET /api/v1/wiki-spaces/:spaceId/members ───────────────────

  app.get(
    '/api/v1/wiki-spaces/:spaceId/members',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Spaces'],
        summary: 'List members of a wiki space',
      },
    },
    async (request, reply) => {
      const { spaceId } = spaceIdParam.parse(request.params);
      const result = await service.listMembers(spaceId, request.user?.id);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/wiki-spaces/:spaceId/members ──────────────────

  app.post(
    '/api/v1/wiki-spaces/:spaceId/members',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Spaces'],
        summary: 'Add a member to a wiki space',
      },
    },
    async (request, reply) => {
      const { spaceId } = spaceIdParam.parse(request.params);
      const body = addWikiSpaceMemberInput.parse(request.body);
      const member = await service.addMember(spaceId, request.user?.id, body);
      return reply.status(201).send({ data: member });
    },
  );

  // ── PATCH /api/v1/wiki-spaces/:spaceId/members/:memberId ───────

  app.patch(
    '/api/v1/wiki-spaces/:spaceId/members/:memberId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Spaces'],
        summary: "Update a wiki space member's role",
      },
    },
    async (request, reply) => {
      const { spaceId, memberId } = spaceAndMemberParam.parse(request.params);
      const body = updateWikiSpaceMemberInput.parse(request.body);
      const member = await service.updateMemberRole(spaceId, request.user?.id, memberId, body.role);
      return reply.status(200).send({ data: member });
    },
  );

  // ── DELETE /api/v1/wiki-spaces/:spaceId/members/:memberId ──────

  app.delete(
    '/api/v1/wiki-spaces/:spaceId/members/:memberId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Spaces'],
        summary: 'Remove a member from a wiki space',
      },
    },
    async (request, reply) => {
      const { spaceId, memberId } = spaceAndMemberParam.parse(request.params);
      await service.removeMember(spaceId, request.user?.id, memberId);
      return reply.status(204).send();
    },
  );
}
