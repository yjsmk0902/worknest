import { z } from 'zod';

// ── Favorite Entity Type ────────────────────────────────────────────────

export const favoriteEntityType = z.enum(['project', 'issue', 'page', 'space']);

export type FavoriteEntityType = z.infer<typeof favoriteEntityType>;

// ── Favorite Input ──────────────────────────────────────────────────────

export const createFavoriteInput = z.object({
  entityType: favoriteEntityType,
  entityId: z.string().uuid(),
});

export type CreateFavoriteInput = z.infer<typeof createFavoriteInput>;

export const updateFavoriteInput = z.object({
  sortOrder: z.string(), // fractional indexing
});

export type UpdateFavoriteInput = z.infer<typeof updateFavoriteInput>;

// ── Favorite Output ─────────────────────────────────────────────────────

export const favoriteOutput = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  issueId: z.string().uuid().nullable(),
  pageId: z.string().uuid().nullable(),
  spaceId: z.string().uuid().nullable(),
  entityType: favoriteEntityType, // computed from non-null FK
  entityName: z.string(), // resolved name of the favorited entity
  sortOrder: z.string(),
  createdAt: z.string(),
});

export type FavoriteOutput = z.infer<typeof favoriteOutput>;
