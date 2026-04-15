import { z } from 'zod';

// ── Roles ──────────────────────────────────────────────────────────────

export const projectRole = z.enum(['admin', 'member', 'viewer']);
export type ProjectRole = z.infer<typeof projectRole>;

// ── Project ────────────────────────────────────────────────────────────

export const createProjectInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  prefix: z
    .string()
    .min(2)
    .max(5)
    .regex(/^[A-Z]{2,5}$/, 'Prefix must be 2-5 uppercase letters'),
  iconUrl: z.string().max(500).nullable().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectInput>;

export const updateProjectInput = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  iconUrl: z.string().max(500).nullable().optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectInput>;

export const projectOutput = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  prefix: z.string(),
  iconUrl: z.string().nullable(),
  issueCounter: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProjectOutput = z.infer<typeof projectOutput>;

// ── Project Member ─────────────────────────────────────────────────────

export const projectMemberOutput = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  role: projectRole,
  joinedAt: z.string(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    avatarUrl: z.string().nullable(),
  }),
});

export type ProjectMemberOutput = z.infer<typeof projectMemberOutput>;

export const checkPrefixQuery = z.object({
  prefix: z.string(),
});

export type CheckPrefixQuery = z.infer<typeof checkPrefixQuery>;

export const addProjectMemberInput = z.object({
  userId: z.string().uuid(),
  role: projectRole,
});

export type AddProjectMemberInput = z.infer<typeof addProjectMemberInput>;

export const updateProjectMemberInput = z.object({
  role: projectRole.exclude(['admin']),
});

export type UpdateProjectMemberInput = z.infer<typeof updateProjectMemberInput>;
