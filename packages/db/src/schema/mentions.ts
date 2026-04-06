import {
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { issues } from "./issues";
import { wikiPages } from "./wiki";

/**
 * Issue mentions table.
 *
 * Bidirectional link between issues and wiki pages. Created when an issue
 * is mentioned (e.g. WRK-42) inside a wiki page. Enables cross-referencing
 * between the project tracker and knowledge base.
 */
export const issueMentions = pgTable(
  "issue_mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => wikiPages.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("issue_mentions_issue_page_unique").on(
      table.issueId,
      table.pageId,
    ),
  ],
);

export const issueMentionsRelations = relations(issueMentions, ({ one }) => ({
  issue: one(issues, {
    fields: [issueMentions.issueId],
    references: [issues.id],
  }),
  page: one(wikiPages, {
    fields: [issueMentions.pageId],
    references: [wikiPages.id],
  }),
}));
