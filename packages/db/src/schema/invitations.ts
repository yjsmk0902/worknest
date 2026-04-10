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
import { workspaces } from "./workspaces";

/**
 * Invitations table.
 *
 * Supports inviting users to either an organization or a workspace (but not
 * both). The mutual exclusivity constraint (exactly one of org_id / workspace_id
 * must be non-null) cannot be expressed with Drizzle ORM's schema builder, so
 * it is enforced via a CHECK constraint added in a raw SQL migration.
 *
 * Partial unique indexes on (workspace_id, email) and (org_id, email) ensure
 * only one pending invitation per target per email.
 */
// CHECK constraint added via raw SQL migration:
// CHECK ((org_id IS NOT NULL AND workspace_id IS NULL) OR (org_id IS NULL AND workspace_id IS NOT NULL))
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    email: text("email").notNull(),
    role: text("role").notNull(), // org: 'owner' | 'admin' | 'member'; ws: 'admin' | 'member' | 'guest'
    tokenHash: text("token_hash").unique().notNull(),
    invitedBy: text("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("invitations_ws_email_unique")
      .on(table.workspaceId, table.email)
      .where(sql`${table.acceptedAt} IS NULL`),
    uniqueIndex("invitations_org_email_unique")
      .on(table.orgId, table.email)
      .where(sql`${table.acceptedAt} IS NULL`),
  ],
);

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.orgId],
    references: [organizations.id],
  }),
  workspace: one(workspaces, {
    fields: [invitations.workspaceId],
    references: [workspaces.id],
  }),
  inviter: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));
