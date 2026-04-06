import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Auth } from "../lib/auth";
import type { Database } from "@worknest/db";
import { createRequireAuth } from "../middleware/auth";
import { WikiPageService } from "../services/wiki-page-service";
import { MentionService } from "../services/mention-service";
import {
  createWikiPageInput,
  updateWikiPageInput,
} from "@worknest/shared";

// ── Param schemas ──────────────────────────────────────────────────────

const spaceIdParam = z.object({ spaceId: z.string().uuid() });
const pageIdParam = z.object({ pageId: z.string().uuid() });

const movePageBody = z.object({
  parentId: z.string().uuid().nullable(),
  sortOrder: z.string().min(1),
});

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

  // ── GET /api/v1/wiki-spaces/:spaceId/pages ──────────────────────

  app.get(
    "/api/v1/wiki-spaces/:spaceId/pages",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Wiki Pages"],
        summary: "List all pages in a wiki space",
        params: spaceIdParam,
      },
    },
    async (request, reply) => {
      const { spaceId } = spaceIdParam.parse(request.params);
      const result = await pageService.list(spaceId, request.user!.id);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/wiki-spaces/:spaceId/pages ─────────────────────

  app.post(
    "/api/v1/wiki-spaces/:spaceId/pages",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Wiki Pages"],
        summary: "Create a new wiki page",
        params: spaceIdParam,
        body: createWikiPageInput,
      },
    },
    async (request, reply) => {
      const { spaceId } = spaceIdParam.parse(request.params);
      const body = createWikiPageInput.parse(request.body);
      const page = await pageService.create(
        spaceId,
        request.user!.id,
        body,
      );

      // Sync mentions if content was provided
      if (body.content) {
        await mentionService.syncMentions(page.id, body.content);
      }

      return reply.status(201).send({ data: page });
    },
  );

  // ── GET /api/v1/wiki-pages/:pageId ──────────────────────────────

  app.get(
    "/api/v1/wiki-pages/:pageId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Wiki Pages"],
        summary: "Get a wiki page by ID",
        params: pageIdParam,
      },
    },
    async (request, reply) => {
      const { pageId } = pageIdParam.parse(request.params);
      const page = await pageService.getById(pageId, request.user!.id);
      return reply.status(200).send({ data: page });
    },
  );

  // ── PATCH /api/v1/wiki-pages/:pageId ────────────────────────────

  app.patch(
    "/api/v1/wiki-pages/:pageId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Wiki Pages"],
        summary: "Update a wiki page",
        params: pageIdParam,
        body: updateWikiPageInput,
      },
    },
    async (request, reply) => {
      const { pageId } = pageIdParam.parse(request.params);
      const body = updateWikiPageInput.parse(request.body);
      const page = await pageService.update(
        pageId,
        request.user!.id,
        body,
      );

      // Sync mentions if content was updated
      if (body.content !== undefined) {
        await mentionService.syncMentions(pageId, body.content);
      }

      return reply.status(200).send({ data: page });
    },
  );

  // ── DELETE /api/v1/wiki-pages/:pageId ───────────────────────────

  app.delete(
    "/api/v1/wiki-pages/:pageId",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Wiki Pages"],
        summary: "Delete a wiki page (soft delete)",
        params: pageIdParam,
      },
    },
    async (request, reply) => {
      const { pageId } = pageIdParam.parse(request.params);
      await pageService.delete(pageId, request.user!.id);
      return reply.status(204).send();
    },
  );
}
