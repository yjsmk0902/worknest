import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  eq,
  and,
  isNull,
  inArray,
} from "drizzle-orm";
import type { Auth } from "../lib/auth";
import {
  issues,
  issueStatuses,
  issueTypes,
  issueAssignees,
  issueLabels,
  labels,
  projects,
  users,
  type Database,
} from "@worknest/db";
import { createRequireAuth } from "../middleware/auth";

// ── Param Schemas ──────────────────────────────────────────────────────

const workspaceIdParam = z.object({ workspaceId: z.string().uuid() });

// ── Types ──────────────────────────────────────────────────────────────

/** Status category keys used for grouping */
type StatusCategory = "backlog" | "unstarted" | "started" | "completed" | "cancelled";

interface MyIssue {
  id: string;
  projectId: string;
  sequenceId: number;
  title: string;
  description: unknown;
  descriptionText: string | null;
  statusId: string | null;
  typeId: string | null;
  priority: string;
  parentId: string | null;
  creatorId: string | null;
  sortOrder: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  status: { id: string; name: string; color: string; category: string } | null;
  type: { id: string; name: string; icon: string; color: string } | null;
  project: { id: string; name: string; prefix: string };
  assignees: {
    id: string;
    userId: string;
    user: { id: string; name: string; email: string; avatarUrl: string | null };
  }[];
  labels: {
    id: string;
    labelId: string;
    label: { id: string; name: string; color: string };
  }[];
}

type GroupedResult = Record<StatusCategory, MyIssue[]>;

/**
 * My Work routes.
 *
 * Provides the "My Issues" view -- issues assigned to the current user
 * across all projects in a workspace, grouped by status category.
 */
export async function myWorkRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);

  // ── GET /api/v1/workspaces/:workspaceId/my-issues ─────────────────

  app.get(
    "/api/v1/workspaces/:workspaceId/my-issues",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["My Work"],
        summary: "List issues assigned to the current user grouped by status category",
        params: workspaceIdParam,
      },
    },
    async (request, reply) => {
      const { workspaceId } = workspaceIdParam.parse(request.params);
      const callerUserId = request.user!.id;

      // Fetch all issues assigned to the caller in this workspace
      const rows = await db
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
          project: {
            id: projects.id,
            name: projects.name,
            prefix: projects.prefix,
          },
        })
        .from(issueAssignees)
        .innerJoin(issues, eq(issueAssignees.issueId, issues.id))
        .innerJoin(projects, eq(issues.projectId, projects.id))
        .leftJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
        .leftJoin(issueTypes, eq(issues.typeId, issueTypes.id))
        .where(
          and(
            eq(issueAssignees.userId, callerUserId),
            eq(projects.workspaceId, workspaceId),
            isNull(issues.deletedAt),
            isNull(projects.deletedAt),
          ),
        );

      // Collect unique issue IDs for batch-loading assignees and labels
      const issueIds = rows.map((r) => r.issue.id);

      // Batch-load assignees and labels in parallel (skip if no issues)
      const [assigneeRows, labelRows] = await Promise.all([
        issueIds.length > 0
          ? db
              .select({
                issueId: issueAssignees.issueId,
                id: issueAssignees.id,
                userId: issueAssignees.userId,
                userName: users.name,
                userEmail: users.email,
                userAvatar: users.avatarUrl,
              })
              .from(issueAssignees)
              .innerJoin(users, eq(issueAssignees.userId, users.id))
              .where(inArray(issueAssignees.issueId, issueIds))
          : Promise.resolve([]),
        issueIds.length > 0
          ? db
              .select({
                issueId: issueLabels.issueId,
                id: issueLabels.id,
                labelId: issueLabels.labelId,
                labelName: labels.name,
                labelColor: labels.color,
              })
              .from(issueLabels)
              .innerJoin(labels, eq(issueLabels.labelId, labels.id))
              .where(inArray(issueLabels.issueId, issueIds))
          : Promise.resolve([]),
      ]);

      // Index assignees and labels by issue ID
      const assigneesByIssue = new Map<string, MyIssue["assignees"]>();
      for (const a of assigneeRows) {
        const arr = assigneesByIssue.get(a.issueId) ?? [];
        arr.push({
          id: a.id,
          userId: a.userId,
          user: {
            id: a.userId,
            name: a.userName,
            email: a.userEmail,
            avatarUrl: a.userAvatar,
          },
        });
        assigneesByIssue.set(a.issueId, arr);
      }

      const labelsByIssue = new Map<string, MyIssue["labels"]>();
      for (const l of labelRows) {
        const arr = labelsByIssue.get(l.issueId) ?? [];
        arr.push({
          id: l.id,
          labelId: l.labelId,
          label: {
            id: l.labelId,
            name: l.labelName,
            color: l.labelColor,
          },
        });
        labelsByIssue.set(l.issueId, arr);
      }

      // Group by status category
      const grouped: GroupedResult = {
        backlog: [],
        unstarted: [],
        started: [],
        completed: [],
        cancelled: [],
      };

      for (const row of rows) {
        const category = (row.status?.category ?? "backlog") as StatusCategory;
        const bucket = grouped[category] ?? grouped.backlog;

        const formatted: MyIssue = {
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
          project: {
            id: row.project.id,
            name: row.project.name,
            prefix: row.project.prefix,
          },
          assignees: assigneesByIssue.get(row.issue.id) ?? [],
          labels: labelsByIssue.get(row.issue.id) ?? [],
        };

        bucket.push(formatted);
      }

      return reply.status(200).send({ data: grouped });
    },
  );
}
