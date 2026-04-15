import type { FastifyInstance } from 'fastify';
/**
 * Issue stats integration tests.
 *
 * Tests the GET /api/v1/projects/:projectId/issues/stats endpoint.
 * The stats endpoint uses groupBy + count() which the in-memory mock DB
 * does not fully support. These tests verify the endpoint routing,
 * auth checks, and parameter acceptance. For accurate stats computation,
 * full DB integration tests are needed.
 *
 * Note: The in-memory mock does not handle SQL aggregate operations
 * (GROUP BY, COUNT) so stats results may not be accurate. The tests
 * focus on the HTTP contract (status codes, auth, params).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addProjectMember,
  buildTestApp,
  cleanup,
  createTestIssue,
  createTestOrg,
  createTestProject,
  createTestUser,
  createTestWorkspace,
  loginAsUser,
  stores,
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
  const user = createTestUser({ name: 'Stats Admin' });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const project = createTestProject(ws.id, user.id, {
    name: 'Stats Project',
    prefix: 'ST',
  });
  const cookie = loginAsUser(user);
  return { user, org, ws, project, cookie };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('GET /api/v1/projects/:projectId/issues/stats', () => {
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

  it('returns 200 with byStatus and total for authenticated member', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const doneStatus = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.name === 'Done',
    )!;
    createTestIssue(project.id, user.id, {
      title: 'Done 1',
      statusId: doneStatus.id,
    });
    createTestIssue(project.id, user.id, {
      title: 'Done 2',
      statusId: doneStatus.id,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues/stats`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('byStatus');
    expect(body).toHaveProperty('total');
    expect(typeof body.total).toBe('number');
  });

  it('returns 200 for empty project', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues/stats`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.total).toBe(0);
  });

  it('returns 403 for non-member', async () => {
    const { project } = setupProjectWithUser();
    const outsider = createTestUser({ name: 'Outsider' });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues/stats`,
      headers: { cookie: outsiderCookie },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    const { project } = setupProjectWithUser();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues/stats`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('accepts filter params alongside stats', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: 'Urgent',
      priority: 'urgent',
    });
    createTestIssue(project.id, user.id, {
      title: 'Low',
      priority: 'low',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues/stats?priority=urgent`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('byStatus');
    expect(body).toHaveProperty('total');
  });

  it('allows viewer to access stats', async () => {
    const { project, user } = setupProjectWithUser();
    const viewer = createTestUser({ name: 'Viewer' });
    addProjectMember(project.id, viewer.id, 'viewer');
    const viewerCookie = loginAsUser(viewer);

    createTestIssue(project.id, user.id, { title: 'An issue' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues/stats`,
      headers: { cookie: viewerCookie },
    });

    expect(res.statusCode).toBe(200);
  });
});
