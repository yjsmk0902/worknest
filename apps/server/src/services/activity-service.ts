import { type Database, activities, issues, projectMembers, users } from '@worknest/db';
import { and, desc, eq, lt } from 'drizzle-orm';
import { AppError } from '../lib/errors';

// ── Types ────────────────────────────────────────────────────────────────

export interface RecordActivityData {
  actorId: string;
  issueId?: string;
  projectId?: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: unknown;
}

// ── Service ──────────────────────────────────────────────────────────────

export class ActivityService {
  constructor(private db: Database) {}

  // ── Record Activity ─────────────────────────────────────────────────

  async record(data: RecordActivityData) {
    const [activity] = await this.db
      .insert(activities)
      .values({
        actorId: data.actorId,
        issueId: data.issueId ?? null,
        projectId: data.projectId ?? null,
        action: data.action,
        field: data.field ?? null,
        oldValue: data.oldValue ?? null,
        newValue: data.newValue ?? null,
        metadata: data.metadata ?? null,
      })
      .returning();

    return activity!;
  }

  // ── List Activities by Issue ────────────────────────────────────────

  async listByIssue(issueId: string, callerUserId: string, cursor?: string, limit = 20) {
    // Look up the issue to get its projectId
    const issue = await this.db
      .select({ projectId: issues.projectId })
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!issue) {
      throw AppError.notFound('issue');
    }

    // Verify the caller is a member of the project
    const member = await this.db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, issue.projectId), eq(projectMembers.userId, callerUserId)),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!member) {
      throw AppError.forbidden('You are not a member of this project');
    }

    const rows = await this.db
      .select({
        activity: activities,
        actor: {
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(activities)
      .leftJoin(users, eq(activities.actorId, users.id))
      .where(
        and(
          eq(activities.issueId, issueId),
          ...(cursor ? [lt(activities.createdAt, new Date(cursor))] : []),
        ),
      )
      .orderBy(desc(activities.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: items.map((row) => ({
        id: row.activity.id,
        actorId: row.activity.actorId,
        issueId: row.activity.issueId,
        projectId: row.activity.projectId,
        action: row.activity.action,
        field: row.activity.field,
        oldValue: row.activity.oldValue,
        newValue: row.activity.newValue,
        metadata: row.activity.metadata,
        createdAt: row.activity.createdAt.toISOString(),
        actor: row.actor
          ? {
              id: row.actor.id,
              name: row.actor.name,
              email: row.actor.email,
              avatarUrl: row.actor.avatarUrl,
            }
          : null,
      })),
      pagination: {
        next_cursor: hasMore ? items[items.length - 1]?.activity.createdAt.toISOString() : null,
        has_more: hasMore,
      },
    };
  }

  // ── List Activities by Project ──────────────────────────────────────

  async listByProject(projectId: string, cursor?: string, limit = 20) {
    const rows = await this.db
      .select({
        activity: activities,
        actor: {
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(activities)
      .leftJoin(users, eq(activities.actorId, users.id))
      .where(
        and(
          eq(activities.projectId, projectId),
          ...(cursor ? [lt(activities.createdAt, new Date(cursor))] : []),
        ),
      )
      .orderBy(desc(activities.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: items.map((row) => ({
        id: row.activity.id,
        actorId: row.activity.actorId,
        issueId: row.activity.issueId,
        projectId: row.activity.projectId,
        action: row.activity.action,
        field: row.activity.field,
        oldValue: row.activity.oldValue,
        newValue: row.activity.newValue,
        metadata: row.activity.metadata,
        createdAt: row.activity.createdAt.toISOString(),
        actor: row.actor
          ? {
              id: row.actor.id,
              name: row.actor.name,
              email: row.actor.email,
              avatarUrl: row.actor.avatarUrl,
            }
          : null,
      })),
      pagination: {
        next_cursor: hasMore ? items[items.length - 1]?.activity.createdAt.toISOString() : null,
        has_more: hasMore,
      },
    };
  }
}
