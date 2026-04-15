import { relations, sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { issues } from './issues';
import { projects } from './projects';
import { users } from './users';

/**
 * Cycles table.
 *
 * Project-scoped time-boxed iterations (sprints). A project may have at most
 * one active cycle at any time, enforced by a partial unique index on
 * (project_id) WHERE status = 'active'.
 *
 * Status values: 'draft' (planning), 'active' (in progress), 'completed' (done).
 */
export const cycles = pgTable(
  'cycles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    startDate: timestamp('start_date', { withTimezone: true }),
    endDate: timestamp('end_date', { withTimezone: true }),
    status: text('status').notNull().default('draft'), // 'draft' | 'active' | 'completed'
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('cycles_project_id_idx').on(table.projectId),
    // Only one active cycle per project
    uniqueIndex('cycles_project_active_unique')
      .on(table.projectId)
      .where(sql`${table.status} = 'active'`),
  ],
);

export const cyclesRelations = relations(cycles, ({ one, many }) => ({
  project: one(projects, {
    fields: [cycles.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [cycles.createdBy],
    references: [users.id],
  }),
  cycleIssues: many(cycleIssues),
}));

/**
 * Cycle-issues join table.
 *
 * Many-to-many relationship between cycles and issues with temporal tracking.
 * `removed_at` enables soft removal: an issue stays in history but is no longer
 * active in the cycle. A partial unique index on (cycle_id, issue_id) WHERE
 * removed_at IS NULL prevents duplicate active entries.
 *
 * `carried_from_id` is a self-reference used to track issues that were
 * automatically carried over from a previous cycle (incomplete items).
 */
export const cycleIssues = pgTable(
  'cycle_issues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cycleId: uuid('cycle_id')
      .notNull()
      .references(() => cycles.id, { onDelete: 'cascade' }),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    // Self-referential FK requires (): AnyColumn cast — Drizzle ORM limitation.
    // See: https://orm.drizzle.team/docs/indexes-constraints#foreign-key
    carriedFromId: uuid('carried_from_id').references((): any => cycleIssues.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    // Prevent duplicate active entries per cycle
    uniqueIndex('cycle_issues_cycle_issue_active_unique')
      .on(table.cycleId, table.issueId)
      .where(sql`${table.removedAt} IS NULL`),
    index('cycle_issues_issue_id_idx').on(table.issueId),
  ],
);

export const cycleIssuesRelations = relations(cycleIssues, ({ one }) => ({
  cycle: one(cycles, {
    fields: [cycleIssues.cycleId],
    references: [cycles.id],
  }),
  issue: one(issues, {
    fields: [cycleIssues.issueId],
    references: [issues.id],
  }),
  carriedFrom: one(cycleIssues, {
    fields: [cycleIssues.carriedFromId],
    references: [cycleIssues.id],
    relationName: 'carriedOver',
  }),
}));
