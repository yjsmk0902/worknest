/**
 * Issue filter integration tests.
 *
 * Tests the list issues endpoint with various filter combinations.
 * Uses the in-memory mock database and exercises real service logic
 * for filters that the mock can evaluate (eq, ilike, inArray, notInArray, isNull).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  cleanup,
  createTestUser,
  createTestWorkspace,
  createTestOrg,
  createTestProject,
  createTestIssue,
  createTestLabel,
  addProjectMember,
  loginAsUser,
  buildTestApp,
  stores,
} from "./setup";

// ── Mock WebSocket broadcasts ───────────────────────────────────────────

vi.mock("../src/websocket/issue-events", () => ({
  broadcastIssueCreated: vi.fn(),
  broadcastIssueUpdated: vi.fn(),
  broadcastIssueDeleted: vi.fn(),
  broadcastIssueBulkUpdated: vi.fn(),
}));

// ── Build a test app with issue routes ──────────────────────────────────

async function buildIssueApp() {
  const { issueRoutes } = await import("../src/routes/issues");

  const { app, auth, db } = await buildTestApp(
    async (app, { auth, db }) => {
      await issueRoutes(app, { auth: auth as never, db: db as never });
    },
    true,
  );

  return { app, auth, db };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setupProjectWithUser() {
  const user = createTestUser({ name: "Filter Admin" });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const project = createTestProject(ws.id, user.id, {
    name: "Filter Project",
    prefix: "FP",
  });
  const cookie = loginAsUser(user);
  return { user, org, ws, project, cookie };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("GET /api/v1/projects/:projectId/issues — single filters", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildIssueApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("filters by statusId", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const doneStatus = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.name === "Done",
    )!;
    const todoStatus = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.name === "Todo",
    )!;

    createTestIssue(project.id, user.id, {
      title: "Done issue",
      statusId: doneStatus.id,
    });
    createTestIssue(project.id, user.id, {
      title: "Todo issue",
      statusId: todoStatus.id,
    });
    createTestIssue(project.id, user.id, {
      title: "No status issue",
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?statusId=${doneStatus.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Done issue");
  });

  it("filters by typeId", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const bugType = stores.issueTypes.find(
      (t) => t.projectId === project.id && t.name === "Bug",
    )!;

    createTestIssue(project.id, user.id, {
      title: "A bug",
      typeId: bugType.id,
    });
    createTestIssue(project.id, user.id, {
      title: "A task",
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?typeId=${bugType.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("A bug");
  });

  it("filters by priority", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: "Urgent one",
      priority: "urgent",
    });
    createTestIssue(project.id, user.id, {
      title: "Low one",
      priority: "low",
    });
    createTestIssue(project.id, user.id, {
      title: "High one",
      priority: "high",
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?priority=urgent`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].priority).toBe("urgent");
  });

  it("filters by title contains", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, { title: "Fix login bug" });
    createTestIssue(project.id, user.id, { title: "Add feature" });
    createTestIssue(project.id, user.id, { title: "Login page redesign" });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?title=login`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    const titles = body.data.map((d: { title: string }) => d.title);
    expect(titles).toContain("Fix login bug");
    expect(titles).toContain("Login page redesign");
  });

  it("filters by search (backward compat)", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, { title: "Database migration" });
    createTestIssue(project.id, user.id, { title: "API endpoint" });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?search=database`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toContain("Database");
  });
});

describe("GET /api/v1/projects/:projectId/issues — multi-value filters", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildIssueApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("filters by multiple statusIds (comma-separated)", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const doneStatus = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.name === "Done",
    )!;
    const todoStatus = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.name === "Todo",
    )!;
    const backlogStatus = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.name === "Backlog",
    )!;

    createTestIssue(project.id, user.id, {
      title: "Done",
      statusId: doneStatus.id,
    });
    createTestIssue(project.id, user.id, {
      title: "Todo",
      statusId: todoStatus.id,
    });
    createTestIssue(project.id, user.id, {
      title: "Backlog",
      statusId: backlogStatus.id,
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?statusId=${doneStatus.id},${todoStatus.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    const titles = body.data.map((d: { title: string }) => d.title);
    expect(titles).toContain("Done");
    expect(titles).toContain("Todo");
  });

  it("filters by multiple priorities (comma-separated)", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: "Urgent",
      priority: "urgent",
    });
    createTestIssue(project.id, user.id, {
      title: "High",
      priority: "high",
    });
    createTestIssue(project.id, user.id, {
      title: "Low",
      priority: "low",
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?priority=urgent,high`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    const priorities = body.data.map(
      (d: { priority: string }) => d.priority,
    );
    expect(priorities).toContain("urgent");
    expect(priorities).toContain("high");
  });
});

describe("GET /api/v1/projects/:projectId/issues — negative filters", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildIssueApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("filters by statusIdNot (excludes a status)", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const doneStatus = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.name === "Done",
    )!;
    const todoStatus = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.name === "Todo",
    )!;

    createTestIssue(project.id, user.id, {
      title: "Done",
      statusId: doneStatus.id,
    });
    createTestIssue(project.id, user.id, {
      title: "Todo",
      statusId: todoStatus.id,
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?statusIdNot=${doneStatus.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Todo");
  });

  it("filters by priorityNot (excludes priorities)", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: "Urgent",
      priority: "urgent",
    });
    createTestIssue(project.id, user.id, {
      title: "High",
      priority: "high",
    });
    createTestIssue(project.id, user.id, {
      title: "None",
      priority: "none",
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?priorityNot=none`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    const priorities = body.data.map(
      (d: { priority: string }) => d.priority,
    );
    expect(priorities).not.toContain("none");
  });
});

describe("GET /api/v1/projects/:projectId/issues — empty filters", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildIssueApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("filters by dueEmpty=true (no due date)", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: "No Due",
      dueDate: null,
    });
    createTestIssue(project.id, user.id, {
      title: "Has Due",
      dueDate: new Date("2025-12-31"),
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?dueEmpty=true`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("No Due");
  });
});

describe("GET /api/v1/projects/:projectId/issues — date filters", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildIssueApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("filters by dueBefore", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: "Due Soon",
      dueDate: new Date("2025-06-01"),
    });
    createTestIssue(project.id, user.id, {
      title: "Due Later",
      dueDate: new Date("2025-12-31"),
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?dueBefore=2025-07-01`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Due Soon");
  });

  it("filters by dueAfter", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: "Due Soon",
      dueDate: new Date("2025-06-01"),
    });
    createTestIssue(project.id, user.id, {
      title: "Due Later",
      dueDate: new Date("2025-12-31"),
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?dueAfter=2025-07-01`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Due Later");
  });
});

describe("GET /api/v1/projects/:projectId/issues — combined filters", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildIssueApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("combines status + priority filters", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const todoStatus = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.name === "Todo",
    )!;

    createTestIssue(project.id, user.id, {
      title: "Todo Urgent",
      statusId: todoStatus.id,
      priority: "urgent",
    });
    createTestIssue(project.id, user.id, {
      title: "Todo Low",
      statusId: todoStatus.id,
      priority: "low",
    });
    createTestIssue(project.id, user.id, {
      title: "Done Urgent",
      priority: "urgent",
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?statusId=${todoStatus.id}&priority=urgent`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Todo Urgent");
  });

  it("combines search + priority filters", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: "Fix login bug",
      priority: "high",
    });
    createTestIssue(project.id, user.id, {
      title: "Fix dashboard bug",
      priority: "low",
    });
    createTestIssue(project.id, user.id, {
      title: "Add login feature",
      priority: "high",
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?search=login&priority=high`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
  });

  it("returns empty results when filters match nothing", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: "A task",
      priority: "low",
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?priority=urgent`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
  });

  it("filters by parentId", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const parent = createTestIssue(project.id, user.id, { title: "Parent" });
    createTestIssue(project.id, user.id, {
      title: "Child 1",
      parentId: parent.id,
    });
    createTestIssue(project.id, user.id, {
      title: "Child 2",
      parentId: parent.id,
    });
    createTestIssue(project.id, user.id, { title: "Unrelated" });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?parentId=${parent.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    const titles = body.data.map((d: { title: string }) => d.title);
    expect(titles).toContain("Child 1");
    expect(titles).toContain("Child 2");
  });

  it("does not return soft-deleted issues", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: "Active",
    });
    createTestIssue(project.id, user.id, {
      title: "Deleted",
      deletedAt: new Date(),
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Active");
  });

  it("returns 403 for non-member", async () => {
    const { project } = setupProjectWithUser();
    const outsider = createTestUser({ name: "Outsider" });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie: outsiderCookie },
    });

    expect(res.statusCode).toBe(403);
  });
});
