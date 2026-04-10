import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { issues } from "./issues";
import { wikiPages } from "./wiki";

/**
 * Comments table.
 *
 * Polymorphic comments that can belong to either an issue or a wiki page.
 * A CHECK constraint (enforced via raw SQL migration) ensures exactly one
 * of (issue_id, page_id) IS NOT NULL.
 *
 * Supports flat 1-level threading via `parent_id` self-reference.
 * `content` stores TipTap JSON. Uses soft delete (`deleted_at`).
 * `resolved_at` is reserved for v1.0 comment resolution.
 */
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id").references(() => issues.id, {
      onDelete: "cascade",
    }),
    pageId: uuid("page_id").references(() => wikiPages.id, {
      onDelete: "cascade",
    }),
    content: jsonb("content").notNull(),
    parentId: uuid("parent_id"),
    authorId: text("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Reserved for v1.0 — marks when a comment thread was resolved */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("comments_issue_id_idx").on(table.issueId),
    index("comments_page_id_idx").on(table.pageId),
    index("comments_parent_id_idx").on(table.parentId),
    index("comments_author_id_idx").on(table.authorId),
  ],
);

export const commentsRelations = relations(comments, ({ one, many }) => ({
  issue: one(issues, {
    fields: [comments.issueId],
    references: [issues.id],
  }),
  page: one(wikiPages, {
    fields: [comments.pageId],
    references: [wikiPages.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "replies",
  }),
  replies: many(comments, { relationName: "replies" }),
  reactions: many(reactions),
}));

/**
 * Reactions table.
 *
 * Emoji reactions on comments. Each user can react with a given emoji
 * only once per comment (enforced by unique constraint).
 * CASCADE on both FKs: deleting a comment or user removes the reaction.
 */
export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("reactions_comment_user_emoji_unique").on(
      table.commentId,
      table.userId,
      table.emoji,
    ),
  ],
);

export const reactionsRelations = relations(reactions, ({ one }) => ({
  comment: one(comments, {
    fields: [reactions.commentId],
    references: [comments.id],
  }),
  user: one(users, {
    fields: [reactions.userId],
    references: [users.id],
  }),
}));
