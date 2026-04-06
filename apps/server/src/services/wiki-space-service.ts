import { eq, and, asc, count } from "drizzle-orm";
import {
  wikiSpaces,
  wikiSpaceMembers,
  type Database,
} from "@worknest/db";
import type {
  CreateWikiSpaceInput,
  UpdateWikiSpaceInput,
  AddWikiSpaceMemberInput,
  WikiSpaceRole,
} from "@worknest/shared";
import { AppError, ErrorCode } from "../lib/errors";

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Verify that the caller is a member of the wiki space.
 * Returns the membership record.
 */
async function requireSpaceMembership(
  db: Database,
  spaceId: string,
  userId: string,
) {
  const member = await db
    .select()
    .from(wikiSpaceMembers)
    .where(
      and(
        eq(wikiSpaceMembers.wikiSpaceId, spaceId),
        eq(wikiSpaceMembers.userId, userId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!member) {
    throw AppError.forbidden("You are not a member of this wiki space");
  }

  return member;
}

/**
 * Verify that the caller has the 'editor' role in the wiki space.
 */
async function requireEditorRole(
  db: Database,
  spaceId: string,
  userId: string,
) {
  const member = await requireSpaceMembership(db, spaceId, userId);

  if (member.role !== "editor") {
    throw AppError.forbidden("Editor role required for this action");
  }

  return member;
}

// ── Serialisation ──────────────────────────────────────────────────────

function toSpaceOutput(row: typeof wikiSpaces.$inferSelect) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description ?? null,
    slug: row.slug,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMemberOutput(row: typeof wikiSpaceMembers.$inferSelect) {
  return {
    id: row.id,
    wikiSpaceId: row.wikiSpaceId,
    userId: row.userId,
    role: row.role as "editor" | "viewer",
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Service ────────────────────────────────────────────────────────────

export class WikiSpaceService {
  constructor(private db: Database) {}

  // ── List Spaces ──────────────────────────────────────────────────

  async list(workspaceId: string, callerUserId: string) {
    // Return spaces where the user is a member
    const memberSpaces = await this.db
      .select({ space: wikiSpaces })
      .from(wikiSpaces)
      .innerJoin(
        wikiSpaceMembers,
        and(
          eq(wikiSpaceMembers.wikiSpaceId, wikiSpaces.id),
          eq(wikiSpaceMembers.userId, callerUserId),
        ),
      )
      .where(eq(wikiSpaces.workspaceId, workspaceId))
      .orderBy(asc(wikiSpaces.createdAt));

    return {
      data: memberSpaces.map((r) => toSpaceOutput(r.space)),
      pagination: {
        next_cursor: null,
        has_more: false,
      },
    };
  }

  // ── Create Space ─────────────────────────────────────────────────

  async create(
    workspaceId: string,
    callerUserId: string,
    input: CreateWikiSpaceInput,
  ) {
    // Check slug uniqueness within workspace
    const existing = await this.db
      .select({ id: wikiSpaces.id })
      .from(wikiSpaces)
      .where(
        and(
          eq(wikiSpaces.workspaceId, workspaceId),
          eq(wikiSpaces.slug, input.slug),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      throw AppError.conflict(
        ErrorCode.SLUG_ALREADY_EXISTS,
        "A wiki space with this slug already exists in this workspace",
      );
    }

    // Create space + add creator as editor in a transaction
    const result = await this.db.transaction(async (tx) => {
      const [space] = await tx
        .insert(wikiSpaces)
        .values({
          workspaceId,
          createdBy: callerUserId,
          name: input.name,
          description: input.description ?? null,
          slug: input.slug,
        })
        .returning();

      await tx.insert(wikiSpaceMembers).values({
        wikiSpaceId: space!.id,
        userId: callerUserId,
        role: "editor",
      });

      return space!;
    });

    return toSpaceOutput(result);
  }

  // ── Get Space by ID ──────────────────────────────────────────────

  async getById(spaceId: string, callerUserId: string) {
    const space = await this.db
      .select()
      .from(wikiSpaces)
      .where(eq(wikiSpaces.id, spaceId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!space) {
      throw AppError.notFound("wiki_space");
    }

    await requireSpaceMembership(this.db, spaceId, callerUserId);

    return toSpaceOutput(space);
  }

  // ── Update Space ─────────────────────────────────────────────────

  async update(
    spaceId: string,
    callerUserId: string,
    input: UpdateWikiSpaceInput,
  ) {
    const space = await this.db
      .select()
      .from(wikiSpaces)
      .where(eq(wikiSpaces.id, spaceId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!space) {
      throw AppError.notFound("wiki_space");
    }

    await requireEditorRole(this.db, spaceId, callerUserId);

    // Check slug uniqueness if slug is being updated
    if (input.slug && input.slug !== space.slug) {
      const slugExists = await this.db
        .select({ id: wikiSpaces.id })
        .from(wikiSpaces)
        .where(
          and(
            eq(wikiSpaces.workspaceId, space.workspaceId),
            eq(wikiSpaces.slug, input.slug),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (slugExists) {
        throw AppError.conflict(
          ErrorCode.SLUG_ALREADY_EXISTS,
          "A wiki space with this slug already exists in this workspace",
        );
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.slug !== undefined) updates.slug = input.slug;

    const [updated] = await this.db
      .update(wikiSpaces)
      .set(updates)
      .where(eq(wikiSpaces.id, spaceId))
      .returning();

    return toSpaceOutput(updated!);
  }

  // ── Delete Space ─────────────────────────────────────────────────

  async delete(spaceId: string, callerUserId: string) {
    const space = await this.db
      .select()
      .from(wikiSpaces)
      .where(eq(wikiSpaces.id, spaceId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!space) {
      throw AppError.notFound("wiki_space");
    }

    await requireEditorRole(this.db, spaceId, callerUserId);

    await this.db.delete(wikiSpaces).where(eq(wikiSpaces.id, spaceId));
  }

  // ── List Members ─────────────────────────────────────────────────

  async listMembers(spaceId: string, callerUserId: string) {
    await requireSpaceMembership(this.db, spaceId, callerUserId);

    const rows = await this.db
      .select()
      .from(wikiSpaceMembers)
      .where(eq(wikiSpaceMembers.wikiSpaceId, spaceId))
      .orderBy(asc(wikiSpaceMembers.createdAt));

    return {
      data: rows.map(toMemberOutput),
      pagination: {
        next_cursor: null,
        has_more: false,
      },
    };
  }

  // ── Add Member ───────────────────────────────────────────────────

  async addMember(
    spaceId: string,
    callerUserId: string,
    input: AddWikiSpaceMemberInput,
  ) {
    await requireEditorRole(this.db, spaceId, callerUserId);

    // Check if already a member
    const existing = await this.db
      .select({ id: wikiSpaceMembers.id })
      .from(wikiSpaceMembers)
      .where(
        and(
          eq(wikiSpaceMembers.wikiSpaceId, spaceId),
          eq(wikiSpaceMembers.userId, input.userId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      throw AppError.conflict(
        ErrorCode.ALREADY_A_MEMBER,
        "User is already a member of this wiki space",
      );
    }

    const [member] = await this.db
      .insert(wikiSpaceMembers)
      .values({
        wikiSpaceId: spaceId,
        userId: input.userId,
        role: input.role,
      })
      .returning();

    return toMemberOutput(member!);
  }

  // ── Update Member Role ───────────────────────────────────────────

  async updateMemberRole(
    spaceId: string,
    callerUserId: string,
    memberId: string,
    role: WikiSpaceRole,
  ) {
    await requireEditorRole(this.db, spaceId, callerUserId);

    const existing = await this.db
      .select()
      .from(wikiSpaceMembers)
      .where(
        and(
          eq(wikiSpaceMembers.id, memberId),
          eq(wikiSpaceMembers.wikiSpaceId, spaceId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound("member");
    }

    // Prevent downgrading the last editor to viewer
    if (existing.role === "editor" && role === "viewer") {
      const [editorCount] = await this.db
        .select({ count: count() })
        .from(wikiSpaceMembers)
        .where(
          and(
            eq(wikiSpaceMembers.wikiSpaceId, spaceId),
            eq(wikiSpaceMembers.role, "editor"),
          ),
        );

      if (editorCount!.count <= 1) {
        throw AppError.badRequest(
          ErrorCode.VALIDATION_ERROR,
          "Cannot downgrade the last editor",
        );
      }
    }

    const [updated] = await this.db
      .update(wikiSpaceMembers)
      .set({ role })
      .where(eq(wikiSpaceMembers.id, memberId))
      .returning();

    return toMemberOutput(updated!);
  }

  // ── Remove Member ────────────────────────────────────────────────

  async removeMember(
    spaceId: string,
    callerUserId: string,
    memberId: string,
  ) {
    await requireEditorRole(this.db, spaceId, callerUserId);

    const existing = await this.db
      .select()
      .from(wikiSpaceMembers)
      .where(
        and(
          eq(wikiSpaceMembers.id, memberId),
          eq(wikiSpaceMembers.wikiSpaceId, spaceId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound("member");
    }

    // Prevent removing the last editor
    if (existing.role === "editor") {
      const [editorCount] = await this.db
        .select({ count: count() })
        .from(wikiSpaceMembers)
        .where(
          and(
            eq(wikiSpaceMembers.wikiSpaceId, spaceId),
            eq(wikiSpaceMembers.role, "editor"),
          ),
        );

      if (editorCount!.count <= 1) {
        throw AppError.badRequest(
          ErrorCode.VALIDATION_ERROR,
          "Cannot remove the last editor",
        );
      }
    }

    await this.db
      .delete(wikiSpaceMembers)
      .where(eq(wikiSpaceMembers.id, memberId));
  }
}
