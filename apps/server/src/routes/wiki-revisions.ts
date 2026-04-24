import type { Database } from '@worknest/db';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Auth } from '../lib/auth';
import { createRequireAuth } from '../middleware/auth';
import { WikiRevisionService } from '../services/wiki-revision-service';

const pageIdParam = z.object({ pageId: z.string().uuid() });
const pageAndRevParam = z.object({
  pageId: z.string().uuid(),
  revisionId: z.string().uuid(),
});

/**
 * Wiki page revision (history) routes.
 *
 * Read access requires wiki-space membership; restore requires editor role.
 * Snapshots themselves are written by the page update flow, not here.
 */
export async function wikiRevisionRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const service = new WikiRevisionService(db);

  // ── GET /api/v1/wiki-pages/:pageId/revisions ─────────────────────────

  app.get(
    '/api/v1/wiki-pages/:pageId/revisions',
    {
      preHandler: [requireAuth],
      schema: { tags: ['Wiki Revisions'], summary: 'List a page\'s revisions' },
    },
    async (request, reply) => {
      const { pageId } = pageIdParam.parse(request.params);
      const result = await service.list(pageId, request.user!.id);
      return reply.status(200).send({ data: result });
    },
  );

  // ── GET /api/v1/wiki-pages/:pageId/revisions/:revisionId ─────────────

  app.get(
    '/api/v1/wiki-pages/:pageId/revisions/:revisionId',
    {
      preHandler: [requireAuth],
      schema: { tags: ['Wiki Revisions'], summary: 'Fetch a single revision' },
    },
    async (request, reply) => {
      const { pageId, revisionId } = pageAndRevParam.parse(request.params);
      const result = await service.getOne(pageId, revisionId, request.user!.id);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/wiki-pages/:pageId/revisions/:revisionId/restore ────

  app.post(
    '/api/v1/wiki-pages/:pageId/revisions/:revisionId/restore',
    {
      preHandler: [requireAuth],
      schema: { tags: ['Wiki Revisions'], summary: 'Restore a page to a revision' },
    },
    async (request, reply) => {
      const { pageId, revisionId } = pageAndRevParam.parse(request.params);
      await service.restore(pageId, revisionId, request.user!.id);
      return reply.status(204).send();
    },
  );
}
