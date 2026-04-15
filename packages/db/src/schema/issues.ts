import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { comments } from './comments';
import { cycleIssues } from './cycles';
import { labels } from './labels';
import { issueMentions } from './mentions';
import { projects } from './projects';
import { users } from './users';

/**
 * Issue statuses table.
 *
 * Project-scoped workflow statuses (e.g. Backlog, Todo, In Progress, Done,
 * Cancelled). Seeded when a project is created.
 */
export const issueStatuses = pgTable(
  'issue_statuses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Workflow category for grouping: backlog | unstarted | started | completed | cancelled */
    category: text('category').notNull(), // 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled'
    /** Whether this status is the default for new issues in the project */
    isDefault: boolean('is_default').notNull().default(false),
  },
  (table) => [uniqueIndex('issue_statuses_project_name_unique').on(table.projectId, table.name)],
);

export const issueStatusesRelations = relations(issueStatuses, ({ one }) => ({
  project: one(projects, {
    fields: [issueStatuses.projectId],
    references: [projects.id],
  }),
}));

/**
 * Issue types table.
 *
 * Project-scoped issue types (e.g. Task, Bug, Story, Epic).
 * Seeded when a project is created.
 */
export const issueTypes = pgTable(
  'issue_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon').notNull(),
    color: text('color').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Whether this type is the default for new issues in the project */
    isDefault: boolean('is_default').notNull().default(false),
  },
  (table) => [uniqueIndex('issue_types_project_name_unique').on(table.projectId, table.name)],
);

export const issueTypesRelations = relations(issueTypes, ({ one }) => ({
  project: one(projects, {
    fields: [issueTypes.projectId],
    references: [projects.id],
  }),
}));

/**
 * Issues table.
 *
 * Core entity for project management. Each issue has a project-scoped
 * sequential number (`sequence_id`) used to form the issue key (e.g. "WRK-42").
 * Supports sub-issues via `parent_id` self-reference.
 * `sort_order` uses fractional indexing (text) for drag-and-drop reordering.
 * `description` stores TipTap JSON; `description_text` stores extracted plain
 * text for full-text search via `search_vector`.
 */
// CHECK constraint added via raw SQL migration:
// CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none'))
export const issues = pgTable(
  'issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sequenceId: integer('sequence_id').notNull(),
    title: text('title').notNull(),
    description: jsonb('description'),
    descriptionText: text('description_text'),
    statusId: uuid('status_id').references(() => issueStatuses.id, {
      onDelete: 'set null',
    }),
    typeId: uuid('type_id').references(() => issueTypes.id, {
      onDelete: 'set null',
    }),
    priority: text('priority').notNull().default('none'), // 'urgent' | 'high' | 'medium' | 'low' | 'none'
    parentId: uuid('parent_id'),
    creatorId: text('creator_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    sortOrder: text('sort_order').notNull().default('a0'),
    startDate: timestamp('start_date', { withTimezone: true }),
    dueDate: timestamp('due_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('issues_project_sequence_unique').on(table.projectId, table.sequenceId),
    index('issues_project_id_idx').on(table.projectId),
    index('issues_status_id_idx').on(table.statusId),
    index('issues_parent_id_idx').on(table.parentId),
    index('issues_priority_idx').on(table.priority),
    index('issues_due_date_idx').on(table.dueDate),
    index('issues_creator_id_idx').on(table.creatorId),
  ],
);

export const issuesRelations = relations(issues, ({ one, many }) => ({
  project: one(projects, {
    fields: [issues.projectId],
    references: [projects.id],
  }),
  status: one(issueStatuses, {
    fields: [issues.statusId],
    references: [issueStatuses.id],
  }),
  type: one(issueTypes, {
    fields: [issues.typeId],
    references: [issueTypes.id],
  }),
  parent: one(issues, {
    fields: [issues.parentId],
    references: [issues.id],
    relationName: 'subIssues',
  }),
  children: many(issues, { relationName: 'subIssues' }),
  creator: one(users, {
    fields: [issues.creatorId],
    references: [users.id],
  }),
  assignees: many(issueAssignees),
  labels: many(issueLabels),
  cycleIssues: many(cycleIssues),
  issueMentions: many(issueMentions),
  comments: many(comments),
}));

/**
 * Issue assignees join table.
 *
 * Many-to-many relationship between issues and users.
 * CASCADE on both FKs: deleting an issue or user removes the assignment.
 */
export const issueAssignees = pgTable(
  'issue_assignees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('issue_assignees_issue_user_unique').on(table.issueId, table.userId),
    index('issue_assignees_user_id_idx').on(table.userId),
  ],
);

export const issueAssigneesRelations = relations(issueAssignees, ({ one }) => ({
  issue: one(issues, {
    fields: [issueAssignees.issueId],
    references: [issues.id],
  }),
  user: one(users, {
    fields: [issueAssignees.userId],
    references: [users.id],
  }),
}));

/**
 * Issue labels join table.
 *
 * Many-to-many relationship between issues and labels.
 * CASCADE on both FKs: deleting an issue or label removes the association.
 */
export const issueLabels = pgTable(
  'issue_labels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (table) => [uniqueIndex('issue_labels_issue_label_unique').on(table.issueId, table.labelId)],
);

export const issueLabelsRelations = relations(issueLabels, ({ one }) => ({
  issue: one(issues, {
    fields: [issueLabels.issueId],
    references: [issues.id],
  }),
  label: one(labels, {
    fields: [issueLabels.labelId],
    references: [labels.id],
  }),
}));
