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

// ── Issue Filter ─────────────────────────────────────────────────────────

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

// ── Issue Status / Type ──────────────────────────────────────────────────

export const issueStatusOutput = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  sortOrder: z.number(),
});

export type IssueStatusOutput = z.infer<typeof issueStatusOutput>;

export const issueTypeOutput = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  sortOrder: z.number(),
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
