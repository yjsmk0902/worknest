import {
  type Database,
  wikiPageRevisions,
  wikiPages,
  wikiSpaceMembers,
} from '@worknest/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { AppError } from '../lib/errors';

// Dedupe window: consecutive edits by the same author within this window
// reuse the same revision slot instead of creating a new entry.
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
// How many revisions to keep per page before pruning oldest.
const MAX_REVISIONS_PER_PAGE = 50;

async function requireSpaceMembership(db: Database, spaceId: string, userId: string) {
  const member = await db
    .select({ role: wikiSpaceMembers.role })
    .from(wikiSpaceMembers)
    .where(
      and(
        eq(wikiSpaceMembers.wikiSpaceId, spaceId),
        eq(wikiSpaceMembers.userId, userId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);
  if (!member) throw AppError.forbidden('You are not a member of this wiki space');
  return member;
}

async function requireEditor(db: Database, spaceId: string, userId: string) {
  const member = await requireSpaceMembership(db, spaceId, userId);
  if (member.role !== 'editor') {
    throw AppError.forbidden('Editor role required for this action');
  }
}

export interface SnapshotInput {
  pageId: string;
  title: string;
  icon: string | null;
  content: unknown | null;
  contentText: string | null;
  authorId: string;
}

/**
 * Shared revision service — writes snapshots (with dedupe) and exposes
 * list/get/restore operations used by the wiki page service and the
 * revision route.
 */
export class WikiRevisionService {
  constructor(private db: Database) {}

  /**
   * Record a revision for a page. If the most recent revision belongs to
   * the same author AND is within {@link DEDUPE_WINDOW_MS}, overwrite it
   * in place instead of appending. This keeps fast consecutive autosaves
   * from flooding the timeline with near-identical entries.
   */
  async snapshot(input: SnapshotInput): Promise<void> {
    const latest = await this.db
      .select({
        id: wikiPageRevisions.id,
        authorId: wikiPageRevisions.authorId,
        createdAt: wikiPageRevisions.createdAt,
      })
      .from(wikiPageRevisions)
      .where(eq(wikiPageRevisions.pageId, input.pageId))
      .orderBy(desc(wikiPageRevisions.createdAt))
      .limit(1)
      .then((rows) => rows[0]);

    const now = Date.now();
    if (
      latest &&
      latest.authorId === input.authorId &&
      now - latest.createdAt.getTime() < DEDUPE_WINDOW_MS
    ) {
      await this.db
        .update(wikiPageRevisions)
        .set({
          title: input.title,
          icon: input.icon,
          content: input.content,
          contentText: input.contentText,
          createdAt: new Date(now),
        })
        .where(eq(wikiPageRevisions.id, latest.id));
      return;
    }

    await this.db.insert(wikiPageRevisions).values({
      pageId: input.pageId,
      title: input.title,
      icon: input.icon,
      content: input.content,
      contentText: input.contentText,
      authorId: input.authorId,
    });

    await this.pruneOldRevisions(input.pageId);
  }

  private async pruneOldRevisions(pageId: string): Promise<void> {
    const rows = await this.db
      .select({ id: wikiPageRevisions.id })
      .from(wikiPageRevisions)
      .where(eq(wikiPageRevisions.pageId, pageId))
      .orderBy(desc(wikiPageRevisions.createdAt))
      .offset(MAX_REVISIONS_PER_PAGE);

    if (rows.length === 0) return;
    for (const row of rows) {
      await this.db
        .delete(wikiPageRevisions)
        .where(eq(wikiPageRevisions.id, row.id));
    }
  }

  // ── Public read APIs ─────────────────────────────────────────────

  async list(pageId: string, callerUserId: string) {
    const page = await this.db
      .select({ wikiSpaceId: wikiPages.wikiSpaceId })
      .from(wikiPages)
      .where(and(eq(wikiPages.id, pageId), isNull(wikiPages.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);
    if (!page) throw AppError.notFound('wiki_page');
    await requireSpaceMembership(this.db, page.wikiSpaceId, callerUserId);

    const rows = await this.db
      .select({
        id: wikiPageRevisions.id,
        pageId: wikiPageRevisions.pageId,
        title: wikiPageRevisions.title,
        icon: wikiPageRevisions.icon,
        authorId: wikiPageRevisions.authorId,
        createdAt: wikiPageRevisions.createdAt,
      })
      .from(wikiPageRevisions)
      .where(eq(wikiPageRevisions.pageId, pageId))
      .orderBy(desc(wikiPageRevisions.createdAt));

    return rows.map((row) => ({
      id: row.id,
      pageId: row.pageId,
      title: row.title,
      icon: row.icon ?? null,
      authorId: row.authorId ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getOne(pageId: string, revisionId: string, callerUserId: string) {
    const page = await this.db
      .select({ wikiSpaceId: wikiPages.wikiSpaceId })
      .from(wikiPages)
      .where(and(eq(wikiPages.id, pageId), isNull(wikiPages.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);
    if (!page) throw AppError.notFound('wiki_page');
    await requireSpaceMembership(this.db, page.wikiSpaceId, callerUserId);

    const row = await this.db
      .select()
      .from(wikiPageRevisions)
      .where(
        and(
          eq(wikiPageRevisions.id, revisionId),
          eq(wikiPageRevisions.pageId, pageId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);
    if (!row) throw AppError.notFound('wiki_page_revision');

    return {
      id: row.id,
      pageId: row.pageId,
      title: row.title,
      icon: row.icon ?? null,
      content: row.content ?? null,
      contentText: row.contentText ?? null,
      authorId: row.authorId ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async restore(pageId: string, revisionId: string, callerUserId: string) {
    const page = await this.db
      .select()
      .from(wikiPages)
      .where(and(eq(wikiPages.id, pageId), isNull(wikiPages.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);
    if (!page) throw AppError.notFound('wiki_page');
    await requireEditor(this.db, page.wikiSpaceId, callerUserId);

    const revision = await this.db
      .select()
      .from(wikiPageRevisions)
      .where(
        and(
          eq(wikiPageRevisions.id, revisionId),
          eq(wikiPageRevisions.pageId, pageId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);
    if (!revision) throw AppError.notFound('wiki_page_revision');

    // Snapshot the current state before overwriting, so the user can always
    // undo a restore by going back one more step.
    await this.snapshot({
      pageId,
      title: page.title,
      icon: page.icon ?? null,
      content: page.content,
      contentText: page.contentText ?? null,
      authorId: callerUserId,
    });

    await this.db
      .update(wikiPages)
      .set({
        title: revision.title,
        icon: revision.icon,
        content: revision.content,
        contentText: revision.contentText,
        updatedAt: new Date(),
      })
      .where(eq(wikiPages.id, pageId));
  }
}
