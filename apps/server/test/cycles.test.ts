import type { FastifyInstance } from 'fastify';
/**
 * Cycle route integration tests.
 *
 * Tests the full HTTP request lifecycle through real Fastify routes,
 * real service code, and an in-memory mock database.
 * No service methods are mocked -- business logic is actually executed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addIssueToCycle,
  buildTestApp,
  cleanup,
  createTestCycle,
  createTestIssue,
  createTestOrg,
  createTestProject,
  createTestUser,
  createTestWorkspace,
  loginAsUser,
  stores,
} from './setup';

// ── Mock WebSocket broadcasts ───────────────────────────────────────────

vi.mock('../src/websocket/cycle-events', () => ({
  broadcastCycleUpdated: vi.fn(),
  broadcastCycleIssueChanged: vi.fn(),
}));

// ── Build a test app with cycle routes ──────────────────────────────────

async function buildCycleApp() {
  const { cycleRoutes } = await import('../src/routes/cycles');

  const { app, auth, db } = await buildTestApp(
    async (app, { auth, db }) => {
      await cycleRoutes(app, { auth: auth as never, db: db as never });
    },
    true, // use in-memory DB
  );

  return { app, auth, db };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setupProjectWithUser() {
  const user = createTestUser({ name: 'Cycle Admin' });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const project = createTestProject(ws.id, user.id, {
    name: 'Cycle Project',
    prefix: 'CP',
  });
  const cookie = loginAsUser(user);
  return { user, org, ws, project, cookie };
}

// ── Tests: Cycle CRUD ───────────────────────────────────────────────────

describe('POST /api/v1/projects/:projectId/cycles', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCycleApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('creates a cycle and returns 201', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/cycles`,
      headers: { cookie },
      payload: { name: 'Sprint 1' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('Sprint 1');
    expect(body.data.projectId).toBe(project.id);
    expect(body.data.status).toBe('draft');
    expect(body.data.description).toBeNull();
    expect(body.data.startDate).toBeNull();
    expect(body.data.endDate).toBeNull();
    expect(body.data.createdAt).toBeDefined();
  });

  it('creates a cycle with description and dates', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/cycles`,
      headers: { cookie },
      payload: {
        name: 'Sprint 2',
        description: 'Two-week sprint',
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2026-04-14T00:00:00.000Z',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.description).toBe('Two-week sprint');
    expect(body.data.startDate).toBeDefined();
    expect(body.data.endDate).toBeDefined();
  });

  it('returns 400 when name is missing', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/cycles`,
      headers: { cookie },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 403 when non-member tries to create', async () => {
    const { project } = setupProjectWithUser();
    const outsider = createTestUser({ name: 'Outsider' });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/cycles`,
      headers: { cookie: outsiderCookie },
      payload: { name: 'No access' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    const { project } = setupProjectWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/cycles`,
      payload: { name: 'No auth' },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/v1/projects/:projectId/cycles', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCycleApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('returns cycles for a project', async () => {
    const { project, cookie } = setupProjectWithUser();
    createTestCycle(project.id, { name: 'Cycle A' });
    createTestCycle(project.id, { name: 'Cycle B' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/cycles`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
  });

  it('returns empty list when no cycles exist', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/cycles`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
  });

  it('returns 403 when non-member tries to list', async () => {
    const { project } = setupProjectWithUser();
    const outsider = createTestUser({ name: 'Outsider' });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/cycles`,
      headers: { cookie: outsiderCookie },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('GET /api/v1/cycles/:cycleId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCycleApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('returns a cycle by ID', async () => {
    const { project, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'Get Cycle' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/cycles/${cycle.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(cycle.id);
    expect(body.data.name).toBe('Get Cycle');
  });

  it('returns 404 when cycle does not exist', async () => {
    const { cookie } = setupProjectWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/cycles/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('PATCH /api/v1/cycles/:cycleId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCycleApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('updates cycle name', async () => {
    const { project, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'Old Name' });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/cycles/${cycle.id}`,
      headers: { cookie },
      payload: { name: 'New Name' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('New Name');
  });

  it('updates cycle description', async () => {
    const { project, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'Desc Cycle' });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/cycles/${cycle.id}`,
      headers: { cookie },
      payload: { description: 'Updated description' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.description).toBe('Updated description');
  });

  it('updates cycle dates', async () => {
    const { project, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'Date Cycle' });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/cycles/${cycle.id}`,
      headers: { cookie },
      payload: {
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: '2026-05-14T00:00:00.000Z',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.startDate).toBeDefined();
    expect(body.data.endDate).toBeDefined();
  });

  it('returns 404 when cycle does not exist', async () => {
    const { cookie } = setupProjectWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/cycles/${fakeId}`,
      headers: { cookie },
      payload: { name: 'Nope' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when non-member tries to update', async () => {
    const { project } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'Protected' });
    const outsider = createTestUser({ name: 'Outsider' });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/cycles/${cycle.id}`,
      headers: { cookie: outsiderCookie },
      payload: { name: 'Hacked' },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('DELETE /api/v1/cycles/:cycleId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCycleApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('deletes a draft cycle and returns 204', async () => {
    const { project, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, {
      name: 'To Delete',
      status: 'draft',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/cycles/${cycle.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    const found = stores.cycles.find((c) => c.id === cycle.id);
    expect(found).toBeUndefined();
  });

  it('returns 400 when deleting an active cycle', async () => {
    const { project, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, {
      name: 'Active Cycle',
      status: 'active',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/cycles/${cycle.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when deleting a completed cycle', async () => {
    const { project, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, {
      name: 'Completed Cycle',
      status: 'completed',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/cycles/${cycle.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when cycle does not exist', async () => {
    const { cookie } = setupProjectWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/cycles/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when non-member tries to delete', async () => {
    const { project } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'Protected' });
    const outsider = createTestUser({ name: 'Outsider' });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/cycles/${cycle.id}`,
      headers: { cookie: outsiderCookie },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ── Tests: Cycle Activation ─────────────────────────────────────────────

describe('POST /api/v1/cycles/:cycleId/activate', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCycleApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('activates a draft cycle', async () => {
    const { project, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, {
      name: 'Activate Me',
      status: 'draft',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cycles/${cycle.id}/activate`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('active');
  });

  it('returns 409 when another active cycle exists', async () => {
    const { project, cookie } = setupProjectWithUser();
    createTestCycle(project.id, { name: 'Already Active', status: 'active' });
    const draft = createTestCycle(project.id, {
      name: 'Try Activate',
      status: 'draft',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cycles/${draft.id}/activate`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(409);
  });

  it('returns 404 when cycle does not exist', async () => {
    const { cookie } = setupProjectWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cycles/${fakeId}/activate`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ── Tests: Cycle Issues ─────────────────────────────────────────────────

describe('POST /api/v1/cycles/:cycleId/issues', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCycleApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('adds an issue to a cycle and returns 201', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'Issue Cycle' });
    const issue = createTestIssue(project.id, user.id, { title: 'Add me' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cycles/${cycle.id}/issues`,
      headers: { cookie },
      payload: { issueId: issue.id },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.cycleId).toBe(cycle.id);
    expect(body.data.issueId).toBe(issue.id);
    expect(body.data.removedAt).toBeNull();
    expect(body.data.carriedFromId).toBeNull();
  });

  it('returns 409 when issue is already in cycle', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'Dup Cycle' });
    const issue = createTestIssue(project.id, user.id, { title: 'Dup Issue' });
    addIssueToCycle(cycle.id, issue.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cycles/${cycle.id}/issues`,
      headers: { cookie },
      payload: { issueId: issue.id },
    });

    expect(res.statusCode).toBe(409);
  });

  it('returns 404 when issue does not exist', async () => {
    const { project, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'No Issue' });
    const fakeIssueId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cycles/${cycle.id}/issues`,
      headers: { cookie },
      payload: { issueId: fakeIssueId },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/v1/cycles/:cycleId/issues/:issueId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCycleApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('removes an issue from a cycle and returns 204', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'Remove Cycle' });
    const issue = createTestIssue(project.id, user.id, { title: 'Remove me' });
    addIssueToCycle(cycle.id, issue.id);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/cycles/${cycle.id}/issues/${issue.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    // Verify the entry was soft-removed (removedAt set)
    const entry = stores.cycleIssues.find(
      (ci) => ci.cycleId === cycle.id && ci.issueId === issue.id,
    );
    expect(entry?.removedAt).not.toBeNull();
  });

  it('returns 404 when issue is not in cycle', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'No Issue' });
    const issue = createTestIssue(project.id, user.id, { title: 'Not here' });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/cycles/${cycle.id}/issues/${issue.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/v1/cycles/:cycleId/issues', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCycleApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('returns active issues in a cycle', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'List Cycle' });
    const issue1 = createTestIssue(project.id, user.id, { title: 'Active 1' });
    const issue2 = createTestIssue(project.id, user.id, { title: 'Active 2' });
    addIssueToCycle(cycle.id, issue1.id);
    addIssueToCycle(cycle.id, issue2.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/cycles/${cycle.id}/issues`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.pagination.has_more).toBe(false);
  });

  it('excludes removed issues', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'Filter Cycle' });
    const issue1 = createTestIssue(project.id, user.id, { title: 'Active' });
    const issue2 = createTestIssue(project.id, user.id, { title: 'Removed' });
    addIssueToCycle(cycle.id, issue1.id);
    addIssueToCycle(cycle.id, issue2.id, { removedAt: new Date() });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/cycles/${cycle.id}/issues`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Active');
  });

  it('returns empty list for cycle with no issues', async () => {
    const { project, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'Empty Cycle' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/cycles/${cycle.id}/issues`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
  });
});

// ── Tests: Cycle Completion + Carryover ──────────────────────────────────

describe('POST /api/v1/cycles/:cycleId/complete', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCycleApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('completes a cycle without target cycle', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, {
      name: 'Complete Me',
      status: 'active',
    });
    const issue = createTestIssue(project.id, user.id, { title: 'In cycle' });
    addIssueToCycle(cycle.id, issue.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cycles/${cycle.id}/complete`,
      headers: { cookie },
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('completed');
  });

  it('carries over incomplete issues to target cycle', async () => {
    const { project, user, cookie } = setupProjectWithUser();

    // Active cycle with an in-progress issue (backlog category = incomplete)
    const cycle = createTestCycle(project.id, {
      name: 'Source Cycle',
      status: 'active',
    });
    const targetCycle = createTestCycle(project.id, {
      name: 'Target Cycle',
      status: 'draft',
    });

    // Get a backlog status (category != completed/cancelled)
    const backlogStatus = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.category === 'backlog',
    );
    const issue = createTestIssue(project.id, user.id, {
      title: 'Incomplete',
      statusId: backlogStatus?.id,
    });
    addIssueToCycle(cycle.id, issue.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cycles/${cycle.id}/complete`,
      headers: { cookie },
      payload: { targetCycleId: targetCycle.id },
    });

    expect(res.statusCode).toBe(200);

    // Verify carryover entry was created in target cycle
    const carriedEntries = stores.cycleIssues.filter((ci) => ci.cycleId === targetCycle.id);
    expect(carriedEntries).toHaveLength(1);
    expect(carriedEntries[0]?.issueId).toBe(issue.id);
    expect(carriedEntries[0]?.carriedFromId).toBeDefined();
  });

  it('returns 404 when cycle does not exist', async () => {
    const { cookie } = setupProjectWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/cycles/${fakeId}/complete`,
      headers: { cookie },
      payload: {},
    });

    expect(res.statusCode).toBe(404);
  });
});

// ── Tests: Cycle Progress ───────────────────────────────────────────────

describe('GET /api/v1/cycles/:cycleId/progress', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCycleApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('returns progress counts by category', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'Progress Cycle' });

    const backlogStatus = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.category === 'backlog',
    );
    const doneStatus = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.category === 'completed',
    );

    const issue1 = createTestIssue(project.id, user.id, {
      title: 'Backlog',
      statusId: backlogStatus?.id,
    });
    const issue2 = createTestIssue(project.id, user.id, {
      title: 'Done',
      statusId: doneStatus?.id,
    });

    addIssueToCycle(cycle.id, issue1.id);
    addIssueToCycle(cycle.id, issue2.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/cycles/${cycle.id}/progress`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.total).toBeGreaterThanOrEqual(2);
  });

  it('returns zero counts for empty cycle', async () => {
    const { project, cookie } = setupProjectWithUser();
    const cycle = createTestCycle(project.id, { name: 'Empty Progress' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/cycles/${cycle.id}/progress`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.total).toBe(0);
    expect(body.data.completed).toBe(0);
  });

  it('returns 404 when cycle does not exist', async () => {
    const { cookie } = setupProjectWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/cycles/${fakeId}/progress`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });
});
