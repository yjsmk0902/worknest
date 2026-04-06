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
  category: string;
  isDefault: boolean;
}

export interface TestIssueType {
  id: string;
  projectId: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
}

export interface TestView {
  id: string;
  projectId: string;
  name: string;
  createdBy: string | null;
  filters: unknown;
  sort: unknown;
  groupBy: string | null;
  type: string;
  createdAt: Date;
  updatedAt: Date;
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

export interface TestCycle {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCycleIssue {
  id: string;
  cycleId: string;
  issueId: string;
  addedAt: Date;
  removedAt: Date | null;
  carriedFromId: string | null;
}

export interface TestWikiSpace {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  slug: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestWikiSpaceMember {
  id: string;
  wikiSpaceId: string;
  userId: string;
  role: string;
  createdAt: Date;
}

export interface TestWikiPage {
  id: string;
  wikiSpaceId: string;
  title: string;
  slug: string;
  content: unknown;
  contentFormat: string;
  contentText: string | null;
  parentId: string | null;
  sortOrder: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestFile {
  id: string;
  issueId: string | null;
  pageId: string | null;
  name: string;
  path: string;
  mimeType: string;
  size: number;
  uploadedBy: string | null;
  createdAt: Date;
}

export interface TestIssueMention {
  id: string;
  issueId: string;
  pageId: string;
  createdAt: Date;
}

export interface TestComment {
  id: string;
  issueId: string | null;
  pageId: string | null;
  content: unknown;
  parentId: string | null;
  authorId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestReaction {
  id: string;
  commentId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface TestNotification {
  id: string;
  userId: string;
  issueId: string | null;
  pageId: string | null;
  type: string;
  message: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface TestFavorite {
  id: string;
  userId: string;
  projectId: string | null;
  issueId: string | null;
  pageId: string | null;
  spaceId: string | null;
  sortOrder: string;
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
  views: [] as TestView[],
  cycles: [] as TestCycle[],
  cycleIssues: [] as TestCycleIssue[],
  wikiSpaces: [] as TestWikiSpace[],
  wikiSpaceMembers: [] as TestWikiSpaceMember[],
  wikiPages: [] as TestWikiPage[],
  files: [] as TestFile[],
  issueMentions: [] as TestIssueMention[],
  comments: [] as TestComment[],
  reactions: [] as TestReaction[],
  notifications: [] as TestNotification[],
  favorites: [] as TestFavorite[],
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
    { name: "Backlog", color: "#6b7280", sortOrder: 0, category: "backlog", isDefault: true },
    { name: "Todo", color: "#3b82f6", sortOrder: 1, category: "unstarted", isDefault: false },
    { name: "In Progress", color: "#f59e0b", sortOrder: 2, category: "started", isDefault: false },
    { name: "Done", color: "#22c55e", sortOrder: 3, category: "completed", isDefault: false },
    { name: "Cancelled", color: "#ef4444", sortOrder: 4, category: "cancelled", isDefault: false },
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
    { name: "Task", icon: "check-circle", color: "#3b82f6", sortOrder: 0, isDefault: true },
    { name: "Bug", icon: "bug", color: "#ef4444", sortOrder: 1, isDefault: false },
    { name: "Story", icon: "book-open", color: "#8b5cf6", sortOrder: 2, isDefault: false },
    { name: "Epic", icon: "rocket", color: "#f59e0b", sortOrder: 3, isDefault: false },
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
 * Create a test view directly in the store.
 */
export function createTestView(
  projectId: string,
  createdBy: string,
  overrides: Partial<TestView> = {},
): TestView {
  const view: TestView = {
    id: randomUUID(),
    projectId,
    name: "Test View",
    createdBy,
    filters: [],
    sort: null,
    groupBy: null,
    type: "list",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  stores.views.push(view);
  return view;
}

/**
 * Create a test cycle directly in the store.
 */
export function createTestCycle(
  projectId: string,
  overrides: Partial<TestCycle> = {},
): TestCycle {
  const cycle: TestCycle = {
    id: randomUUID(),
    projectId,
    name: "Test Cycle",
    description: null,
    startDate: null,
    endDate: null,
    status: "draft",
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  stores.cycles.push(cycle);
  return cycle;
}

/**
 * Add an issue to a cycle directly in the store.
 */
export function addIssueToCycle(
  cycleId: string,
  issueId: string,
  overrides: Partial<TestCycleIssue> = {},
): TestCycleIssue {
  const entry: TestCycleIssue = {
    id: randomUUID(),
    cycleId,
    issueId,
    addedAt: new Date(),
    removedAt: null,
    carriedFromId: null,
    ...overrides,
  };
  stores.cycleIssues.push(entry);
  return entry;
}

/**
 * Create a test wiki space directly in the store.
 */
export function createTestWikiSpace(
  workspaceId: string,
  overrides: Partial<TestWikiSpace> = {},
): TestWikiSpace {
  const space: TestWikiSpace = {
    id: randomUUID(),
    workspaceId,
    name: "Test Wiki Space",
    description: null,
    slug: `wiki-${randomUUID().slice(0, 8)}`,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  stores.wikiSpaces.push(space);
  return space;
}

/**
 * Add a member to a wiki space directly in the store.
 */
export function addWikiSpaceMember(
  spaceId: string,
  userId: string,
  role = "editor",
): TestWikiSpaceMember {
  const member: TestWikiSpaceMember = {
    id: randomUUID(),
    wikiSpaceId: spaceId,
    userId,
    role,
    createdAt: new Date(),
  };
  stores.wikiSpaceMembers.push(member);
  return member;
}

/**
 * Create a test wiki page directly in the store.
 */
export function createTestWikiPage(
  spaceId: string,
  overrides: Partial<TestWikiPage> = {},
): TestWikiPage {
  const page: TestWikiPage = {
    id: randomUUID(),
    wikiSpaceId: spaceId,
    title: "Test Page",
    slug: `page-${randomUUID().slice(0, 8)}`,
    content: null,
    contentFormat: "json",
    contentText: null,
    parentId: null,
    sortOrder: "a0",
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
  stores.wikiPages.push(page);
  return page;
}

/**
 * Create a test file directly in the store.
 */
export function createTestFile(
  overrides: Partial<TestFile> = {},
): TestFile {
  const file: TestFile = {
    id: randomUUID(),
    issueId: null,
    pageId: null,
    name: "test-file.txt",
    path: `/tmp/uploads/${randomUUID()}.txt`,
    mimeType: "text/plain",
    size: 1024,
    uploadedBy: null,
    createdAt: new Date(),
    ...overrides,
  };
  stores.files.push(file);
  return file;
}

/**
 * Create a test comment directly in the store.
 */
export function createTestComment(
  overrides: Partial<TestComment> = {},
): TestComment {
  const comment: TestComment = {
    id: randomUUID(),
    issueId: null,
    pageId: null,
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Test comment" }] }] },
    parentId: null,
    authorId: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
  stores.comments.push(comment);
  return comment;
}

/**
 * Create a test reaction directly in the store.
 */
export function createTestReaction(
  overrides: Partial<TestReaction> = {},
): TestReaction {
  const reaction: TestReaction = {
    id: randomUUID(),
    commentId: "",
    userId: "",
    emoji: "👍",
    createdAt: new Date(),
    ...overrides,
  };
  stores.reactions.push(reaction);
  return reaction;
}

/**
 * Create a test notification directly in the store.
 */
export function createTestNotification(
  overrides: Partial<TestNotification> = {},
): TestNotification {
  const notification: TestNotification = {
    id: randomUUID(),
    userId: "",
    issueId: null,
    pageId: null,
    type: "commented",
    message: "Test notification",
    readAt: null,
    createdAt: new Date(),
    ...overrides,
  };
  stores.notifications.push(notification);
  return notification;
}

/**
 * Create a test favorite directly in the store.
 */
export function createTestFavorite(
  overrides: Partial<TestFavorite> = {},
): TestFavorite {
  const favorite: TestFavorite = {
    id: randomUUID(),
    userId: "",
    projectId: null,
    issueId: null,
    pageId: null,
    spaceId: null,
    sortOrder: "a0",
    createdAt: new Date(),
    ...overrides,
  };
  stores.favorites.push(favorite);
  return favorite;
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
  stores.views.length = 0;
  stores.cycles.length = 0;
  stores.cycleIssues.length = 0;
  stores.wikiSpaces.length = 0;
  stores.wikiSpaceMembers.length = 0;
  stores.wikiPages.length = 0;
  stores.files.length = 0;
  stores.issueMentions.length = 0;
  stores.comments.length = 0;
  stores.reactions.length = 0;
  stores.notifications.length = 0;
  stores.favorites.length = 0;
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
    views: stores.views,
    cycles: stores.cycles,
    cycle_issues: stores.cycleIssues,
    wiki_spaces: stores.wikiSpaces,
    wiki_space_members: stores.wikiSpaceMembers,
    wiki_pages: stores.wikiPages,
    files: stores.files,
    issue_mentions: stores.issueMentions,
    comments: stores.comments,
    reactions: stores.reactions,
    notifications: stores.notifications,
    favorites: stores.favorites,
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
      category: "backlog",
      isDefault: false,
    },
    issue_types: {
      sortOrder: 0,
      isDefault: false,
    },
    views: {
      filters: [],
      sort: null,
      groupBy: null,
      createdBy: null,
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
    cycles: {
      description: null,
      startDate: null,
      endDate: null,
      status: "draft",
      createdBy: null,
    },
    cycle_issues: {
      addedAt: new Date(),
      removedAt: null,
      carriedFromId: null,
    },
    wiki_spaces: {
      description: null,
      createdBy: null,
    },
    wiki_space_members: {
      role: "editor",
    },
    wiki_pages: {
      content: null,
      contentFormat: "json",
      contentText: null,
      parentId: null,
      sortOrder: "a0",
      createdBy: null,
      deletedAt: null,
    },
    files: {
      issueId: null,
      pageId: null,
      uploadedBy: null,
    },
    issue_mentions: {},
    comments: {
      issueId: null,
      pageId: null,
      parentId: null,
      authorId: null,
      resolvedAt: null,
      deletedAt: null,
    },
    reactions: {},
    notifications: {
      issueId: null,
      pageId: null,
      readAt: null,
    },
    favorites: {
      projectId: null,
      issueId: null,
      pageId: null,
      spaceId: null,
      sortOrder: "a0",
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
 * Supports `eq`, `ne`, `and`, `or`, `not`, `isNull`, `isNotNull`, `lt`, `gt`,
 * `ilike`, `inArray`, `notInArray`.
 *
 * Handles both the legacy node-type format (type: "binary" / "unary") and the
 * real Drizzle SQL AST (queryChunks arrays) so the mock works with actual
 * Drizzle operator functions.
 */
function evaluateCondition(condition: unknown, row: Record<string, unknown>): boolean {
  if (!condition) return true;
  if (typeof condition !== "object") return true;

  const cond = condition as Record<string, unknown>;

  // BinaryOperator (eq, ne, lt, ilike)
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
      case "!=":
      case "<>":
        return value !== rightValue;
      case "<":
        if (value instanceof Date && rightValue instanceof Date) {
          return value.getTime() < rightValue.getTime();
        }
        return (value as number) < (rightValue as number);
      case ">":
        if (value instanceof Date && rightValue instanceof Date) {
          return value.getTime() > rightValue.getTime();
        }
        return (value as number) > (rightValue as number);
      case ">=":
        if (value instanceof Date && rightValue instanceof Date) {
          return value.getTime() >= rightValue.getTime();
        }
        return (value as number) >= (rightValue as number);
      case "<=":
        if (value instanceof Date && rightValue instanceof Date) {
          return value.getTime() <= rightValue.getTime();
        }
        return (value as number) <= (rightValue as number);
      case "ilike": {
        if (typeof value !== "string" || typeof rightValue !== "string") return false;
        const pattern = escapeRegex(rightValue).replace(/%/g, ".*");
        return new RegExp(pattern, "i").test(value);
      }
      default:
        return true;
    }
  }

  // Unary (isNull, isNotNull, not)
  if (cond.type === "unary") {
    const operand = cond.operand as Record<string, unknown>;
    const op = cond.operator as string;

    switch (op) {
      case "is null": {
        const colName = getColumnName(operand);
        if (!colName) return true;
        const fieldName = snakeToCamel(colName);
        const value = row[fieldName];
        return value === null || value === undefined;
      }
      case "is not null": {
        const colName = getColumnName(operand);
        if (!colName) return true;
        const fieldName = snakeToCamel(colName);
        const value = row[fieldName];
        return value !== null && value !== undefined;
      }
      case "not":
        return !evaluateCondition(operand, row);
      default:
        return true;
    }
  }

  // And
  if (Array.isArray((cond as { conditions?: unknown[] }).conditions)) {
    const conditions = (cond as { conditions: unknown[] }).conditions;
    // Detect Or vs And by checking for an `operator` hint
    const op = (cond as { operator?: string }).operator;
    if (op === "or") {
      return conditions.some((c) => evaluateCondition(c, row));
    }
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

  // NotInArray
  if (cond.type === "not_in_array") {
    const left = cond.left as Record<string, unknown>;
    const values = cond.values as unknown[];
    const colName = getColumnName(left);
    if (!colName) return true;
    const fieldName = snakeToCamel(colName);
    const value = row[fieldName];
    return !values.includes(value);
  }

  // ── Drizzle SQL AST (queryChunks) fallback ───────────────────────────
  // Drizzle's eq/ne/and/or/isNull produce SQL objects with a queryChunks array.
  // Walk queryChunks to interpret the condition at runtime.
  const queryChunks = (cond as { queryChunks?: unknown[] }).queryChunks;
  if (Array.isArray(queryChunks)) {
    return evaluateQueryChunks(queryChunks, row);
  }

  return true;
}

/**
 * Escape special regex characters in a string so it can be used as a literal
 * inside a RegExp.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract sub-conditions from a Drizzle SQL queryChunks array that represents
 * an and/or expression.  The structure is:
 *   [StringChunk("("), SQL([cond1, StringChunk(" and "|" or "), cond2, ...]), StringChunk(")")]
 * Returns { mode, conditions } if detected, or null otherwise.
 */
function extractLogicalConditions(
  chunks: unknown[],
): { mode: "and" | "or"; conditions: unknown[] } | null {
  // and/or with multiple conditions: [StringChunk("("), SQL(joined), StringChunk(")")]
  // and/or with a single condition:  [singleCondition]
  if (chunks.length === 1) {
    // Single-condition and/or: just evaluate the inner condition
    return null;
  }

  // Look for the middle SQL chunk produced by sql.join
  const innerChunks = findInnerChunks(chunks);
  if (!innerChunks) return null;

  // Determine mode by scanning for StringChunk separators
  let mode: "and" | "or" = "and";
  const conditions: unknown[] = [];

  for (const chunk of innerChunks) {
    if (isStringChunk(chunk)) {
      const text = getStringChunkValue(chunk);
      if (text === " and ") mode = "and";
      else if (text === " or ") mode = "or";
      // Skip StringChunk separators (including parens)
      continue;
    }
    conditions.push(chunk);
  }

  if (conditions.length > 0) {
    return { mode, conditions };
  }
  return null;
}

/** Check if value is a Drizzle StringChunk. */
function isStringChunk(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const entitySym = Symbol.for("drizzle:entityKind");
  const obj = v as Record<string | symbol, unknown>;
  if (obj[entitySym] === "StringChunk") return true;
  // Fallback: duck-type check (string[] value, no queryChunks)
  return (
    Array.isArray(obj.value) &&
    (obj.value as unknown[]).every((x: unknown) => typeof x === "string") &&
    !Array.isArray((obj as { queryChunks?: unknown }).queryChunks)
  );
}

/** Get the joined string value from a StringChunk. */
function getStringChunkValue(v: unknown): string {
  const obj = v as { value: string[] };
  return obj.value.join("");
}

/** Find the inner queryChunks of a nested SQL object (e.g. from sql.join). */
function findInnerChunks(chunks: unknown[]): unknown[] | null {
  for (const chunk of chunks) {
    if (chunk && typeof chunk === "object" && !isStringChunk(chunk)) {
      const inner = (chunk as { queryChunks?: unknown[] }).queryChunks;
      if (Array.isArray(inner)) {
        return inner;
      }
    }
  }
  return null;
}

/**
 * Evaluate a Drizzle SQL queryChunks array against an in-memory row.
 * Handles binary operators (=, <>, <, >, ilike), unary (is null, is not null, not),
 * logical (and, or), inArray, and notInArray.
 */
function evaluateQueryChunks(chunks: unknown[], row: Record<string, unknown>): boolean {
  // Filter out empty StringChunks to simplify pattern matching
  const significant = chunks.filter((c) => {
    if (isStringChunk(c)) {
      const text = getStringChunkValue(c);
      return text.trim() !== "";
    }
    return true;
  });

  // ── Logical operators (and / or) ───────────────────────────────────
  const logical = extractLogicalConditions(chunks);
  if (logical) {
    if (logical.mode === "or") {
      return logical.conditions.some((c) => evaluateCondition(c, row));
    }
    return logical.conditions.every((c) => evaluateCondition(c, row));
  }

  // Single-element queryChunks (e.g. single-condition and/or wrapper)
  if (chunks.length === 1 && !isStringChunk(chunks[0])) {
    return evaluateCondition(chunks[0], row);
  }

  // ── Binary operators: [Column, StringChunk(" op "), Param] ─────────
  // significant should be [Column, StringChunk(" op "), Param/value]
  if (significant.length === 2) {
    // Could be unary: [Column, StringChunk(" is null")] or [StringChunk("not "), SubCondition]
    const first = significant[0];
    const second = significant[1];

    // Unary: column is null / is not null
    if (isStringChunk(second)) {
      const op = getStringChunkValue(second).trim().toLowerCase();
      const colName = getColumnName(first);
      if (colName) {
        const fieldName = snakeToCamel(colName);
        const value = row[fieldName];
        if (op === "is null") return value === null || value === undefined;
        if (op === "is not null") return value !== null && value !== undefined;
      }
    }

    // not <condition>: StringChunk("not ") followed by a sub-condition
    if (isStringChunk(first)) {
      const text = getStringChunkValue(first).trim().toLowerCase();
      if (text === "not") {
        return !evaluateCondition(second, row);
      }
    }
  }

  if (significant.length === 3) {
    const [left, middle, right] = significant;
    if (isStringChunk(middle)) {
      const op = getStringChunkValue(middle).trim().toLowerCase();
      const colName = getColumnName(left);
      if (colName) {
        const fieldName = snakeToCamel(colName);
        const value = row[fieldName];

        // Handle inArray: column in (values...)
        if (op === "in" && right && typeof right === "object" && Array.isArray(right)) {
          const vals = (right as unknown[]).map(extractValue);
          return vals.includes(value);
        }
        if (op === "not in" && right && typeof right === "object" && Array.isArray(right)) {
          const vals = (right as unknown[]).map(extractValue);
          return !vals.includes(value);
        }

        const rightValue = extractValue(right);

        switch (op) {
          case "=":
            return value === rightValue;
          case "!=":
          case "<>":
            return value !== rightValue;
          case "<":
            if (value instanceof Date && rightValue instanceof Date) {
              return value.getTime() < rightValue.getTime();
            }
            return (value as number) < (rightValue as number);
          case ">":
            if (value instanceof Date && rightValue instanceof Date) {
              return value.getTime() > rightValue.getTime();
            }
            return (value as number) > (rightValue as number);
          case ">=":
            if (value instanceof Date && rightValue instanceof Date) {
              return value.getTime() >= rightValue.getTime();
            }
            return (value as number) >= (rightValue as number);
          case "<=":
            if (value instanceof Date && rightValue instanceof Date) {
              return value.getTime() <= rightValue.getTime();
            }
            return (value as number) <= (rightValue as number);
          case "ilike": {
            if (typeof value !== "string" || typeof rightValue !== "string") return false;
            const escaped = escapeRegex(rightValue).replace(/%/g, ".*");
            return new RegExp(escaped, "i").test(value);
          }
          default:
            return true;
        }
      }
    }
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

    chain.groupBy = (..._args: unknown[]) => {
      // No-op in the in-memory mock -- aggregations are not supported.
      // The chain still returns results (without grouping) so callers
      // get a non-empty array they can iterate over.
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

        // Detect aggregate selection (e.g. select({ count: count() }))
        if (selection && typeof selection === "object" && !joins.length) {
          const sel = selection as Record<string, unknown>;
          const hasAggregate = Object.values(sel).some((v) => isSqlExpression(v));
          if (hasAggregate) {
            const aggResult: Record<string, unknown> = {};
            for (const [key, v] of Object.entries(sel)) {
              if (isSqlExpression(v)) {
                // Assume count() aggregate
                aggResult[key] = results.length;
              }
            }
            return Promise.resolve([aggResult]).then(resolve, reject);
          }
        }

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

        const deleteChain: Record<string, unknown> = {};

        deleteChain.returning = (returnSelection?: unknown) => {
          if (!store) return Promise.resolve([]);

          const removed: unknown[] = [];
          const toRemove: number[] = [];
          for (let i = 0; i < store.length; i++) {
            if (evaluateCondition(cond, store[i] as Record<string, unknown>)) {
              toRemove.push(i);
              if (returnSelection) {
                removed.push(projectRow(store[i] as Record<string, unknown>, returnSelection));
              } else {
                removed.push({ ...store[i] });
              }
            }
          }
          for (let i = toRemove.length - 1; i >= 0; i--) {
            store.splice(toRemove[i]!, 1);
          }
          return Promise.resolve(removed);
        };

        deleteChain.then = (
          resolve: (val: unknown) => unknown,
          reject?: (err: unknown) => unknown,
        ) => {
          if (!store) return Promise.resolve(undefined).then(resolve, reject);

          // Remove matching rows
          const toRemove: number[] = [];
          for (let i = 0; i < store.length; i++) {
            if (evaluateCondition(cond, store[i] as Record<string, unknown>)) {
              toRemove.push(i);
            }
          }
          for (let i = toRemove.length - 1; i >= 0; i--) {
            store.splice(toRemove[i]!, 1);
          }

          return Promise.resolve(undefined).then(resolve, reject);
        };

        return deleteChain;
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
