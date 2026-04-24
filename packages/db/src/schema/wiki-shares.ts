import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { wikiPages } from './wiki';

/**
 * Wiki page share links.
 *
 * Tokenized public read-only access for a wiki page. A page can have
 * multiple active shares (e.g. different expirations or audiences).
 * A share is "live" when `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`.
 *
 * The token is opaque and URL-safe (base64url of a 24-byte random). No PII
 * is encoded in it, so leaking one share doesn't leak workspace metadata.
 */
export const wikiPageShares = pgTable(
  'wiki_page_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => wikiPages.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('wiki_page_shares_token_unique').on(table.token),
    index('wiki_page_shares_page_id_idx').on(table.pageId),
  ],
);

export const wikiPageSharesRelations = relations(wikiPageShares, ({ one }) => ({
  page: one(wikiPages, {
    fields: [wikiPageShares.pageId],
    references: [wikiPages.id],
  }),
  creator: one(users, {
    fields: [wikiPageShares.createdBy],
    references: [users.id],
  }),
}));
