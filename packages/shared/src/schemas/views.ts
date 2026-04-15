import { z } from 'zod';

// ── Filter Primitives ───────────────────────────────────────────────────

export const filterOperator = z.enum([
  'is',
  'is_not',
  'is_empty',
  'is_not_empty',
  'includes',
  'excludes',
  'contains',
  'before',
  'after',
  'between',
]);

export type FilterOperator = z.infer<typeof filterOperator>;

export const filterField = z.enum([
  'statusId',
  'typeId',
  'priority',
  'assigneeId',
  'labelId',
  'dueDate',
  'title',
  'cycleId',
]);

export type FilterField = z.infer<typeof filterField>;

export const filterCondition = z.object({
  field: filterField,
  operator: filterOperator,
  value: z.union([z.string(), z.array(z.string())]).optional(),
  // value is optional for is_empty / is_not_empty operators
});

export type FilterCondition = z.infer<typeof filterCondition>;

export const viewFilters = z.array(filterCondition); // AND semantics

export type ViewFilters = z.infer<typeof viewFilters>;

// ── Sort ────────────────────────────────────────────────────────────────

export const sortField = z.enum(['created_at', 'updated_at', 'priority', 'due_date', 'manual']);

export type SortField = z.infer<typeof sortField>;

export const viewSort = z.object({
  field: sortField,
  direction: z.enum(['asc', 'desc']).default('desc'),
});

export type ViewSort = z.infer<typeof viewSort>;

// ── View Type ───────────────────────────────────────────────────────────

export const viewType = z.enum(['list', 'board', 'gantt']);

export type ViewType = z.infer<typeof viewType>;

// ── View CRUD Schemas ───────────────────────────────────────────────────

export const createViewInput = z.object({
  name: z.string().min(1).max(100),
  type: viewType,
  filters: viewFilters.default([]),
  sort: viewSort.optional(),
  groupBy: z.string().nullable().optional(),
});

export type CreateViewInput = z.infer<typeof createViewInput>;

export const updateViewInput = z.object({
  name: z.string().min(1).max(100).optional(),
  type: viewType.optional(),
  filters: viewFilters.optional(),
  sort: viewSort.nullable().optional(),
  groupBy: z.string().nullable().optional(),
});

export type UpdateViewInput = z.infer<typeof updateViewInput>;

export const viewOutput = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  createdBy: z.string().uuid().nullable(),
  filters: viewFilters,
  sort: viewSort.nullable(),
  groupBy: z.string().nullable(),
  type: viewType,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ViewOutput = z.infer<typeof viewOutput>;
