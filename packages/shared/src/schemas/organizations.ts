import { z } from 'zod';

// ── Roles ──────────────────────────────────────────────────────────────

export const orgRole = z.enum(['owner', 'admin', 'member']);
export type OrgRole = z.infer<typeof orgRole>;

// ── Organization ───────────────────────────────────────────────────────

export const createOrganizationInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  logo: z.string().nullable().optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationInput>;

export const updateOrganizationInput = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  showMemberCount: z.boolean().optional(),
  logo: z.string().nullable().optional(),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationInput>;

export const organizationOutput = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  tag: z.string(),
  description: z.string().nullable(),
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

// ── Search ────────────────────────────────────────────────────────────

export const searchOrganizationsQuery = z.object({
  q: z.string().min(1).max(100),
});

export type SearchOrganizationsQuery = z.infer<typeof searchOrganizationsQuery>;

// ── Join Request ──────────────────────────────────────────────────────

export const createJoinRequestInput = z.object({
  message: z.string().max(500).optional(),
});

export type CreateJoinRequestInput = z.infer<typeof createJoinRequestInput>;

export const reviewJoinRequestInput = z.object({
  action: z.enum(['approve', 'reject']),
});

export type ReviewJoinRequestInput = z.infer<typeof reviewJoinRequestInput>;

export const joinRequestOutput = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  userId: z.string(),
  message: z.string().nullable(),
  status: z.string(),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
  user: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      avatarUrl: z.string().nullable(),
    })
    .optional(),
});

export type JoinRequestOutput = z.infer<typeof joinRequestOutput>;
