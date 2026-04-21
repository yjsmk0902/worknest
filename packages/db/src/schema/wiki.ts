import { relations, sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { comments } from './comments';
import { projects } from './projects';
import { users } from './users';
import { workspaces } from './workspaces';

/**
 * Wiki spaces table.
 *
 * Workspace-scoped knowledge base containers. Each wiki space has a unique
 * slug within its workspace for URL-friendly routing (e.g. /wiki/engineering).
 */
export const wikiSpaces = pgTable(
  'wiki_spaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    // Optional project link: when set, this wiki space is the default wiki
    // for that project and is auto-created on project creation.
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    description: text('description'),
    slug: text('slug').notNull(),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('wiki_spaces_workspace_slug_unique').on(table.workspaceId, table.slug),
    index('wiki_spaces_workspace_id_idx').on(table.workspaceId),
    index('wiki_spaces_project_id_idx').on(table.projectId),
  ],
);

export const wikiSpacesRelations = relations(wikiSpaces, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [wikiSpaces.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [wikiSpaces.createdBy],
    references: [users.id],
  }),
  members: many(wikiSpaceMembers),
  pages: many(wikiPages),
}));

/**
 * Wiki space members table.
 *
 * Controls per-user access to a wiki space. Role determines edit vs read-only
 * access: 'editor' can create/update pages, 'viewer' has read-only access.
 */
export const wikiSpaceMembers = pgTable(
  'wiki_space_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    wikiSpaceId: uuid('wiki_space_id')
      .notNull()
      .references(() => wikiSpaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('editor'), // 'editor' | 'viewer'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('wiki_space_members_space_user_unique').on(table.wikiSpaceId, table.userId),
  ],
);

export const wikiSpaceMembersRelations = relations(wikiSpaceMembers, ({ one }) => ({
  wikiSpace: one(wikiSpaces, {
    fields: [wikiSpaceMembers.wikiSpaceId],
    references: [wikiSpaces.id],
  }),
  user: one(users, {
    fields: [wikiSpaceMembers.userId],
    references: [users.id],
  }),
}));

/**
 * Wiki pages table.
 *
 * Hierarchical pages within a wiki space. Supports tree structure via
 * `parent_id` self-reference. Uses soft delete (`deleted_at`) so pages can
 * be restored. The partial unique index on (wiki_space_id, slug) ensures
 * unique slugs among non-deleted pages only.
 *
 * `content` stores TipTap JSON; `content_text` stores extracted plain text
 * for full-text search. `content_format` supports future lazy migration
 * to Yjs binary (v1.0).
 *
 * `sort_order` uses text-based fractional indexing for drag-and-drop reordering.
 */
export const wikiPages = pgTable(
  'wiki_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    wikiSpaceId: uuid('wiki_space_id')
      .notNull()
      .references(() => wikiSpaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    content: jsonb('content'),
    contentFormat: text('content_format').notNull().default('json'), // 'json' | 'yjs'
    contentText: text('content_text'),
    icon: text('icon'), // Emoji (e.g. "📄") or shortcode
    coverUrl: text('cover_url'), // Uploaded image path or external URL
    status: text('status').notNull().default('published'), // 'draft' | 'published'
    parentId: uuid('parent_id'),
    sortOrder: text('sort_order').notNull().default('a0'),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('wiki_pages_space_id_idx').on(table.wikiSpaceId),
    index('wiki_pages_parent_id_idx').on(table.parentId),
    // Partial unique index enforced via raw SQL migration:
    // UNIQUE(wiki_space_id, slug) WHERE deleted_at IS NULL
    uniqueIndex('wiki_pages_space_slug_unique')
      .on(table.wikiSpaceId, table.slug)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
);

export const wikiPagesRelations = relations(wikiPages, ({ one, many }) => ({
  wikiSpace: one(wikiSpaces, {
    fields: [wikiPages.wikiSpaceId],
    references: [wikiSpaces.id],
  }),
  creator: one(users, {
    fields: [wikiPages.createdBy],
    references: [users.id],
  }),
  parent: one(wikiPages, {
    fields: [wikiPages.parentId],
    references: [wikiPages.id],
    relationName: 'subPages',
  }),
  children: many(wikiPages, { relationName: 'subPages' }),
  comments: many(comments),
}));
