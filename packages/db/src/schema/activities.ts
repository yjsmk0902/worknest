import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { issues } from './issues';
import { projects } from './projects';
import { users } from './users';

/**
 * Activities table.
 *
 * Audit log for issue and project-level events. Each row records a single
 * action (e.g. status change, assignee added) with optional before/after
 * values and extra metadata.
 */
export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: text('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    issueId: uuid('issue_id').references(() => issues.id, {
      onDelete: 'cascade',
    }),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'cascade',
    }),
    action: text('action').notNull(), // 'created' | 'updated' | 'deleted' | 'status_changed' | 'assignee_added' | 'assignee_removed' | 'label_added' | 'label_removed' | 'comment_added'
    field: text('field'), // which field changed (e.g. 'title', 'status', 'priority')
    oldValue: text('old_value'),
    newValue: text('new_value'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('activities_issue_id_idx').on(table.issueId),
    index('activities_project_id_idx').on(table.projectId),
  ],
);

export const activitiesRelations = relations(activities, ({ one }) => ({
  actor: one(users, {
    fields: [activities.actorId],
    references: [users.id],
  }),
  issue: one(issues, {
    fields: [activities.issueId],
    references: [issues.id],
  }),
  project: one(projects, {
    fields: [activities.projectId],
    references: [projects.id],
  }),
}));
