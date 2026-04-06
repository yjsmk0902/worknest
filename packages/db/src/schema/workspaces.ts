import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users } from "./users";
import { organizations } from "./organizations";
import { projects } from "./projects";
import { wikiSpaces } from "./wiki";

/**
 * Workspaces table.
 *
 * A workspace belongs to an organization and represents a team or project
 * boundary. Uses soft delete with a partial unique index on (org_id, slug)
 * so deleted workspaces don't block slug reuse within the same org.
 */
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("workspaces_org_slug_unique")
      .on(table.orgId, table.slug)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workspaces.orgId],
    references: [organizations.id],
  }),
  members: many(workspaceMembers),
  projects: many(projects),
  wikiSpaces: many(wikiSpaces),
}));

/**
 * Workspace members join table.
 *
 * Role hierarchy: admin > member > guest.
 * `invited_by` uses SET NULL so the invitation record survives if the
 * inviting user is deleted.
 */
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'admin' | 'member' | 'guest'
    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspace_members_ws_user_unique").on(
      table.workspaceId,
      table.userId,
    ),
  ],
);

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
    inviter: one(users, {
      fields: [workspaceMembers.invitedBy],
      references: [users.id],
      relationName: "inviter",
    }),
  }),
);
