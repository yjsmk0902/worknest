import { eq, and, isNull, lt, desc, ilike, sql, inArray } from "drizzle-orm";
import {
  issues,
  issueStatuses,
  issueTypes,
  issueAssignees,
  issueLabels,
  labels,
  users,
  projects,
  projectMembers,
  type Database,
} from "@worknest/db";
import type { CreateIssueInput, UpdateIssueInput, IssueFilterQuery } from "@worknest/shared";
import { AppError, ErrorCode } from "../lib/errors";
import { ActivityService } from "./activity-service";
import {
  broadcastIssueCreated,
  broadcastIssueUpdated,
  broadcastIssueDeleted,
} from "../websocket/issue-events";

// ── Service ──────────────────────────────────────────────────────────────

export class IssueService {
  private activityService: ActivityService;

  constructor(private db: Database) {
    this.activityService = new ActivityService(db);
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  /**
   * Verify caller is a member of the project. Throws forbidden if not.
   */
  private async verifyProjectMember(projectId: string, userId: string) {
    const member = await this.db
      .select({ id: projectMembers.id, role: projectMembers.role })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!member) {
      throw AppError.forbidden("You are not a member of this project");
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

    return this.formatIssue(row, assigneeRows, labelRows);
  }

  /**
   * Format an issue row with its relations into the API output shape.
   */
  private formatIssue(
    row: {
      issue: typeof issues.$inferSelect;
      status: { id: string; name: string; color: string } | null;
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
      dueDate: row.issue.dueDate?.toISOString() ?? null,
      createdAt: row.issue.createdAt.toISOString(),
      updatedAt: row.issue.updatedAt.toISOString(),
      status: row.status?.id
        ? { id: row.status.id, name: row.status.name, color: row.status.color }
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
    };
  }

  // ── Create Issue ──────────────────────────────────────────────────────

  async create(projectId: string, callerUserId: string, input: CreateIssueInput) {
    await this.verifyProjectMember(projectId, callerUserId);

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
        throw AppError.notFound("project");
      }

      const sequenceId = updated.issueCounter;

      // Create the issue
      const [created] = await tx
        .insert(issues)
        .values({
          projectId,
          sequenceId,
          title: input.title,
          description: input.description ?? null,
          descriptionText: input.descriptionText ?? null,
          statusId: input.statusId ?? null,
          typeId: input.typeId ?? null,
          priority: input.priority ?? "none",
          parentId: input.parentId ?? null,
          creatorId: callerUserId,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        })
        .returning();

      const issueId = created!.id;

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
      action: "created",
    });

    // Fetch full issue with relations
    const fullIssue = await this.getIssueWithRelations(issue.id);

    // Broadcast WebSocket event
    broadcastIssueCreated(projectId, fullIssue);

    return fullIssue!;
  }

  // ── Get Issue by ID ───────────────────────────────────────────────────

  async getById(issueId: string, callerUserId: string) {
    const issue = await this.getIssueWithRelations(issueId);

    if (!issue) {
      throw AppError.notFound("issue");
    }

    await this.verifyProjectMember(issue.projectId, callerUserId);

    return issue;
  }

  // ── List Issues ───────────────────────────────────────────────────────

  async list(projectId: string, callerUserId: string, filters: IssueFilterQuery) {
    await this.verifyProjectMember(projectId, callerUserId);

    const { cursor, limit, statusId, typeId, priority, assigneeId, labelId, parentId, search } =
      filters;

    // Build where conditions
    const conditions = [
      eq(issues.projectId, projectId),
      isNull(issues.deletedAt),
    ];

    if (cursor) {
      conditions.push(lt(issues.createdAt, new Date(cursor)));
    }
    if (statusId) {
      conditions.push(eq(issues.statusId, statusId));
    }
    if (typeId) {
      conditions.push(eq(issues.typeId, typeId));
    }
    if (priority) {
      conditions.push(eq(issues.priority, priority));
    }
    if (parentId) {
      conditions.push(eq(issues.parentId, parentId));
    }
    if (search) {
      conditions.push(ilike(issues.title, `%${search}%`));
    }

    // Build query with optional assignee/label joins (both can apply simultaneously)
    // Use subquery-based conditions so filters are independent
    if (assigneeId) {
      conditions.push(
        sql`${issues.id} IN (SELECT ${issueAssignees.issueId} FROM ${issueAssignees} WHERE ${eq(issueAssignees.userId, assigneeId)})`,
      );
    }
    if (labelId) {
      conditions.push(
        sql`${issues.id} IN (SELECT ${issueLabels.issueId} FROM ${issueLabels} WHERE ${eq(issueLabels.labelId, labelId)})`,
      );
    }

    const baseQuery = this.db
      .select({
        issue: issues,
        status: {
          id: issueStatuses.id,
          name: issueStatuses.name,
          color: issueStatuses.color,
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
      .orderBy(desc(issues.createdAt))
      .limit(limit + 1);

    const rows = await baseQuery;
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    // Batch-fetch assignees and labels for all returned issues
    const issueIds = items.map((r) => r.issue.id);

    let assigneeMap = new Map<
      string,
      { assignee: { id: string; userId: string }; user: { id: string; name: string; email: string; avatarUrl: string | null } }[]
    >();
    let labelMap = new Map<
      string,
      { issueLabel: { id: string; labelId: string }; label: { id: string; name: string; color: string } }[]
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
      data: items.map((row) =>
        this.formatIssue(
          row,
          assigneeMap.get(row.issue.id) ?? [],
          labelMap.get(row.issue.id) ?? [],
        ),
      ),
      pagination: {
        next_cursor: hasMore
          ? items[items.length - 1]!.issue.createdAt.toISOString()
          : null,
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
      throw AppError.notFound("issue");
    }

    await this.verifyProjectMember(existing.projectId, callerUserId);

    // Build update payload and track changes
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const changedFields: { field: string; oldValue: string | null; newValue: string | null }[] = [];

    if (input.title !== undefined && input.title !== existing.title) {
      updates.title = input.title;
      changedFields.push({ field: "title", oldValue: existing.title, newValue: input.title });
    }
    if (input.description !== undefined) {
      updates.description = input.description;
      changedFields.push({ field: "description", oldValue: null, newValue: null });
    }
    if (input.descriptionText !== undefined) {
      updates.descriptionText = input.descriptionText;
    }
    if (input.statusId !== undefined && input.statusId !== existing.statusId) {
      updates.statusId = input.statusId;
      changedFields.push({
        field: "status",
        oldValue: existing.statusId,
        newValue: input.statusId,
      });
    }
    if (input.typeId !== undefined && input.typeId !== existing.typeId) {
      updates.typeId = input.typeId;
      changedFields.push({
        field: "type",
        oldValue: existing.typeId,
        newValue: input.typeId,
      });
    }
    if (input.priority !== undefined && input.priority !== existing.priority) {
      updates.priority = input.priority;
      changedFields.push({
        field: "priority",
        oldValue: existing.priority,
        newValue: input.priority,
      });
    }
    if (input.parentId !== undefined && input.parentId !== existing.parentId) {
      updates.parentId = input.parentId;
      changedFields.push({
        field: "parent",
        oldValue: existing.parentId,
        newValue: input.parentId,
      });
    }
    if (input.sortOrder !== undefined && input.sortOrder !== existing.sortOrder) {
      updates.sortOrder = input.sortOrder;
    }
    if (input.dueDate !== undefined) {
      const newDueDate = input.dueDate ? new Date(input.dueDate) : null;
      updates.dueDate = newDueDate;
      changedFields.push({
        field: "dueDate",
        oldValue: existing.dueDate?.toISOString() ?? null,
        newValue: newDueDate?.toISOString() ?? null,
      });
    }

    // Perform update
    await this.db
      .update(issues)
      .set(updates)
      .where(eq(issues.id, issueId));

    // Record activities for each changed field
    for (const change of changedFields) {
      await this.activityService.record({
        actorId: callerUserId,
        issueId,
        projectId: existing.projectId,
        action: "updated",
        field: change.field,
        oldValue: change.oldValue ?? undefined,
        newValue: change.newValue ?? undefined,
      });
    }

    // Fetch and return updated issue
    const fullIssue = await this.getIssueWithRelations(issueId);

    // Broadcast WebSocket event
    broadcastIssueUpdated(existing.projectId, fullIssue);

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
      throw AppError.notFound("issue");
    }

    const member = await this.verifyProjectMember(existing.projectId, callerUserId);

    // Only admin or member can delete (not viewer)
    if (!["admin", "member"].includes(member.role)) {
      throw AppError.forbidden("Only project admin or member can delete issues");
    }

    // Soft delete the issue and promote sub-issues
    await this.db.transaction(async (tx) => {
      await tx
        .update(issues)
        .set({ deletedAt: new Date() })
        .where(eq(issues.id, issueId));

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
      action: "deleted",
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
      throw AppError.notFound("issue");
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
        "User is already an assignee of this issue",
      );
    }

    // Record activity
    await this.activityService.record({
      actorId: callerUserId,
      issueId,
      projectId: existing.projectId,
      action: "assignee_added",
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
      throw AppError.notFound("issue");
    }

    await this.verifyProjectMember(existing.projectId, callerUserId);

    await this.db
      .delete(issueAssignees)
      .where(
        and(
          eq(issueAssignees.issueId, issueId),
          eq(issueAssignees.userId, userId),
        ),
      );

    // Record activity
    await this.activityService.record({
      actorId: callerUserId,
      issueId,
      projectId: existing.projectId,
      action: "assignee_removed",
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
      throw AppError.notFound("issue");
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
        "Label is already attached to this issue",
      );
    }

    // Record activity
    await this.activityService.record({
      actorId: callerUserId,
      issueId,
      projectId: existing.projectId,
      action: "label_added",
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
      throw AppError.notFound("issue");
    }

    await this.verifyProjectMember(existing.projectId, callerUserId);

    await this.db
      .delete(issueLabels)
      .where(
        and(
          eq(issueLabels.issueId, issueId),
          eq(issueLabels.labelId, labelId),
        ),
      );

    // Record activity
    await this.activityService.record({
      actorId: callerUserId,
      issueId,
      projectId: existing.projectId,
      action: "label_removed",
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
      throw AppError.notFound("issue");
    }

    await this.verifyProjectMember(parent.projectId, callerUserId);

    const rows = await this.db
      .select({
        issue: issues,
        status: {
          id: issueStatuses.id,
          name: issueStatuses.name,
          color: issueStatuses.color,
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
    let assigneeMap = new Map<
      string,
      { assignee: { id: string; userId: string }; user: { id: string; name: string; email: string; avatarUrl: string | null } }[]
    >();
    let labelMap = new Map<
      string,
      { issueLabel: { id: string; labelId: string }; label: { id: string; name: string; color: string } }[]
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
}
