import type { Database } from '@worknest/db';
import { createIssueTemplateInput, updateIssueTemplateInput } from '@worknest/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Auth } from '../lib/auth';
import { createRequireAuth } from '../middleware/auth';
import { IssueTemplateService } from '../services/issue-template-service';

// ── Param schemas ──────────────────────────────────────────────────────

const projectIdParam = z.object({ projectId: z.string().uuid() });
const templateIdParam = z.object({
  projectId: z.string().uuid(),
  templateId: z.string().uuid(),
});

/**
 * Issue template routes.
 */
export async function issueTemplateRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const service = new IssueTemplateService(db);

  // ── GET /api/v1/projects/:projectId/issue-templates ────────────────

  app.get(
    '/api/v1/projects/:projectId/issue-templates',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Issue Templates'],
        summary: 'List issue templates for a project',
      },
    },
    async (request, reply) => {
      const { projectId } = projectIdParam.parse(request.params);
      const result = await service.list(projectId, request.user?.id);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/projects/:projectId/issue-templates ───────────────

  app.post(
    '/api/v1/projects/:projectId/issue-templates',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Issue Templates'],
        summary: 'Create an issue template (admin/member only)',
      },
    },
    async (request, reply) => {
      const { projectId } = projectIdParam.parse(request.params);
      const body = createIssueTemplateInput.parse(request.body);
      const tpl = await service.create(projectId, request.user?.id, body);
      return reply.status(201).send({ data: tpl });
    },
  );

  // ── PATCH /api/v1/projects/:projectId/issue-templates/:templateId ──

  app.patch(
    '/api/v1/projects/:projectId/issue-templates/:templateId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Issue Templates'],
        summary: 'Update an issue template (admin/member only)',
      },
    },
    async (request, reply) => {
      const { projectId, templateId } = templateIdParam.parse(request.params);
      const body = updateIssueTemplateInput.parse(request.body);
      const tpl = await service.update(projectId, templateId, request.user?.id, body);
      return reply.status(200).send({ data: tpl });
    },
  );

  // ── DELETE /api/v1/projects/:projectId/issue-templates/:templateId ─

  app.delete(
    '/api/v1/projects/:projectId/issue-templates/:templateId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Issue Templates'],
        summary: 'Delete an issue template (admin/member only)',
      },
    },
    async (request, reply) => {
      const { projectId, templateId } = templateIdParam.parse(request.params);
      await service.delete(projectId, templateId, request.user?.id);
      return reply.status(204).send();
    },
  );
}
