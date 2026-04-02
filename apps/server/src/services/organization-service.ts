import { eq, and, isNull, lt, desc } from "drizzle-orm";
import {
  organizations,
  orgMembers,
  invitations,
  users,
  type Database,
} from "@worknest/db";
import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  CreateOrgInvitationInput,
  OrgRole,
  CursorPaginationQuery,
} from "@worknest/shared";
import { AppError, ErrorCode } from "../lib/errors";
import crypto from "node:crypto";

// ── Helpers ────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// ── Service ────────────────────────────────────────────────────────────

export class OrganizationService {
  constructor(private db: Database) {}

  // ── List User's Orgs ───────────────────────────────────────────────

  async listByUser(userId: string, pagination: CursorPaginationQuery) {
    const { cursor, limit } = pagination;

    let query = this.db
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
          ...(cursor ? [lt(organizations.id, cursor)] : []),
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
        next_cursor: hasMore ? items[items.length - 1]!.org.id : null,
        has_more: hasMore,
      },
    };
  }

  // ── Create Org ─────────────────────────────────────────────────────

  async create(userId: string, input: CreateOrganizationInput) {
    // Check slug uniqueness
    const existing = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(
        and(
          eq(organizations.slug, input.slug),
          isNull(organizations.deletedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw AppError.conflict(ErrorCode.SLUG_ALREADY_EXISTS, "Organization slug already taken");
    }

    // Create org + membership in a single transaction (Drizzle doesn't have
    // built-in transactions via the query builder, so we do sequential inserts —
    // the caller can wrap in a transaction if needed, but for MVP this is fine)
    const [org] = await this.db
      .insert(organizations)
      .values({
        name: input.name,
        slug: input.slug,
        logo: input.logo ?? null,
      })
      .returning();

    // Make creator the owner
    await this.db.insert(orgMembers).values({
      orgId: org!.id,
      userId,
      role: "owner",
    });

    return {
      id: org!.id,
      name: org!.name,
      slug: org!.slug,
      logo: org!.logo,
      createdAt: org!.createdAt.toISOString(),
      updatedAt: org!.updatedAt.toISOString(),
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
      throw AppError.notFound("organization");
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

  // ── Update Org ─────────────────────────────────────────────────────

  async update(id: string, input: UpdateOrganizationInput) {
    // If slug is changing, check uniqueness
    if (input.slug) {
      const existing = await this.db
        .select({ id: organizations.id })
        .from(organizations)
        .where(
          and(
            eq(organizations.slug, input.slug),
            isNull(organizations.deletedAt),
          ),
        )
        .limit(1);

      if (existing.length > 0 && existing[0]!.id !== id) {
        throw AppError.conflict(ErrorCode.SLUG_ALREADY_EXISTS, "Organization slug already taken");
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.slug !== undefined) updates.slug = input.slug;
    if (input.logo !== undefined) updates.logo = input.logo;

    const updated = await this.db
      .update(organizations)
      .set(updates)
      .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
      .returning()
      .then((rows) => rows[0]);

    if (!updated) {
      throw AppError.notFound("organization");
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

    if (!member || member.role !== "owner") {
      throw AppError.forbidden("Only the owner can delete an organization");
    }

    const updated = await this.db
      .update(organizations)
      .set({ deletedAt: new Date() })
      .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
      .returning()
      .then((rows) => rows[0]);

    if (!updated) {
      throw AppError.notFound("organization");
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
          ...(cursor ? [lt(orgMembers.id, cursor)] : []),
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
        next_cursor: hasMore ? items[items.length - 1]!.member.id : null,
        has_more: hasMore,
      },
    };
  }

  // ── Update Member Role ─────────────────────────────────────────────

  async updateMemberRole(memberId: string, role: OrgRole) {
    // Cannot change to owner via this endpoint
    if (role === "owner") {
      throw AppError.forbidden("Cannot assign owner role through this endpoint");
    }

    const member = await this.db
      .select()
      .from(orgMembers)
      .where(eq(orgMembers.id, memberId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!member) {
      throw AppError.notFound("member");
    }

    if (member.role === "owner") {
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

  async removeMember(memberId: string) {
    const member = await this.db
      .select()
      .from(orgMembers)
      .where(eq(orgMembers.id, memberId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!member) {
      throw AppError.notFound("member");
    }

    if (member.role === "owner") {
      throw AppError.forbidden("Cannot remove the organization owner");
    }

    await this.db.delete(orgMembers).where(eq(orgMembers.id, memberId));
  }

  // ── Create Invitation ──────────────────────────────────────────────

  async createInvitation(
    orgId: string,
    invitedById: string,
    input: CreateOrgInvitationInput,
  ) {
    // Check if already a member
    const existingMember = await this.db
      .select({ id: orgMembers.id })
      .from(orgMembers)
      .innerJoin(users, eq(orgMembers.userId, users.id))
      .where(
        and(
          eq(orgMembers.orgId, orgId),
          eq(users.email, input.email),
        ),
      )
      .limit(1);

    if (existingMember.length > 0) {
      throw AppError.conflict(ErrorCode.ALREADY_A_MEMBER, "User is already a member of this organization");
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
        "An invitation has already been sent to this email",
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
        id: invitation!.id,
        email: invitation!.email,
        role: invitation!.role,
        invitedBy: invitation!.invitedBy,
        expiresAt: invitation!.expiresAt.toISOString(),
        acceptedAt: null,
        createdAt: invitation!.createdAt.toISOString(),
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
          ...(cursor ? [lt(invitations.id, cursor)] : []),
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
        next_cursor: hasMore ? items[items.length - 1]!.id : null,
        has_more: hasMore,
      },
    };
  }

  // ── Cancel Invitation ──────────────────────────────────────────────

  async cancelInvitation(invitationId: string) {
    const invitation = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.id, invitationId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!invitation) {
      throw AppError.notFound("invitation");
    }

    await this.db.delete(invitations).where(eq(invitations.id, invitationId));
  }

  // ── Accept Invitation ──────────────────────────────────────────────

  async acceptInvitation(
    userId: string,
    token: string,
  ): Promise<{ orgId: string } | null> {
    const tokenHash = hashToken(token);

    const invitation = await this.db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.tokenHash, tokenHash),
          isNull(invitations.acceptedAt),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!invitation) return null;

    // Only handle org invitations
    if (!invitation.orgId) return null;

    // Check expiry
    if (new Date() > invitation.expiresAt) {
      throw AppError.badRequest(ErrorCode.INVITATION_EXPIRED, "This invitation has expired");
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
