import { z } from 'zod';

// ── Roles ──────────────────────────────────────────────────────────────

export const orgRole = z.enum(['owner', 'admin', 'member']);
export type OrgRole = z.infer<typeof orgRole>;

// ── Organization ───────────────────────────────────────────────────────

export const createOrganizationInput = z.object({
  name: z.string().min(1).max(100),
  logo: z.string().nullable().optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationInput>;

export const updateOrganizationInput = z.object({
  name: z.string().min(1).max(100).optional(),
  logo: z.string().nullable().optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationInput>;

export const organizationOutput = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type OrganizationOutput = z.infer<typeof organizationOutput>;

// ── Org Member ─────────────────────────────────────────────────────────

export const orgMemberOutput = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  role: orgRole,
  joinedAt: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
  }),
});

export type OrgMemberOutput = z.infer<typeof orgMemberOutput>;

export const updateOrgMemberInput = z.object({
  role: orgRole,
});

export type UpdateOrgMemberInput = z.infer<typeof updateOrgMemberInput>;

// ── Invitation ─────────────────────────────────────────────────────────

export const createOrgInvitationInput = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']),
});

export type CreateOrgInvitationInput = z.infer<typeof createOrgInvitationInput>;

export const invitationOutput = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.string(),
  invitedBy: z.string().uuid().nullable(),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
  createdAt: z.string(),
});

export type InvitationOutput = z.infer<typeof invitationOutput>;
