import { z } from "zod";

// ── Register ───────────────────────────────────────────────────────────

export const registerInput = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});

export type RegisterInput = z.infer<typeof registerInput>;

export const registerOutput = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
});

export type RegisterOutput = z.infer<typeof registerOutput>;

// ── Login ──────────────────────────────────────────────────────────────

export const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginInput>;

export const loginOutput = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
});

export type LoginOutput = z.infer<typeof loginOutput>;

// ── Accept Invitation ──────────────────────────────────────────────────

export const acceptInvitationParams = z.object({
  token: z.string().min(1),
});

export type AcceptInvitationParams = z.infer<typeof acceptInvitationParams>;

export const acceptInvitationOutput = z.object({
  orgId: z.string().uuid().optional(),
  workspaceId: z.string().uuid().optional(),
});

export type AcceptInvitationOutput = z.infer<typeof acceptInvitationOutput>;

// ── Profile ────────────────────────────────────────────────────────────

export const profileOutput = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
});

export type ProfileOutput = z.infer<typeof profileOutput>;

export const updateProfileInput = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileInput>;
