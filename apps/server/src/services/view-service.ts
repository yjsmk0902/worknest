import { type Database, projectMembers, views } from '@worknest/db';
import type { CreateViewInput, UpdateViewInput } from '@worknest/shared';
import { and, asc, eq } from 'drizzle-orm';
import { AppError } from '../lib/errors';

// ── Helpers ────────────────────────────────────────────────────────────

async function requireProjectMembership(db: Database, projectId: string, userId: string) {
  const member = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!member) {
    throw AppError.forbidden('You are not a member of this project');
  }

  return member;
}

// ── Serialisation ──────────────────────────────────────────────────────

function toViewOutput(row: typeof views.$inferSelect) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    createdBy: row.createdBy,
    filters: row.filters ?? [],
    sort: row.sort ?? null,
    groupBy: row.groupBy ?? null,
    type: row.type,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Service ────────────────────────────────────────────────────────────

export class ViewService {
  constructor(private db: Database) {}

  // ── List Views ───────────────────────────────────────────────────

  async list(projectId: string, callerUserId: string) {
    await requireProjectMembership(this.db, projectId, callerUserId);

    const rows = await this.db
      .select()
      .from(views)
      .where(eq(views.projectId, projectId))
      .orderBy(asc(views.createdAt));

    return {
      data: rows.map(toViewOutput),
      pagination: {
        next_cursor: null,
        has_more: false,
      },
    };
  }

  // ── Create View ──────────────────────────────────────────────────

  async create(projectId: string, creatorId: string, input: CreateViewInput) {
    await requireProjectMembership(this.db, projectId, creatorId);

    const [view] = await this.db
      .insert(views)
      .values({
        projectId,
        createdBy: creatorId,
        name: input.name,
        type: input.type,
        filters: input.filters ?? [],
        sort: input.sort ?? null,
        groupBy: input.groupBy ?? null,
      })
      .returning();

    return toViewOutput(view!);
  }

  // ── Get View by ID ───────────────────────────────────────────────

  async getById(viewId: string, callerUserId: string) {
    const view = await this.db
      .select()
      .from(views)
      .where(eq(views.id, viewId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!view) {
      throw AppError.notFound('view');
    }

    await requireProjectMembership(this.db, view.projectId, callerUserId);

    return toViewOutput(view);
  }

  // ── Update View ──────────────────────────────────────────────────

  async update(viewId: string, callerUserId: string, input: UpdateViewInput) {
    // Look up the view to get its projectId
    const existing = await this.db
      .select()
      .from(views)
      .where(eq(views.id, viewId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound('view');
    }

    await requireProjectMembership(this.db, existing.projectId, callerUserId);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.type !== undefined) updates.type = input.type;
    if (input.filters !== undefined) updates.filters = input.filters;
    if (input.sort !== undefined) updates.sort = input.sort;
    if (input.groupBy !== undefined) updates.groupBy = input.groupBy;

    const [updated] = await this.db
      .update(views)
      .set(updates)
      .where(eq(views.id, viewId))
      .returning();

    return toViewOutput(updated!);
  }

  // ── Delete View ──────────────────────────────────────────────────

  async delete(viewId: string, callerUserId: string) {
    // Look up the view to get its projectId
    const existing = await this.db
      .select()
      .from(views)
      .where(eq(views.id, viewId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) {
      throw AppError.notFound('view');
    }

    await requireProjectMembership(this.db, existing.projectId, callerUserId);

    await this.db.delete(views).where(eq(views.id, viewId));
  }
}
