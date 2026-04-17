import { z } from 'zod';

// ── Notification Type ───────────────────────────────────────────────────

export const notificationType = z.enum([
  'assigned',
  'mentioned',
  'commented',
  'status_changed',
  'invited',
  'join_request_received',
  'join_request_approved',
  'join_request_rejected',
]);

export type NotificationType = z.infer<typeof notificationType>;

// ── Notification Output ─────────────────────────────────────────────────

export const notificationOutput = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  issueId: z.string().uuid().nullable(),
  pageId: z.string().uuid().nullable(),
  type: notificationType,
  message: z.string(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

export type NotificationOutput = z.infer<typeof notificationOutput>;

// ── Notification Input ──────────────────────────────────────────────────

export const markNotificationReadInput = z.object({
  read: z.boolean().default(true),
});

export type MarkNotificationReadInput = z.infer<typeof markNotificationReadInput>;
