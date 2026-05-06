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
import { issueTypes } from './issues';
import { projects } from './projects';
import { users } from './users';

/**
 * Issue templates — project-scoped reusable issue presets.
 *
 * `labelIds` stores label UUIDs as a jsonb array. Labels are referenced
 * loosely: deleted labels get filtered out at template-apply time.
 * `body` mirrors the issue description shape (TipTap JSON).
 */
export const issueTemplates = pgTable(
  'issue_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    titleTemplate: text('title_template').notNull().default(''),
    body: jsonb('body'),
    priority: text('priority').notNull().default('none'),
    typeId: uuid('type_id').references(() => issueTypes.id, {
      onDelete: 'set null',
    }),
    labelIds: jsonb('label_ids').$type<string[]>().notNull().default([]),
    sortOrder: integer('sort_order').notNull().default(0),
    isDefault: boolean('is_default').notNull().default(false),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('issue_templates_project_name_unique').on(table.projectId, table.name),
    index('issue_templates_project_id_idx').on(table.projectId),
  ],
);

export const issueTemplatesRelations = relations(issueTemplates, ({ one }) => ({
  project: one(projects, {
    fields: [issueTemplates.projectId],
    references: [projects.id],
  }),
  type: one(issueTypes, {
    fields: [issueTemplates.typeId],
    references: [issueTypes.id],
  }),
  creator: one(users, {
    fields: [issueTemplates.createdBy],
    references: [users.id],
  }),
}));
