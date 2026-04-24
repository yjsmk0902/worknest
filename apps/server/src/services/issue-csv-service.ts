import {
  type Database,
  issueAssignees,
  issueLabels,
  issueStatuses,
  issueTypes,
  issues,
  labels as labelsTable,
  projectMembers,
  projects,
  users,
} from '@worknest/db';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { AppError } from '../lib/errors';
import { IssueService } from './issue-service';
import type { NotificationService } from './notification-service';

// ── CSV helpers ────────────────────────────────────────────────────────

function csvEscape(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsvRow(fields: unknown[]): string {
  return fields.map(csvEscape).join(',');
}

// ── Row schema for import ─────────────────────────────────────────────

export interface ImportRow {
  title: string;
  descriptionText?: string;
  priority?: string;
  statusName?: string;
  typeName?: string;
  assigneeEmails?: string[];
  labelNames?: string[];
  startDate?: string;
  dueDate?: string;
}

// ── Service ────────────────────────────────────────────────────────────

export class IssueCsvService {
  private issueService: IssueService;

  constructor(
    private db: Database,
    notificationService: NotificationService,
  ) {
    this.issueService = new IssueService(db, notificationService);
  }

  private async verifyProjectMember(projectId: string, userId: string) {
    const [member] = await this.db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
      .limit(1);
    if (!member) throw AppError.forbidden('You are not a member of this project');
    return member;
  }

  /**
   * Export all non-deleted issues in a project to CSV.
   * Filter-aware fields are pulled straight from the issues table; related
   * rows (status/assignees/labels) are joined separately in bulk and mapped.
   */
  async exportCsv(projectId: string, callerUserId: string): Promise<string> {
    await this.verifyProjectMember(projectId, callerUserId);

    const projectRow = await this.db
      .select({ prefix: projects.prefix })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
      .then((rows) => rows[0]);
    const prefix = projectRow?.prefix ?? 'ISSUE';

    const issueRows = await this.db
      .select({
        id: issues.id,
        sequenceId: issues.sequenceId,
        title: issues.title,
        descriptionText: issues.descriptionText,
        priority: issues.priority,
        statusName: issueStatuses.name,
        typeName: issueTypes.name,
        startDate: issues.startDate,
        dueDate: issues.dueDate,
        createdAt: issues.createdAt,
      })
      .from(issues)
      .leftJoin(issueStatuses, eq(issueStatuses.id, issues.statusId))
      .leftJoin(issueTypes, eq(issueTypes.id, issues.typeId))
      .where(and(eq(issues.projectId, projectId), isNull(issues.deletedAt)))
      .orderBy(asc(issues.sequenceId));

    const issueIds = issueRows.map((r) => r.id);
    const [assigneeRows, labelRows] = issueIds.length
      ? await Promise.all([
          this.db
            .select({
              issueId: issueAssignees.issueId,
              name: users.name,
              email: users.email,
            })
            .from(issueAssignees)
            .innerJoin(users, eq(users.id, issueAssignees.userId))
            .where(inArray(issueAssignees.issueId, issueIds)),
          this.db
            .select({
              issueId: issueLabels.issueId,
              name: labelsTable.name,
            })
            .from(issueLabels)
            .innerJoin(labelsTable, eq(labelsTable.id, issueLabels.labelId))
            .where(inArray(issueLabels.issueId, issueIds)),
        ])
      : [[], []];

    const assigneesByIssue = new Map<string, string[]>();
    for (const row of assigneeRows) {
      const arr = assigneesByIssue.get(row.issueId) ?? [];
      arr.push(row.email);
      assigneesByIssue.set(row.issueId, arr);
    }
    const labelsByIssue = new Map<string, string[]>();
    for (const row of labelRows) {
      const arr = labelsByIssue.get(row.issueId) ?? [];
      arr.push(row.name);
      labelsByIssue.set(row.issueId, arr);
    }

    const header = [
      'Key',
      'Title',
      'Description',
      'Status',
      'Type',
      'Priority',
      'Assignees',
      'Labels',
      'Start Date',
      'Due Date',
      'Created At',
    ];
    const lines: string[] = [header.join(',')];

    for (const r of issueRows) {
      lines.push(
        toCsvRow([
          `${prefix}-${r.sequenceId}`,
          r.title,
          r.descriptionText ?? '',
          r.statusName ?? '',
          r.typeName ?? '',
          r.priority,
          (assigneesByIssue.get(r.id) ?? []).join('; '),
          (labelsByIssue.get(r.id) ?? []).join('; '),
          r.startDate ? r.startDate.toISOString().slice(0, 10) : '',
          r.dueDate ? r.dueDate.toISOString().slice(0, 10) : '',
          r.createdAt.toISOString(),
        ]),
      );
    }

    return `${lines.join('\n')}\n`;
  }

  /**
   * Import pre-parsed rows. The client parses CSV itself and sends
   * structured rows so we don't need to duplicate a CSV parser server-side
   * (keeps the import flexible — JSON imports work too).
   */
  async importRows(projectId: string, callerUserId: string, rows: ImportRow[]) {
    await this.verifyProjectMember(projectId, callerUserId);

    // Preload lookup maps
    const [statusRows, typeRows, labelRows, memberRows] = await Promise.all([
      this.db.select().from(issueStatuses).where(eq(issueStatuses.projectId, projectId)),
      this.db.select().from(issueTypes).where(eq(issueTypes.projectId, projectId)),
      this.db.select().from(labelsTable).where(eq(labelsTable.projectId, projectId)),
      this.db
        .select({ userId: projectMembers.userId, email: users.email })
        .from(projectMembers)
        .innerJoin(users, eq(users.id, projectMembers.userId))
        .where(eq(projectMembers.projectId, projectId)),
    ]);

    const statusByName = new Map(statusRows.map((s) => [s.name.toLowerCase(), s]));
    const typeByName = new Map(typeRows.map((t) => [t.name.toLowerCase(), t]));
    const labelByName = new Map(labelRows.map((l) => [l.name.toLowerCase(), l]));
    const memberByEmail = new Map(memberRows.map((m) => [m.email.toLowerCase(), m.userId]));

    const VALID_PRIORITIES = new Set(['urgent', 'high', 'medium', 'low', 'none']);

    const errors: { row: number; message: string }[] = [];
    let imported = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!;
      try {
        if (!row.title || row.title.trim().length === 0) {
          errors.push({ row: i + 1, message: 'Missing title' });
          continue;
        }

        // Resolve label IDs, creating missing labels on the fly
        const labelIds: string[] = [];
        for (const labelName of row.labelNames ?? []) {
          const key = labelName.trim().toLowerCase();
          if (!key) continue;
          let label = labelByName.get(key);
          if (!label) {
            const [created] = await this.db
              .insert(labelsTable)
              .values({ projectId, name: labelName.trim(), color: '#9ca3af' })
              .returning();
            if (created) {
              labelByName.set(key, created);
              label = created;
            }
          }
          if (label) labelIds.push(label.id);
        }

        const assigneeIds: string[] = [];
        for (const email of row.assigneeEmails ?? []) {
          const userId = memberByEmail.get(email.trim().toLowerCase());
          if (userId) assigneeIds.push(userId);
        }

        const priority = row.priority && VALID_PRIORITIES.has(row.priority)
          ? row.priority
          : 'none';

        const statusId = row.statusName
          ? statusByName.get(row.statusName.toLowerCase())?.id
          : undefined;
        const typeId = row.typeName ? typeByName.get(row.typeName.toLowerCase())?.id : undefined;

        await this.issueService.create(projectId, callerUserId, {
          title: row.title.trim(),
          descriptionText: row.descriptionText,
          priority: priority as 'urgent' | 'high' | 'medium' | 'low' | 'none',
          statusId,
          typeId,
          startDate: row.startDate || undefined,
          dueDate: row.dueDate || undefined,
          assigneeIds: assigneeIds.length ? assigneeIds : undefined,
          labelIds: labelIds.length ? labelIds : undefined,
        });
        imported += 1;
      } catch (err) {
        errors.push({
          row: i + 1,
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return { imported, skipped: errors.length, errors };
  }
}
