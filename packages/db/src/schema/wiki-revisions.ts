import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { wikiPages } from './wiki';

/**
 * Wiki page revisions (version history).
 *
 * A snapshot of a page's content, title, and icon taken at save time. The
 * service records a new revision only if the previous revision by the same
 * author is older than the dedupe window (default 5 minutes) to avoid
 * drowning the timeline with autosave-level granularity.
 *
 * CASCADE on page_id so deleting a wiki page takes its history with it.
 */
export const wikiPageRevisions = pgTable(
  'wiki_page_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => wikiPages.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    icon: text('icon'),
    content: jsonb('content'),
    contentText: text('content_text'),
    authorId: text('author_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('wiki_page_revisions_page_id_idx').on(table.pageId),
    index('wiki_page_revisions_page_created_idx').on(
      table.pageId,
      table.createdAt,
    ),
  ],
);

export const wikiPageRevisionsRelations = relations(
  wikiPageRevisions,
  ({ one }) => ({
    page: one(wikiPages, {
      fields: [wikiPageRevisions.pageId],
      references: [wikiPages.id],
    }),
    author: one(users, {
      fields: [wikiPageRevisions.authorId],
      references: [users.id],
    }),
  }),
);
