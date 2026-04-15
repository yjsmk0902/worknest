import { relations } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { issues } from './issues';
import { users } from './users';
import { wikiPages } from './wiki';

/**
 * Files table.
 *
 * Polymorphic attachment storage — a file belongs to either an issue or a
 * wiki page (or neither, for temporary uploads). A CHECK constraint enforced
 * via raw SQL migration ensures at most one parent:
 *   NOT (issue_id IS NOT NULL AND page_id IS NOT NULL)
 */
export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    issueId: uuid('issue_id').references(() => issues.id, {
      onDelete: 'cascade',
    }),
    pageId: uuid('page_id').references(() => wikiPages.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    path: text('path').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    uploadedBy: text('uploaded_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('files_issue_id_idx').on(table.issueId),
    index('files_page_id_idx').on(table.pageId),
  ],
);

export const filesRelations = relations(files, ({ one }) => ({
  issue: one(issues, {
    fields: [files.issueId],
    references: [issues.id],
  }),
  page: one(wikiPages, {
    fields: [files.pageId],
    references: [wikiPages.id],
  }),
  uploader: one(users, {
    fields: [files.uploadedBy],
    references: [users.id],
  }),
}));
