import { type Database, labels, projectMembers } from '@worknest/db';
import type { CreateLabelInput, UpdateLabelInput } from '@worknest/shared';
import { and, eq } from 'drizzle-orm';
import { AppError, ErrorCode } from '../lib/errors';

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

async function requireProjectAdminOrMember(db: Database, projectId: string, userId: string) {
  const member = await requireProjectMembership(db, projectId, userId);

  if (member.role !== 'admin' && member.role !== 'member') {
    throw AppError.forbidden('Only project admins and members can perform this action');
  }

  return member;
}

async function requireProjectAdmin(db: Database, projectId: string, userId: string) {
  const member = await requireProjectMembership(db, projectId, userId);

  if (member.role !== 'admin') {
    throw AppError.forbidden('Only project admins can perform this action');
  }

  return member;
}

// ── Service ────────────────────────────────────────────────────────────

export class LabelService {
  constructor(private db: Database) {}

  // ── List Labels ───────────────────────────────────────────────────

  async list(projectId: string, callerUserId: string) {
    await requireProjectMembership(this.db, projectId, callerUserId);

    const rows = await this.db
      .select()
      .from(labels)
      .where(eq(labels.projectId, projectId))
      .orderBy(labels.name);

    return {
      data: rows.map((row) => ({
        id: row.id,
        projectId: row.projectId,
        name: row.name,
        color: row.color,
        description: row.description,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  // ── Create Label ──────────────────────────────────────────────────

  async create(projectId: string, callerUserId: string, input: CreateLabelInput) {
    await requireProjectAdminOrMember(this.db, projectId, callerUserId);

    // Check for existing label with the same name in this project
    const existing = await this.db
      .select({ id: labels.id })
      .from(labels)
      .where(and(eq(labels.projectId, projectId), eq(labels.name, input.name)))
      .limit(1);

    if (existing.length > 0) {
      throw AppError.conflict(
        ErrorCode.SLUG_ALREADY_EXISTS,
        'A label with this name already exists in the project',
      );
    }

    const [label] = await this.db
      .insert(labels)
      .values({
        projectId,
        name: input.name,
        color: input.color,
        description: input.description ?? null,
      })
      .returning();

    return {
      id: label?.id,
      projectId: label?.projectId,
      name: label?.name,
      color: label?.color,
      description: label?.description,
      createdAt: label?.createdAt.toISOString(),
    };
  }

  // ── Update Label ──────────────────────────────────────────────────

  async update(labelId: string, callerUserId: string, input: UpdateLabelInput) {
    // Find the label first to get its project
    const label = await this.db
      .select()
      .from(labels)
      .where(eq(labels.id, labelId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!label) {
      throw AppError.notFound('label');
    }

    await requireProjectAdminOrMember(this.db, label.projectId, callerUserId);

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.color !== undefined) updates.color = input.color;
    if (input.description !== undefined) updates.description = input.description;

    const [updated] = await this.db
      .update(labels)
      .set(updates)
      .where(eq(labels.id, labelId))
      .returning();

    return {
      id: updated?.id,
      projectId: updated?.projectId,
      name: updated?.name,
      color: updated?.color,
      description: updated?.description,
      createdAt: updated?.createdAt.toISOString(),
    };
  }

  // ── Delete Label ──────────────────────────────────────────────────

  async delete(labelId: string, callerUserId: string) {
    // Find the label first to get its project
    const label = await this.db
      .select()
      .from(labels)
      .where(eq(labels.id, labelId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!label) {
      throw AppError.notFound('label');
    }

    await requireProjectAdmin(this.db, label.projectId, callerUserId);

    await this.db.delete(labels).where(eq(labels.id, labelId));
  }
}
