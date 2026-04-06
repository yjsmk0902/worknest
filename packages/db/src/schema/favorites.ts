import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { projects } from "./projects";
import { issues } from "./issues";
import { wikiPages, wikiSpaces } from "./wiki";

/**
 * Favorites table.
 *
 * User-scoped bookmarks for quick access to projects, issues, wiki pages,
 * or wiki spaces. A CHECK constraint (enforced via raw SQL migration)
 * ensures exactly one of (project_id, issue_id, page_id, space_id) IS NOT
 * NULL. Partial unique indexes prevent duplicate favorites per user per
 * target entity.
 *
 * `sort_order` uses text-based fractional indexing for drag-and-drop
 * reordering within a user's favorites list.
 */
export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    issueId: uuid("issue_id").references(() => issues.id, {
      onDelete: "cascade",
    }),
    pageId: uuid("page_id").references(() => wikiPages.id, {
      onDelete: "cascade",
    }),
    spaceId: uuid("space_id").references(() => wikiSpaces.id, {
      onDelete: "cascade",
    }),
    sortOrder: text("sort_order").notNull().default("a0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("favorites_user_sort_idx").on(table.userId, table.sortOrder),
  ],
);

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [favorites.projectId],
    references: [projects.id],
  }),
  issue: one(issues, {
    fields: [favorites.issueId],
    references: [issues.id],
  }),
  page: one(wikiPages, {
    fields: [favorites.pageId],
    references: [wikiPages.id],
  }),
  space: one(wikiSpaces, {
    fields: [favorites.spaceId],
    references: [wikiSpaces.id],
  }),
}));
