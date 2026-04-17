import { relations, sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';
import { users } from './users';

/**
 * Join requests table.
 *
 * Tracks user requests to join an organization. A partial unique index
 * ensures only one pending request per (org, user) pair.
 */
export const joinRequests = pgTable(
  'join_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    message: text('message'),
    status: text('status').notNull(), // 'pending' | 'approved' | 'rejected'
    reviewedBy: text('reviewed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('join_requests_org_status_idx').on(table.orgId, table.status),
    uniqueIndex('join_requests_org_user_pending_unique')
      .on(table.orgId, table.userId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export const joinRequestsRelations = relations(joinRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [joinRequests.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [joinRequests.userId],
    references: [users.id],
    relationName: 'requester',
  }),
  reviewer: one(users, {
    fields: [joinRequests.reviewedBy],
    references: [users.id],
    relationName: 'reviewer',
  }),
}));
