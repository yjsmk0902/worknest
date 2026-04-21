import { z } from 'zod';

// ── Search Query ────────────────────────────────────────────────────────

export const searchQuery = z.object({
  q: z.string().min(1).max(200),
  type: z.string().optional(), // comma-separated: 'issue,page,project'
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchQuery = z.infer<typeof searchQuery>;

// ── Search Result ───────────────────────────────────────────────────────

export const searchResultItem = z.object({
  id: z.string().uuid(),
  type: z.enum(['issue', 'page', 'project']),
  title: z.string(),
  subtitle: z.string().optional(), // project prefix, space name, etc.
  url: z.string(), // client-side route path
  /** Parent wiki space ID (set for page results, used to build full URL). */
  spaceId: z.string().uuid().optional(),
  /** Parent project ID (set for issue results). */
  projectId: z.string().uuid().optional(),
  /** Emoji/icon for wiki pages. */
  icon: z.string().nullable().optional(),
});

export type SearchResultItem = z.infer<typeof searchResultItem>;

export const searchResultOutput = z.object({
  results: z.array(searchResultItem),
  categories: z.object({
    issues: z.array(searchResultItem),
    pages: z.array(searchResultItem),
    projects: z.array(searchResultItem),
  }),
});

export type SearchResultOutput = z.infer<typeof searchResultOutput>;
