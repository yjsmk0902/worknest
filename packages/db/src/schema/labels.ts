import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { issueLabels } from './issues';
import { projects } from './projects';

/**
 * Labels table.
 *
 * Project-scoped labels that can be attached to issues via the issue_labels
 * join table. Each label has a color (hex) for visual identification.
 */
export const labels = pgTable(
  'labels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('labels_project_name_unique').on(table.projectId, table.name)],
);

export const labelsRelations = relations(labels, ({ one, many }) => ({
  project: one(projects, {
    fields: [labels.projectId],
    references: [projects.id],
  }),
  issueLabels: many(issueLabels),
}));
