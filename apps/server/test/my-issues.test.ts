import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
/**
 * My Issues (My Work) route integration tests.
 *
 * Tests the "My Issues" view -- issues assigned to the current user
 * across all projects in a workspace, grouped by status category.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
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

// ── Build a test app with my-work routes ────────────────────────────────

async function buildMyWorkApp() {
  const { myWorkRoutes } = await import('../src/routes/my-work');

  const { app, auth, db } = await buildTestApp(
    async (app, { auth, db }) => {
      await myWorkRoutes(app, { auth: auth as never, db: db as never });
    },
    true, // use in-memory DB
  );

  return { app, auth, db };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setupWorkspaceWithUser() {
  const user = createTestUser({ name: 'My Work User' });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const project = createTestProject(ws.id, user.id, {
    name: 'My Work Project',
    prefix: 'MW',
  });
  const cookie = loginAsUser(user);
  return { user, org, ws, project, cookie };
}

function assignIssueToUser(issueId: string, userId: string) {
  stores.issueAssignees.push({
    id: randomUUID(),
    issueId,
    userId,
    assignedAt: new Date(),
  });
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('GET /api/v1/workspaces/:workspaceId/my-issues', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildMyWorkApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('returns issues assigned to the current user', async () => {
    const { user, ws, project, cookie } = setupWorkspaceWithUser();

    // Get the "In Progress" status (started category)
    const startedStatus = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.category === 'started',
    );

    const issue = createTestIssue(project.id, user.id, {
      title: 'My assigned issue',
      statusId: startedStatus?.id ?? null,
    });
    assignIssueToUser(issue.id, user.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/my-issues`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeDefined();
    // Should have standard category keys
    expect(body.data.backlog).toBeDefined();
    expect(body.data.unstarted).toBeDefined();
    expect(body.data.started).toBeDefined();
    expect(body.data.completed).toBeDefined();
    expect(body.data.cancelled).toBeDefined();

    // Our issue should be in the "started" category
    const allIssues = [
      ...body.data.backlog,
      ...body.data.unstarted,
      ...body.data.started,
      ...body.data.completed,
      ...body.data.cancelled,
    ];
    expect(allIssues.length).toBeGreaterThanOrEqual(1);

    const found = allIssues.find((i: { id: string }) => i.id === issue.id);
    expect(found).toBeDefined();
    expect(found.title).toBe('My assigned issue');
  });

  it('groups issues by status category', async () => {
    const { user, ws, project, cookie } = setupWorkspaceWithUser();

    const backlogStatus = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.category === 'backlog',
    );
    const completedStatus = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.category === 'completed',
    );

    const issue1 = createTestIssue(project.id, user.id, {
      title: 'Backlog issue',
      statusId: backlogStatus?.id ?? null,
    });
    assignIssueToUser(issue1.id, user.id);

    const issue2 = createTestIssue(project.id, user.id, {
      title: 'Completed issue',
      statusId: completedStatus?.id ?? null,
    });
    assignIssueToUser(issue2.id, user.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/my-issues`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    const backlogIds = body.data.backlog.map((i: { id: string }) => i.id);
    const completedIds = body.data.completed.map((i: { id: string }) => i.id);

    expect(backlogIds).toContain(issue1.id);
    expect(completedIds).toContain(issue2.id);
  });

  it('returns empty groups when no issues are assigned', async () => {
    const { ws, cookie } = setupWorkspaceWithUser();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/my-issues`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.backlog).toHaveLength(0);
    expect(body.data.unstarted).toHaveLength(0);
    expect(body.data.started).toHaveLength(0);
    expect(body.data.completed).toHaveLength(0);
    expect(body.data.cancelled).toHaveLength(0);
  });

  it('does not return issues from other workspaces', async () => {
    const { user, org, ws, project, cookie } = setupWorkspaceWithUser();

    // Create issue in current workspace
    const issue1 = createTestIssue(project.id, user.id, {
      title: 'Current WS issue',
    });
    assignIssueToUser(issue1.id, user.id);

    // Create another workspace with its own project and issue
    const ws2 = createTestWorkspace(org.id, user.id, { name: 'Other WS' });
    const project2 = createTestProject(ws2.id, user.id, {
      name: 'Other Project',
      prefix: 'OT',
    });
    const issue2 = createTestIssue(project2.id, user.id, {
      title: 'Other WS issue',
    });
    assignIssueToUser(issue2.id, user.id);

    // Search in ws1 only
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/my-issues`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    const allIssues = [
      ...body.data.backlog,
      ...body.data.unstarted,
      ...body.data.started,
      ...body.data.completed,
      ...body.data.cancelled,
    ];

    const ids = allIssues.map((i: { id: string }) => i.id);
    expect(ids).toContain(issue1.id);
    expect(ids).not.toContain(issue2.id);
  });

  it('returns 401 when not authenticated', async () => {
    const { ws } = setupWorkspaceWithUser();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/my-issues`,
    });

    expect(res.statusCode).toBe(401);
  });
});
