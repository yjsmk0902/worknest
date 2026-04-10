import { z } from "zod";

// ── Roles ──────────────────────────────────────────────────────────────

export const wsRole = z.enum(["admin", "member", "guest"]);
export type WsRole = z.infer<typeof wsRole>;

// ── Workspace ──────────────────────────────────────────────────────────

export const createWorkspaceInput = z.object({
  name: z.string().min(1).max(100),
  logo: z.string().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInput>;

export const updateWorkspaceInput = z.object({
  name: z.string().min(1).max(100).optional(),
  logo: z.string().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceInput>;

export const workspaceOutput = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WorkspaceOutput = z.infer<typeof workspaceOutput>;

// ── Workspace Member ───────────────────────────────────────────────────

export const wsMemberOutput = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: wsRole,
  joinedAt: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
  }),
});

export type WsMemberOutput = z.infer<typeof wsMemberOutput>;

export const updateWsMemberInput = z.object({
  role: wsRole,
});

export type UpdateWsMemberInput = z.infer<typeof updateWsMemberInput>;

// ── Invitation ─────────────────────────────────────────────────────────

export const createWsInvitationInput = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "guest"]),
});

export type CreateWsInvitationInput = z.infer<typeof createWsInvitationInput>;
