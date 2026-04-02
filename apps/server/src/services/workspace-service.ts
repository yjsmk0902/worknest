import { eq, and, isNull, lt, desc } from "drizzle-orm";
import {
  workspaces,
  workspaceMembers,
  invitations,
  users,
  orgMembers,
  type Database,
} from "@worknest/db";
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  CreateWsInvitationInput,
  WsRole,
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

export class WorkspaceService {
  constructor(private db: Database) {}

  // ── List Workspaces for an Org ─────────────────────────────────────

  async listByOrg(
    orgId: string,
    userId: string,
    pagination: CursorPaginationQuery,
  ) {
    const { cursor, limit } = pagination;

    const rows = await this.db
      .select({
        ws: workspaces,
        member: workspaceMembers,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaces.orgId, orgId),
          eq(workspaceMembers.userId, userId),
          isNull(workspaces.deletedAt),
          ...(cursor ? [lt(workspaces.id, cursor)] : []),
        ),
      )
      .orderBy(desc(workspaces.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: items.map((row) => ({
        id: row.ws.id,
        orgId: row.ws.orgId,
        name: row.ws.name,
        slug: row.ws.slug,
        logo: row.ws.logo,
        description: row.ws.description,
        createdAt: row.ws.createdAt.toISOString(),
        updatedAt: row.ws.updatedAt.toISOString(),
        role: row.member.role,
      })),
      pagination: {
        next_cursor: hasMore ? items[items.length - 1]!.ws.id : null,
        has_more: hasMore,
      },
    };
  }

  // ── Create Workspace ───────────────────────────────────────────────

  async create(orgId: string, userId: string, input: CreateWorkspaceInput) {
    // Verify user is org admin or owner
    const orgMember = await this.db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!orgMember || !["owner", "admin"].includes(orgMember.role)) {
      throw AppError.forbidden("Only org owner or admin can create workspaces");
    }

    // Check slug uniqueness within org
    const existing = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.orgId, orgId),
          eq(workspaces.slug, input.slug),
          isNull(workspaces.deletedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw AppError.conflict(ErrorCode.SLUG_ALREADY_EXISTS, "Workspace slug already taken in this organization");
    }

    const [ws] = await this.db
      .insert(workspaces)
      .values({
        orgId,
        name: input.name,
        slug: input.slug,
        logo: input.logo ?? null,
        description: input.description ?? null,
      })
      .returning();

    // Make creator an admin
    await this.db.insert(workspaceMembers).values({
      workspaceId: ws!.id,
      userId,
      role: "admin",
    });

    return {
      id: ws!.id,
      orgId: ws!.orgId,
      name: ws!.name,
      slug: ws!.slug,
      logo: ws!.logo,
      description: ws!.description,
      createdAt: ws!.createdAt.toISOString(),
      updatedAt: ws!.updatedAt.toISOString(),
    };
  }

  // ── Get Workspace ──────────────────────────────────────────────────

  async getById(id: string) {
    const ws = await this.db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.id, id), isNull(workspaces.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!ws) {
      throw AppError.notFound("workspace");
    }

    return {
      id: ws.id,
      orgId: ws.orgId,
      name: ws.name,
      slug: ws.slug,
      logo: ws.logo,
      description: ws.description,
      createdAt: ws.createdAt.toISOString(),
      updatedAt: ws.updatedAt.toISOString(),
    };
  }

  // ── Update Workspace ───────────────────────────────────────────────

  async update(id: string, input: UpdateWorkspaceInput) {
    // If slug is changing, check uniqueness within org
    if (input.slug) {
      const current = await this.db
        .select({ orgId: workspaces.orgId })
        .from(workspaces)
        .where(eq(workspaces.id, id))
        .limit(1)
        .then((rows) => rows[0]);

      if (current) {
        const existing = await this.db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(
            and(
              eq(workspaces.orgId, current.orgId),
              eq(workspaces.slug, input.slug),
              isNull(workspaces.deletedAt),
            ),
          )
          .limit(1);

        if (existing.length > 0 && existing[0]!.id !== id) {
          throw AppError.conflict(
            ErrorCode.SLUG_ALREADY_EXISTS,
            "Workspace slug already taken in this organization",
          );
        }
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.slug !== undefined) updates.slug = input.slug;
    if (input.logo !== undefined) updates.logo = input.logo;
    if (input.description !== undefined) updates.description = input.description;

    const updated = await this.db
      .update(workspaces)
      .set(updates)
      .where(and(eq(workspaces.id, id), isNull(workspaces.deletedAt)))
      .returning()
      .then((rows) => rows[0]);

    if (!updated) {
      throw AppError.notFound("workspace");
    }

    return {
      id: updated.id,
      orgId: updated.orgId,
      name: updated.name,
      slug: updated.slug,
      logo: updated.logo,
      description: updated.description,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ── Soft Delete Workspace ──────────────────────────────────────────

  async softDelete(id: string, userId: string) {
    // Verify the user is a workspace admin
    const member = await this.db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, id),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!member || member.role !== "admin") {
      throw AppError.forbidden("Only workspace admin can delete a workspace");
    }

    const updated = await this.db
      .update(workspaces)
      .set({ deletedAt: new Date() })
      .where(and(eq(workspaces.id, id), isNull(workspaces.deletedAt)))
      .returning()
      .then((rows) => rows[0]);

    if (!updated) {
      throw AppError.notFound("workspace");
    }
  }

  // ── List Members ───────────────────────────────────────────────────

  async listMembers(wsId: string, pagination: CursorPaginationQuery) {
    const { cursor, limit } = pagination;

    const rows = await this.db
      .select({
        member: workspaceMembers,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(
        and(
          eq(workspaceMembers.workspaceId, wsId),
          ...(cursor ? [lt(workspaceMembers.id, cursor)] : []),
        ),
      )
      .orderBy(desc(workspaceMembers.joinedAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: items.map((row) => ({
        id: row.member.id,
        workspaceId: row.member.workspaceId,
        userId: row.member.userId,
        role: row.member.role as WsRole,
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

  async updateMemberRole(memberId: string, role: WsRole) {
    const member = await this.db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.id, memberId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!member) {
      throw AppError.notFound("member");
    }

    const [updated] = await this.db
      .update(workspaceMembers)
      .set({ role })
      .where(eq(workspaceMembers.id, memberId))
      .returning();

    return updated;
  }

  // ── Remove Member ──────────────────────────────────────────────────

  async removeMember(memberId: string) {
    const member = await this.db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.id, memberId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!member) {
      throw AppError.notFound("member");
    }

    await this.db
      .delete(workspaceMembers)
      .where(eq(workspaceMembers.id, memberId));
  }

  // ── Create Invitation ──────────────────────────────────────────────

  async createInvitation(
    wsId: string,
    invitedById: string,
    input: CreateWsInvitationInput,
  ) {
    // Check if already a member
    const existingMember = await this.db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(
        and(
          eq(workspaceMembers.workspaceId, wsId),
          eq(users.email, input.email),
        ),
      )
      .limit(1);

    if (existingMember.length > 0) {
      throw AppError.conflict(ErrorCode.ALREADY_A_MEMBER, "User is already a member of this workspace");
    }

    // Check for existing pending invitation
    const existingInvitation = await this.db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.workspaceId, wsId),
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
        workspaceId: wsId,
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
      token,
    };
  }

  // ── List Pending Invitations ───────────────────────────────────────

  async listInvitations(wsId: string, pagination: CursorPaginationQuery) {
    const { cursor, limit } = pagination;

    const rows = await this.db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.workspaceId, wsId),
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

  // ── Accept Invitation ──────────────────────────────────────────────

  async acceptInvitation(
    userId: string,
    token: string,
  ): Promise<{ workspaceId: string } | null> {
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

    // Only handle workspace invitations
    if (!invitation.workspaceId) return null;

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
      .insert(workspaceMembers)
      .values({
        workspaceId: invitation.workspaceId,
        userId,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
      })
      .onConflictDoNothing();

    return { workspaceId: invitation.workspaceId };
  }
}
