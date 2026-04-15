import type { Database } from '@worknest/db';
import type { Job } from 'bullmq';
import { NotificationService } from '../services/notification-service';
import type { NotificationJobData } from '../services/notification-service';
import { sendToUser } from '../websocket/handler';

// ── Processor ────────────────────────────────────────────────────────────

/**
 * Create a notification job processor bound to a database instance.
 *
 * For each recipient in the job data:
 * 1. Creates a notification record in the DB
 * 2. Sends a real-time WebSocket event via sendToUser()
 *
 * Job data shape:
 * ```
 * {
 *   type: NotificationType,
 *   actorId: string,
 *   recipientIds: string[],
 *   issueId?: string | null,
 *   pageId?: string | null,
 *   message: string,
 * }
 * ```
 */
export function createNotificationProcessor(db: Database) {
  const service = new NotificationService(db);

  return async (job: Job<NotificationJobData>): Promise<void> => {
    const { type, recipientIds, issueId, pageId, message } = job.data;

    for (const recipientId of recipientIds) {
      // Insert notification record
      const notification = await service.createNotification({
        userId: recipientId,
        type,
        message,
        issueId,
        pageId,
      });

      // Send real-time WebSocket event (in-process, no Redis Pub/Sub)
      sendToUser(recipientId, {
        type: 'notification.new',
        payload: {
          id: notification.id,
          userId: notification.userId,
          issueId: notification.issueId,
          pageId: notification.pageId,
          type: notification.type,
          message: notification.message,
          readAt: null,
          createdAt: notification.createdAt.toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    }
  };
}
