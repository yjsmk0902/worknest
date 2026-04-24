import { randomBytes } from 'node:crypto';
import {
  type Database,
  wikiPageShares,
  wikiPages,
  wikiSpaceMembers,
  wikiSpaces,
} from '@worknest/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { AppError, ErrorCode } from '../lib/errors';

// ── Helpers ────────────────────────────────────────────────────────────

async function getPageOr404(db: Database, pageId: string) {
  const page = await db
    .select()
    .from(wikiPages)
    .where(and(eq(wikiPages.id, pageId), isNull(wikiPages.deletedAt)))
    .limit(1)
    .then((rows) => rows[0]);
  if (!page) throw AppError.notFound('wiki_page');
  return page;
}

async function requireEditor(db: Database, spaceId: string, userId: string) {
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
  if (member.role !== 'editor') {
    throw AppError.forbidden('Editor role required for this action');
  }
}

function generateShareToken(): string {
  return randomBytes(24).toString('base64url');
}

type ShareRow = typeof wikiPageShares.$inferSelect;

function toShareOutput(row: ShareRow) {
  return {
    id: row.id,
    pageId: row.pageId,
    token: row.token,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdBy: row.createdBy,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export type WikiShareOutput = ReturnType<typeof toShareOutput>;

// ── Service ────────────────────────────────────────────────────────────

export class WikiShareService {
  constructor(private db: Database) {}

  async list(pageId: string, callerUserId: string) {
    const page = await getPageOr404(this.db, pageId);
    await requireEditor(this.db, page.wikiSpaceId, callerUserId);

    const rows = await this.db
      .select()
      .from(wikiPageShares)
      .where(eq(wikiPageShares.pageId, pageId))
      .orderBy(desc(wikiPageShares.createdAt));

    return rows.map(toShareOutput);
  }

  async create(
    pageId: string,
    callerUserId: string,
    input: { expiresAt?: string | null },
  ) {
    const page = await getPageOr404(this.db, pageId);
    await requireEditor(this.db, page.wikiSpaceId, callerUserId);

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())) {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'expiresAt must be a future ISO date',
      );
    }

    const [row] = await this.db
      .insert(wikiPageShares)
      .values({
        pageId,
        token: generateShareToken(),
        expiresAt,
        createdBy: callerUserId,
      })
      .returning();

    return toShareOutput(row!);
  }

  async revoke(pageId: string, shareId: string, callerUserId: string) {
    const page = await getPageOr404(this.db, pageId);
    await requireEditor(this.db, page.wikiSpaceId, callerUserId);

    const [row] = await this.db
      .update(wikiPageShares)
      .set({ revokedAt: new Date() })
      .where(and(eq(wikiPageShares.id, shareId), eq(wikiPageShares.pageId, pageId)))
      .returning();

    if (!row) throw AppError.notFound('wiki_page_share');
    return toShareOutput(row);
  }

  // ── Public (unauthenticated) ─────────────────────────────────────

  async getPublicPage(token: string) {
    const share = await this.db
      .select()
      .from(wikiPageShares)
      .where(eq(wikiPageShares.token, token))
      .limit(1)
      .then((rows) => rows[0]);

    if (!share || share.revokedAt) throw AppError.notFound('wiki_page_share');
    if (share.expiresAt && share.expiresAt <= new Date()) {
      throw AppError.notFound('wiki_page_share');
    }

    const page = await this.db
      .select()
      .from(wikiPages)
      .where(and(eq(wikiPages.id, share.pageId), isNull(wikiPages.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);
    if (!page || page.status === 'draft') {
      throw AppError.notFound('wiki_page');
    }

    const space = await this.db
      .select({ name: wikiSpaces.name })
      .from(wikiSpaces)
      .where(eq(wikiSpaces.id, page.wikiSpaceId))
      .limit(1)
      .then((rows) => rows[0]);

    return {
      id: page.id,
      title: page.title,
      icon: page.icon ?? null,
      content: page.content ?? null,
      updatedAt: page.updatedAt.toISOString(),
      spaceName: space?.name ?? null,
      expiresAt: share.expiresAt ? share.expiresAt.toISOString() : null,
    };
  }
}
