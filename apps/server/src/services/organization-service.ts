import { randomUUID } from 'node:crypto';
import {
  type Database,
  invitations,
  orgMembers,
  organizations,
  users,
  workspaceMembers,
} from '@worknest/db';
import type {
  CreateOrgInvitationInput,
  CreateOrganizationInput,
  CursorPaginationQuery,
  OrgRole,
  UpdateOrganizationInput,
} from '@worknest/shared';
import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import { generateToken, hashToken } from '../lib/crypto';
import { AppError, ErrorCode } from '../lib/errors';

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
  return base ? `${base}-${suffix}` : suffix;
}

// ── Service ────────────────────────────────────────────────────────────

export class OrganizationService {
  constructor(private db: Database) {}

  // ── List User's Orgs ───────────────────────────────────────────────

  async listByUser(userId: string, pagination: CursorPaginationQuery) {
    const { cursor, limit } = pagination;

    const query = this.db
      .select({
        org: organizations,
        member: orgMembers,
      })
      .from(orgMembers)
      .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
      .where(
        and(
          eq(orgMembers.userId, userId),
          isNull(organizations.deletedAt),
          ...(cursor ? [lt(organizations.createdAt, new Date(cursor))] : []),
        ),
      )
      .orderBy(desc(organizations.createdAt))
      .limit(limit + 1);

    const rows = await query;
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: items.map((row) => ({
        id: row.org.id,
        name: row.org.name,
        slug: row.org.slug,
        logo: row.org.logo,
        createdAt: row.org.createdAt.toISOString(),
        updatedAt: row.org.updatedAt.toISOString(),
        role: row.member.role,
      })),
      pagination: {
        next_cursor: hasMore ? items[items.length - 1]?.org.createdAt.toISOString() : null,
        has_more: hasMore,
      },
    };
  }

  // ── Create Org ─────────────────────────────────────────────────────

  async create(userId: string, input: CreateOrganizationInput) {
    const slug = generateSlug(input.name);

    // Create org + owner membership atomically
    const org = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(organizations)
        .values({
          name: input.name,
          slug,
          logo: input.logo ?? null,
        })
        .returning();

      // Make creator the owner
      await tx.insert(orgMembers).values({
        orgId: created?.id,
        userId,
        role: 'owner',
      });

      return created!;
    });

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    };
  }

  // ── Get Org ────────────────────────────────────────────────────────

  async getById(id: string) {
    const org = await this.db
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!org) {
      throw AppError.notFound('organization');
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    };
  }

  // ── Get Org by Slug ─────────────────────────────────────────────────

  async getBySlug(slug: string, userId: string) {
    const row = await this.db
      .select({
        org: organizations,
        member: orgMembers,
      })
      .from(organizations)
      .innerJoin(
        orgMembers,
        and(eq(orgMembers.orgId, organizations.id), eq(orgMembers.userId, userId)),
      )
      .where(and(eq(organizations.slug, slug), isNull(organizations.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!row) {
      throw AppError.notFound('organization');
    }

    return {
      id: row.org.id,
      name: row.org.name,
      slug: row.org.slug,
      logo: row.org.logo,
      role: row.member.role,
      createdAt: row.org.createdAt.toISOString(),
      updatedAt: row.org.updatedAt.toISOString(),
    };
  }

  // ── Update Org ─────────────────────────────────────────────────────

  async update(id: string, input: UpdateOrganizationInput) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.logo !== undefined) updates.logo = input.logo;

    const updated = await this.db
      .update(organizations)
      .set(updates)
      .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
      .returning()
      .then((rows) => rows[0]);

    if (!updated) {
      throw AppError.notFound('organization');
    }

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      logo: updated.logo,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ── Soft Delete Org ────────────────────────────────────────────────

  async softDelete(id: string, userId: string) {
    // Verify the user is the owner
    const member = await this.db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, id), eq(orgMembers.userId, userId)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!member || member.role !== 'owner') {
      throw AppError.forbidden('Only the owner can delete an organization');
    }

    const updated = await this.db
      .update(organizations)
      .set({ deletedAt: new Date() })
      .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
      .returning()
      .then((rows) => rows[0]);

    if (!updated) {
      throw AppError.notFound('organization');
    }
  }

  // ── List Members ───────────────────────────────────────────────────

  async listMembers(orgId: string, pagination: CursorPaginationQuery) {
    const { cursor, limit } = pagination;

    const rows = await this.db
      .select({
        member: orgMembers,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(orgMembers)
      .innerJoin(users, eq(orgMembers.userId, users.id))
      .where(
        and(
          eq(orgMembers.orgId, orgId),
          ...(cursor ? [lt(orgMembers.joinedAt, new Date(cursor))] : []),
        ),
      )
      .orderBy(desc(orgMembers.joinedAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: items.map((row) => ({
        id: row.member.id,
        orgId: row.member.orgId,
        userId: row.member.userId,
        role: row.member.role as OrgRole,
        joinedAt: row.member.joinedAt.toISOString(),
        user: {
          id: row.user.id,
          email: row.user.email,
          name: row.user.name,
          avatarUrl: row.user.avatarUrl,
        },
      })),
      pagination: {
        next_cursor: hasMore ? items[items.length - 1]?.member.joinedAt.toISOString() : null,
        has_more: hasMore,
      },
    };
  }

  // ── Update Member Role ─────────────────────────────────────────────

  async updateMemberRole(memberId: string, role: OrgRole, callerUserId: string) {
    // Cannot change to owner via this endpoint
    if (role === 'owner') {
      throw AppError.forbidden('Cannot assign owner role through this endpoint');
    }

    const member = await this.db
      .select()
      .from(orgMembers)
      .where(eq(orgMembers.id, memberId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!member) {
      throw AppError.notFound('member');
    }

    // Verify caller is admin or owner of the org
    const caller = await this.db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, member.orgId), eq(orgMembers.userId, callerUserId)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!caller || !['owner', 'admin'].includes(caller.role)) {
      throw AppError.forbidden('Only org owner or admin can change member roles');
    }

    if (member.role === 'owner') {
      throw AppError.forbidden("Cannot change the owner's role");
    }

    const [updated] = await this.db
      .update(orgMembers)
      .set({ role })
      .where(eq(orgMembers.id, memberId))
      .returning();

    return updated;
  }

  // ── Remove Member ──────────────────────────────────────────────────

  async removeMember(memberId: string, callerUserId: string) {
    const member = await this.db
      .select()
      .from(orgMembers)
      .where(eq(orgMembers.id, memberId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!member) {
      throw AppError.notFound('member');
    }

    // Verify caller is admin or owner of the org
    const caller = await this.db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, member.orgId), eq(orgMembers.userId, callerUserId)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!caller || !['owner', 'admin'].includes(caller.role)) {
      throw AppError.forbidden('Only org owner or admin can remove members');
    }

    if (member.role === 'owner') {
      throw AppError.forbidden('Cannot remove the organization owner');
    }

    await this.db.delete(orgMembers).where(eq(orgMembers.id, memberId));
  }

  // ── Create Invitation ──────────────────────────────────────────────

  async createInvitation(orgId: string, invitedById: string, input: CreateOrgInvitationInput) {
    // Check if already a member
    const existingMember = await this.db
      .select({ id: orgMembers.id })
      .from(orgMembers)
      .innerJoin(users, eq(orgMembers.userId, users.id))
      .where(and(eq(orgMembers.orgId, orgId), eq(users.email, input.email)))
      .limit(1);

    if (existingMember.length > 0) {
      throw AppError.conflict(
        ErrorCode.ALREADY_A_MEMBER,
        'User is already a member of this organization',
      );
    }

    // Check for existing pending invitation
    const existingInvitation = await this.db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.orgId, orgId),
          eq(invitations.email, input.email),
          isNull(invitations.acceptedAt),
        ),
      )
      .limit(1);

    if (existingInvitation.length > 0) {
      throw AppError.conflict(
        ErrorCode.INVITATION_ALREADY_SENT,
        'An invitation has already been sent to this email',
      );
    }

    const token = generateToken();
    const tokenHash = hashToken(token);

    const [invitation] = await this.db
      .insert(invitations)
      .values({
        orgId,
        email: input.email,
        role: input.role,
        tokenHash,
        invitedBy: invitedById,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .returning();

    return {
      invitation: {
        id: invitation?.id,
        email: invitation?.email,
        role: invitation?.role,
        invitedBy: invitation?.invitedBy,
        expiresAt: invitation?.expiresAt.toISOString(),
        acceptedAt: null,
        createdAt: invitation?.createdAt.toISOString(),
      },
      token, // Return raw token (for sending via email)
    };
  }

  // ── List Pending Invitations ───────────────────────────────────────

  async listInvitations(orgId: string, pagination: CursorPaginationQuery) {
    const { cursor, limit } = pagination;

    const rows = await this.db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.orgId, orgId),
          isNull(invitations.acceptedAt),
          ...(cursor ? [lt(invitations.createdAt, new Date(cursor))] : []),
        ),
      )
      .orderBy(desc(invitations.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: items.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        invitedBy: inv.invitedBy,
        expiresAt: inv.expiresAt.toISOString(),
        acceptedAt: inv.acceptedAt?.toISOString() ?? null,
        createdAt: inv.createdAt.toISOString(),
      })),
      pagination: {
        next_cursor: hasMore ? items[items.length - 1]?.createdAt.toISOString() : null,
        has_more: hasMore,
      },
    };
  }

  // ── Resend Invitation ──────────────────────────────────────────────

  async resendInvitation(invitationId: string, callerUserId: string) {
    const invitation = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.id, invitationId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!invitation) {
      throw AppError.notFound('invitation');
    }

    if (invitation.acceptedAt) {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Cannot resend an already accepted invitation',
      );
    }

    // Determine which org/ws this invitation belongs to and verify caller permission
    if (invitation.orgId) {
      const caller = await this.db
        .select()
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, invitation.orgId), eq(orgMembers.userId, callerUserId)))
        .limit(1)
        .then((rows) => rows[0]);

      if (!caller || !['owner', 'admin'].includes(caller.role)) {
        throw AppError.forbidden('Only org owner or admin can resend invitations');
      }
    } else if (invitation.workspaceId) {
      const caller = await this.db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, invitation.workspaceId),
            eq(workspaceMembers.userId, callerUserId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!caller || caller.role !== 'admin') {
        throw AppError.forbidden('Only workspace admin can resend invitations');
      }
    }

    // Generate new token and refresh expiry
    const token = generateToken();
    const tokenHash = hashToken(token);

    const [updated] = await this.db
      .update(invitations)
      .set({
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .where(eq(invitations.id, invitationId))
      .returning();

    return {
      invitation: {
        id: updated?.id,
        email: updated?.email,
        role: updated?.role,
        invitedBy: updated?.invitedBy,
        expiresAt: updated?.expiresAt.toISOString(),
        acceptedAt: null,
        createdAt: updated?.createdAt.toISOString(),
      },
      token, // Return raw token (for sending via email)
    };
  }

  // ── Cancel Invitation ──────────────────────────────────────────────

  async cancelInvitation(invitationId: string, callerUserId: string) {
    const invitation = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.id, invitationId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!invitation) {
      throw AppError.notFound('invitation');
    }

    // Verify caller has admin+ permission on the relevant org or workspace
    if (invitation.orgId) {
      const callerMember = await this.db
        .select()
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, invitation.orgId), eq(orgMembers.userId, callerUserId)))
        .limit(1)
        .then((rows) => rows[0]);
      if (!callerMember || callerMember.role === 'member') {
        throw AppError.forbidden('Only org admins can cancel invitations');
      }
    } else if (invitation.workspaceId) {
      const callerMember = await this.db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, invitation.workspaceId),
            eq(workspaceMembers.userId, callerUserId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (!callerMember || callerMember.role !== 'admin') {
        throw AppError.forbidden('Only workspace admins can cancel invitations');
      }
    }

    await this.db.delete(invitations).where(eq(invitations.id, invitationId));
  }

  // ── Accept Invitation ──────────────────────────────────────────────

  async acceptInvitation(userId: string, token: string): Promise<{ orgId: string } | null> {
    const tokenHash = hashToken(token);

    const invitation = await this.db
      .select()
      .from(invitations)
      .where(and(eq(invitations.tokenHash, tokenHash), isNull(invitations.acceptedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!invitation) return null;

    // Only handle org invitations
    if (!invitation.orgId) return null;

    // Check expiry
    if (new Date() > invitation.expiresAt) {
      throw AppError.badRequest(ErrorCode.INVITATION_EXPIRED, 'This invitation has expired');
    }

    // Mark as accepted
    await this.db
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invitation.id));

    // Add as member
    await this.db
      .insert(orgMembers)
      .values({
        orgId: invitation.orgId,
        userId,
        role: invitation.role,
      })
      .onConflictDoNothing();

    return { orgId: invitation.orgId };
  }
}
