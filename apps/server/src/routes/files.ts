import * as fs from 'node:fs';
import type { Database } from '@worknest/db';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Auth } from '../lib/auth';
import { createRequireAuth } from '../middleware/auth';
import { FileService } from '../services/file-service';

// ── Param schemas ──────────────────────────────────────────────────────

const fileIdParam = z.object({ fileId: z.string().uuid() });
const pageIdParam = z.object({ pageId: z.string().uuid() });

/**
 * File routes.
 *
 * Upload, download, and manage file attachments.
 */
export async function fileRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const service = new FileService(db);

  // ── GET /api/v1/wiki-pages/:pageId/files ─────────────────────────

  app.get(
    '/api/v1/wiki-pages/:pageId/files',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Files'],
        summary: 'List files attached to a wiki page',
      },
    },
    async (request, reply) => {
      const { pageId } = pageIdParam.parse(request.params);
      const result = await service.listByPageId(pageId, request.user?.id);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/files/upload ───────────────────────────────────

  app.post(
    '/api/v1/files/upload',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Files'],
        summary: 'Upload a file',
        consumes: ['multipart/form-data'],
      },
    },
    async (request, reply) => {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No file provided',
          },
        });
      }

      // Read file data into buffer
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Parse optional entity fields from multipart fields
      const fields = data.fields as Record<string, { value?: string } | undefined>;
      const rawEntityType = fields.entityType?.value;
      if (rawEntityType && rawEntityType !== 'issue' && rawEntityType !== 'page') {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: "Invalid entityType. Must be 'issue' or 'page'.",
          },
        });
      }
      const entityType = rawEntityType as 'issue' | 'page' | undefined;
      const entityId = fields.entityId?.value;

      const file = await service.upload(
        request.user?.id,
        {
          filename: data.filename,
          mimetype: data.mimetype,
          data: buffer,
        },
        entityType,
        entityId,
      );

      return reply.status(201).send({ data: file });
    },
  );

  // ── GET /api/v1/files/:fileId ───────────────────────────────────

  app.get(
    '/api/v1/files/:fileId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Files'],
        summary: 'Get file info',
      },
    },
    async (request, reply) => {
      const { fileId } = fileIdParam.parse(request.params);
      const file = await service.getById(fileId, request.user?.id);
      return reply.status(200).send({ data: file });
    },
  );

  // ── GET /api/v1/files/:fileId/download ──────────────────────────

  app.get(
    '/api/v1/files/:fileId/download',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Files'],
        summary: 'Download a file',
      },
    },
    async (request, reply) => {
      const { fileId } = fileIdParam.parse(request.params);
      const file = await service.getFileRecord(fileId, request.user?.id);

      if (!fs.existsSync(file.path)) {
        return reply.status(404).send({
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File not found on disk',
          },
        });
      }

      const stream = fs.createReadStream(file.path);
      return reply
        .header('Content-Type', file.mimeType)
        .header('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`)
        .send(stream);
    },
  );

  // ── GET /api/v1/files/:fileId/serve ──────────────────────────────
  // Public endpoint for displaying images (logos, avatars).
  // No auth required — file IDs are unguessable UUIDs.
  // Only serves image files; rejects non-images for security.

  app.get(
    '/api/v1/files/:fileId/serve',
    {
      schema: {
        tags: ['Files'],
        summary: 'Serve an image file publicly (for logos/avatars)',
      },
    },
    async (request, reply) => {
      const { fileId } = fileIdParam.parse(request.params);
      const file = await service.getFileRecordPublic(fileId);

      if (!file.mimeType.startsWith('image/')) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN', message: 'Only image files can be served publicly' },
        });
      }

      if (!fs.existsSync(file.path)) {
        return reply.status(404).send({
          error: { code: 'FILE_NOT_FOUND', message: 'File not found on disk' },
        });
      }

      const stream = fs.createReadStream(file.path);
      return reply
        .header('Content-Type', file.mimeType)
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .send(stream);
    },
  );

  // ── DELETE /api/v1/files/:fileId ────────────────────────────────

  app.delete(
    '/api/v1/files/:fileId',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Files'],
        summary: 'Delete a file',
      },
    },
    async (request, reply) => {
      const { fileId } = fileIdParam.parse(request.params);
      await service.delete(fileId, request.user?.id);
      return reply.status(204).send();
    },
  );
}
