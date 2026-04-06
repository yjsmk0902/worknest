import { z } from "zod";

// ── Priority ─────────────────────────────────────────────────────────────

export const priorityEnum = z.enum(["urgent", "high", "medium", "low", "none"]);
export type Priority = z.infer<typeof priorityEnum>;

// ── Issue Input ──────────────────────────────────────────────────────────

export const createIssueInput = z.object({
  title: z.string().min(1).max(500),
  description: z.unknown().optional(),
  descriptionText: z.string().optional(),
  statusId: z.string().uuid().optional(),
  typeId: z.string().uuid().optional(),
  priority: priorityEnum.optional(),
  parentId: z.string().uuid().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  labelIds: z.array(z.string().uuid()).optional(),
  dueDate: z.string().optional(),
});

export type CreateIssueInput = z.infer<typeof createIssueInput>;

export const updateIssueInput = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.unknown().optional(),
  descriptionText: z.string().optional(),
  statusId: z.string().uuid().nullable().optional(),
  typeId: z.string().uuid().nullable().optional(),
  priority: priorityEnum.optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.string().optional(),
  dueDate: z.string().nullable().optional(),
});

export type UpdateIssueInput = z.infer<typeof updateIssueInput>;

// ── Issue Output ─────────────────────────────────────────────────────────

const userSummary = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().nullable(),
});

export const issueOutput = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  sequenceId: z.number(),
  title: z.string(),
  description: z.unknown().nullable(),
  descriptionText: z.string().nullable(),
  statusId: z.string().uuid().nullable(),
  typeId: z.string().uuid().nullable(),
  priority: priorityEnum,
  parentId: z.string().uuid().nullable(),
  creatorId: z.string().uuid().nullable(),
  sortOrder: z.string(),
  dueDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      color: z.string(),
    })
    .nullable()
    .optional(),
  type: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      icon: z.string(),
      color: z.string(),
    })
    .nullable()
    .optional(),
  creator: userSummary.nullable().optional(),
  assignees: z
    .array(
      z.object({
        id: z.string().uuid(),
        userId: z.string().uuid(),
        user: userSummary,
      }),
    )
    .optional(),
  labels: z
    .array(
      z.object({
        id: z.string().uuid(),
        labelId: z.string().uuid(),
        label: z.object({
          id: z.string().uuid(),
          name: z.string(),
          color: z.string(),
        }),
      }),
    )
    .optional(),
});

export type IssueOutput = z.infer<typeof issueOutput>;

// ── Issue Filter (legacy — kept for backward compatibility) ─────────────

export const issueFilterQuery = z.object({
  statusId: z.string().uuid().optional(),
  typeId: z.string().uuid().optional(),
  priority: priorityEnum.optional(),
  assigneeId: z.string().uuid().optional(),
  labelId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type IssueFilterQuery = z.infer<typeof issueFilterQuery>;

// ── Issue List Query (extended multi-value filters) ─────────────────────

export const issueListQuery = z.object({
  // Multi-value filters (comma-separated in URL)
  statusId: z.union([z.string().uuid(), z.string()]).optional(),
  statusIdNot: z.union([z.string().uuid(), z.string()]).optional(),
  typeId: z.union([z.string().uuid(), z.string()]).optional(),
  typeIdNot: z.union([z.string().uuid(), z.string()]).optional(),
  priority: z.string().optional(), // can be comma-separated
  priorityNot: z.string().optional(),
  assigneeId: z.union([z.string().uuid(), z.string()]).optional(),
  assigneeIdNot: z.union([z.string().uuid(), z.string()]).optional(),
  assigneeEmpty: z.coerce.boolean().optional(), // is_empty
  labelId: z.union([z.string().uuid(), z.string()]).optional(), // includes
  labelIdNot: z.union([z.string().uuid(), z.string()]).optional(), // excludes
  dueBefore: z.string().optional(), // ISO date
  dueAfter: z.string().optional(),
  dueEmpty: z.coerce.boolean().optional(),
  title: z.string().optional(), // contains
  search: z.string().optional(), // full-text search (keep for backward compat)
  parentId: z.string().uuid().optional(),
  // Cycle
  cycleId: z.string().uuid().optional(), // issues in a specific cycle
  cycleIdNot: z.string().uuid().optional(), // issues NOT in a specific cycle
  cycleEmpty: z.coerce.boolean().optional(), // issues not in any cycle
  // Sort
  sort: z
    .enum(["created_at", "updated_at", "priority", "due_date", "manual"])
    .optional(),
  order: z.enum(["asc", "desc"]).optional(),
  // Pagination
  cursor: z.string().optional(), // opaque base64 cursor
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type IssueListQuery = z.infer<typeof issueListQuery>;

// ── Bulk Update ─────────────────────────────────────────────────────────

export const bulkUpdateInput = z.object({
  issueIds: z.array(z.string().uuid()).min(1).max(50),
  changes: z
    .object({
      statusId: z.string().uuid().optional(),
      typeId: z.string().uuid().optional(),
      priority: priorityEnum.optional(),
      assigneeIds: z.array(z.string().uuid()).optional(), // set assignees
      labelIds: z.array(z.string().uuid()).optional(), // set labels
    })
    .refine((obj) => Object.values(obj).some((v) => v !== undefined), {
      message: "At least one change is required",
    }),
});

export type BulkUpdateInput = z.infer<typeof bulkUpdateInput>;

// ── Issue Status / Type ──────────────────────────────────────────────────

export const statusCategory = z.enum([
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
]);

export type StatusCategory = z.infer<typeof statusCategory>;

export const issueStatusOutput = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  sortOrder: z.number(),
  category: statusCategory,
  isDefault: z.boolean(),
});

export type IssueStatusOutput = z.infer<typeof issueStatusOutput>;

export const issueTypeOutput = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  sortOrder: z.number(),
  isDefault: z.boolean(),
});

export type IssueTypeOutput = z.infer<typeof issueTypeOutput>;

export const updateIssueStatusInput = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().optional(),
});

export type UpdateIssueStatusInput = z.infer<typeof updateIssueStatusInput>;

export const updateIssueTypeInput = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export type UpdateIssueTypeInput = z.infer<typeof updateIssueTypeInput>;

// ── Activity Output ──────────────────────────────────────────────────────

export const activityOutput = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid().nullable(),
  issueId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),
  action: z.string(),
  field: z.string().nullable(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
  actor: userSummary.nullable().optional(),
});

export type ActivityOutput = z.infer<typeof activityOutput>;
