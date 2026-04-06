import { eq, and, asc, isNull, sql } from "drizzle-orm";
import {
  wikiPages,
  wikiSpaceMembers,
  type Database,
} from "@worknest/db";
import type {
  CreateWikiPageInput,
  UpdateWikiPageInput,
} from "@worknest/shared";
import { AppError, ErrorCode } from "../lib/errors";
import { sanitizeContent } from "../lib/sanitize";
import { extractPlainText } from "../lib/extract-text";

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Verify that the caller is a member of the wiki space.
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

/**
 * Get the spaceId for a page, verifying the page exists and is not deleted.
 */
async function getPageWithSpaceId(
  db: Database,
  pageId: string,
) {
  const page = await db
    .select()
    .from(wikiPages)
    .where(and(eq(wikiPages.id, pageId), isNull(wikiPages.deletedAt)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!page) {
    throw AppError.notFound("wiki_page");
  }

  return page;
}

/**
 * Check if moving a page to newParentId would create a circular reference.
 * Uses a recursive CTE to walk from newParentId up the tree and see if we
 * encounter the page being moved (pageId).
 */
async function checkCircularReference(
  db: Database,
  pageId: string,
  newParentId: string,
): Promise<boolean> {
  const result = await db.execute(
    sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, parent_id
        FROM wiki_pages
        WHERE id = ${newParentId} AND deleted_at IS NULL
        UNION ALL
        SELECT wp.id, wp.parent_id
        FROM wiki_pages wp
        INNER JOIN ancestors a ON a.parent_id = wp.id
        WHERE wp.deleted_at IS NULL
      )
      SELECT 1 AS found FROM ancestors WHERE id = ${pageId} LIMIT 1
    `,
  );

  return (result as unknown as { found?: number }[]).length > 0;
}

// ── Serialisation ──────────────────────────────────────────────────────

function toPageOutput(row: typeof wikiPages.$inferSelect) {
  return {
    id: row.id,
    wikiSpaceId: row.wikiSpaceId,
    title: row.title,
    slug: row.slug,
    content: row.content ?? null,
    contentFormat: row.contentFormat,
    parentId: row.parentId ?? null,
    sortOrder: row.sortOrder,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Service ────────────────────────────────────────────────────────────

export class WikiPageService {
  constructor(private db: Database) {}

  // ── List Pages ───────────────────────────────────────────────────

  async list(spaceId: string, callerUserId: string) {
    await requireSpaceMembership(this.db, spaceId, callerUserId);

    const rows = await this.db
      .select()
      .from(wikiPages)
      .where(
        and(eq(wikiPages.wikiSpaceId, spaceId), isNull(wikiPages.deletedAt)),
      )
      .orderBy(asc(wikiPages.sortOrder));

    return {
      data: rows.map(toPageOutput),
      pagination: {
        next_cursor: null,
        has_more: false,
      },
    };
  }

  // ── Create Page ──────────────────────────────────────────────────

  async create(
    spaceId: string,
    callerUserId: string,
    input: CreateWikiPageInput,
  ) {
    await requireEditorRole(this.db, spaceId, callerUserId);

    // Validate parentId if provided
    if (input.parentId) {
      const parent = await this.db
        .select({ id: wikiPages.id })
        .from(wikiPages)
        .where(
          and(
            eq(wikiPages.id, input.parentId),
            eq(wikiPages.wikiSpaceId, spaceId),
            isNull(wikiPages.deletedAt),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!parent) {
        throw AppError.notFound("parent_page");
      }
    }

    // Sanitize content if provided
    const sanitized = input.content ? sanitizeContent(input.content) : null;
    const contentText = sanitized ? extractPlainText(sanitized) : null;

    const [page] = await this.db
      .insert(wikiPages)
      .values({
        wikiSpaceId: spaceId,
        createdBy: callerUserId,
        title: input.title,
        slug: input.slug,
        content: sanitized,
        contentText,
        parentId: input.parentId ?? null,
      })
      .returning();

    return toPageOutput(page!);
  }

  // ── Get Page by ID ──────────────────────────────────────────────

  async getById(pageId: string, callerUserId: string) {
    const page = await getPageWithSpaceId(this.db, pageId);
    await requireSpaceMembership(this.db, page.wikiSpaceId, callerUserId);

    return toPageOutput(page);
  }

  // ── Update Page ─────────────────────────────────────────────────

  async update(
    pageId: string,
    callerUserId: string,
    input: UpdateWikiPageInput,
  ) {
    const page = await getPageWithSpaceId(this.db, pageId);
    await requireEditorRole(this.db, page.wikiSpaceId, callerUserId);

    // Check circular reference if parentId is changing
    if (
      input.parentId !== undefined &&
      input.parentId !== null &&
      input.parentId !== page.parentId
    ) {
      // Validate parent exists in the same space
      const parent = await this.db
        .select({ id: wikiPages.id })
        .from(wikiPages)
        .where(
          and(
            eq(wikiPages.id, input.parentId),
            eq(wikiPages.wikiSpaceId, page.wikiSpaceId),
            isNull(wikiPages.deletedAt),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!parent) {
        throw AppError.notFound("parent_page");
      }

      // Cannot set self as parent
      if (input.parentId === pageId) {
        throw AppError.badRequest(
          ErrorCode.CIRCULAR_REFERENCE,
          "A page cannot be its own parent",
        );
      }

      const isCircular = await checkCircularReference(
        this.db,
        pageId,
        input.parentId,
      );

      if (isCircular) {
        throw AppError.badRequest(
          ErrorCode.CIRCULAR_REFERENCE,
          "Moving this page would create a circular reference",
        );
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) updates.title = input.title;
    if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
    if (input.parentId !== undefined) updates.parentId = input.parentId;

    if (input.content !== undefined) {
      const sanitized = sanitizeContent(input.content);
      updates.content = sanitized;
      updates.contentText = extractPlainText(sanitized);
    }

    const [updated] = await this.db
      .update(wikiPages)
      .set(updates)
      .where(eq(wikiPages.id, pageId))
      .returning();

    return toPageOutput(updated!);
  }

  // ── Move Page ───────────────────────────────────────────────────

  async move(
    pageId: string,
    callerUserId: string,
    newParentId: string | null,
    newSortOrder: string,
  ) {
    const page = await getPageWithSpaceId(this.db, pageId);
    await requireEditorRole(this.db, page.wikiSpaceId, callerUserId);

    if (newParentId !== null) {
      // Validate parent exists in same space
      const parent = await this.db
        .select({ id: wikiPages.id })
        .from(wikiPages)
        .where(
          and(
            eq(wikiPages.id, newParentId),
            eq(wikiPages.wikiSpaceId, page.wikiSpaceId),
            isNull(wikiPages.deletedAt),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!parent) {
        throw AppError.notFound("parent_page");
      }

      if (newParentId === pageId) {
        throw AppError.badRequest(
          ErrorCode.CIRCULAR_REFERENCE,
          "A page cannot be its own parent",
        );
      }

      const isCircular = await checkCircularReference(
        this.db,
        pageId,
        newParentId,
      );

      if (isCircular) {
        throw AppError.badRequest(
          ErrorCode.CIRCULAR_REFERENCE,
          "Moving this page would create a circular reference",
        );
      }
    }

    const [updated] = await this.db
      .update(wikiPages)
      .set({
        parentId: newParentId,
        sortOrder: newSortOrder,
        updatedAt: new Date(),
      })
      .where(eq(wikiPages.id, pageId))
      .returning();

    return toPageOutput(updated!);
  }

  // ── Delete Page (soft delete) ────────────────────────────────────

  async delete(pageId: string, callerUserId: string) {
    const page = await getPageWithSpaceId(this.db, pageId);
    await requireEditorRole(this.db, page.wikiSpaceId, callerUserId);

    await this.db.transaction(async (tx) => {
      // Re-parent direct children to the deleted page's parent (promote up one level)
      await tx
        .update(wikiPages)
        .set({ parentId: page.parentId ?? null, updatedAt: new Date() })
        .where(
          and(eq(wikiPages.parentId, pageId), isNull(wikiPages.deletedAt)),
        );

      // Soft-delete the page
      await tx
        .update(wikiPages)
        .set({ deletedAt: new Date() })
        .where(eq(wikiPages.id, pageId));
    });
  }

  // ── Get Tree ────────────────────────────────────────────────────

  async getTree(spaceId: string, callerUserId: string) {
    await requireSpaceMembership(this.db, spaceId, callerUserId);

    // Return all non-deleted pages ordered by sortOrder for tree building
    const rows = await this.db
      .select({
        id: wikiPages.id,
        wikiSpaceId: wikiPages.wikiSpaceId,
        title: wikiPages.title,
        slug: wikiPages.slug,
        parentId: wikiPages.parentId,
        sortOrder: wikiPages.sortOrder,
        createdBy: wikiPages.createdBy,
        createdAt: wikiPages.createdAt,
        updatedAt: wikiPages.updatedAt,
      })
      .from(wikiPages)
      .where(
        and(eq(wikiPages.wikiSpaceId, spaceId), isNull(wikiPages.deletedAt)),
      )
      .orderBy(asc(wikiPages.sortOrder));

    return {
      data: rows.map((row) => ({
        id: row.id,
        wikiSpaceId: row.wikiSpaceId,
        title: row.title,
        slug: row.slug,
        parentId: row.parentId ?? null,
        sortOrder: row.sortOrder,
        createdBy: row.createdBy ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      pagination: {
        next_cursor: null,
        has_more: false,
      },
    };
  }
}
