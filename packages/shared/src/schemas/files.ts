import { z } from 'zod';

// ── File Entity Type ──────────────────────────────────────────────────

export const fileEntityType = z.enum(['issue', 'page']);

export type FileEntityType = z.infer<typeof fileEntityType>;

// ── File Schemas ──────────────────────────────────────────────────────

export const createFileInput = z.object({
  name: z.string().min(1).max(500),
  entityType: fileEntityType.optional(),
  entityId: z.string().uuid().optional(),
});

export type CreateFileInput = z.infer<typeof createFileInput>;

export const fileOutput = z.object({
  id: z.string().uuid(),
  issueId: z.string().uuid().nullable(),
  pageId: z.string().uuid().nullable(),
  name: z.string(),
  /** Download URL for the file (e.g. /api/v1/files/:id/download) */
  path: z.string(),
  mimeType: z.string(),
  size: z.number(),
  uploadedBy: z.string().uuid().nullable(),
  createdAt: z.string(),
});

export type FileOutput = z.infer<typeof fileOutput>;
