import { z } from 'zod';
import { priorityEnum } from './issues';

// ── Issue Template ─────────────────────────────────────────────────────

export const createIssueTemplateInput = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).nullable().optional(),
  titleTemplate: z.string().max(200).default(''),
  body: z.unknown().nullable().optional(),
  priority: priorityEnum.default('none'),
  typeId: z.string().uuid().nullable().optional(),
  labelIds: z.array(z.string().uuid()).default([]),
  sortOrder: z.number().int().optional(),
});

export type CreateIssueTemplateInput = z.infer<typeof createIssueTemplateInput>;

export const updateIssueTemplateInput = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(300).nullable().optional(),
  titleTemplate: z.string().max(200).optional(),
  body: z.unknown().nullable().optional(),
  priority: priorityEnum.optional(),
  typeId: z.string().uuid().nullable().optional(),
  labelIds: z.array(z.string().uuid()).optional(),
  sortOrder: z.number().int().optional(),
});

export type UpdateIssueTemplateInput = z.infer<typeof updateIssueTemplateInput>;

export const issueTemplateOutput = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  titleTemplate: z.string(),
  body: z.unknown().nullable(),
  priority: priorityEnum,
  typeId: z.string().uuid().nullable(),
  labelIds: z.array(z.string().uuid()),
  sortOrder: z.number().int(),
  isDefault: z.boolean(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type IssueTemplateOutput = z.infer<typeof issueTemplateOutput>;
