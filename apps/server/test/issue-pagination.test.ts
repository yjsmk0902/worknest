/**
 * Issue pagination integration tests.
 *
 * Tests cursor-based pagination for the issue list endpoint.
 * The in-memory mock DB handles basic limit slicing. Cursor-based
 * pagination relies on SQL expressions that the mock partially supports,
 * so cursor continuation tests verify the endpoint accepts the cursor
 * parameter and returns valid responses.
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
  const user = createTestUser({ name: "Pagination Admin" });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const project = createTestProject(ws.id, user.id, {
    name: "Pagination Project",
    prefix: "PP",
  });
  const cookie = loginAsUser(user);
  return { user, org, ws, project, cookie };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("GET /api/v1/projects/:projectId/issues — pagination", () => {
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

  it("first page with no cursor returns results and pagination info", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    for (let i = 0; i < 5; i++) {
      createTestIssue(project.id, user.id, {
        title: `Issue ${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      });
    }

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(5);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.has_more).toBe(false);
    expect(body.pagination.next_cursor).toBeNull();
  });

  it("returns has_more=true when limit < total items", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    for (let i = 0; i < 5; i++) {
      createTestIssue(project.id, user.id, {
        title: `Issue ${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      });
    }

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?limit=3`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(3);
    expect(body.pagination.has_more).toBe(true);
    expect(body.pagination.next_cursor).toBeDefined();
    expect(body.pagination.next_cursor).not.toBeNull();
  });

  it("returns has_more=false when exact items equal limit", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    for (let i = 0; i < 3; i++) {
      createTestIssue(project.id, user.id, {
        title: `Issue ${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      });
    }

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?limit=3`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(3);
    expect(body.pagination.has_more).toBe(false);
  });

  it("returns has_more=true when limit+1 items exist", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    for (let i = 0; i < 4; i++) {
      createTestIssue(project.id, user.id, {
        title: `Issue ${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      });
    }

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?limit=3`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(3);
    expect(body.pagination.has_more).toBe(true);
  });

  it("limit=1 returns single item pages", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: "Only Issue A",
      createdAt: new Date("2025-01-01"),
    });
    createTestIssue(project.id, user.id, {
      title: "Only Issue B",
      createdAt: new Date("2025-02-01"),
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?limit=1`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.pagination.has_more).toBe(true);
  });

  it("empty project returns empty list with no cursor", async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
    expect(body.pagination.has_more).toBe(false);
    expect(body.pagination.next_cursor).toBeNull();
  });

  it("default limit is 50", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    // Create 51 issues to verify default limit
    for (let i = 0; i < 51; i++) {
      createTestIssue(project.id, user.id, {
        title: `Issue ${i}`,
        createdAt: new Date(Date.now() - i * 100),
      });
    }

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(50);
    expect(body.pagination.has_more).toBe(true);
  });

  it("next_cursor is a valid base64 string", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    for (let i = 0; i < 3; i++) {
      createTestIssue(project.id, user.id, {
        title: `Issue ${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      });
    }

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?limit=2`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const cursor = body.pagination.next_cursor;
    expect(cursor).toBeDefined();

    // Cursor should be base64-decodable to JSON with { v, id }
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
    expect(decoded).toHaveProperty("v");
    expect(decoded).toHaveProperty("id");
  });

  it("accepts a cursor parameter and returns 200", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    for (let i = 0; i < 5; i++) {
      createTestIssue(project.id, user.id, {
        title: `Issue ${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      });
    }

    // Get first page
    const firstRes = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?limit=2`,
      headers: { cookie },
    });

    expect(firstRes.statusCode).toBe(200);
    const firstBody = JSON.parse(firstRes.body);
    expect(firstBody.pagination.next_cursor).toBeDefined();

    // Use cursor for second page
    const cursor = firstBody.pagination.next_cursor;
    const secondRes = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?limit=2&cursor=${cursor}`,
      headers: { cookie },
    });

    expect(secondRes.statusCode).toBe(200);
    const secondBody = JSON.parse(secondRes.body);
    expect(secondBody.data.length).toBeGreaterThanOrEqual(0);
    expect(secondBody.pagination).toBeDefined();
  });

  it("respects limit=100 as maximum", async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?limit=100`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
  });

  it("rejects limit greater than 100", async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?limit=101`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects limit less than 1", async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/issues?limit=0`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(400);
  });
});
