import type { Database } from '@worknest/db';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Auth } from '../lib/auth';
import { createRequireAuth } from '../middleware/auth';
import { WikiShareService } from '../services/wiki-share-service';

// ── Param schemas ──────────────────────────────────────────────────────

const pageIdParam = z.object({ pageId: z.string().uuid() });
const pageAndShareParam = z.object({
  pageId: z.string().uuid(),
  shareId: z.string().uuid(),
});
const tokenParam = z.object({ token: z.string().min(1).max(128) });

const createShareBody = z
  .object({
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .strict();

/**
 * Wiki page share routes.
 *
 * Authenticated CRUD for issuing/revoking tokenized share links, plus a
 * single unauthenticated GET for consuming a share token.
 */
export async function wikiShareRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const service = new WikiShareService(db);

  // ── GET /api/v1/wiki-pages/:pageId/shares ────────────────────────────

  app.get(
    '/api/v1/wiki-pages/:pageId/shares',
    {
      preHandler: [requireAuth],
      schema: { tags: ['Wiki Shares'], summary: 'List share links for a page' },
    },
    async (request, reply) => {
      const { pageId } = pageIdParam.parse(request.params);
      const result = await service.list(pageId, request.user!.id);
      return reply.status(200).send({ data: result });
    },
  );

  // ── POST /api/v1/wiki-pages/:pageId/shares ───────────────────────────

  app.post(
    '/api/v1/wiki-pages/:pageId/shares',
    {
      preHandler: [requireAuth],
      schema: { tags: ['Wiki Shares'], summary: 'Create a new share link' },
    },
    async (request, reply) => {
      const { pageId } = pageIdParam.parse(request.params);
      const body = createShareBody.parse(request.body ?? {});
      const result = await service.create(pageId, request.user!.id, {
        expiresAt: body.expiresAt ?? null,
      });
      return reply.status(201).send(result);
    },
  );

  // ── DELETE /api/v1/wiki-pages/:pageId/shares/:shareId ────────────────

  app.delete(
    '/api/v1/wiki-pages/:pageId/shares/:shareId',
    {
      preHandler: [requireAuth],
      schema: { tags: ['Wiki Shares'], summary: 'Revoke a share link' },
    },
    async (request, reply) => {
      const { pageId, shareId } = pageAndShareParam.parse(request.params);
      const result = await service.revoke(pageId, shareId, request.user!.id);
      return reply.status(200).send(result);
    },
  );

  // ── GET /api/v1/wiki-share/:token (PUBLIC) ───────────────────────────

  app.get(
    '/api/v1/wiki-share/:token',
    {
      schema: {
        tags: ['Wiki Shares'],
        summary: 'Read a shared page (no authentication required)',
      },
    },
    async (request, reply) => {
      const { token } = tokenParam.parse(request.params);
      const result = await service.getPublicPage(token);
      return reply.status(200).send(result);
    },
  );
}
