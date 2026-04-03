import { eq, and, isNull, lt, desc } from "drizzle-orm";
import {
  projects,
  projectMembers,
  issueStatuses,
  issueTypes,
  users,
  type Database,
} from "@worknest/db";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  AddProjectMemberInput,
  ProjectRole,
  CursorPaginationQuery,
} from "@worknest/shared";
import { AppError, ErrorCode } from "../lib/errors";

// ── Default Seeds ─────────────────────────────────────────────────────

const DEFAULT_STATUSES = [
  { name: "Backlog", color: "#6b7280", sortOrder: 0 },
  { name: "Todo", color: "#3b82f6", sortOrder: 1 },
  { name: "In Progress", color: "#f59e0b", sortOrder: 2 },
  { name: "Done", color: "#22c55e", sortOrder: 3 },
  { name: "Cancelled", color: "#ef4444", sortOrder: 4 },
];

const DEFAULT_TYPES = [
  { name: "Task", icon: "check-circle", color: "#3b82f6", sortOrder: 0 },
  { name: "Bug", icon: "bug", color: "#ef4444", sortOrder: 1 },
  { name: "Story", icon: "book-open", color: "#8b5cf6", sortOrder: 2 },
  { name: "Epic", icon: "rocket", color: "#f59e0b", sortOrder: 3 },
];

// ── Helpers ────────────────────────────────────────────────────────────

async function requireProjectMembership(
  db: Database,
  projectId: string,
  userId: string,
) {
  const member = await db
    .select()
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

async function requireProjectAdmin(
  db: Database,
  projectId: string,
  userId: string,
) {
  const member = await requireProjectMembership(db, projectId, userId);

  if (member.role !== "admin") {
    throw AppError.forbidden("Only project admins can perform this action");
  }

  return member;
}

// ── Service ────────────────────────────────────────────────────────────

export class ProjectService {
  constructor(private db: Database) {}

  // ── List Projects by Workspace ────────────────────────────────────

  async listByWorkspace(
    wsId: string,
    callerUserId: string,
    pagination: CursorPaginationQuery,
  ) {
    const { cursor, limit } = pagination;

    const rows = await this.db
      .select({
        project: projects,
        member: projectMembers,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(
        and(
          eq(projects.workspaceId, wsId),
          eq(projectMembers.userId, callerUserId),
          isNull(projects.deletedAt),
          ...(cursor ? [lt(projects.createdAt, new Date(cursor))] : []),
        ),
      )
      .orderBy(desc(projects.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: items.map((row) => ({
        id: row.project.id,
        workspaceId: row.project.workspaceId,
        name: row.project.name,
        description: row.project.description,
        prefix: row.project.prefix,
        iconUrl: row.project.iconUrl,
        issueCounter: row.project.issueCounter,
        createdAt: row.project.createdAt.toISOString(),
        updatedAt: row.project.updatedAt.toISOString(),
        role: row.member.role,
      })),
      pagination: {
        next_cursor: hasMore
          ? items[items.length - 1]!.project.createdAt.toISOString()
          : null,
        has_more: hasMore,
      },
    };
  }

  // ── Create Project ────────────────────────────────────────────────

  async create(wsId: string, callerUserId: string, input: CreateProjectInput) {
    // Check prefix uniqueness within workspace
    const existing = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, wsId),
          eq(projects.prefix, input.prefix),
          isNull(projects.deletedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw AppError.conflict(
        ErrorCode.PREFIX_ALREADY_EXISTS,
        "Project prefix already taken in this workspace",
      );
    }

    // Create project + admin membership + seed statuses/types atomically
    const project = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(projects)
        .values({
          workspaceId: wsId,
          name: input.name,
          description: input.description ?? null,
          prefix: input.prefix,
          iconUrl: input.iconUrl ?? null,
        })
        .returning();

      // Make creator an admin
      await tx.insert(projectMembers).values({
        projectId: created!.id,
        userId: callerUserId,
        role: "admin",
      });

      // Seed default issue statuses
      await tx.insert(issueStatuses).values(
        DEFAULT_STATUSES.map((s) => ({
          projectId: created!.id,
          name: s.name,
          color: s.color,
          sortOrder: s.sortOrder,
        })),
      );

      // Seed default issue types
      await tx.insert(issueTypes).values(
        DEFAULT_TYPES.map((t) => ({
          projectId: created!.id,
          name: t.name,
          icon: t.icon,
          color: t.color,
          sortOrder: t.sortOrder,
        })),
      );

      return created!;
    });

    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      description: project.description,
      prefix: project.prefix,
      iconUrl: project.iconUrl,
      issueCounter: project.issueCounter,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  // ── Get Project ───────────────────────────────────────────────────

  async getById(projectId: string, callerUserId: string) {
    await requireProjectMembership(this.db, projectId, callerUserId);

    const project = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!project) {
      throw AppError.notFound("project");
    }

    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      description: project.description,
      prefix: project.prefix,
      iconUrl: project.iconUrl,
      issueCounter: project.issueCounter,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  // ── Check Prefix ──────────────────────────────────────────────────

  async checkPrefix(wsId: string, prefix: string) {
    const existing = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, wsId),
          eq(projects.prefix, prefix),
          isNull(projects.deletedAt),
        ),
      )
      .limit(1);

    return { available: existing.length === 0 };
  }

  // ── Update Project ────────────────────────────────────────────────

  async update(
    projectId: string,
    callerUserId: string,
    input: UpdateProjectInput,
  ) {
    await requireProjectAdmin(this.db, projectId, callerUserId);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.iconUrl !== undefined) updates.iconUrl = input.iconUrl;

    const updated = await this.db
      .update(projects)
      .set(updates)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .returning()
      .then((rows) => rows[0]);

    if (!updated) {
      throw AppError.notFound("project");
    }

    return {
      id: updated.id,
      workspaceId: updated.workspaceId,
      name: updated.name,
      description: updated.description,
      prefix: updated.prefix,
      iconUrl: updated.iconUrl,
      issueCounter: updated.issueCounter,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ── Soft Delete Project ───────────────────────────────────────────

  async softDelete(projectId: string, callerUserId: string) {
    await requireProjectAdmin(this.db, projectId, callerUserId);

    const updated = await this.db
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .returning()
      .then((rows) => rows[0]);

    if (!updated) {
      throw AppError.notFound("project");
    }
  }

  // ── List Members ──────────────────────────────────────────────────

  async listMembers(
    projectId: string,
    callerUserId: string,
    pagination: CursorPaginationQuery,
  ) {
    await requireProjectMembership(this.db, projectId, callerUserId);

    const { cursor, limit } = pagination;

    const rows = await this.db
      .select({
        member: projectMembers,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          ...(cursor
            ? [lt(projectMembers.joinedAt, new Date(cursor))]
            : []),
        ),
      )
      .orderBy(desc(projectMembers.joinedAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: items.map((row) => ({
        id: row.member.id,
        projectId: row.member.projectId,
        userId: row.member.userId,
        role: row.member.role as ProjectRole,
        joinedAt: row.member.joinedAt.toISOString(),
        user: {
          id: row.user.id,
          email: row.user.email,
          name: row.user.name,
          avatarUrl: row.user.avatarUrl,
        },
      })),
      pagination: {
        next_cursor: hasMore
          ? items[items.length - 1]!.member.joinedAt.toISOString()
          : null,
        has_more: hasMore,
      },
    };
  }

  // ── Add Member ────────────────────────────────────────────────────

  async addMember(
    projectId: string,
    callerUserId: string,
    input: AddProjectMemberInput,
  ) {
    await requireProjectAdmin(this.db, projectId, callerUserId);

    // Check if already a member
    const existing = await this.db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, input.userId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw AppError.conflict(
        ErrorCode.ALREADY_A_MEMBER,
        "User is already a member of this project",
      );
    }

    const [member] = await this.db
      .insert(projectMembers)
      .values({
        projectId,
        userId: input.userId,
        role: input.role,
      })
      .returning();

    // Fetch user info
    const user = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)
      .then((rows) => rows[0]);

    return {
      id: member!.id,
      projectId: member!.projectId,
      userId: member!.userId,
      role: member!.role as ProjectRole,
      joinedAt: member!.joinedAt.toISOString(),
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        avatarUrl: user!.avatarUrl,
      },
    };
  }

  // ── Update Member Role ────────────────────────────────────────────

  async updateMemberRole(
    projectId: string,
    callerUserId: string,
    memberId: string,
    role: string,
  ) {
    await requireProjectAdmin(this.db, projectId, callerUserId);

    const member = await this.db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.id, memberId),
          eq(projectMembers.projectId, projectId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!member) {
      throw AppError.notFound("member");
    }

    // Prevent demoting the last admin
    if (member.role === "admin" && role !== "admin") {
      const adminCount = await this.db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.role, "admin"),
          ),
        );

      if (adminCount.length <= 1) {
        throw AppError.badRequest(
          ErrorCode.VALIDATION_ERROR,
          "Cannot demote the last admin",
        );
      }
    }

    const [updated] = await this.db
      .update(projectMembers)
      .set({ role })
      .where(eq(projectMembers.id, memberId))
      .returning();

    return updated;
  }

  // ── Remove Member ─────────────────────────────────────────────────

  async removeMember(
    projectId: string,
    callerUserId: string,
    memberId: string,
  ) {
    await requireProjectAdmin(this.db, projectId, callerUserId);

    const member = await this.db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.id, memberId),
          eq(projectMembers.projectId, projectId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!member) {
      throw AppError.notFound("member");
    }

    // Can't remove last admin
    if (member.role === "admin") {
      const adminCount = await this.db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.role, "admin"),
          ),
        );

      if (adminCount.length <= 1) {
        throw AppError.forbidden("Cannot remove the last admin of a project");
      }
    }

    await this.db
      .delete(projectMembers)
      .where(eq(projectMembers.id, memberId));
  }

  // ── List for Sidebar ──────────────────────────────────────────────

  async listForSidebar(wsId: string, callerUserId: string) {
    const rows = await this.db
      .select({
        id: projects.id,
        name: projects.name,
        prefix: projects.prefix,
        iconUrl: projects.iconUrl,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(
        and(
          eq(projects.workspaceId, wsId),
          eq(projectMembers.userId, callerUserId),
          isNull(projects.deletedAt),
        ),
      )
      .orderBy(projects.name);

    return {
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        prefix: row.prefix,
        iconUrl: row.iconUrl,
      })),
    };
  }
}
