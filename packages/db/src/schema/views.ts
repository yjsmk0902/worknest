import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { projects } from "./projects";

/**
 * Views table.
 *
 * Project-scoped saved views for the issue tracker. Each view stores filter,
 * sort, and grouping configuration so users can quickly switch between
 * different perspectives (e.g. "My open bugs", "Sprint board").
 *
 * `filters` stores an array of AND-only filter conditions as JSONB.
 * `sort` stores a single { field, direction } object.
 * `groupBy` is a simple column name string (e.g. "status", "priority").
 * `type` determines the layout: 'list' for table/list view, 'board' for
 * kanban-style board view.
 */
export const views = pgTable(
  "views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    filters: jsonb("filters"),
    sort: jsonb("sort"),
    groupBy: text("group_by"),
    type: text("type").notNull(), // 'list' | 'board'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("views_project_id_idx").on(table.projectId),
    index("views_project_created_by_idx").on(table.projectId, table.createdBy),
  ],
);

export const viewsRelations = relations(views, ({ one }) => ({
  project: one(projects, {
    fields: [views.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [views.createdBy],
    references: [users.id],
  }),
}));
