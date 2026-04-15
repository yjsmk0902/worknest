import { z } from 'zod';

// ── Wiki Space Role ───────────────────────────────────────────────────

export const wikiSpaceRole = z.enum(['editor', 'viewer']);

export type WikiSpaceRole = z.infer<typeof wikiSpaceRole>;

// ── Wiki Space CRUD Schemas ───────────────────────────────────────────

export const createWikiSpaceInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

export type CreateWikiSpaceInput = z.infer<typeof createWikiSpaceInput>;

export const updateWikiSpaceInput = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
});

export type UpdateWikiSpaceInput = z.infer<typeof updateWikiSpaceInput>;

export const wikiSpaceOutput = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  slug: z.string(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WikiSpaceOutput = z.infer<typeof wikiSpaceOutput>;

// ── Wiki Space Member Schemas ─────────────────────────────────────────

export const addWikiSpaceMemberInput = z.object({
  userId: z.string().uuid(),
  role: wikiSpaceRole,
});

export type AddWikiSpaceMemberInput = z.infer<typeof addWikiSpaceMemberInput>;

export const updateWikiSpaceMemberInput = z.object({
  role: wikiSpaceRole,
});

export type UpdateWikiSpaceMemberInput = z.infer<typeof updateWikiSpaceMemberInput>;

export const wikiSpaceMemberOutput = z.object({
  id: z.string().uuid(),
  wikiSpaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: wikiSpaceRole,
  createdAt: z.string(),
});

export type WikiSpaceMemberOutput = z.infer<typeof wikiSpaceMemberOutput>;

// ── Wiki Page CRUD Schemas ────────────────────────────────────────────

export const createWikiPageInput = z.object({
  title: z.string().min(1).max(500),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  content: z.unknown().optional(),
  parentId: z.string().uuid().optional(),
});

export type CreateWikiPageInput = z.infer<typeof createWikiPageInput>;

export const updateWikiPageInput = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.unknown().optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.string().optional(),
});

export type UpdateWikiPageInput = z.infer<typeof updateWikiPageInput>;

export const wikiPageOutput = z.object({
  id: z.string().uuid(),
  wikiSpaceId: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  content: z.unknown().nullable(),
  contentFormat: z.string(),
  parentId: z.string().uuid().nullable(),
  sortOrder: z.string(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WikiPageOutput = z.infer<typeof wikiPageOutput>;
