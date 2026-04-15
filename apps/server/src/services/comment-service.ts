import {
  type Database,
  comments,
  issues,
  projectMembers,
  reactions,
  users,
  wikiPages,
  wikiSpaceMembers,
} from '@worknest/db';
import type { CreateCommentInput, ToggleReactionInput, UpdateCommentInput } from '@worknest/shared';
import { ALLOWED_EMOJIS } from '@worknest/shared';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { AppError, ErrorCode } from '../lib/errors';
import { sanitizeContent } from '../lib/sanitize';

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Verify that the caller is a member of the project owning the issue.
 */
async function requireProjectMembershipForIssue(db: Database, issueId: string, userId: string) {
  const issue = await db
    .select({
      id: issues.id,
      projectId: issues.projectId,
    })
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!issue) {
    throw AppError.notFound('issue');
  }

  const member = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, issue.projectId), eq(projectMembers.userId, userId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!member) {
    throw AppError.forbidden('You are not a member of this project');
  }

  return issue;
}

/**
 * Verify that the caller is a member of the wiki space owning the page.
 */
async function requireSpaceMembershipForPage(db: Database, pageId: string, userId: string) {
  const page = await db
    .select({
      id: wikiPages.id,
      wikiSpaceId: wikiPages.wikiSpaceId,
    })
    .from(wikiPages)
    .where(and(eq(wikiPages.id, pageId), isNull(wikiPages.deletedAt)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!page) {
    throw AppError.notFound('wiki_page');
  }

  const member = await db
    .select({ id: wikiSpaceMembers.id })
    .from(wikiSpaceMembers)
    .where(
      and(eq(wikiSpaceMembers.wikiSpaceId, page.wikiSpaceId), eq(wikiSpaceMembers.userId, userId)),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!member) {
    throw AppError.forbidden('You are not a member of this wiki space');
  }

  return page;
}

// ── Serialisation ──────────────────────────────────────────────────────

function toCommentOutput(
  row: typeof comments.$inferSelect,
  author: { id: string; name: string; email: string; avatarUrl: string | null } | null,
  reactionList: {
    id: string;
    commentId: string;
    userId: string;
    emoji: string;
    createdAt: string;
    user: { id: string; name: string; avatarUrl: string | null } | null;
  }[],
) {
  return {
    id: row.id,
    issueId: row.issueId ?? null,
    pageId: row.pageId ?? null,
    content: row.content,
    parentId: row.parentId ?? null,
    authorId: row.authorId ?? null,
    author: author
      ? {
          id: author.id,
          name: author.name,
          email: author.email,
          avatarUrl: author.avatarUrl,
        }
      : null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reactions: reactionList,
  };
}

// ── Service ────────────────────────────────────────────────────────────

export class CommentService {
  constructor(private db: Database) {}

  // ── List Comments by Issue ───────────────────────────────────────

  async listByIssue(issueId: string, callerUserId: string) {
    await requireProjectMembershipForIssue(this.db, issueId, callerUserId);

    const rows = await this.db
      .select({
        comment: comments,
        author: {
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(and(eq(comments.issueId, issueId), isNull(comments.deletedAt)))
      .orderBy(asc(comments.createdAt));

    // Fetch reactions for all comments in one query
    const commentIds = rows.map((r) => r.comment.id);
    const reactionsByComment = await this.getReactionsForComments(commentIds);

    return {
      data: rows.map((r) =>
        toCommentOutput(
          r.comment,
          r.author?.id ? r.author : null,
          reactionsByComment.get(r.comment.id) ?? [],
        ),
      ),
    };
  }

  // ── List Comments by Page ────────────────────────────────────────

  async listByPage(pageId: string, callerUserId: string) {
    await requireSpaceMembershipForPage(this.db, pageId, callerUserId);

    const rows = await this.db
      .select({
        comment: comments,
        author: {
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(and(eq(comments.pageId, pageId), isNull(comments.deletedAt)))
      .orderBy(asc(comments.createdAt));

    // Fetch reactions for all comments in one query
    const commentIds = rows.map((r) => r.comment.id);
    const reactionsByComment = await this.getReactionsForComments(commentIds);

    return {
      data: rows.map((r) =>
        toCommentOutput(
          r.comment,
          r.author?.id ? r.author : null,
          reactionsByComment.get(r.comment.id) ?? [],
        ),
      ),
    };
  }

  // ── Create Comment ───────────────────────────────────────────────

  async create(callerUserId: string, input: CreateCommentInput, issueId?: string, pageId?: string) {
    // Validate exactly one parent target
    if ((!issueId && !pageId) || (issueId && pageId)) {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Comment must belong to exactly one of issue or page',
      );
    }

    // Verify membership
    if (issueId) {
      await requireProjectMembershipForIssue(this.db, issueId, callerUserId);
    } else if (pageId) {
      await requireSpaceMembershipForPage(this.db, pageId, callerUserId);
    }

    // Validate flat threading: parent comment must NOT have a parentId itself
    if (input.parentId) {
      const parent = await this.db
        .select({
          id: comments.id,
          parentId: comments.parentId,
          issueId: comments.issueId,
          pageId: comments.pageId,
        })
        .from(comments)
        .where(and(eq(comments.id, input.parentId), isNull(comments.deletedAt)))
        .limit(1)
        .then((rows) => rows[0]);

      if (!parent) {
        throw AppError.notFound('comment');
      }

      // Ensure parent belongs to the same target
      if (issueId && parent.issueId !== issueId) {
        throw AppError.badRequest(
          ErrorCode.VALIDATION_ERROR,
          'Parent comment does not belong to this issue',
        );
      }
      if (pageId && parent.pageId !== pageId) {
        throw AppError.badRequest(
          ErrorCode.VALIDATION_ERROR,
          'Parent comment does not belong to this page',
        );
      }

      // Flat threading: reject nested replies (1 level only)
      if (parent.parentId) {
        throw AppError.badRequest(
          ErrorCode.VALIDATION_ERROR,
          'Nested replies are not allowed. You can only reply to top-level comments.',
        );
      }
    }

    // Sanitize content
    const sanitized = sanitizeContent(input.content);

    const [created] = await this.db
      .insert(comments)
      .values({
        issueId: issueId ?? null,
        pageId: pageId ?? null,
        content: sanitized,
        parentId: input.parentId ?? null,
        authorId: callerUserId,
      })
      .returning();

    // Fetch author info
    const author = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, callerUserId))
      .limit(1)
      .then((rows) => rows[0]);

    return toCommentOutput(created!, author ?? null, []);
  }

  // ── Get Comment by ID ────────────────────────────────────────────

  async getById(commentId: string, callerUserId: string) {
    const row = await this.db
      .select({
        comment: comments,
        author: {
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!row) {
      throw AppError.notFound('comment');
    }

    // Verify membership based on the comment's parent resource
    if (row.comment.issueId) {
      await requireProjectMembershipForIssue(this.db, row.comment.issueId, callerUserId);
    } else if (row.comment.pageId) {
      await requireSpaceMembershipForPage(this.db, row.comment.pageId, callerUserId);
    }

    const reactionsByComment = await this.getReactionsForComments([commentId]);

    return toCommentOutput(
      row.comment,
      row.author?.id ? row.author : null,
      reactionsByComment.get(commentId) ?? [],
    );
  }

  // ── Update Comment ───────────────────────────────────────────────

  async update(commentId: string, callerUserId: string, input: UpdateCommentInput) {
    const existing = await this.db
      .select()
      .from(comments)
      .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound('comment');
    }

    // Only the author can update
    if (existing.authorId !== callerUserId) {
      throw AppError.forbidden('Only the author can update this comment');
    }

    const sanitized = sanitizeContent(input.content);

    const [updated] = await this.db
      .update(comments)
      .set({
        content: sanitized,
        updatedAt: new Date(),
      })
      .where(eq(comments.id, commentId))
      .returning();

    // Fetch author info
    const author = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, callerUserId))
      .limit(1)
      .then((rows) => rows[0]);

    const reactionsByComment = await this.getReactionsForComments([commentId]);

    return toCommentOutput(updated!, author ?? null, reactionsByComment.get(commentId) ?? []);
  }

  // ── Delete Comment (soft delete) ─────────────────────────────────

  async delete(commentId: string, callerUserId: string) {
    const existing = await this.db
      .select()
      .from(comments)
      .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound('comment');
    }

    // Only the author can delete
    if (existing.authorId !== callerUserId) {
      throw AppError.forbidden('Only the author can delete this comment');
    }

    await this.db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId));

    return existing;
  }

  // ── Toggle Reaction ──────────────────────────────────────────────

  async toggleReaction(commentId: string, callerUserId: string, input: ToggleReactionInput) {
    // Verify comment exists and is not deleted
    const comment = await this.db
      .select()
      .from(comments)
      .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!comment) {
      throw AppError.notFound('comment');
    }

    // Verify membership
    if (comment.issueId) {
      await requireProjectMembershipForIssue(this.db, comment.issueId, callerUserId);
    } else if (comment.pageId) {
      await requireSpaceMembershipForPage(this.db, comment.pageId, callerUserId);
    }

    // Check if reaction already exists
    const existing = await this.db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.commentId, commentId),
          eq(reactions.userId, callerUserId),
          eq(reactions.emoji, input.emoji),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      // Remove existing reaction
      await this.db.delete(reactions).where(eq(reactions.id, existing.id));

      return { added: false, commentId, emoji: input.emoji };
    }

    // Create new reaction
    await this.db.insert(reactions).values({
      commentId,
      userId: callerUserId,
      emoji: input.emoji,
    });

    return { added: true, commentId, emoji: input.emoji };
  }

  // ── Remove Reaction ──────────────────────────────────────────────

  async removeReaction(commentId: string, callerUserId: string, emoji: string) {
    // Validate emoji
    if (!ALLOWED_EMOJIS.includes(emoji as (typeof ALLOWED_EMOJIS)[number])) {
      throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'Invalid emoji');
    }

    // Verify comment exists and is not deleted
    const comment = await this.db
      .select()
      .from(comments)
      .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!comment) {
      throw AppError.notFound('comment');
    }

    // Verify membership
    if (comment.issueId) {
      await requireProjectMembershipForIssue(this.db, comment.issueId, callerUserId);
    } else if (comment.pageId) {
      await requireSpaceMembershipForPage(this.db, comment.pageId, callerUserId);
    }

    const existing = await this.db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.commentId, commentId),
          eq(reactions.userId, callerUserId),
          eq(reactions.emoji, emoji),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound('reaction');
    }

    await this.db.delete(reactions).where(eq(reactions.id, existing.id));
  }

  // ── List Reactions (grouped) ─────────────────────────────────────

  async listReactions(commentId: string) {
    const reactionRows = await this.db
      .select({
        reaction: reactions,
        user: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(reactions)
      .innerJoin(users, eq(reactions.userId, users.id))
      .where(eq(reactions.commentId, commentId))
      .orderBy(asc(reactions.createdAt));

    // Group by emoji
    const grouped = new Map<
      string,
      {
        emoji: string;
        count: number;
        users: { id: string; name: string; avatarUrl: string | null }[];
      }
    >();

    for (const r of reactionRows) {
      const existing = grouped.get(r.reaction.emoji);
      if (existing) {
        existing.count += 1;
        existing.users.push(r.user);
      } else {
        grouped.set(r.reaction.emoji, {
          emoji: r.reaction.emoji,
          count: 1,
          users: [r.user],
        });
      }
    }

    return { data: Array.from(grouped.values()) };
  }

  // ── Get the WS channel for a comment ─────────────────────────────

  getChannel(comment: { issueId: string | null; pageId: string | null }): string {
    if (comment.issueId) return `issue:${comment.issueId}`;
    if (comment.pageId) return `page:${comment.pageId}`;
    throw AppError.internal('Comment has no parent resource');
  }

  // ── Private: batch-load reactions ────────────────────────────────

  private async getReactionsForComments(commentIds: string[]) {
    const map = new Map<
      string,
      {
        id: string;
        commentId: string;
        userId: string;
        emoji: string;
        createdAt: string;
        user: { id: string; name: string; avatarUrl: string | null } | null;
      }[]
    >();

    if (commentIds.length === 0) return map;

    const reactionRows = await this.db
      .select({
        reaction: reactions,
        user: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(reactions)
      .innerJoin(users, eq(reactions.userId, users.id))
      .where(inArray(reactions.commentId, commentIds))
      .orderBy(asc(reactions.createdAt));

    for (const r of reactionRows) {
      const list = map.get(r.reaction.commentId) ?? [];
      list.push({
        id: r.reaction.id,
        commentId: r.reaction.commentId,
        userId: r.reaction.userId,
        emoji: r.reaction.emoji,
        createdAt: r.reaction.createdAt.toISOString(),
        user: r.user,
      });
      map.set(r.reaction.commentId, list);
    }

    return map;
  }
}
