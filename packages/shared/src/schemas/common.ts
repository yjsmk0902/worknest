import { z } from "zod";

// ── Pagination ─────────────────────────────────────────────────────────

export const cursorPaginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuery>;

export const paginationMeta = z.object({
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
});

export type PaginationMeta = z.infer<typeof paginationMeta>;

// ── Standard API Response Wrappers ─────────────────────────────────────

/**
 * Wrap any data schema in a standard `{ data: T }` envelope.
 */
export function dataResponse<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema });
}

/**
 * Wrap a list schema in `{ data: T[], pagination }` envelope.
 */
export function listResponse<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: paginationMeta,
  });
}

// ── Error Response ─────────────────────────────────────────────────────

export const validationFieldError = z.object({
  path: z.string(),
  message: z.string(),
});

export const errorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponse>;

// ── Common field schemas ───────────────────────────────────────────────

export const uuidParam = z.object({
  id: z.string().uuid(),
});

export type UuidParam = z.infer<typeof uuidParam>;

export const slugSchema = z
  .string()
  .min(2)
  .max(50)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase alphanumeric with hyphens",
  );
