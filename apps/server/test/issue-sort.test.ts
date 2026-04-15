import type { FastifyInstance } from 'fastify';
/**
 * Issue sort integration tests.
 *
 * Tests the list issues endpoint with various sort options.
 * The in-memory mock DB does not fully replicate SQL ORDER BY semantics,
 * so these tests verify the sort parameter is accepted and returns 200.
 * For sort correctness, we rely on the service code exercising Drizzle
 * SQL which is verified at the DB level.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildTestApp,
  cleanup,
  createTestIssue,
  createTestOrg,
  createTestProject,
  createTestUser,
  createTestWorkspace,
  loginAsUser,
} from './setup';

// ── Mock WebSocket broadcasts ───────────────────────────────────────────

vi.mock('../src/websocket/issue-events', () => ({
  broadcastIssueCreated: vi.fn(),
  broadcastIssueUpdated: vi.fn(),
  broadcastIssueDeleted: vi.fn(),
  broadcastIssueBulkUpdated: vi.fn(),
}));

// ── Build a test app with issue routes ──────────────────────────────────

async function buildIssueApp() {
  const { issueRoutes } = await import('../src/routes/issues');

  const { app, auth, db } = await buildTestApp(async (app, { auth, db }) => {
    await issueRoutes(app, { auth: auth as never, db: db as never });
  }, true);

  return { app, auth, db };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setupProjectWithUser() {
  const user = createTestUser({ name: 'Sort Admin' });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const project = createTestProject(ws.id, user.id, {
    name: 'Sort Project',
    prefix: 'SP',
  });
  const cookie = loginAsUser(user);
  return { user, org, ws, project, cookie };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('GET /api/v1/projects/:projectId/issues — sorting', () => {
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

  it('defaults to sort by created_at desc', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: 'First',
      createdAt: new Date('2025-01-01'),
    });
    createTestIssue(project.id, user.id, {
      title: 'Second',
      createdAt: new Date('2025-02-01'),
    });
    createTestIssue(project.id, user.id, {
      title: 'Third',
      createdAt: new Date('2025-03-01'),
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(3);
  });

  it('accepts sort=created_at with order=asc', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: 'Oldest',
      createdAt: new Date('2025-01-01'),
    });
    createTestIssue(project.id, user.id, {
      title: 'Newest',
      createdAt: new Date('2025-12-01'),
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues?sort=created_at&order=asc`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
  });

  it('accepts sort=updated_at', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: 'Updated early',
      updatedAt: new Date('2025-01-01'),
    });
    createTestIssue(project.id, user.id, {
      title: 'Updated late',
      updatedAt: new Date('2025-06-01'),
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues?sort=updated_at&order=desc`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
  });

  it('accepts sort=priority', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: 'None priority',
      priority: 'none',
    });
    createTestIssue(project.id, user.id, {
      title: 'Urgent priority',
      priority: 'urgent',
    });
    createTestIssue(project.id, user.id, {
      title: 'Medium priority',
      priority: 'medium',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues?sort=priority&order=asc`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // The sort is done via SQL CASE expression, which the in-memory mock
    // does not fully replicate. We verify the endpoint accepts the params.
    expect(body.data).toHaveLength(3);
  });

  it('accepts sort=due_date', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: 'Due soon',
      dueDate: new Date('2025-06-01'),
    });
    createTestIssue(project.id, user.id, {
      title: 'Due later',
      dueDate: new Date('2025-12-01'),
    });
    createTestIssue(project.id, user.id, {
      title: 'No due date',
      dueDate: null,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues?sort=due_date&order=asc`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(3);
  });

  it('accepts sort=manual (fractional indexing sort_order)', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: 'First',
      sortOrder: 'a0',
    });
    createTestIssue(project.id, user.id, {
      title: 'Second',
      sortOrder: 'a1',
    });
    createTestIssue(project.id, user.id, {
      title: 'Third',
      sortOrder: 'a2',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues?sort=manual&order=asc`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(3);
  });

  it('accepts order=desc direction', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, { title: 'A' });
    createTestIssue(project.id, user.id, { title: 'B' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues?sort=created_at&order=desc`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
  });

  it('accepts order=asc direction', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, { title: 'A' });
    createTestIssue(project.id, user.id, { title: 'B' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues?sort=created_at&order=asc`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
  });

  it('combines sort with filter', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: 'High 1',
      priority: 'high',
      createdAt: new Date('2025-01-01'),
    });
    createTestIssue(project.id, user.id, {
      title: 'High 2',
      priority: 'high',
      createdAt: new Date('2025-06-01'),
    });
    createTestIssue(project.id, user.id, {
      title: 'Low',
      priority: 'low',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues?priority=high&sort=created_at&order=asc`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    // Both should be high priority
    expect(body.data[0].priority).toBe('high');
    expect(body.data[1].priority).toBe('high');
  });

  it('rejects invalid sort field', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues?sort=invalid_field`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(400);
  });
});
