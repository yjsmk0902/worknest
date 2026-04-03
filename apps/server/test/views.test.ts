/**
 * View route integration tests.
 *
 * Tests the full HTTP request lifecycle through real Fastify routes,
 * real service code, and an in-memory mock database.
 * No service methods are mocked -- business logic is actually executed.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  cleanup,
  createTestUser,
  createTestWorkspace,
  createTestOrg,
  createTestProject,
  createTestView,
  addProjectMember,
  loginAsUser,
  buildTestApp,
  stores,
} from "./setup";

// ── Build a test app with view routes ──────────────────────────────────

async function buildViewApp() {
  const { viewRoutes } = await import("../src/routes/views");

  const { app, auth, db } = await buildTestApp(
    async (app, { auth, db }) => {
      await viewRoutes(app, { auth: auth as never, db: db as never });
    },
    true, // use in-memory DB
  );

  return { app, auth, db };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setupProjectWithUser() {
  const user = createTestUser({ name: "View Admin" });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const project = createTestProject(ws.id, user.id, {
    name: "View Project",
    prefix: "VP",
  });
  const cookie = loginAsUser(user);
  return { user, org, ws, project, cookie };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("POST /api/v1/projects/:projectId/views", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildViewApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("creates a view and returns 201 with correct shape", async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.id}/views`,
      headers: { cookie },
      payload: { name: "My Open Bugs", type: "list" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe("My Open Bugs");
    expect(body.data.type).toBe("list");
    expect(body.data.projectId).toBe(project.id);
    expect(body.data.filters).toEqual([]);
    expect(body.data.sort).toBeNull();
    expect(body.data.groupBy).toBeNull();
    expect(body.data.id).toBeDefined();
    expect(body.data.createdAt).toBeDefined();
    expect(body.data.updatedAt).toBeDefined();
  });

  it("creates a board view", async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.id}/views`,
      headers: { cookie },
      payload: { name: "Sprint Board", type: "board" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.type).toBe("board");
  });

  it("creates a view with filters", async () => {
    const { project, cookie } = setupProjectWithUser();

    const filters = [
      { field: "priority", operator: "is", value: "high" },
      { field: "assigneeId", operator: "is_empty" },
    ];

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.id}/views`,
      headers: { cookie },
      payload: { name: "Unassigned High", type: "list", filters },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.filters).toHaveLength(2);
    expect(body.data.filters[0].field).toBe("priority");
    expect(body.data.filters[1].operator).toBe("is_empty");
  });

  it("creates a view with sort", async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.id}/views`,
      headers: { cookie },
      payload: {
        name: "By Priority",
        type: "list",
        sort: { field: "priority", direction: "asc" },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.sort.field).toBe("priority");
    expect(body.data.sort.direction).toBe("asc");
  });

  it("creates a view with groupBy", async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.id}/views`,
      headers: { cookie },
      payload: { name: "Grouped", type: "board", groupBy: "status" },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.groupBy).toBe("status");
  });

  it("returns 400 when name is missing", async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.id}/views`,
      headers: { cookie },
      payload: { type: "list" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when type is invalid", async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.id}/views`,
      headers: { cookie },
      payload: { name: "Bad Type", type: "kanban" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 403 when non-member tries to create", async () => {
    const { project } = setupProjectWithUser();
    const outsider = createTestUser({ name: "Outsider" });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.id}/views`,
      headers: { cookie: outsiderCookie },
      payload: { name: "No Access", type: "list" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    const { project } = setupProjectWithUser();

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.id}/views`,
      payload: { name: "No Auth", type: "list" },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/v1/projects/:projectId/views", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildViewApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("lists views for a project", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestView(project.id, user.id, { name: "View 1" });
    createTestView(project.id, user.id, { name: "View 2" });
    createTestView(project.id, user.id, { name: "View 3" });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/views`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(3);
    expect(body.pagination.has_more).toBe(false);
  });

  it("returns empty list when project has no views", async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/views`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
  });

  it("returns 403 for non-members", async () => {
    const { project } = setupProjectWithUser();
    const outsider = createTestUser({ name: "Outsider" });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/views`,
      headers: { cookie: outsiderCookie },
    });

    expect(res.statusCode).toBe(403);
  });

  it("allows viewer to list views", async () => {
    const { project, user } = setupProjectWithUser();
    const viewer = createTestUser({ name: "Viewer" });
    addProjectMember(project.id, viewer.id, "viewer");
    const viewerCookie = loginAsUser(viewer);
    createTestView(project.id, user.id, { name: "Visible" });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/views`,
      headers: { cookie: viewerCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
  });

  it("does not return views from other projects", async () => {
    const { project, user, cookie, ws } = setupProjectWithUser();
    createTestView(project.id, user.id, { name: "This project" });

    // Create another project and view
    const otherProject = createTestProject(ws.id, user.id, {
      name: "Other Project",
      prefix: "OP",
    });
    createTestView(otherProject.id, user.id, { name: "Other view" });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.id}/views`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("This project");
  });
});

describe("GET /api/v1/views/:viewId", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildViewApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("returns a view by ID", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const view = createTestView(project.id, user.id, {
      name: "My View",
      type: "board",
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/views/${view.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(view.id);
    expect(body.data.name).toBe("My View");
    expect(body.data.type).toBe("board");
    expect(body.data.projectId).toBe(project.id);
  });

  it("returns 404 for non-existent view", async () => {
    const { cookie } = setupProjectWithUser();
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/views/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("PATCH /api/v1/views/:viewId", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildViewApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("updates view name", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const view = createTestView(project.id, user.id, { name: "Old Name" });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/views/${view.id}`,
      headers: { cookie },
      payload: { name: "New Name" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe("New Name");
  });

  it("updates view filters", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const view = createTestView(project.id, user.id, {
      name: "Filter View",
      filters: [],
    });

    const newFilters = [
      { field: "priority", operator: "is", value: "urgent" },
    ];

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/views/${view.id}`,
      headers: { cookie },
      payload: { filters: newFilters },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.filters).toHaveLength(1);
    expect(body.data.filters[0].value).toBe("urgent");
  });

  it("updates view sort", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const view = createTestView(project.id, user.id, { name: "Sort View" });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/views/${view.id}`,
      headers: { cookie },
      payload: { sort: { field: "due_date", direction: "asc" } },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.sort.field).toBe("due_date");
    expect(body.data.sort.direction).toBe("asc");
  });

  it("updates view type", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const view = createTestView(project.id, user.id, {
      name: "Type View",
      type: "list",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/views/${view.id}`,
      headers: { cookie },
      payload: { type: "board" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.type).toBe("board");
  });

  it("supports partial update (only name, other fields unchanged)", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const view = createTestView(project.id, user.id, {
      name: "Original",
      type: "board",
      groupBy: "status",
    });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/views/${view.id}`,
      headers: { cookie },
      payload: { name: "Updated" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe("Updated");
    expect(body.data.type).toBe("board");
    expect(body.data.groupBy).toBe("status");
  });

  it("returns 404 when view does not exist", async () => {
    const { cookie } = setupProjectWithUser();
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/views/${fakeId}`,
      headers: { cookie },
      payload: { name: "Nope" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 403 when non-member tries to update", async () => {
    const { project, user } = setupProjectWithUser();
    const view = createTestView(project.id, user.id, { name: "Protected" });
    const outsider = createTestUser({ name: "Outsider" });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/views/${view.id}`,
      headers: { cookie: outsiderCookie },
      payload: { name: "Hacked" },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("DELETE /api/v1/views/:viewId", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildViewApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("deletes a view and returns 204", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const view = createTestView(project.id, user.id, { name: "To Delete" });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/views/${view.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    // Verify view was removed from store
    const found = stores.views.find((v) => v.id === view.id);
    expect(found).toBeUndefined();
  });

  it("returns 404 when view does not exist", async () => {
    const { cookie } = setupProjectWithUser();
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/views/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 403 when non-member tries to delete", async () => {
    const { project, user } = setupProjectWithUser();
    const view = createTestView(project.id, user.id, { name: "Protected" });
    const outsider = createTestUser({ name: "Outsider" });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/views/${view.id}`,
      headers: { cookie: outsiderCookie },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    const { project, user } = setupProjectWithUser();
    const view = createTestView(project.id, user.id, { name: "No Auth" });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/views/${view.id}`,
    });

    expect(res.statusCode).toBe(401);
  });
});
