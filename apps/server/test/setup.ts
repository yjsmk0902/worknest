/**
 * Server test setup — helpers for building a testable Fastify app
 * and creating test entities (users, orgs, workspaces, projects, issues, labels).
 *
 * These helpers mock Better Auth and wire up a real Fastify instance
 * with the actual route handlers so we can test the full HTTP path
 * (middleware -> handler -> service -> mock DB).
 */
import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { randomUUID } from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────────

export interface TestUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestOrg {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestOrgMember {
  id: string;
  orgId: string;
  userId: string;
  role: string;
  joinedAt: Date;
}

export interface TestWorkspace {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestWsMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  invitedBy: string | null;
  joinedAt: Date;
}

export interface TestInvitation {
  id: string;
  orgId: string | null;
  workspaceId: string | null;
  email: string;
  role: string;
  tokenHash: string;
  invitedBy: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

export interface TestProject {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  prefix: string;
  iconUrl: string | null;
  issueCounter: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  joinedAt: Date;
}

export interface TestIssueStatus {
  id: string;
  projectId: string;
  name: string;
  color: string;
  sortOrder: number;
}

export interface TestIssueType {
  id: string;
  projectId: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
}

export interface TestIssue {
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
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestIssueAssignee {
  id: string;
  issueId: string;
  userId: string;
  assignedAt: Date;
}

export interface TestIssueLabel {
  id: string;
  issueId: string;
  labelId: string;
}

export interface TestLabel {
  id: string;
  projectId: string;
  name: string;
  color: string;
  description: string | null;
  createdAt: Date;
}

export interface TestActivity {
  id: string;
  actorId: string | null;
  issueId: string | null;
  projectId: string | null;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  metadata: unknown;
  createdAt: Date;
}

// ── In-memory data stores ─────────────────────────────────────────────

export const stores = {
  users: [] as TestUser[],
  organizations: [] as TestOrg[],
  orgMembers: [] as TestOrgMember[],
  workspaces: [] as TestWorkspace[],
  workspaceMembers: [] as TestWsMember[],
  invitations: [] as TestInvitation[],
  projects: [] as TestProject[],
  projectMembers: [] as TestProjectMember[],
  issueStatuses: [] as TestIssueStatus[],
  issueTypes: [] as TestIssueType[],
  issues: [] as TestIssue[],
  issueAssignees: [] as TestIssueAssignee[],
  issueLabels: [] as TestIssueLabel[],
  labels: [] as TestLabel[],
  activities: [] as TestActivity[],
  sessions: new Map<string, TestUser>(),
};

// ── Factory helpers ───────────────────────────────────────────────────

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const user: TestUser = {
    id: randomUUID(),
    email: `user-${randomUUID().slice(0, 8)}@test.com`,
    name: "Test User",
    avatarUrl: null,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  stores.users.push(user);
  return user;
}

export function createTestOrg(
  ownerId: string,
  overrides: Partial<TestOrg> = {},
): TestOrg {
  const org: TestOrg = {
    id: randomUUID(),
    name: "Test Org",
    slug: `org-${randomUUID().slice(0, 8)}`,
    logo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
  stores.organizations.push(org);

  // Owner membership
  stores.orgMembers.push({
    id: randomUUID(),
    orgId: org.id,
    userId: ownerId,
    role: "owner",
    joinedAt: new Date(),
  });

  return org;
}

export function createTestWorkspace(
  orgId: string,
  creatorId: string,
  overrides: Partial<TestWorkspace> = {},
): TestWorkspace {
  const ws: TestWorkspace = {
    id: randomUUID(),
    orgId,
    name: "Test Workspace",
    slug: `ws-${randomUUID().slice(0, 8)}`,
    logo: null,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
  stores.workspaces.push(ws);

  // Creator becomes admin
  stores.workspaceMembers.push({
    id: randomUUID(),
    workspaceId: ws.id,
    userId: creatorId,
    role: "admin",
    invitedBy: null,
    joinedAt: new Date(),
  });

  return ws;
}

export function addOrgMember(
  orgId: string,
  userId: string,
  role: string,
): TestOrgMember {
  const member: TestOrgMember = {
    id: randomUUID(),
    orgId,
    userId,
    role,
    joinedAt: new Date(),
  };
  stores.orgMembers.push(member);
  return member;
}

export function addWsMember(
  workspaceId: string,
  userId: string,
  role: string,
): TestWsMember {
  const member: TestWsMember = {
    id: randomUUID(),
    workspaceId,
    userId,
    role,
    invitedBy: null,
    joinedAt: new Date(),
  };
  stores.workspaceMembers.push(member);
  return member;
}

/**
 * Create a test project with creator as admin and default statuses/types seeded.
 */
export function createTestProject(
  wsId: string,
  creatorId: string,
  overrides: Partial<TestProject> = {},
): TestProject {
  const project: TestProject = {
    id: randomUUID(),
    workspaceId: wsId,
    name: "Test Project",
    description: null,
    prefix: `P${randomUUID().slice(0, 2).toUpperCase()}`,
    iconUrl: null,
    issueCounter: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
  stores.projects.push(project);

  // Creator becomes admin
  stores.projectMembers.push({
    id: randomUUID(),
    projectId: project.id,
    userId: creatorId,
    role: "admin",
    joinedAt: new Date(),
  });

  // Seed default statuses
  const defaultStatuses = [
    { name: "Backlog", color: "#6b7280", sortOrder: 0 },
    { name: "Todo", color: "#3b82f6", sortOrder: 1 },
    { name: "In Progress", color: "#f59e0b", sortOrder: 2 },
    { name: "Done", color: "#22c55e", sortOrder: 3 },
    { name: "Cancelled", color: "#ef4444", sortOrder: 4 },
  ];
  for (const s of defaultStatuses) {
    stores.issueStatuses.push({
      id: randomUUID(),
      projectId: project.id,
      ...s,
    });
  }

  // Seed default types
  const defaultTypes = [
    { name: "Task", icon: "check-circle", color: "#3b82f6", sortOrder: 0 },
    { name: "Bug", icon: "bug", color: "#ef4444", sortOrder: 1 },
    { name: "Story", icon: "book-open", color: "#8b5cf6", sortOrder: 2 },
    { name: "Epic", icon: "rocket", color: "#f59e0b", sortOrder: 3 },
  ];
  for (const t of defaultTypes) {
    stores.issueTypes.push({
      id: randomUUID(),
      projectId: project.id,
      ...t,
    });
  }

  return project;
}

/**
 * Add a member to a project (without going through the service).
 */
export function addProjectMember(
  projectId: string,
  userId: string,
  role: string,
): TestProjectMember {
  const member: TestProjectMember = {
    id: randomUUID(),
    projectId,
    userId,
    role,
    joinedAt: new Date(),
  };
  stores.projectMembers.push(member);
  return member;
}

/**
 * Create a test issue directly in the store.
 */
export function createTestIssue(
  projectId: string,
  creatorId: string,
  overrides: Partial<TestIssue> = {},
): TestIssue {
  // Increment project counter
  const project = stores.projects.find((p) => p.id === projectId);
  if (project) {
    project.issueCounter += 1;
  }
  const issue: TestIssue = {
    id: randomUUID(),
    projectId,
    sequenceId: project ? project.issueCounter : 1,
    title: "Test Issue",
    description: null,
    descriptionText: null,
    statusId: null,
    typeId: null,
    priority: "none",
    parentId: null,
    creatorId,
    sortOrder: "a0",
    dueDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
  stores.issues.push(issue);
  return issue;
}

/**
 * Create a test label directly in the store.
 */
export function createTestLabel(
  projectId: string,
  overrides: Partial<TestLabel> = {},
): TestLabel {
  const label: TestLabel = {
    id: randomUUID(),
    projectId,
    name: "Test Label",
    color: "#000000",
    description: null,
    createdAt: new Date(),
    ...overrides,
  };
  stores.labels.push(label);
  return label;
}

/**
 * Create a session cookie value for a user, simulating a logged-in session.
 */
export function loginAsUser(user: TestUser): string {
  const sessionId = randomUUID();
  stores.sessions.set(sessionId, user);
  return `worknest.session_token=${sessionId}`;
}

// ── Cleanup ───────────────────────────────────────────────────────────

export function cleanup(): void {
  stores.users.length = 0;
  stores.organizations.length = 0;
  stores.orgMembers.length = 0;
  stores.workspaces.length = 0;
  stores.workspaceMembers.length = 0;
  stores.invitations.length = 0;
  stores.projects.length = 0;
  stores.projectMembers.length = 0;
  stores.issueStatuses.length = 0;
  stores.issueTypes.length = 0;
  stores.issues.length = 0;
  stores.issueAssignees.length = 0;
  stores.issueLabels.length = 0;
  stores.labels.length = 0;
  stores.activities.length = 0;
  stores.sessions.clear();
}

// ── Mock Auth ─────────────────────────────────────────────────────────

/**
 * Create a mock Auth object that resolves sessions from our in-memory store.
 * This simulates Better Auth's session management.
 */
export function createMockAuth() {
  return {
    api: {
      getSession: vi.fn(async ({ headers }: { headers: Headers | Record<string, string | undefined> }) => {
        let cookieValue: string | undefined | null;

        if (headers instanceof Headers) {
          cookieValue = headers.get("cookie");
        } else {
          cookieValue = headers?.cookie as string | undefined;
        }

        if (!cookieValue) return null;

        // Extract session token from cookie string
        const match = cookieValue.match(/worknest\.session_token=([^;]+)/);
        if (!match) return null;

        const sessionId = match[1];
        const user = stores.sessions.get(sessionId!);
        if (!user) return null;

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          session: { id: sessionId },
        };
      }),

      signUpEmail: vi.fn(async ({ body }: { body: { email: string; password: string; name: string } }) => {
        const existing = stores.users.find((u) => u.email === body.email);
        if (existing) return null;

        const user = createTestUser({
          email: body.email,
          name: body.name,
        });

        const sessionId = randomUUID();
        stores.sessions.set(sessionId, user);

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          headers: new Headers({
            "set-cookie": `worknest.session_token=${sessionId}; Path=/; HttpOnly`,
          }),
        };
      }),

      signInEmail: vi.fn(async ({ body }: { body: { email: string; password: string } }) => {
        const user = stores.users.find((u) => u.email === body.email);
        // In tests, any non-empty password works unless the user doesn't exist
        if (!user) return null;

        const sessionId = randomUUID();
        stores.sessions.set(sessionId, user);

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          headers: new Headers({
            "set-cookie": `worknest.session_token=${sessionId}; Path=/; HttpOnly`,
          }),
        };
      }),

      signOut: vi.fn(async ({ headers }: { headers: Headers | Record<string, string | undefined> }) => {
        let cookieValue: string | undefined | null;
        if (headers instanceof Headers) {
          cookieValue = headers.get("cookie");
        } else {
          cookieValue = headers?.cookie as string | undefined;
        }

        if (cookieValue) {
          const match = cookieValue.match(/worknest\.session_token=([^;]+)/);
          if (match?.[1]) {
            stores.sessions.delete(match[1]);
          }
        }
      }),
    },
  };
}

// ── Mock Database ─────────────────────────────────────────────────────

/**
 * Resolve the table reference from Drizzle's table object to our in-memory store.
 * Drizzle table objects are imported symbols; we match by their internal table name.
 */
function resolveTableName(table: unknown): string | null {
  // Drizzle pgTable objects have a Symbol property that stores the table name,
  // but the simplest way is to check for a known shape.
  if (table && typeof table === "object") {
    // Drizzle tables have a [Symbol.for("drizzle:Name")] property
    const drizzleNameSym = Symbol.for("drizzle:Name");
    const entitySym = Symbol.for("drizzle:IsDrizzleEntity");
    // Also check for a `_` property with `name`
    const t = table as Record<string | symbol, unknown>;
    if (t[drizzleNameSym]) {
      return t[drizzleNameSym] as string;
    }
    // Fallback: check for _ property
    const internal = (t as { _?: { name?: string } })?._;
    if (internal?.name) return internal.name;
    // Fallback: check Symbol.for("drizzle:Name") on the Table config
    const tableConfig = Symbol.for("drizzle:BaseName");
    if (t[tableConfig]) return t[tableConfig] as string;
  }
  return null;
}

function getStoreForTable(tableName: string): unknown[] | null {
  const map: Record<string, unknown[]> = {
    projects: stores.projects,
    project_members: stores.projectMembers,
    issue_statuses: stores.issueStatuses,
    issue_types: stores.issueTypes,
    issues: stores.issues,
    issue_assignees: stores.issueAssignees,
    issue_labels: stores.issueLabels,
    labels: stores.labels,
    activities: stores.activities,
    users: stores.users,
  };
  return map[tableName] ?? null;
}

/**
 * Get default field values for a table, matching the DB schema defaults.
 */
function getTableDefaults(tableName: string): Record<string, unknown> {
  const defaults: Record<string, Record<string, unknown>> = {
    projects: {
      description: null,
      iconUrl: null,
      issueCounter: 0,
      deletedAt: null,
    },
    project_members: {
      joinedAt: new Date(),
    },
    issues: {
      description: null,
      descriptionText: null,
      statusId: null,
      typeId: null,
      priority: "none",
      parentId: null,
      creatorId: null,
      sortOrder: "a0",
      dueDate: null,
      deletedAt: null,
    },
    issue_statuses: {
      sortOrder: 0,
    },
    issue_types: {
      sortOrder: 0,
    },
    issue_assignees: {
      assignedAt: new Date(),
    },
    issue_labels: {},
    labels: {
      description: null,
    },
    activities: {
      issueId: null,
      projectId: null,
      field: null,
      oldValue: null,
      newValue: null,
      metadata: null,
    },
    users: {
      avatarUrl: null,
      emailVerified: false,
    },
  };
  return defaults[tableName] ?? {};
}

/**
 * Map between DB column names (snake_case) and our store field names (camelCase).
 */
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Extract column name from a Drizzle column reference.
 */
function getColumnName(col: unknown): string | null {
  if (col && typeof col === "object") {
    const c = col as Record<string, unknown>;
    if (typeof c.name === "string") return c.name;
  }
  return null;
}

/**
 * Evaluate a Drizzle `where` condition against a row from our in-memory store.
 * Supports `eq`, `and`, `isNull`, `lt`, `ilike`, `inArray`.
 */
function evaluateCondition(condition: unknown, row: Record<string, unknown>): boolean {
  if (!condition) return true;
  if (typeof condition !== "object") return true;

  const cond = condition as Record<string, unknown>;

  // BinaryOperator (eq, lt, ilike)
  if (cond.type === "binary") {
    const left = cond.left as Record<string, unknown>;
    const right = cond.right as unknown;
    const op = cond.operator as string;
    const colName = getColumnName(left);
    if (!colName) return true;
    const fieldName = snakeToCamel(colName);
    const value = row[fieldName];
    const rightValue = extractValue(right);

    switch (op) {
      case "=":
        return value === rightValue;
      case "<":
        if (value instanceof Date && rightValue instanceof Date) {
          return value.getTime() < rightValue.getTime();
        }
        return (value as number) < (rightValue as number);
      case "ilike": {
        if (typeof value !== "string" || typeof rightValue !== "string") return false;
        const pattern = rightValue.replace(/%/g, ".*");
        return new RegExp(pattern, "i").test(value);
      }
      default:
        return true;
    }
  }

  // Unary (isNull)
  if (cond.type === "unary") {
    const operand = cond.operand as Record<string, unknown>;
    const op = cond.operator as string;
    const colName = getColumnName(operand);
    if (!colName) return true;
    const fieldName = snakeToCamel(colName);
    const value = row[fieldName];

    switch (op) {
      case "is null":
        return value === null || value === undefined;
      case "is not null":
        return value !== null && value !== undefined;
      default:
        return true;
    }
  }

  // And
  if (Array.isArray((cond as { conditions?: unknown[] }).conditions)) {
    const conditions = (cond as { conditions: unknown[] }).conditions;
    return conditions.every((c) => evaluateCondition(c, row));
  }

  // InArray
  if (cond.type === "in_array") {
    const left = cond.left as Record<string, unknown>;
    const values = cond.values as unknown[];
    const colName = getColumnName(left);
    if (!colName) return true;
    const fieldName = snakeToCamel(colName);
    const value = row[fieldName];
    return values.includes(value);
  }

  return true;
}

/**
 * Check if a value is a Drizzle SQL expression (e.g., sql`col + 1`).
 * Drizzle SQL objects can be detected by their internal symbols or properties.
 */
function isSqlExpression(val: unknown): boolean {
  if (!val || typeof val !== "object") return false;
  const v = val as Record<string | symbol, unknown>;
  // Check for Drizzle SQL type marker
  if (v.type === "sql") return true;
  // Check for queryChunks property (Drizzle SQL tagged template)
  if (Array.isArray((v as { queryChunks?: unknown }).queryChunks)) return true;
  // Check for Drizzle entity symbol
  const entitySym = Symbol.for("drizzle:IsDrizzleEntity");
  if (v[entitySym] === true) {
    // It's a Drizzle entity but not a column/table -- likely SQL expression
    const nameSym = Symbol.for("drizzle:Name");
    if (!v[nameSym]) return true;
  }
  return false;
}

function extractValue(val: unknown): unknown {
  if (val && typeof val === "object") {
    const v = val as Record<string, unknown>;
    // Drizzle wraps literal values in a Param node
    if (v.type === "param" && v.value !== undefined) {
      return v.value;
    }
    if (v.value !== undefined && !v.type) {
      return v.value;
    }
  }
  return val;
}

/**
 * Extract selected fields from a row based on the selection spec.
 * Handles both simple column selections and nested object selections.
 */
function projectRow(row: Record<string, unknown>, selection: unknown): Record<string, unknown> {
  if (!selection || typeof selection !== "object") return { ...row };

  const result: Record<string, unknown> = {};
  const sel = selection as Record<string, unknown>;

  for (const [key, colOrObj] of Object.entries(sel)) {
    if (colOrObj && typeof colOrObj === "object") {
      const col = colOrObj as Record<string, unknown>;
      const colName = getColumnName(col);
      if (colName) {
        // Simple column reference
        result[key] = row[snakeToCamel(colName)];
      } else if (col.type === "sql") {
        // SQL expression (e.g., counter + 1) -- handle incrementing
        result[key] = row[key];
      } else {
        // Nested object selection (e.g., { id: table.id, name: table.name })
        const nested: Record<string, unknown> = {};
        for (const [nk, nv] of Object.entries(col)) {
          const nc = getColumnName(nv);
          if (nc) {
            nested[nk] = row[snakeToCamel(nc)];
          }
        }
        result[key] = nested;
      }
    }
  }

  return result;
}

/**
 * Create a mock Database object that operates on in-memory stores.
 * Simulates the Drizzle chained query builder API so real service code executes.
 */
export function createInMemoryDb(): unknown {
  function buildSelectChain(
    selection: unknown,
    joins: { tableName: string; joinType: string; condition: unknown }[] = [],
  ) {
    let _tableName: string | null = null;
    let _where: unknown = null;
    let _limit: number | null = null;
    let _orderBy: unknown = null;

    const chain: Record<string, unknown> = {};

    chain.from = (table: unknown) => {
      _tableName = resolveTableName(table);
      return chain;
    };

    chain.innerJoin = (table: unknown, condition: unknown) => {
      const name = resolveTableName(table);
      if (name) {
        joins.push({ tableName: name, joinType: "inner", condition });
      }
      return chain;
    };

    chain.leftJoin = (table: unknown, condition: unknown) => {
      const name = resolveTableName(table);
      if (name) {
        joins.push({ tableName: name, joinType: "left", condition });
      }
      return chain;
    };

    chain.where = (cond: unknown) => {
      _where = cond;
      return chain;
    };

    chain.limit = (n: number) => {
      _limit = n;
      return chain;
    };

    chain.orderBy = (...args: unknown[]) => {
      _orderBy = args;
      return chain;
    };

    chain.then = (resolve: (val: unknown) => unknown, reject?: (err: unknown) => unknown) => {
      try {
        const store = _tableName ? getStoreForTable(_tableName) : null;
        if (!store) {
          return Promise.resolve([]).then(resolve, reject);
        }

        let results = store.filter((row) =>
          evaluateCondition(_where, row as Record<string, unknown>),
        );

        // Handle joins for enrichment
        if (joins.length > 0) {
          results = performJoins(
            results as Record<string, unknown>[],
            _tableName!,
            joins,
            selection,
          );
        } else if (selection) {
          // Project columns if a specific selection was given
          results = results.map((row) =>
            projectRow(row as Record<string, unknown>, selection),
          );
        }

        if (_limit !== null) {
          results = results.slice(0, _limit);
        }

        return Promise.resolve(results).then(resolve, reject);
      } catch (err) {
        if (reject) return reject(err);
        return Promise.reject(err);
      }
    };

    // Make chain thenable
    (chain as { [Symbol.toStringTag]?: string })[Symbol.toStringTag] = "Promise";

    return chain;
  }

  /**
   * Determine which table a Drizzle column belongs to by checking
   * the column's `table` property for a table name symbol.
   */
  function getColumnTableName(col: unknown): string | null {
    if (col && typeof col === "object") {
      const c = col as Record<string, unknown>;
      if (c.table) {
        return resolveTableName(c.table);
      }
    }
    return null;
  }

  /**
   * A JoinedRow stores data from multiple tables keyed by table name.
   * This avoids field collisions between tables (e.g. both having `id`).
   */
  type JoinedRow = Record<string, Record<string, unknown>>;

  function performJoins(
    baseRows: Record<string, unknown>[],
    baseTableName: string,
    joins: { tableName: string; joinType: string; condition: unknown }[],
    selection: unknown,
  ): Record<string, unknown>[] {
    // Convert base rows into JoinedRow format
    let results: JoinedRow[] = baseRows.map((row) => ({
      [baseTableName]: { ...row },
    }));

    for (const join of joins) {
      const joinStore = getStoreForTable(join.tableName);
      if (!joinStore) continue;

      const enriched: JoinedRow[] = [];

      for (const row of results) {
        // Build a flat view of all fields for condition evaluation
        const flatRow = flattenJoinedRow(row);

        const matchingJoinRows = (joinStore as Record<string, unknown>[]).filter((jr) =>
          evaluateJoinCondition(join.condition, flatRow, jr),
        );

        if (matchingJoinRows.length > 0) {
          for (const jr of matchingJoinRows) {
            enriched.push({ ...row, [join.tableName]: { ...jr } });
          }
        } else if (join.joinType === "left") {
          enriched.push({ ...row, [join.tableName]: {} });
        }
        // inner join: skip row if no matches
      }

      results = enriched;
    }

    // Now project the selection using the per-table data
    if (selection) {
      return results.map((row) => projectSelectionWithJoins(row, selection));
    }

    return results.map(flattenJoinedRow);
  }

  function flattenJoinedRow(row: JoinedRow): Record<string, unknown> {
    const flat: Record<string, unknown> = {};
    for (const tableData of Object.values(row)) {
      Object.assign(flat, tableData);
    }
    return flat;
  }

  function evaluateJoinCondition(
    condition: unknown,
    leftRow: Record<string, unknown>,
    rightRow: Record<string, unknown>,
  ): boolean {
    if (!condition || typeof condition !== "object") return true;
    const cond = condition as Record<string, unknown>;

    if (cond.type === "binary" && cond.operator === "=") {
      const left = cond.left as Record<string, unknown>;
      const right = cond.right as Record<string, unknown>;
      const leftCol = getColumnName(left);
      const rightCol = getColumnName(right);
      if (leftCol && rightCol) {
        const leftField = snakeToCamel(leftCol);
        const rightField = snakeToCamel(rightCol);
        // Try both directions: left col from leftRow, right col from rightRow
        const leftVal = leftRow[leftField] ?? rightRow[leftField];
        const rightVal = rightRow[rightField] ?? leftRow[rightField];
        return leftVal === rightVal;
      }
      // Handle eq(column, param_value) in join conditions (e.g. eq(issueAssignees.userId, assigneeId))
      if (leftCol) {
        const rightValue = extractValue(right);
        if (rightValue !== right) {
          const leftField = snakeToCamel(leftCol);
          const leftVal = leftRow[leftField] ?? rightRow[leftField];
          return leftVal === rightValue;
        }
      }
    }

    if (Array.isArray((cond as { conditions?: unknown[] }).conditions)) {
      return (cond as { conditions: unknown[] }).conditions.every((c) =>
        evaluateJoinCondition(c, leftRow, rightRow),
      );
    }

    return true;
  }

  function projectSelectionWithJoins(
    joinedRow: JoinedRow,
    selection: unknown,
  ): Record<string, unknown> {
    if (!selection || typeof selection !== "object") return flattenJoinedRow(joinedRow);

    const result: Record<string, unknown> = {};
    const sel = selection as Record<string, unknown>;
    const flatRow = flattenJoinedRow(joinedRow);

    for (const [key, colOrObj] of Object.entries(sel)) {
      if (colOrObj && typeof colOrObj === "object") {
        const col = colOrObj as Record<string, unknown>;
        const colName = getColumnName(col);
        if (colName) {
          // Simple column reference - resolve from the right table
          const colTable = getColumnTableName(col);
          if (colTable && joinedRow[colTable]) {
            result[key] = joinedRow[colTable]![snakeToCamel(colName)];
          } else {
            result[key] = flatRow[snakeToCamel(colName)];
          }
        } else {
          // Check if this is a whole-table reference
          const tblName = resolveTableName(col);
          if (tblName && joinedRow[tblName]) {
            // Return all fields from that specific table
            result[key] = { ...joinedRow[tblName]! };
          } else {
            // Nested object selection { id: table.id, name: table.name }
            const nested: Record<string, unknown> = {};
            let hasValues = false;
            for (const [nk, nv] of Object.entries(col)) {
              const nc = getColumnName(nv);
              if (nc) {
                const ncTable = getColumnTableName(nv);
                let val: unknown;
                if (ncTable && joinedRow[ncTable]) {
                  val = joinedRow[ncTable]![snakeToCamel(nc)];
                } else {
                  val = flatRow[snakeToCamel(nc)];
                }
                nested[nk] = val ?? null;
                if (val !== undefined && val !== null) hasValues = true;
              }
            }
            result[key] = hasValues ? nested : null;
          }
        }
      }
    }

    return result;
  }

  const db: Record<string, unknown> = {};

  db.select = (selection?: unknown) => {
    return buildSelectChain(selection ?? null);
  };

  db.insert = (table: unknown) => {
    const tableName = resolveTableName(table);
    return {
      values: (data: unknown) => {
        const insertChain: Record<string, unknown> = {};

        insertChain.returning = () => {
          const store = tableName ? getStoreForTable(tableName) : null;
          if (!store) return Promise.resolve([]);

          const rows = Array.isArray(data) ? data : [data];
          const inserted: unknown[] = [];

          for (const row of rows) {
            const record = {
              ...getTableDefaults(tableName!),
              id: randomUUID(),
              createdAt: new Date(),
              updatedAt: new Date(),
              ...(row as Record<string, unknown>),
            };
            store.push(record);
            inserted.push(record);
          }

          return Promise.resolve(inserted);
        };

        insertChain.onConflictDoNothing = () => {
          return {
            returning: () => {
              const store = tableName ? getStoreForTable(tableName) : null;
              if (!store) return Promise.resolve([]);

              const rows = Array.isArray(data) ? data : [data];
              const inserted: unknown[] = [];

              for (const row of rows) {
                const record = {
                  ...getTableDefaults(tableName!),
                  id: randomUUID(),
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  ...(row as Record<string, unknown>),
                };
                store.push(record);
                inserted.push(record);
              }

              return Promise.resolve(inserted);
            },
          };
        };

        // Also support non-returning insert (fire-and-forget)
        insertChain.then = (
          resolve: (val: unknown) => unknown,
          reject?: (err: unknown) => unknown,
        ) => {
          const store = tableName ? getStoreForTable(tableName) : null;
          if (!store) return Promise.resolve(undefined).then(resolve, reject);

          const rows = Array.isArray(data) ? data : [data];
          for (const row of rows) {
            const record = {
              ...getTableDefaults(tableName!),
              id: randomUUID(),
              createdAt: new Date(),
              updatedAt: new Date(),
              ...(row as Record<string, unknown>),
            };
            store.push(record);
          }
          return Promise.resolve(undefined).then(resolve, reject);
        };

        return insertChain;
      },
    };
  };

  db.update = (table: unknown) => {
    const tableName = resolveTableName(table);

    return {
      set: (updates: Record<string, unknown>) => {
        let _where: unknown = null;

        const setChain: Record<string, unknown> = {};

        setChain.where = (cond: unknown) => {
          _where = cond;
          return setChain;
        };

        setChain.returning = (returnSelection?: unknown) => {
          const store = tableName ? getStoreForTable(tableName) : null;
          if (!store) return Promise.resolve([]);

          const updated: unknown[] = [];
          for (const row of store) {
            const r = row as Record<string, unknown>;
            if (evaluateCondition(_where, r)) {
              // Handle SQL expressions (e.g., counter + 1)
              for (const [key, value] of Object.entries(updates)) {
                if (isSqlExpression(value)) {
                  // Simplified: assume it's an increment by 1
                  const fieldName = snakeToCamel(key);
                  r[fieldName] = ((r[fieldName] as number) || 0) + 1;
                  continue;
                }
                r[snakeToCamel(key)] = value;
              }
              updated.push({ ...r });
            }
          }

          if (returnSelection) {
            return Promise.resolve(
              updated.map((row) =>
                projectRow(row as Record<string, unknown>, returnSelection),
              ),
            );
          }

          return Promise.resolve(updated);
        };

        // Support non-returning update
        setChain.then = (
          resolve: (val: unknown) => unknown,
          reject?: (err: unknown) => unknown,
        ) => {
          const store = tableName ? getStoreForTable(tableName) : null;
          if (!store) return Promise.resolve(undefined).then(resolve, reject);

          for (const row of store) {
            const r = row as Record<string, unknown>;
            if (evaluateCondition(_where, r)) {
              for (const [key, value] of Object.entries(updates)) {
                if (isSqlExpression(value)) {
                  const fieldName = snakeToCamel(key);
                  r[fieldName] = ((r[fieldName] as number) || 0) + 1;
                  continue;
                }
                r[snakeToCamel(key)] = value;
              }
            }
          }

          return Promise.resolve(undefined).then(resolve, reject);
        };

        return setChain;
      },
    };
  };

  db.delete = (table: unknown) => {
    const tableName = resolveTableName(table);

    return {
      where: (cond: unknown) => {
        const store = tableName ? getStoreForTable(tableName) : null;
        if (!store) return Promise.resolve();

        // Remove matching rows
        const toRemove: number[] = [];
        for (let i = 0; i < store.length; i++) {
          if (evaluateCondition(cond, store[i] as Record<string, unknown>)) {
            toRemove.push(i);
          }
        }
        // Remove in reverse order to maintain indices
        for (let i = toRemove.length - 1; i >= 0; i--) {
          store.splice(toRemove[i]!, 1);
        }

        return Promise.resolve();
      },
    };
  };

  // Transaction support: the transaction callback receives the same db
  // (since our stores are globally shared mutable arrays)
  db.transaction = async (fn: (tx: unknown) => Promise<unknown>) => {
    return fn(db);
  };

  return db;
}

/**
 * Create a mock Database object that operates on in-memory stores.
 * This is a simplified mock; services that need complex queries
 * should have their methods mocked directly.
 */
export function createMockDb(): unknown {
  // Return a minimal mock. Individual test files will mock service methods
  // at a higher level, since the Drizzle query builder is hard to fully mock.
  return {};
}

// ── Build Test App ────────────────────────────────────────────────────

/**
 * Build a Fastify instance with the routes we want to test.
 * Callers pass in route registration functions.
 */
export async function buildTestApp(
  registerRoutes: (app: FastifyInstance, opts: { auth: ReturnType<typeof createMockAuth>; db: unknown }) => Promise<void>,
  useInMemoryDb = false,
): Promise<{ app: FastifyInstance; auth: ReturnType<typeof createMockAuth>; db: unknown }> {
  const app = Fastify({ logger: false });

  await app.register(cookie);

  const auth = createMockAuth();
  const db = useInMemoryDb ? createInMemoryDb() : createMockDb();

  // Import and set error handler
  const { errorHandler } = await import("../src/lib/errors");
  app.setErrorHandler(errorHandler);

  await registerRoutes(app, { auth, db });

  await app.ready();

  return { app, auth, db };
}
