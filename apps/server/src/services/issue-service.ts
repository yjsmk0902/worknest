import {
  type Database,
  cycleIssues,
  cycles,
  issueAssignees,
  issueLabels,
  issueRelations,
  issueStatuses,
  issueTypes,
  issues,
  labels,
  projectMembers,
  projects,
  users,
} from '@worknest/db';
import type {
  BulkUpdateInput,
  CreateIssueInput,
  CreateIssueRelationInput,
  IssueListQuery,
  IssueRelationType,
  UpdateIssueInput,
} from '@worknest/shared';
import { isValidSortKey } from '@worknest/shared';
import {
  type SQL,
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lt,
  notInArray,
  sql,
} from 'drizzle-orm';
import { AppError, ErrorCode } from '../lib/errors';
import { escapeLikePattern } from '../lib/escape-like';
import { addJob } from '../lib/queue';
import { sanitizeContent } from '../lib/sanitize';
import {
  broadcastIssueBulkUpdated,
  broadcastIssueCreated,
  broadcastIssueDeleted,
  broadcastIssueUpdated,
} from '../websocket/issue-events';
import { ActivityService } from './activity-service';
import type { NotificationService } from './notification-service';

// ── Constants ───────────────────────────────────────────────────────────

/** Numeric ordering for priority sort (lower = more urgent) */
const PRIORITY_ORDER: Record<string, number> = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
  none: 5,
};

// ── Cursor Helpers ──────────────────────────────────────────────────────

interface CursorPayload {
  v: string | number; // sort value
  id: string; // issue id
}

function encodeCursor(sortValue: string | number, issueId: string): string {
  return Buffer.from(JSON.stringify({ v: sortValue, id: issueId })).toString('base64');
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed.id === 'string' && parsed.v !== undefined) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a comma-separated query param value into an array of trimmed strings.
 */
function parseMultiValue(val: string | undefined): string[] {
  if (!val) return [];
  return val
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

// ── Service ──────────────────────────────────────────────────────────────

export class IssueService {
  private db: Database;
  private activityService: ActivityService;
  private notificationService: NotificationService | null;

  constructor(db: Database, notificationService?: NotificationService) {
    this.db = db;
    this.activityService = new ActivityService(db);
    this.notificationService = notificationService ?? null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  /**
   * Verify caller is a member of the project. Throws forbidden if not.
   */
  private async verifyProjectMember(projectId: string, userId: string) {
    const member = await this.db
      .select({ id: projectMembers.id, role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!member) {
      throw AppError.forbidden('You are not a member of this project');
    }

    return member;
  }

  /**
   * Fetch a full issue with all relations.
   */
  private async getIssueWithRelations(issueId: string) {
    // Get base issue with status, type, creator
    const row = await this.db
      .select({
        issue: issues,
        status: {
          id: issueStatuses.id,
          name: issueStatuses.name,
          color: issueStatuses.color,
          category: issueStatuses.category,
        },
        type: {
          id: issueTypes.id,
          name: issueTypes.name,
          icon: issueTypes.icon,
          color: issueTypes.color,
        },
        creator: {
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(issues)
      .leftJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .leftJoin(issueTypes, eq(issues.typeId, issueTypes.id))
      .leftJoin(users, eq(issues.creatorId, users.id))
      .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!row) return null;

    // Get assignees with user info
    const assigneeRows = await this.db
      .select({
        assignee: {
          id: issueAssignees.id,
          userId: issueAssignees.userId,
        },
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(issueAssignees)
      .innerJoin(users, eq(issueAssignees.userId, users.id))
      .where(eq(issueAssignees.issueId, issueId));

    // Get labels with label info
    const labelRows = await this.db
      .select({
        issueLabel: {
          id: issueLabels.id,
          labelId: issueLabels.labelId,
        },
        label: {
          id: labels.id,
          name: labels.name,
          color: labels.color,
        },
      })
      .from(issueLabels)
      .innerJoin(labels, eq(issueLabels.labelId, labels.id))
      .where(eq(issueLabels.issueId, issueId));

    // Get active cycle for this issue
    const cycleRow = await this.db
      .select({
        id: cycles.id,
        name: cycles.name,
        status: cycles.status,
      })
      .from(cycleIssues)
      .innerJoin(cycles, eq(cycleIssues.cycleId, cycles.id))
      .where(and(eq(cycleIssues.issueId, issueId), isNull(cycleIssues.removedAt)))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    return this.formatIssue(row, assigneeRows, labelRows, cycleRow);
  }

  /**
   * Format an issue row with its relations into the API output shape.
   */
  private formatIssue(
    row: {
      issue: typeof issues.$inferSelect;
      status: { id: string; name: string; color: string; category: string } | null;
      type: { id: string; name: string; icon: string; color: string } | null;
      creator: {
        id: string;
        name: string;
        email: string;
        avatarUrl: string | null;
      } | null;
    },
    assigneeRows: {
      assignee: { id: string; userId: string };
      user: {
        id: string;
        name: string;
        email: string;
        avatarUrl: string | null;
      };
    }[],
    labelRows: {
      issueLabel: { id: string; labelId: string };
      label: { id: string; name: string; color: string };
    }[],
    cycleData?: { id: string; name: string; status: string } | null,
  ) {
    return {
      id: row.issue.id,
      projectId: row.issue.projectId,
      sequenceId: row.issue.sequenceId,
      title: row.issue.title,
      description: row.issue.description,
      descriptionText: row.issue.descriptionText,
      statusId: row.issue.statusId,
      typeId: row.issue.typeId,
      priority: row.issue.priority,
      parentId: row.issue.parentId,
      creatorId: row.issue.creatorId,
      sortOrder: row.issue.sortOrder,
      startDate: row.issue.startDate?.toISOString() ?? null,
      dueDate: row.issue.dueDate?.toISOString() ?? null,
      createdAt: row.issue.createdAt.toISOString(),
      updatedAt: row.issue.updatedAt.toISOString(),
      status: row.status?.id
        ? {
            id: row.status.id,
            name: row.status.name,
            color: row.status.color,
            category: row.status.category,
          }
        : null,
      type: row.type?.id
        ? {
            id: row.type.id,
            name: row.type.name,
            icon: row.type.icon,
            color: row.type.color,
          }
        : null,
      creator: row.creator?.id
        ? {
            id: row.creator.id,
            name: row.creator.name,
            email: row.creator.email,
            avatarUrl: row.creator.avatarUrl,
          }
        : null,
      assignees: assigneeRows.map((a) => ({
        id: a.assignee.id,
        userId: a.assignee.userId,
        user: {
          id: a.user.id,
          name: a.user.name,
          email: a.user.email,
          avatarUrl: a.user.avatarUrl,
        },
      })),
      labels: labelRows.map((l) => ({
        id: l.issueLabel.id,
        labelId: l.issueLabel.labelId,
        label: {
          id: l.label.id,
          name: l.label.name,
          color: l.label.color,
        },
      })),
      cycle: cycleData ?? null,
    };
  }

  // ── Create Issue ──────────────────────────────────────────────────────

  async create(projectId: string, callerUserId: string, input: CreateIssueInput) {
    await this.verifyProjectMember(projectId, callerUserId);

    // Resolve default status if not provided
    let statusId = input.statusId ?? null;
    if (!statusId) {
      const [defaultStatus] = await this.db
        .select({ id: issueStatuses.id })
        .from(issueStatuses)
        .where(eq(issueStatuses.projectId, projectId))
        .orderBy(asc(issueStatuses.sortOrder))
        .limit(1);
      statusId = defaultStatus?.id ?? null;
    }

    const issue = await this.db.transaction(async (tx) => {
      // Atomically increment the project's issue counter
      const [updated] = await tx
        .update(projects)
        .set({
          issueCounter: sql`${projects.issueCounter} + 1`,
        })
        .where(eq(projects.id, projectId))
        .returning({ issueCounter: projects.issueCounter });

      if (!updated) {
        throw AppError.notFound('project');
      }

      const sequenceId = updated.issueCounter;

      // Create the issue
      const [created] = await tx
        .insert(issues)
        .values({
          projectId,
          sequenceId,
          title: input.title,
          description: input.description ? sanitizeContent(input.description) : null,
          descriptionText: input.descriptionText ?? null,
          statusId,
          typeId: input.typeId ?? null,
          priority: input.priority ?? 'none',
          parentId: input.parentId ?? null,
          creatorId: callerUserId,
          startDate: input.startDate ? new Date(input.startDate) : null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        })
        .returning();

      const issueId = created?.id;

      // Create assignee rows
      if (input.assigneeIds && input.assigneeIds.length > 0) {
        await tx.insert(issueAssignees).values(
          input.assigneeIds.map((userId) => ({
            issueId,
            userId,
          })),
        );
      }

      // Create label rows
      if (input.labelIds && input.labelIds.length > 0) {
        await tx.insert(issueLabels).values(
          input.labelIds.map((labelId) => ({
            issueId,
            labelId,
          })),
        );
      }

      return created!;
    });

    // Record activity
    await this.activityService.record({
      actorId: callerUserId,
      issueId: issue.id,
      projectId,
      action: 'created',
    });

    // Fetch full issue with relations
    const fullIssue = await this.getIssueWithRelations(issue.id);

    // Broadcast WebSocket event
    broadcastIssueCreated(projectId, fullIssue);

    return fullIssue!;
  }

  // ── Duplicate Issue ───────────────────────────────────────────────────

  async duplicate(issueId: string, callerUserId: string) {
    const source = await this.db
      .select()
      .from(issues)
      .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!source) {
      throw AppError.notFound('issue');
    }

    await this.verifyProjectMember(source.projectId, callerUserId);

    const [assigneeRows, labelRows] = await Promise.all([
      this.db
        .select({ userId: issueAssignees.userId })
        .from(issueAssignees)
        .where(eq(issueAssignees.issueId, issueId)),
      this.db
        .select({ labelId: issueLabels.labelId })
        .from(issueLabels)
        .where(eq(issueLabels.issueId, issueId)),
    ]);

    return this.create(source.projectId, callerUserId, {
      title: `${source.title} (복제본)`,
      description: source.description ?? undefined,
      descriptionText: source.descriptionText ?? undefined,
      statusId: source.statusId ?? undefined,
      typeId: source.typeId ?? undefined,
      priority: source.priority,
      parentId: source.parentId ?? undefined,
      startDate: source.startDate ? source.startDate.toISOString() : undefined,
      dueDate: source.dueDate ? source.dueDate.toISOString() : undefined,
      assigneeIds: assigneeRows.map((r) => r.userId),
      labelIds: labelRows.map((r) => r.labelId),
    });
  }

  // ── Get Issue by ID ───────────────────────────────────────────────────

  async getById(issueId: string, callerUserId: string) {
    const issue = await this.getIssueWithRelations(issueId);

    if (!issue) {
      throw AppError.notFound('issue');
    }

    await this.verifyProjectMember(issue.projectId, callerUserId);

    return issue;
  }

  // ── Get Issue Summary (for notifications) ────────────────────────────

  /**
   * Lightweight fetch of issue summary data for notification messages.
   * Returns null if issue not found.
   */
  async getIssueSummary(issueId: string) {
    const row = await this.db
      .select({
        id: issues.id,
        sequenceId: issues.sequenceId,
        title: issues.title,
        projectId: issues.projectId,
        creatorId: issues.creatorId,
      })
      .from(issues)
      .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    return row ?? null;
  }

  /**
   * Get all assignee user IDs for an issue.
   */
  async getAssigneeIds(issueId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: issueAssignees.userId })
      .from(issueAssignees)
      .where(eq(issueAssignees.issueId, issueId));

    return rows.map((r) => r.userId);
  }

  // ── Build Filter Conditions (shared between list & stats) ─────────────

  /**
   * Build Drizzle SQL conditions from query params. Used by both `list()` and `stats()`.
   * If `skipStatus` is true, statusId/statusIdNot filters are omitted (for stats).
   */
  private buildFilterConditions(
    projectId: string,
    query: IssueListQuery,
    opts?: { skipStatus?: boolean },
  ): SQL[] {
    const conditions: SQL[] = [eq(issues.projectId, projectId), isNull(issues.deletedAt)];

    // ── Status ──────────────────────────────────────────────────────────
    if (!opts?.skipStatus) {
      const statusIds = parseMultiValue(query.statusId);
      if (statusIds.length > 0) {
        conditions.push(inArray(issues.statusId, statusIds));
      }
      const statusIdsNot = parseMultiValue(query.statusIdNot);
      if (statusIdsNot.length > 0) {
        conditions.push(notInArray(issues.statusId, statusIdsNot));
      }
    }

    // ── Type ────────────────────────────────────────────────────────────
    const typeIds = parseMultiValue(query.typeId);
    if (typeIds.length > 0) {
      conditions.push(inArray(issues.typeId, typeIds));
    }
    const typeIdsNot = parseMultiValue(query.typeIdNot);
    if (typeIdsNot.length > 0) {
      conditions.push(notInArray(issues.typeId, typeIdsNot));
    }

    // ── Priority ────────────────────────────────────────────────────────
    const priorities = parseMultiValue(query.priority);
    if (priorities.length > 0) {
      conditions.push(inArray(issues.priority, priorities));
    }
    const prioritiesNot = parseMultiValue(query.priorityNot);
    if (prioritiesNot.length > 0) {
      conditions.push(notInArray(issues.priority, prioritiesNot));
    }

    // ── Assignee ────────────────────────────────────────────────────────
    if (query.assigneeEmpty === true) {
      // Issues with NO assignees
      conditions.push(
        sql`NOT EXISTS (SELECT 1 FROM ${issueAssignees} WHERE ${issueAssignees.issueId} = ${issues.id})`,
      );
    }
    const assigneeIds = parseMultiValue(query.assigneeId);
    if (assigneeIds.length > 0) {
      conditions.push(
        sql`${issues.id} IN (SELECT ${issueAssignees.issueId} FROM ${issueAssignees} WHERE ${inArray(issueAssignees.userId, assigneeIds)})`,
      );
    }
    const assigneeIdsNot = parseMultiValue(query.assigneeIdNot);
    if (assigneeIdsNot.length > 0) {
      conditions.push(
        sql`${issues.id} NOT IN (SELECT ${issueAssignees.issueId} FROM ${issueAssignees} WHERE ${inArray(issueAssignees.userId, assigneeIdsNot)})`,
      );
    }

    // ── Label ───────────────────────────────────────────────────────────
    const labelIds = parseMultiValue(query.labelId);
    if (labelIds.length > 0) {
      conditions.push(
        sql`${issues.id} IN (SELECT ${issueLabels.issueId} FROM ${issueLabels} WHERE ${inArray(issueLabels.labelId, labelIds)})`,
      );
    }
    const labelIdsNot = parseMultiValue(query.labelIdNot);
    if (labelIdsNot.length > 0) {
      conditions.push(
        sql`${issues.id} NOT IN (SELECT ${issueLabels.issueId} FROM ${issueLabels} WHERE ${inArray(issueLabels.labelId, labelIdsNot)})`,
      );
    }

    // ── Due date ────────────────────────────────────────────────────────
    if (query.dueEmpty === true) {
      conditions.push(isNull(issues.dueDate));
    }
    if (query.dueBefore) {
      conditions.push(lt(issues.dueDate, new Date(query.dueBefore)));
    }
    if (query.dueAfter) {
      conditions.push(gt(issues.dueDate, new Date(query.dueAfter)));
    }

    // ── Title / Search ──────────────────────────────────────────────────
    if (query.title) {
      conditions.push(ilike(issues.title, `%${escapeLikePattern(query.title)}%`));
    }
    if (query.search) {
      conditions.push(ilike(issues.title, `%${escapeLikePattern(query.search)}%`));
    }

    // ── Parent ──────────────────────────────────────────────────────────
    if (query.parentId) {
      conditions.push(eq(issues.parentId, query.parentId));
    }

    // ── Cycle ───────────────────────────────────────────────────────────
    if (query.cycleEmpty === true) {
      // Issues not in any cycle
      conditions.push(
        sql`NOT EXISTS (SELECT 1 FROM ${cycleIssues} WHERE ${cycleIssues.issueId} = ${issues.id} AND ${cycleIssues.removedAt} IS NULL)`,
      );
    }
    if (query.cycleId) {
      conditions.push(
        sql`${issues.id} IN (SELECT ${cycleIssues.issueId} FROM ${cycleIssues} WHERE ${cycleIssues.cycleId} = ${query.cycleId} AND ${cycleIssues.removedAt} IS NULL)`,
      );
    }
    if (query.cycleIdNot) {
      conditions.push(
        sql`${issues.id} NOT IN (SELECT ${cycleIssues.issueId} FROM ${cycleIssues} WHERE ${cycleIssues.cycleId} = ${query.cycleIdNot} AND ${cycleIssues.removedAt} IS NULL)`,
      );
    }

    return conditions;
  }

  // ── List Issues ───────────────────────────────────────────────────────

  async list(projectId: string, callerUserId: string, query: IssueListQuery) {
    await this.verifyProjectMember(projectId, callerUserId);

    const { cursor, limit, sort = 'created_at', order = 'desc' } = query;

    // Build where conditions
    const conditions = this.buildFilterConditions(projectId, query);

    // ── Cursor pagination ───────────────────────────────────────────────
    let cursorData: CursorPayload | null = null;
    if (cursor) {
      cursorData = decodeCursor(cursor);
      if (!cursorData) {
        throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'Invalid cursor format');
      }
    }

    // ── Build sort & cursor clause ──────────────────────────────────────
    const dir = order === 'asc' ? asc : desc;
    const _dirOp = order === 'asc' ? gt : lt;
    let orderByClause: SQL;

    if (sort === 'priority') {
      // Custom priority ordering: urgent=1, high=2, medium=3, low=4, none=5
      const priorityExpr = sql`CASE ${issues.priority}
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END`;

      if (cursorData) {
        const cursorPriority = Number(cursorData.v);
        // Keyset pagination on (priority_order, id)
        conditions.push(
          sql`(${priorityExpr}, ${issues.id}) ${order === 'asc' ? sql`>` : sql`<`} (${cursorPriority}, ${cursorData.id})`,
        );
      }

      orderByClause = sql`${dir(priorityExpr)}, ${dir(issues.id)}`;
    } else if (sort === 'manual') {
      // Fractional indexing sort_order with created_at tie-breaker
      if (cursorData) {
        const cursorSort = String(cursorData.v);
        conditions.push(
          sql`(${issues.sortOrder}, ${issues.createdAt}, ${issues.id}) ${order === 'asc' ? sql`>` : sql`<`} (${cursorSort}, (SELECT ${issues.createdAt} FROM ${issues} WHERE ${issues.id} = ${cursorData.id}), ${cursorData.id})`,
        );
      }

      orderByClause = sql`${dir(issues.sortOrder)}, ${dir(issues.createdAt)}, ${dir(issues.id)}`;
    } else if (sort === 'due_date') {
      // NULLs last for ascending, NULLs first for descending
      const col = issues.dueDate;
      if (cursorData) {
        const cursorVal = String(cursorData.v);
        if (cursorVal === 'null') {
          // After all non-null due dates
          conditions.push(
            sql`(${col} IS NULL AND ${issues.id} ${order === 'asc' ? sql`>` : sql`<`} ${cursorData.id})`,
          );
        } else {
          conditions.push(
            sql`(
              (${col} IS NOT NULL AND (${col}, ${issues.id}) ${order === 'asc' ? sql`>` : sql`<`} (${cursorVal}, ${cursorData.id}))
              OR ${col} IS NULL
            )`,
          );
        }
      }

      orderByClause =
        order === 'asc'
          ? sql`${col} ASC NULLS LAST, ${issues.id} ASC`
          : sql`${col} DESC NULLS LAST, ${issues.id} DESC`;
    } else {
      // created_at or updated_at
      const col = sort === 'updated_at' ? issues.updatedAt : issues.createdAt;

      if (cursorData) {
        const cursorDate = new Date(String(cursorData.v));
        conditions.push(
          sql`(${col}, ${issues.id}) ${order === 'asc' ? sql`>` : sql`<`} (${cursorDate}, ${cursorData.id})`,
        );
      }

      orderByClause = sql`${dir(col)}, ${dir(issues.id)}`;
    }

    const baseQuery = this.db
      .select({
        issue: issues,
        status: {
          id: issueStatuses.id,
          name: issueStatuses.name,
          color: issueStatuses.color,
          category: issueStatuses.category,
        },
        type: {
          id: issueTypes.id,
          name: issueTypes.name,
          icon: issueTypes.icon,
          color: issueTypes.color,
        },
        creator: {
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(issues)
      .leftJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .leftJoin(issueTypes, eq(issues.typeId, issueTypes.id))
      .leftJoin(users, eq(issues.creatorId, users.id))
      .where(and(...conditions))
      .orderBy(orderByClause)
      .limit(limit + 1);

    const rows = await baseQuery;
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    // Batch-fetch assignees and labels for all returned issues
    const issueIds = items.map((r) => r.issue.id);

    const assigneeMap = new Map<
      string,
      {
        assignee: { id: string; userId: string };
        user: { id: string; name: string; email: string; avatarUrl: string | null };
      }[]
    >();
    const labelMap = new Map<
      string,
      {
        issueLabel: { id: string; labelId: string };
        label: { id: string; name: string; color: string };
      }[]
    >();

    const cycleMap = new Map<string, { id: string; name: string; status: string }>();

    if (issueIds.length > 0) {
      const [allAssignees, allLabels, allCycles] = await Promise.all([
        this.db
          .select({
            issueId: issueAssignees.issueId,
            assignee: {
              id: issueAssignees.id,
              userId: issueAssignees.userId,
            },
            user: {
              id: users.id,
              name: users.name,
              email: users.email,
              avatarUrl: users.avatarUrl,
            },
          })
          .from(issueAssignees)
          .innerJoin(users, eq(issueAssignees.userId, users.id))
          .where(inArray(issueAssignees.issueId, issueIds)),
        this.db
          .select({
            issueId: issueLabels.issueId,
            issueLabel: {
              id: issueLabels.id,
              labelId: issueLabels.labelId,
            },
            label: {
              id: labels.id,
              name: labels.name,
              color: labels.color,
            },
          })
          .from(issueLabels)
          .innerJoin(labels, eq(issueLabels.labelId, labels.id))
          .where(inArray(issueLabels.issueId, issueIds)),
        this.db
          .select({
            issueId: cycleIssues.issueId,
            id: cycles.id,
            name: cycles.name,
            status: cycles.status,
          })
          .from(cycleIssues)
          .innerJoin(cycles, eq(cycleIssues.cycleId, cycles.id))
          .where(and(inArray(cycleIssues.issueId, issueIds), isNull(cycleIssues.removedAt))),
      ]);

      for (const row of allAssignees) {
        const existing = assigneeMap.get(row.issueId) ?? [];
        existing.push({ assignee: row.assignee, user: row.user });
        assigneeMap.set(row.issueId, existing);
      }

      for (const row of allLabels) {
        const existing = labelMap.get(row.issueId) ?? [];
        existing.push({ issueLabel: row.issueLabel, label: row.label });
        labelMap.set(row.issueId, existing);
      }

      for (const row of allCycles) {
        // Keep the first (most relevant) cycle per issue
        if (!cycleMap.has(row.issueId)) {
          cycleMap.set(row.issueId, { id: row.id, name: row.name, status: row.status });
        }
      }
    }

    // Build next cursor from the last item
    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const lastIssue = items[items.length - 1]?.issue;
      if (sort === 'priority') {
        const numericPriority = PRIORITY_ORDER[lastIssue.priority] ?? 5;
        nextCursor = encodeCursor(numericPriority, lastIssue.id);
      } else if (sort === 'manual') {
        nextCursor = encodeCursor(lastIssue.sortOrder, lastIssue.id);
      } else if (sort === 'due_date') {
        const dueVal = lastIssue.dueDate ? lastIssue.dueDate.toISOString() : 'null';
        nextCursor = encodeCursor(dueVal, lastIssue.id);
      } else if (sort === 'updated_at') {
        nextCursor = encodeCursor(lastIssue.updatedAt.toISOString(), lastIssue.id);
      } else {
        nextCursor = encodeCursor(lastIssue.createdAt.toISOString(), lastIssue.id);
      }
    }

    return {
      data: items.map((row) =>
        this.formatIssue(
          row,
          assigneeMap.get(row.issue.id) ?? [],
          labelMap.get(row.issue.id) ?? [],
          cycleMap.get(row.issue.id) ?? null,
        ),
      ),
      pagination: {
        next_cursor: nextCursor,
        has_more: hasMore,
      },
    };
  }

  // ── Update Issue ──────────────────────────────────────────────────────

  async update(issueId: string, callerUserId: string, input: UpdateIssueInput) {
    // Get existing issue
    const existing = await this.db
      .select()
      .from(issues)
      .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound('issue');
    }

    await this.verifyProjectMember(existing.projectId, callerUserId);

    // Build update payload and track changes
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const changedFields: { field: string; oldValue: string | null; newValue: string | null }[] = [];

    if (input.title !== undefined && input.title !== existing.title) {
      updates.title = input.title;
      changedFields.push({ field: 'title', oldValue: existing.title, newValue: input.title });
    }
    if (input.description !== undefined) {
      updates.description = input.description
        ? sanitizeContent(input.description)
        : input.description;
      changedFields.push({ field: 'description', oldValue: null, newValue: null });
    }
    if (input.descriptionText !== undefined) {
      updates.descriptionText = input.descriptionText;
    }
    if (input.statusId !== undefined && input.statusId !== existing.statusId) {
      updates.statusId = input.statusId;
      changedFields.push({
        field: 'status',
        oldValue: existing.statusId,
        newValue: input.statusId,
      });
    }
    if (input.typeId !== undefined && input.typeId !== existing.typeId) {
      updates.typeId = input.typeId;
      changedFields.push({
        field: 'type',
        oldValue: existing.typeId,
        newValue: input.typeId,
      });
    }
    if (input.priority !== undefined && input.priority !== existing.priority) {
      updates.priority = input.priority;
      changedFields.push({
        field: 'priority',
        oldValue: existing.priority,
        newValue: input.priority,
      });
    }
    if (input.parentId !== undefined && input.parentId !== existing.parentId) {
      updates.parentId = input.parentId;
      changedFields.push({
        field: 'parent',
        oldValue: existing.parentId,
        newValue: input.parentId,
      });
    }
    if (input.sortOrder !== undefined && input.sortOrder !== existing.sortOrder) {
      if (!isValidSortKey(input.sortOrder)) {
        throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'Invalid sort order format');
      }
      updates.sortOrder = input.sortOrder;
    }
    if (input.startDate !== undefined) {
      const newStartDate = input.startDate ? new Date(input.startDate) : null;
      updates.startDate = newStartDate;
      changedFields.push({
        field: 'startDate',
        oldValue: existing.startDate?.toISOString() ?? null,
        newValue: newStartDate?.toISOString() ?? null,
      });
    }
    if (input.dueDate !== undefined) {
      const newDueDate = input.dueDate ? new Date(input.dueDate) : null;
      updates.dueDate = newDueDate;
      changedFields.push({
        field: 'dueDate',
        oldValue: existing.dueDate?.toISOString() ?? null,
        newValue: newDueDate?.toISOString() ?? null,
      });
    }

    // Perform update + optional assignee/label replacement in a transaction
    await this.db.transaction(async (tx) => {
      await tx.update(issues).set(updates).where(eq(issues.id, issueId));

      if (input.assigneeIds !== undefined) {
        await tx.delete(issueAssignees).where(eq(issueAssignees.issueId, issueId));
        if (input.assigneeIds.length > 0) {
          await tx.insert(issueAssignees).values(
            input.assigneeIds.map((userId) => ({ issueId, userId })),
          );
        }
        changedFields.push({ field: 'assignees', oldValue: null, newValue: null });
      }

      if (input.labelIds !== undefined) {
        await tx.delete(issueLabels).where(eq(issueLabels.issueId, issueId));
        if (input.labelIds.length > 0) {
          await tx.insert(issueLabels).values(
            input.labelIds.map((labelId) => ({ issueId, labelId })),
          );
        }
        changedFields.push({ field: 'labels', oldValue: null, newValue: null });
      }
    });

    // Record activities for each changed field
    for (const change of changedFields) {
      await this.activityService.record({
        actorId: callerUserId,
        issueId,
        projectId: existing.projectId,
        action: 'updated',
        field: change.field,
        oldValue: change.oldValue ?? undefined,
        newValue: change.newValue ?? undefined,
      });
    }

    // Fetch and return updated issue
    const fullIssue = await this.getIssueWithRelations(issueId);

    // Broadcast WebSocket event
    broadcastIssueUpdated(existing.projectId, fullIssue);

    // Fire-and-forget: dispatch "status_changed" notification to assignees
    const statusChanged = changedFields.some((c) => c.field === 'status');
    if (statusChanged && this.notificationService) {
      this.getAssigneeIds(issueId)
        .then((assigneeIds) => {
          if (assigneeIds.length > 0) {
            this.notificationService
              ?.dispatchNotification({
                type: 'status_changed',
                actorId: callerUserId,
                recipientIds: assigneeIds,
                issueId,
                message: `이슈 #${existing.sequenceId}의 상태가 변경되었습니다`,
              })
              .catch((err) => console.error('Failed to dispatch status_changed notification', err));
          }
        })
        .catch((err) =>
          console.error('Failed to fetch assignees for status_changed notification', err),
        );
    }

    return fullIssue!;
  }

  // ── Soft Delete Issue ─────────────────────────────────────────────────

  async softDelete(issueId: string, callerUserId: string) {
    const existing = await this.db
      .select()
      .from(issues)
      .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound('issue');
    }

    const member = await this.verifyProjectMember(existing.projectId, callerUserId);

    // Only admin or member can delete (not viewer)
    if (!['admin', 'member'].includes(member.role)) {
      throw AppError.forbidden('Only project admin or member can delete issues');
    }

    // Soft delete the issue and promote sub-issues
    await this.db.transaction(async (tx) => {
      await tx.update(issues).set({ deletedAt: new Date() }).where(eq(issues.id, issueId));

      // Promote sub-issues: set parentId = null
      await tx
        .update(issues)
        .set({ parentId: null })
        .where(and(eq(issues.parentId, issueId), isNull(issues.deletedAt)));
    });

    // Record activity
    await this.activityService.record({
      actorId: callerUserId,
      issueId,
      projectId: existing.projectId,
      action: 'deleted',
    });

    // Broadcast WebSocket event
    broadcastIssueDeleted(existing.projectId, issueId);
  }

  // ── Add Assignee ──────────────────────────────────────────────────────

  async addAssignee(issueId: string, callerUserId: string, userId: string) {
    const existing = await this.db
      .select()
      .from(issues)
      .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound('issue');
    }

    await this.verifyProjectMember(existing.projectId, callerUserId);

    const [assignee] = await this.db
      .insert(issueAssignees)
      .values({ issueId, userId })
      .onConflictDoNothing()
      .returning();

    if (!assignee) {
      throw AppError.conflict(
        ErrorCode.ALREADY_A_MEMBER,
        'User is already an assignee of this issue',
      );
    }

    // Record activity
    await this.activityService.record({
      actorId: callerUserId,
      issueId,
      projectId: existing.projectId,
      action: 'assignee_added',
      newValue: userId,
    });

    // Broadcast updated issue
    const fullIssue = await this.getIssueWithRelations(issueId);
    broadcastIssueUpdated(existing.projectId, fullIssue);

    return assignee;
  }

  // ── Remove Assignee ───────────────────────────────────────────────────

  async removeAssignee(issueId: string, callerUserId: string, userId: string) {
    const existing = await this.db
      .select()
      .from(issues)
      .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound('issue');
    }

    await this.verifyProjectMember(existing.projectId, callerUserId);

    await this.db
      .delete(issueAssignees)
      .where(and(eq(issueAssignees.issueId, issueId), eq(issueAssignees.userId, userId)));

    // Record activity
    await this.activityService.record({
      actorId: callerUserId,
      issueId,
      projectId: existing.projectId,
      action: 'assignee_removed',
      oldValue: userId,
    });

    // Broadcast updated issue
    const fullIssue = await this.getIssueWithRelations(issueId);
    broadcastIssueUpdated(existing.projectId, fullIssue);
  }

  // ── Add Label ─────────────────────────────────────────────────────────

  async addLabel(issueId: string, callerUserId: string, labelId: string) {
    const existing = await this.db
      .select()
      .from(issues)
      .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound('issue');
    }

    await this.verifyProjectMember(existing.projectId, callerUserId);

    const [issueLabel] = await this.db
      .insert(issueLabels)
      .values({ issueId, labelId })
      .onConflictDoNothing()
      .returning();

    if (!issueLabel) {
      throw AppError.conflict(
        ErrorCode.ALREADY_A_MEMBER,
        'Label is already attached to this issue',
      );
    }

    // Record activity
    await this.activityService.record({
      actorId: callerUserId,
      issueId,
      projectId: existing.projectId,
      action: 'label_added',
      newValue: labelId,
    });

    // Broadcast updated issue
    const fullIssue = await this.getIssueWithRelations(issueId);
    broadcastIssueUpdated(existing.projectId, fullIssue);

    return issueLabel;
  }

  // ── Remove Label ──────────────────────────────────────────────────────

  async removeLabel(issueId: string, callerUserId: string, labelId: string) {
    const existing = await this.db
      .select()
      .from(issues)
      .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound('issue');
    }

    await this.verifyProjectMember(existing.projectId, callerUserId);

    await this.db
      .delete(issueLabels)
      .where(and(eq(issueLabels.issueId, issueId), eq(issueLabels.labelId, labelId)));

    // Record activity
    await this.activityService.record({
      actorId: callerUserId,
      issueId,
      projectId: existing.projectId,
      action: 'label_removed',
      oldValue: labelId,
    });

    // Broadcast updated issue
    const fullIssue = await this.getIssueWithRelations(issueId);
    broadcastIssueUpdated(existing.projectId, fullIssue);
  }

  // ── List Sub-Issues ───────────────────────────────────────────────────

  async listSubIssues(issueId: string, callerUserId: string) {
    // Get parent issue to find its project
    const parent = await this.db
      .select({ projectId: issues.projectId })
      .from(issues)
      .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!parent) {
      throw AppError.notFound('issue');
    }

    await this.verifyProjectMember(parent.projectId, callerUserId);

    const rows = await this.db
      .select({
        issue: issues,
        status: {
          id: issueStatuses.id,
          name: issueStatuses.name,
          color: issueStatuses.color,
          category: issueStatuses.category,
        },
        type: {
          id: issueTypes.id,
          name: issueTypes.name,
          icon: issueTypes.icon,
          color: issueTypes.color,
        },
        creator: {
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(issues)
      .leftJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .leftJoin(issueTypes, eq(issues.typeId, issueTypes.id))
      .leftJoin(users, eq(issues.creatorId, users.id))
      .where(and(eq(issues.parentId, issueId), isNull(issues.deletedAt)))
      .orderBy(desc(issues.createdAt));

    // Batch-fetch assignees and labels
    const issueIds = rows.map((r) => r.issue.id);
    const assigneeMap = new Map<
      string,
      {
        assignee: { id: string; userId: string };
        user: { id: string; name: string; email: string; avatarUrl: string | null };
      }[]
    >();
    const labelMap = new Map<
      string,
      {
        issueLabel: { id: string; labelId: string };
        label: { id: string; name: string; color: string };
      }[]
    >();

    if (issueIds.length > 0) {
      const allAssignees = await this.db
        .select({
          issueId: issueAssignees.issueId,
          assignee: {
            id: issueAssignees.id,
            userId: issueAssignees.userId,
          },
          user: {
            id: users.id,
            name: users.name,
            email: users.email,
            avatarUrl: users.avatarUrl,
          },
        })
        .from(issueAssignees)
        .innerJoin(users, eq(issueAssignees.userId, users.id))
        .where(inArray(issueAssignees.issueId, issueIds));

      for (const row of allAssignees) {
        const existing = assigneeMap.get(row.issueId) ?? [];
        existing.push({ assignee: row.assignee, user: row.user });
        assigneeMap.set(row.issueId, existing);
      }

      const allLabels = await this.db
        .select({
          issueId: issueLabels.issueId,
          issueLabel: {
            id: issueLabels.id,
            labelId: issueLabels.labelId,
          },
          label: {
            id: labels.id,
            name: labels.name,
            color: labels.color,
          },
        })
        .from(issueLabels)
        .innerJoin(labels, eq(issueLabels.labelId, labels.id))
        .where(inArray(issueLabels.issueId, issueIds));

      for (const row of allLabels) {
        const existing = labelMap.get(row.issueId) ?? [];
        existing.push({ issueLabel: row.issueLabel, label: row.label });
        labelMap.set(row.issueId, existing);
      }
    }

    return {
      data: rows.map((row) =>
        this.formatIssue(
          row,
          assigneeMap.get(row.issue.id) ?? [],
          labelMap.get(row.issue.id) ?? [],
        ),
      ),
    };
  }

  // ── Issue Stats ──────────────────────────────────────────────────────

  /**
   * Return issue counts grouped by status for a project.
   * Accepts the same filter params as list() minus status filters.
   */
  async stats(projectId: string, callerUserId: string, query: IssueListQuery) {
    await this.verifyProjectMember(projectId, callerUserId);

    // Build conditions but skip status filters so stats show all statuses
    const conditions = this.buildFilterConditions(projectId, query, { skipStatus: true });

    const rows = await this.db
      .select({
        statusId: issues.statusId,
        statusName: issueStatuses.name,
        category: issueStatuses.category,
        count: count(),
      })
      .from(issues)
      .leftJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .where(and(...conditions))
      .groupBy(issues.statusId, issueStatuses.name, issueStatuses.category);

    // Build byStatus map and total for the client
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      if (r.statusId) {
        byStatus[r.statusId] = Number(r.count);
      }
      total += Number(r.count);
    }

    return { byStatus, total };
  }

  // ── Bulk Update ──────────────────────────────────────────────────────

  /**
   * Update multiple issues in a single transaction (all-or-nothing).
   * Enqueues an async bulk-activity job after success.
   */
  async bulkUpdate(projectId: string, callerUserId: string, input: BulkUpdateInput) {
    await this.verifyProjectMember(projectId, callerUserId);

    const { issueIds, changes } = input;

    // ── Validate all issues belong to this project and are not deleted ──

    const existingIssues = await this.db
      .select({ id: issues.id, projectId: issues.projectId })
      .from(issues)
      .where(and(inArray(issues.id, issueIds), isNull(issues.deletedAt)));

    const existingIds = new Set(existingIssues.map((i) => i.id));
    const missingIds = issueIds.filter((id) => !existingIds.has(id));
    if (missingIds.length > 0) {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        `Issues not found or deleted: ${missingIds.join(', ')}`,
      );
    }

    const wrongProject = existingIssues.filter((i) => i.projectId !== projectId);
    if (wrongProject.length > 0) {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        `Issues do not belong to this project: ${wrongProject.map((i) => i.id).join(', ')}`,
      );
    }

    // ── Validate referenced statusId/typeId belong to the project ──────

    if (changes.statusId) {
      const status = await this.db
        .select({ id: issueStatuses.id })
        .from(issueStatuses)
        .where(and(eq(issueStatuses.id, changes.statusId), eq(issueStatuses.projectId, projectId)))
        .limit(1)
        .then((rows) => rows[0]);

      if (!status) {
        throw AppError.notFound('issue status');
      }
    }

    if (changes.typeId) {
      const type = await this.db
        .select({ id: issueTypes.id })
        .from(issueTypes)
        .where(and(eq(issueTypes.id, changes.typeId), eq(issueTypes.projectId, projectId)))
        .limit(1)
        .then((rows) => rows[0]);

      if (!type) {
        throw AppError.notFound('issue type');
      }
    }

    // ── Execute all updates in a single transaction ────────────────────

    await this.db.transaction(async (tx) => {
      // Build column updates
      const columnUpdates: Record<string, unknown> = { updatedAt: new Date() };
      if (changes.statusId) columnUpdates.statusId = changes.statusId;
      if (changes.typeId) columnUpdates.typeId = changes.typeId;
      if (changes.priority) columnUpdates.priority = changes.priority;

      // Update issue columns
      if (Object.keys(columnUpdates).length > 1) {
        // more than just updatedAt
        await tx.update(issues).set(columnUpdates).where(inArray(issues.id, issueIds));
      } else {
        // Still touch updatedAt
        await tx.update(issues).set({ updatedAt: new Date() }).where(inArray(issues.id, issueIds));
      }

      // Handle assignees: clear existing + insert new (replace strategy)
      if (changes.assigneeIds !== undefined) {
        await tx.delete(issueAssignees).where(inArray(issueAssignees.issueId, issueIds));

        if (changes.assigneeIds.length > 0) {
          const assigneeRows = issueIds.flatMap((issueId) =>
            changes.assigneeIds?.map((userId) => ({
              issueId,
              userId,
            })),
          );
          await tx.insert(issueAssignees).values(assigneeRows).onConflictDoNothing();
        }
      }

      // Handle labels: clear existing + insert new (replace strategy)
      if (changes.labelIds !== undefined) {
        await tx.delete(issueLabels).where(inArray(issueLabels.issueId, issueIds));

        if (changes.labelIds.length > 0) {
          const labelRows = issueIds.flatMap((issueId) =>
            changes.labelIds?.map((labelId) => ({
              issueId,
              labelId,
            })),
          );
          await tx.insert(issueLabels).values(labelRows).onConflictDoNothing();
        }
      }
    });

    // ── Broadcast WebSocket event ──────────────────────────────────────
    broadcastIssueBulkUpdated(projectId, { actorId: callerUserId, issueIds, changes });

    // ── Enqueue async activity recording ───────────────────────────────
    await addJob('bulk-activity', {
      actorId: callerUserId,
      projectId,
      issueIds,
      changes,
    });

    return { updated: issueIds.length };
  }

  // ── Issue Relations (Dependencies) ─────────────────────────────────────

  /**
   * Returns relations visible from this issue's perspective:
   * - Outgoing: rows where source = issueId
   * - Incoming: rows where target = issueId
   *
   * Each row carries a direction + "label" so the UI can render
   * "blocks X" vs "blocked by Y" without the caller deriving it.
   */
  async listRelations(issueId: string, callerUserId: string) {
    const issue = await this.db
      .select({ projectId: issues.projectId })
      .from(issues)
      .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);
    if (!issue) throw AppError.notFound('issue');
    await this.verifyProjectMember(issue.projectId, callerUserId);

    const rows = await this.db
      .select({
        relation: issueRelations,
        srcIssue: {
          id: sql<string>`src.id`.as('src_id'),
          sequenceId: sql<number>`src.sequence_id`.as('src_seq'),
          title: sql<string>`src.title`.as('src_title'),
          statusId: sql<string | null>`src.status_id`.as('src_status_id'),
        },
        tgtIssue: {
          id: sql<string>`tgt.id`.as('tgt_id'),
          sequenceId: sql<number>`tgt.sequence_id`.as('tgt_seq'),
          title: sql<string>`tgt.title`.as('tgt_title'),
          statusId: sql<string | null>`tgt.status_id`.as('tgt_status_id'),
        },
      })
      .from(issueRelations)
      .innerJoin(
        sql`${issues} as src`,
        sql`src.id = ${issueRelations.sourceIssueId} AND src.deleted_at IS NULL`,
      )
      .innerJoin(
        sql`${issues} as tgt`,
        sql`tgt.id = ${issueRelations.targetIssueId} AND tgt.deleted_at IS NULL`,
      )
      .where(
        sql`${issueRelations.sourceIssueId} = ${issueId} OR ${issueRelations.targetIssueId} = ${issueId}`,
      );

    // Fetch all statuses for this project to embed in output
    const statusRows = await this.db
      .select()
      .from(issueStatuses)
      .where(eq(issueStatuses.projectId, issue.projectId));
    const statusById = new Map(statusRows.map((s) => [s.id, s]));

    return rows.map((r) => {
      const isOutgoing = r.relation.sourceIssueId === issueId;
      const other = isOutgoing ? r.tgtIssue : r.srcIssue;
      const status = other.statusId ? statusById.get(other.statusId) : null;
      let label: 'blocks' | 'blocked_by' | 'relates_to';
      if (r.relation.type === 'relates_to') label = 'relates_to';
      else label = isOutgoing ? 'blocks' : 'blocked_by';

      return {
        id: r.relation.id,
        sourceIssueId: r.relation.sourceIssueId,
        targetIssueId: r.relation.targetIssueId,
        direction: isOutgoing ? ('outgoing' as const) : ('incoming' as const),
        label,
        type: r.relation.type as IssueRelationType,
        issue: {
          id: other.id,
          sequenceId: other.sequenceId,
          title: other.title,
          statusId: other.statusId,
          status: status
            ? {
                id: status.id,
                name: status.name,
                color: status.color,
                category: status.category,
              }
            : null,
        },
        createdAt: r.relation.createdAt.toISOString(),
      };
    });
  }

  async createRelation(
    issueId: string,
    callerUserId: string,
    input: CreateIssueRelationInput,
  ) {
    if (issueId === input.targetIssueId) {
      throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'Cannot relate an issue to itself');
    }

    const source = await this.db
      .select({ projectId: issues.projectId })
      .from(issues)
      .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);
    if (!source) throw AppError.notFound('issue');
    await this.verifyProjectMember(source.projectId, callerUserId);

    const target = await this.db
      .select({ id: issues.id, projectId: issues.projectId })
      .from(issues)
      .where(and(eq(issues.id, input.targetIssueId), isNull(issues.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);
    if (!target) throw AppError.notFound('target_issue');
    if (target.projectId !== source.projectId) {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Cross-project relations are not supported',
      );
    }

    // Circular-blocks check: only for 'blocks' edges. Ensure target does
    // not already (transitively) block source.
    if (input.type === 'blocks') {
      const cycle = await this.db.execute(sql`
        WITH RECURSIVE chain AS (
          SELECT source_issue_id, target_issue_id
            FROM issue_relations
           WHERE source_issue_id = ${input.targetIssueId}
             AND type = 'blocks'
          UNION ALL
          SELECT r.source_issue_id, r.target_issue_id
            FROM issue_relations r
            JOIN chain c ON c.target_issue_id = r.source_issue_id
           WHERE r.type = 'blocks'
        )
        SELECT 1 FROM chain WHERE target_issue_id = ${issueId} LIMIT 1;
      `);
      const found = (cycle as unknown as { rows?: unknown[] }).rows ?? (cycle as unknown as unknown[]);
      if (Array.isArray(found) && found.length > 0) {
        throw AppError.badRequest(
          ErrorCode.VALIDATION_ERROR,
          'This relation would create a blocking cycle',
        );
      }
    }

    try {
      const [created] = await this.db
        .insert(issueRelations)
        .values({
          sourceIssueId: issueId,
          targetIssueId: input.targetIssueId,
          type: input.type,
          createdBy: callerUserId,
        })
        .returning();
      return created!;
    } catch (err) {
      // Unique-violation = duplicate relation of same type.
      if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
        throw AppError.conflict(
          ErrorCode.ALREADY_A_MEMBER,
          'This relation already exists',
        );
      }
      throw err;
    }
  }

  async removeRelation(issueId: string, callerUserId: string, relationId: string) {
    const existing = await this.db
      .select()
      .from(issueRelations)
      .where(eq(issueRelations.id, relationId))
      .limit(1)
      .then((rows) => rows[0]);
    if (!existing) throw AppError.notFound('relation');
    if (existing.sourceIssueId !== issueId && existing.targetIssueId !== issueId) {
      throw AppError.notFound('relation');
    }

    const issue = await this.db
      .select({ projectId: issues.projectId })
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1)
      .then((rows) => rows[0]);
    if (!issue) throw AppError.notFound('issue');
    await this.verifyProjectMember(issue.projectId, callerUserId);

    await this.db.delete(issueRelations).where(eq(issueRelations.id, relationId));
  }
}
