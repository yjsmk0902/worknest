import { type Database, issueTemplates, projectMembers } from '@worknest/db';
import type { CreateIssueTemplateInput, UpdateIssueTemplateInput } from '@worknest/shared';
import { and, asc, eq } from 'drizzle-orm';
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
    throw AppError.forbidden('Only project admins and members can manage templates');
  }

  return member;
}

function serialize(row: typeof issueTemplates.$inferSelect) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    titleTemplate: row.titleTemplate,
    body: row.body,
    priority: row.priority,
    typeId: row.typeId,
    labelIds: row.labelIds ?? [],
    sortOrder: row.sortOrder,
    isDefault: row.isDefault,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Service ────────────────────────────────────────────────────────────

export class IssueTemplateService {
  constructor(private db: Database) {}

  async list(projectId: string, callerUserId: string) {
    await requireProjectMembership(this.db, projectId, callerUserId);

    const rows = await this.db
      .select()
      .from(issueTemplates)
      .where(eq(issueTemplates.projectId, projectId))
      .orderBy(asc(issueTemplates.sortOrder), asc(issueTemplates.name));

    return { data: rows.map(serialize) };
  }

  async create(projectId: string, callerUserId: string, input: CreateIssueTemplateInput) {
    await requireProjectAdminOrMember(this.db, projectId, callerUserId);

    const existing = await this.db
      .select({ id: issueTemplates.id })
      .from(issueTemplates)
      .where(and(eq(issueTemplates.projectId, projectId), eq(issueTemplates.name, input.name)))
      .limit(1);

    if (existing.length > 0) {
      throw AppError.conflict(
        ErrorCode.SLUG_ALREADY_EXISTS,
        'A template with this name already exists in the project',
      );
    }

    const [row] = await this.db
      .insert(issueTemplates)
      .values({
        projectId,
        name: input.name,
        description: input.description ?? null,
        titleTemplate: input.titleTemplate ?? '',
        body: (input.body ?? null) as unknown as object | null,
        priority: input.priority ?? 'none',
        typeId: input.typeId ?? null,
        labelIds: input.labelIds ?? [],
        sortOrder: input.sortOrder ?? 0,
        createdBy: callerUserId,
      })
      .returning();

    if (!row) throw AppError.internal('Failed to create template');
    return serialize(row);
  }

  async update(
    projectId: string,
    templateId: string,
    callerUserId: string,
    input: UpdateIssueTemplateInput,
  ) {
    await requireProjectAdminOrMember(this.db, projectId, callerUserId);

    const existing = await this.db
      .select()
      .from(issueTemplates)
      .where(and(eq(issueTemplates.id, templateId), eq(issueTemplates.projectId, projectId)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing) throw AppError.notFound('issue template');

    if (input.name && input.name !== existing.name) {
      const dup = await this.db
        .select({ id: issueTemplates.id })
        .from(issueTemplates)
        .where(and(eq(issueTemplates.projectId, projectId), eq(issueTemplates.name, input.name)))
        .limit(1);
      if (dup.length > 0) {
        throw AppError.conflict(
          ErrorCode.SLUG_ALREADY_EXISTS,
          'A template with this name already exists in the project',
        );
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.titleTemplate !== undefined) updates.titleTemplate = input.titleTemplate;
    if (input.body !== undefined) updates.body = input.body;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.typeId !== undefined) updates.typeId = input.typeId;
    if (input.labelIds !== undefined) updates.labelIds = input.labelIds;
    if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

    const [row] = await this.db
      .update(issueTemplates)
      .set(updates)
      .where(eq(issueTemplates.id, templateId))
      .returning();

    if (!row) throw AppError.internal('Failed to update template');
    return serialize(row);
  }

  async delete(projectId: string, templateId: string, callerUserId: string) {
    await requireProjectAdminOrMember(this.db, projectId, callerUserId);

    const existing = await this.db
      .select({ id: issueTemplates.id })
      .from(issueTemplates)
      .where(and(eq(issueTemplates.id, templateId), eq(issueTemplates.projectId, projectId)))
      .limit(1);

    if (existing.length === 0) throw AppError.notFound('issue template');

    await this.db.delete(issueTemplates).where(eq(issueTemplates.id, templateId));
  }
}
