import { relations, sql } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { workspaces } from './workspaces';

/**
 * Organizations table.
 *
 * Top-level tenant entity. Uses soft delete with a partial unique index on
 * `slug` so that deleted orgs don't block slug reuse. The `tag` column is a
 * unique human-friendly code (e.g. ABCD-1234) used for org discovery.
 */
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    tag: text('tag').notNull(),
    description: text('description'),
    showMemberCount: boolean('show_member_count').notNull().default(true),
    logo: text('logo'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('organizations_slug_unique').on(table.slug).where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex('organizations_tag_unique').on(table.tag).where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(orgMembers),
  workspaces: many(workspaces),
}));

/**
 * Organization members join table.
 *
 * Role hierarchy: owner > admin > member.
 * CASCADE on both FKs: deleting an org or user removes the membership.
 */
export const orgMembers = pgTable(
  'org_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'owner' | 'admin' | 'member'
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('org_members_org_user_unique').on(table.orgId, table.userId)],
);

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgMembers.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [orgMembers.userId],
    references: [users.id],
  }),
}));
