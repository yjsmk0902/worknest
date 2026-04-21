import { type Database, wikiSpaces } from '@worknest/db';
import { createWikiPageInput, updateWikiPageInput } from '@worknest/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Auth } from '../lib/auth';
import { createRequireAuth } from '../middleware/auth';
import { MentionService } from '../services/mention-service';
import { WikiPageService } from '../services/wiki-page-service';
import {
  broadcastWikiPageCreated,
  broadcastWikiPageDeleted,
  broadcastWikiPageUpdated,
} from '../websocket/wiki-events';

// ── Param schemas ──────────────────────────────────────────────────────

const spaceIdParam = z.object({ spaceId: z.string().uuid() });
const pageIdParam = z.object({ pageId: z.string().uuid() });
const workspaceIdParam = z.object({ workspaceId: z.string().uuid() });
const recentQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).optional() });

const movePageBody = z.object({
  parentId: z.string().uuid().nullable(),
  sortOrder: z.string().min(1),
});

/**
 * Look up the workspaceId for a wiki space.
 */
async function getWorkspaceId(db: Database, spaceId: string): Promise<string> {
  const space = await db
    .select({ workspaceId: wikiSpaces.workspaceId })
    .from(wikiSpaces)
    .where(eq(wikiSpaces.id, spaceId))
    .limit(1)
    .then((rows) => rows[0]);

  return space?.workspaceId;
}

/**
 * Wiki page routes.
 *
 * CRUD endpoints for wiki pages within a wiki space.
 */
export async function wikiPageRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const pageService = new WikiPageService(db);
  const mentionService = new MentionService(db);

  // ── GET /api/v1/workspaces/:workspaceId/wiki-pages/recent ──────

  app.get(
    '/api/v1/workspaces/:workspaceId/wiki-pages/recent',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Pages'],
        summary: 'List recently edited wiki pages in the workspace',
      },
    },
    async (request, reply) => {
      const { workspaceId } = workspaceIdParam.parse(request.params);
      const { limit } = recentQuery.parse(request.query);
      const result = await pageService.listRecent(workspaceId, request.user?.id, limit);
      return reply.status(200).send(result);
    },
  );

  // ── GET /api/v1/wiki-spaces/:spaceId/pages/tree ─────────────────

  app.get(
    '/api/v1/wiki-spaces/:spaceId/pages/tree',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Pages'],
        summary: 'Get page tree for a wiki space',
      },
    },
    async (request, reply) => {
      const { spaceId } = spaceIdParam.parse(request.params);
      const result = await pageService.getTree(spaceId, request.user?.id);
      return reply.status(200).send(result);
    },
  );

  // ── GET /api/v1/wiki-spaces/:spaceId/pages ──────────────────────

  app.get(
    '/api/v1/wiki-spaces/:spaceId/pages',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Pages'],
        summary: 'List all pages in a wiki space',
      },
    },
    async (request, reply) => {
      const { spaceId } = spaceIdParam.parse(request.params);
      const result = await pageService.list(spaceId, request.user?.id);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/wiki-spaces/:spaceId/pages ─────────────────────

  app.post(
    '/api/v1/wiki-spaces/:spaceId/pages',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Pages'],
        summary: 'Create a new wiki page',
      },
    },
    async (request, reply) => {
      const { spaceId } = spaceIdParam.parse(request.params);
      const body = createWikiPageInput.parse(request.body);
      const page = await pageService.create(spaceId, request.user?.id, body);

      // Sync mentions if content was provided
      if (body.content) {
        await mentionService.syncMentions(page.id, body.content);
      }

      // Broadcast wiki page created event
      const workspaceId = await getWorkspaceId(db, spaceId);
      broadcastWikiPageCreated(workspaceId, { pageId: page.id, title: page.title });

      return reply.status(201).send({ data: page });
    },
  );

  // ── GET /api/v1/wiki-pages/:pageId ──────────────────────────────

  app.get(
    '/api/v1/wiki-pages/:pageId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Pages'],
        summary: 'Get a wiki page by ID',
      },
    },
    async (request, reply) => {
      const { pageId } = pageIdParam.parse(request.params);
      const page = await pageService.getById(pageId, request.user?.id);
      return reply.status(200).send({ data: page });
    },
  );

  // ── PATCH /api/v1/wiki-pages/:pageId ────────────────────────────

  app.patch(
    '/api/v1/wiki-pages/:pageId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Pages'],
        summary: 'Update a wiki page',
      },
    },
    async (request, reply) => {
      const { pageId } = pageIdParam.parse(request.params);
      const body = updateWikiPageInput.parse(request.body);
      const page = await pageService.update(pageId, request.user?.id, body);

      // Sync mentions if content was updated
      if (body.content !== undefined) {
        await mentionService.syncMentions(pageId, body.content);
      }

      // Broadcast wiki page updated event
      const workspaceId = await getWorkspaceId(db, page.wikiSpaceId);
      broadcastWikiPageUpdated(workspaceId, { pageId: page.id });

      return reply.status(200).send({ data: page });
    },
  );

  // ── DELETE /api/v1/wiki-pages/:pageId ───────────────────────────

  app.delete(
    '/api/v1/wiki-pages/:pageId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Pages'],
        summary: 'Delete a wiki page (soft delete)',
      },
    },
    async (request, reply) => {
      const { pageId } = pageIdParam.parse(request.params);

      // Look up the page before deletion to get the spaceId for broadcasting
      const page = await pageService.getById(pageId, request.user?.id);

      await pageService.delete(pageId, request.user?.id);

      // Broadcast wiki page deleted event
      const workspaceId = await getWorkspaceId(db, page.wikiSpaceId);
      broadcastWikiPageDeleted(workspaceId, { pageId });

      return reply.status(204).send();
    },
  );

  // ── POST /api/v1/wiki-pages/:pageId/move ──────────────────────

  app.post(
    '/api/v1/wiki-pages/:pageId/move',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Wiki Pages'],
        summary: 'Move a wiki page to a new parent and/or position',
      },
    },
    async (request, reply) => {
      const { pageId } = pageIdParam.parse(request.params);
      const { parentId, sortOrder } = movePageBody.parse(request.body);
      const page = await pageService.move(pageId, request.user?.id, parentId, sortOrder);
      return reply.status(200).send({ data: page });
    },
  );
}
