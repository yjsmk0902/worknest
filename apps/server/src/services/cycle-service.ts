import {
  type Database,
  cycleIssues,
  cycles,
  issueStatuses,
  issues,
  projectMembers,
} from '@worknest/db';
import type { CompleteCycleInput, CreateCycleInput, UpdateCycleInput } from '@worknest/shared';
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { AppError, ErrorCode } from '../lib/errors';
import { broadcastCycleIssueChanged, broadcastCycleUpdated } from '../websocket/cycle-events';

// ── Helpers ──────────────────────────────────────────────────────────────

async function requireProjectMembership(db: Database, projectId: string, userId: string) {
  const member = await db
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

function formatCycle(row: typeof cycles.$inferSelect) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    status: row.status as 'draft' | 'active' | 'completed',
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function formatCycleIssue(row: typeof cycleIssues.$inferSelect) {
  return {
    id: row.id,
    cycleId: row.cycleId,
    issueId: row.issueId,
    addedAt: row.addedAt.toISOString(),
    removedAt: row.removedAt?.toISOString() ?? null,
    carriedFromId: row.carriedFromId,
  };
}

// ── Service ──────────────────────────────────────────────────────────────

export class CycleService {
  constructor(private db: Database) {}

  // ── List Cycles ────────────────────────────────────────────────────────

  async list(projectId: string, callerUserId: string) {
    await requireProjectMembership(this.db, projectId, callerUserId);

    const rows = await this.db
      .select()
      .from(cycles)
      .where(eq(cycles.projectId, projectId))
      .orderBy(desc(cycles.startDate));

    return { data: rows.map(formatCycle) };
  }

  // ── Create Cycle ───────────────────────────────────────────────────────

  async create(projectId: string, callerUserId: string, input: CreateCycleInput) {
    await requireProjectMembership(this.db, projectId, callerUserId);

    const [created] = await this.db
      .insert(cycles)
      .values({
        projectId,
        name: input.name,
        description: input.description ?? null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        createdBy: callerUserId,
      })
      .returning();

    const result = formatCycle(created!);

    broadcastCycleUpdated(projectId, { action: 'created', cycle: result });

    return result;
  }

  // ── Get Cycle by ID ────────────────────────────────────────────────────

  async getById(cycleId: string, callerUserId: string) {
    const cycle = await this.db
      .select()
      .from(cycles)
      .where(eq(cycles.id, cycleId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!cycle) {
      throw AppError.notFound('cycle');
    }

    await requireProjectMembership(this.db, cycle.projectId, callerUserId);

    return formatCycle(cycle);
  }

  // ── Update Cycle ───────────────────────────────────────────────────────

  async update(cycleId: string, callerUserId: string, input: UpdateCycleInput) {
    const existing = await this.db
      .select()
      .from(cycles)
      .where(eq(cycles.id, cycleId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound('cycle');
    }

    await requireProjectMembership(this.db, existing.projectId, callerUserId);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.startDate !== undefined) {
      updates.startDate = input.startDate ? new Date(input.startDate) : null;
    }
    if (input.endDate !== undefined) {
      updates.endDate = input.endDate ? new Date(input.endDate) : null;
    }

    const [updated] = await this.db
      .update(cycles)
      .set(updates)
      .where(eq(cycles.id, cycleId))
      .returning();

    const result = formatCycle(updated!);

    broadcastCycleUpdated(existing.projectId, {
      action: 'updated',
      cycle: result,
    });

    return result;
  }

  // ── Delete Cycle ───────────────────────────────────────────────────────

  async delete(cycleId: string, callerUserId: string) {
    const existing = await this.db
      .select()
      .from(cycles)
      .where(eq(cycles.id, cycleId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound('cycle');
    }

    await requireProjectMembership(this.db, existing.projectId, callerUserId);

    if (existing.status === 'active') {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Active cycles cannot be deleted. Complete the cycle first.',
      );
    }

    await this.db.delete(cycles).where(eq(cycles.id, cycleId));

    broadcastCycleUpdated(existing.projectId, {
      action: 'deleted',
      cycleId,
    });
  }

  // ── Activate Cycle ─────────────────────────────────────────────────────

  async activate(cycleId: string, callerUserId: string) {
    const existing = await this.db
      .select()
      .from(cycles)
      .where(eq(cycles.id, cycleId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound('cycle');
    }

    await requireProjectMembership(this.db, existing.projectId, callerUserId);

    // Only draft cycles can be activated
    if (existing.status !== 'draft') {
      throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'Only draft cycles can be activated');
    }

    // Check + activate in a transaction to prevent TOCTOU race condition
    const updated = await this.db.transaction(async (tx) => {
      const activeCycle = await tx
        .select({ id: cycles.id })
        .from(cycles)
        .where(and(eq(cycles.projectId, existing.projectId), eq(cycles.status, 'active')))
        .limit(1)
        .then((rows) => rows[0]);

      if (activeCycle) {
        throw AppError.conflict(
          ErrorCode.ACTIVE_CYCLE_EXISTS,
          'An active cycle already exists in this project',
        );
      }

      const [row] = await tx
        .update(cycles)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(cycles.id, cycleId))
        .returning();

      return row!;
    });

    const result = formatCycle(updated);

    broadcastCycleUpdated(existing.projectId, {
      action: 'activated',
      cycle: result,
    });

    return result;
  }

  // ── Add Issue to Cycle ─────────────────────────────────────────────────

  async addIssue(cycleId: string, callerUserId: string, issueId: string) {
    const cycle = await this.db
      .select()
      .from(cycles)
      .where(eq(cycles.id, cycleId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!cycle) {
      throw AppError.notFound('cycle');
    }

    await requireProjectMembership(this.db, cycle.projectId, callerUserId);

    // Verify issue exists
    const issue = await this.db
      .select({ id: issues.id, projectId: issues.projectId })
      .from(issues)
      .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!issue) {
      throw AppError.notFound('issue');
    }

    // Verify issue belongs to the same project as the cycle
    if (issue.projectId !== cycle.projectId) {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Issue does not belong to this project',
      );
    }

    // Check not already active in cycle
    const existing = await this.db
      .select({ id: cycleIssues.id })
      .from(cycleIssues)
      .where(
        and(
          eq(cycleIssues.cycleId, cycleId),
          eq(cycleIssues.issueId, issueId),
          isNull(cycleIssues.removedAt),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      throw AppError.conflict(ErrorCode.ALREADY_A_MEMBER, 'Issue is already in this cycle');
    }

    const [created] = await this.db.insert(cycleIssues).values({ cycleId, issueId }).returning();

    const result = formatCycleIssue(created!);

    broadcastCycleIssueChanged(cycle.projectId, {
      action: 'added',
      cycleId,
      cycleIssue: result,
    });

    return result;
  }

  // ── Remove Issue from Cycle ────────────────────────────────────────────

  async removeIssue(cycleId: string, callerUserId: string, issueId: string) {
    const cycle = await this.db
      .select()
      .from(cycles)
      .where(eq(cycles.id, cycleId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!cycle) {
      throw AppError.notFound('cycle');
    }

    await requireProjectMembership(this.db, cycle.projectId, callerUserId);

    const entry = await this.db
      .select()
      .from(cycleIssues)
      .where(
        and(
          eq(cycleIssues.cycleId, cycleId),
          eq(cycleIssues.issueId, issueId),
          isNull(cycleIssues.removedAt),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!entry) {
      throw AppError.notFound('cycle_issue');
    }

    // Soft remove
    await this.db
      .update(cycleIssues)
      .set({ removedAt: new Date() })
      .where(eq(cycleIssues.id, entry.id));

    broadcastCycleIssueChanged(cycle.projectId, {
      action: 'removed',
      cycleId,
      issueId,
    });
  }

  // ── List Issues in Cycle ───────────────────────────────────────────────

  async listIssues(cycleId: string, callerUserId: string) {
    const cycle = await this.db
      .select()
      .from(cycles)
      .where(eq(cycles.id, cycleId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!cycle) {
      throw AppError.notFound('cycle');
    }

    await requireProjectMembership(this.db, cycle.projectId, callerUserId);

    // Join with issues table to return full issue data
    const rows = await this.db
      .select({
        issue: issues,
        status: {
          id: issueStatuses.id,
          name: issueStatuses.name,
          color: issueStatuses.color,
        },
      })
      .from(cycleIssues)
      .innerJoin(issues, eq(cycleIssues.issueId, issues.id))
      .leftJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .where(
        and(
          eq(cycleIssues.cycleId, cycleId),
          isNull(cycleIssues.removedAt),
          isNull(issues.deletedAt),
        ),
      )
      .orderBy(desc(cycleIssues.addedAt));

    return {
      data: rows.map((row) => ({
        id: row.issue.id,
        projectId: row.issue.projectId,
        sequenceId: row.issue.sequenceId,
        title: row.issue.title,
        description: row.issue.description ?? null,
        descriptionText: row.issue.descriptionText ?? null,
        statusId: row.issue.statusId ?? null,
        typeId: row.issue.typeId ?? null,
        priority: row.issue.priority ?? 'none',
        parentId: row.issue.parentId ?? null,
        creatorId: row.issue.creatorId ?? null,
        sortOrder: row.issue.sortOrder,
        startDate: row.issue.startDate?.toISOString() ?? null,
        dueDate: row.issue.dueDate?.toISOString() ?? null,
        createdAt: row.issue.createdAt.toISOString(),
        updatedAt: row.issue.updatedAt.toISOString(),
        status: row.status
          ? {
              id: row.status.id,
              name: row.status.name,
              color: row.status.color,
            }
          : null,
      })),
      pagination: {
        next_cursor: null,
        has_more: false,
      },
    };
  }

  // ── Complete Cycle ─────────────────────────────────────────────────────

  async complete(cycleId: string, callerUserId: string, input: CompleteCycleInput) {
    const cycle = await this.db
      .select()
      .from(cycles)
      .where(eq(cycles.id, cycleId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!cycle) {
      throw AppError.notFound('cycle');
    }

    await requireProjectMembership(this.db, cycle.projectId, callerUserId);

    // Only active cycles can be completed
    if (cycle.status !== 'active') {
      throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'Only active cycles can be completed');
    }

    // Validate target cycle if provided
    if (input.targetCycleId) {
      const targetCycle = await this.db
        .select({ id: cycles.id, projectId: cycles.projectId })
        .from(cycles)
        .where(eq(cycles.id, input.targetCycleId))
        .limit(1)
        .then((rows) => rows[0]);

      if (!targetCycle) {
        throw AppError.notFound('cycle');
      }

      if (targetCycle.projectId !== cycle.projectId) {
        throw AppError.badRequest(
          ErrorCode.VALIDATION_ERROR,
          'Target cycle must belong to the same project',
        );
      }
    }

    const result = await this.db.transaction(async (tx) => {
      // 1. Set cycle status to completed
      const [updated] = await tx
        .update(cycles)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(cycles.id, cycleId))
        .returning();

      // 2. Find active (non-removed) issues in this cycle
      const activeEntries = await tx
        .select({
          cycleIssue: cycleIssues,
          statusCategory: issueStatuses.category,
        })
        .from(cycleIssues)
        .innerJoin(issues, eq(cycleIssues.issueId, issues.id))
        .leftJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
        .where(and(eq(cycleIssues.cycleId, cycleId), isNull(cycleIssues.removedAt)));

      // 3. Find incomplete issues (status category != completed and != cancelled)
      const incompleteEntries = activeEntries.filter(
        (e) => e.statusCategory !== 'completed' && e.statusCategory !== 'cancelled',
      );

      // 4. If targetCycleId provided, carry over incomplete issues
      if (input.targetCycleId && incompleteEntries.length > 0) {
        await tx.insert(cycleIssues).values(
          incompleteEntries.map((e) => ({
            cycleId: input.targetCycleId!,
            issueId: e.cycleIssue.issueId,
            carriedFromId: e.cycleIssue.id,
          })),
        );
      }

      // 5. Set removedAt on all active entries in the completed cycle
      if (activeEntries.length > 0) {
        const entryIds = activeEntries.map((e) => e.cycleIssue.id);
        await tx
          .update(cycleIssues)
          .set({ removedAt: new Date() })
          .where(inArray(cycleIssues.id, entryIds));
      }

      return updated!;
    });

    const formatted = formatCycle(result);

    broadcastCycleUpdated(cycle.projectId, {
      action: 'completed',
      cycle: formatted,
    });

    return formatted;
  }

  // ── Cycle Progress ─────────────────────────────────────────────────────

  async getProgress(cycleId: string, callerUserId: string) {
    const cycle = await this.db
      .select()
      .from(cycles)
      .where(eq(cycles.id, cycleId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!cycle) {
      throw AppError.notFound('cycle');
    }

    await requireProjectMembership(this.db, cycle.projectId, callerUserId);

    // Count issues by status category
    const rows = await this.db
      .select({
        category: issueStatuses.category,
        count: count(),
      })
      .from(cycleIssues)
      .innerJoin(issues, eq(cycleIssues.issueId, issues.id))
      .leftJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .where(and(eq(cycleIssues.cycleId, cycleId), isNull(cycleIssues.removedAt)))
      .groupBy(issueStatuses.category);

    const byCategory: Record<string, number> = {};
    let total = 0;
    let completed = 0;

    for (const row of rows) {
      const category = row.category ?? 'uncategorized';
      const cnt = Number(row.count);
      byCategory[category] = cnt;
      total += cnt;
      if (category === 'completed') {
        completed += cnt;
      }
    }

    return { total, completed, byCategory };
  }
}
