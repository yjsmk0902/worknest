/**
 * Notification Service
 *
 * Handles creation, dispatch (with dedup), listing, and management of
 * user notifications.
 *
 * ## Integration Points (for Tech Lead — Phase 5)
 *
 * The following events should call `dispatchNotification()`:
 *
 * 1. **Issue assigned** (type: "assigned")
 *    - Trigger: IssueService.addAssignee / bulk update assignees
 *    - Recipients: newly assigned user(s)
 *    - Entity: issueId
 *
 * 2. **@mention in comment** (type: "mentioned")
 *    - Trigger: Comment creation when mentions are detected
 *    - Recipients: mentioned user IDs (parsed from comment content)
 *    - Entity: issueId or pageId
 *
 * 3. **Comment created** (type: "commented")
 *    - Trigger: Comment creation
 *    - Recipients: issue/page watchers (assignees + creator), excluding
 *      users already notified via @mention
 *    - Entity: issueId or pageId
 *
 * 4. **Issue status changed** (type: "status_changed")
 *    - Trigger: IssueService.update (when statusId changes)
 *    - Recipients: issue assignees
 *    - Entity: issueId
 *
 * 5. **Workspace invited** (type: "invited")
 *    - Trigger: WorkspaceService.invite
 *    - Recipients: invited user
 *    - Entity: none (workspace-level)
 */

import { type Database, notifications } from '@worknest/db';
import type { NotificationType } from '@worknest/shared';
import { and, count, desc, eq, gte, isNull, lt } from 'drizzle-orm';
import { addJob } from '../lib/queue';

// ── Types ────────────────────────────────────────────────────────────────

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  message: string;
  issueId?: string | null;
  pageId?: string | null;
}

export interface DispatchNotificationData {
  type: NotificationType;
  actorId: string;
  recipientIds: string[];
  issueId?: string | null;
  pageId?: string | null;
  message: string;
}

export interface NotificationJobData {
  type: NotificationType;
  actorId: string;
  recipientIds: string[];
  issueId?: string | null;
  pageId?: string | null;
  message: string;
}

// ── Dedup window (5 minutes) ────────────────────────────────────────────

const DEDUP_WINDOW_MS = 5 * 60 * 1000;

// ── Service ──────────────────────────────────────────────────────────────

export class NotificationService {
  constructor(private db: Database) {}

  // ── Create Notification ──────────────────────────────────────────────
  /**
   * Insert a single notification record into the DB.
   * Used by the BullMQ job processor.
   */
  async createNotification(data: CreateNotificationData) {
    const [notification] = await this.db
      .insert(notifications)
      .values({
        userId: data.userId,
        type: data.type,
        message: data.message,
        issueId: data.issueId ?? null,
        pageId: data.pageId ?? null,
      })
      .returning();

    return notification!;
  }

  // ── Dispatch Notification ────────────────────────────────────────────
  /**
   * Enqueue a notification job after filtering and dedup checks.
   *
   * 1. Filters out actorId from recipientIds (self-exclude)
   * 2. Checks 5-min dedup window per recipient
   * 3. Enqueues BullMQ job with filtered recipients
   */
  async dispatchNotification(data: DispatchNotificationData): Promise<void> {
    // Self-exclude: remove the actor from recipients
    const filteredRecipients = data.recipientIds.filter((id) => id !== data.actorId);

    if (filteredRecipients.length === 0) return;

    // Dedup: check each recipient for a recent notification with the same
    // (userId, type, issueId/pageId) within the last 5 minutes
    const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
    const dedupedRecipients: string[] = [];

    for (const recipientId of filteredRecipients) {
      const conditions = [
        eq(notifications.userId, recipientId),
        eq(notifications.type, data.type),
        gte(notifications.createdAt, dedupCutoff),
      ];

      if (data.issueId) {
        conditions.push(eq(notifications.issueId, data.issueId));
      } else if (data.pageId) {
        conditions.push(eq(notifications.pageId, data.pageId));
      }

      const existing = await this.db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(...conditions))
        .limit(1)
        .then((rows) => rows[0]);

      if (!existing) {
        dedupedRecipients.push(recipientId);
      }
    }

    if (dedupedRecipients.length === 0) return;

    // Enqueue BullMQ job
    await addJob<NotificationJobData>('notification', {
      type: data.type,
      actorId: data.actorId,
      recipientIds: dedupedRecipients,
      issueId: data.issueId ?? null,
      pageId: data.pageId ?? null,
      message: data.message,
    });
  }

  // ── List Notifications ───────────────────────────────────────────────
  /**
   * List notifications for a user, ordered by createdAt desc.
   * Uses cursor-based pagination.
   */
  async list(userId: string, cursor?: string, limit = 20) {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          ...(cursor ? [lt(notifications.createdAt, new Date(cursor))] : []),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: items.map((n) => ({
        id: n.id,
        userId: n.userId,
        issueId: n.issueId,
        pageId: n.pageId,
        type: n.type,
        message: n.message,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      pagination: {
        next_cursor: hasMore ? items[items.length - 1]?.createdAt.toISOString() : null,
        has_more: hasMore,
      },
    };
  }

  // ── Unread Count ─────────────────────────────────────────────────────

  async getUnreadCount(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

    return result?.count ?? 0;
  }

  // ── Mark as Read ─────────────────────────────────────────────────────

  async markAsRead(notificationId: string, userId: string) {
    const [updated] = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();

    return updated ?? null;
  }

  // ── Mark All as Read ─────────────────────────────────────────────────

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });

    return result.length;
  }

  // ── Delete Notification ──────────────────────────────────────────────

  async delete(notificationId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning({ id: notifications.id });

    return result.length > 0;
  }
}
