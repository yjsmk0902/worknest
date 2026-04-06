import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { issues } from "./issues";
import { wikiPages } from "./wiki";

/**
 * Notifications table.
 *
 * User-scoped notifications for various events (assigned, mentioned,
 * commented, status_changed, invited). A CHECK constraint (enforced via
 * raw SQL migration) ensures at most one of (issue_id, page_id) IS NOT
 * NULL — both can be NULL for workspace-level notifications like invites.
 *
 * `read_at` tracks when the user acknowledged the notification.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id").references(() => issues.id, {
      onDelete: "cascade",
    }),
    pageId: uuid("page_id").references(() => wikiPages.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(), // 'assigned' | 'mentioned' | 'commented' | 'status_changed' | 'invited'
    message: text("message").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_read_idx").on(table.userId, table.readAt),
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  issue: one(issues, {
    fields: [notifications.issueId],
    references: [issues.id],
  }),
  page: one(wikiPages, {
    fields: [notifications.pageId],
    references: [wikiPages.id],
  }),
}));
