import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { orgMembers } from "./organizations";
import { workspaceMembers } from "./workspaces";
import { projectMembers } from "./projects";
import { issueAssignees } from "./issues";
import { activities } from "./activities";
import { comments, reactions } from "./comments";
import { notifications } from "./notifications";
import { favorites } from "./favorites";

/**
 * Core users table.
 *
 * Password handling is delegated to Better Auth (separate session/account tables).
 * This table stores profile information only.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  orgMemberships: many(orgMembers),
  workspaceMemberships: many(workspaceMembers),
  projectMemberships: many(projectMembers),
  issueAssignments: many(issueAssignees),
  activities: many(activities),
  comments: many(comments),
  reactions: many(reactions),
  notifications: many(notifications),
  favorites: many(favorites),
}));
