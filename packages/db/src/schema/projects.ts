import { relations, sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { activities } from './activities';
import { cycles } from './cycles';
import { issueStatuses, issueTypes, issues } from './issues';
import { labels } from './labels';
import { users } from './users';
import { views } from './views';
import { workspaces } from './workspaces';

/**
 * Projects table.
 *
 * A project belongs to a workspace and groups issues, labels, and wiki pages.
 * `prefix` is used to generate human-readable issue keys (e.g. "WRK-42").
 * `issue_counter` is atomically incremented to assign sequential issue numbers.
 * Uses soft delete with partial unique indexes on (workspace_id, prefix) and
 * (workspace_id, name) so deleted projects don't block reuse.
 */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    prefix: text('prefix').notNull(),
    iconUrl: text('icon_url'),
    issueCounter: integer('issue_counter').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('projects_ws_prefix_unique')
      .on(table.workspaceId, table.prefix)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex('projects_ws_name_unique')
      .on(table.workspaceId, table.name)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  members: many(projectMembers),
  issueStatuses: many(issueStatuses),
  issueTypes: many(issueTypes),
  issues: many(issues),
  labels: many(labels),
  activities: many(activities),
  views: many(views),
  cycles: many(cycles),
}));

/**
 * Project members join table.
 *
 * Role hierarchy: admin > member > viewer.
 * CASCADE on both FKs: deleting a project or user removes the membership.
 */
export const projectMembers = pgTable(
  'project_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'admin' | 'member' | 'viewer'
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('project_members_project_user_unique').on(table.projectId, table.userId)],
);

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));
