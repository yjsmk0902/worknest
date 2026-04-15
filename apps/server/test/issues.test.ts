import type { FastifyInstance } from 'fastify';
/**
 * Issue route integration tests.
 *
 * Tests the full HTTP request lifecycle through real Fastify routes,
 * real service code, and an in-memory mock database.
 * No service methods are mocked -- business logic is actually executed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addProjectMember,
  buildTestApp,
  cleanup,
  createTestIssue,
  createTestLabel,
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
}));

// ── Build a test app with issue routes ──────────────────────────────────

async function buildIssueApp() {
  const { issueRoutes } = await import('../src/routes/issues');

  const { app, auth, db } = await buildTestApp(
    async (app, { auth, db }) => {
      await issueRoutes(app, { auth: auth as never, db: db as never });
    },
    true, // use in-memory DB
  );

  return { app, auth, db };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setupProjectWithUser() {
  const user = createTestUser({ name: 'Project Admin' });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const project = createTestProject(ws.id, user.id, {
    name: 'Issue Project',
    prefix: 'IP',
  });
  const cookie = loginAsUser(user);
  return { user, org, ws, project, cookie };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('POST /api/v1/projects/:projectId/issues', () => {
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

  it('creates an issue and returns 201 with sequenceId = 1', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
      payload: { title: 'First issue' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.title).toBe('First issue');
    expect(body.data.sequenceId).toBe(1);
    expect(body.data.projectId).toBe(project.id);
    expect(body.data.priority).toBe('none');
    expect(body.data.createdAt).toBeDefined();
  });

  it('auto-increments sequenceId for each new issue', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
      payload: { title: 'Issue 1' },
    });
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
      payload: { title: 'Issue 2' },
    });
    const res3 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
      payload: { title: 'Issue 3' },
    });

    expect(JSON.parse(res1.body).data.sequenceId).toBe(1);
    expect(JSON.parse(res2.body).data.sequenceId).toBe(2);
    expect(JSON.parse(res3.body).data.sequenceId).toBe(3);
  });

  it('creates an issue with assignees', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const assignee = createTestUser({ name: 'Assignee' });
    addProjectMember(project.id, assignee.id, 'member');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
      payload: { title: 'With assignee', assigneeIds: [assignee.id] },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.assignees).toHaveLength(1);
    expect(body.data.assignees[0].userId).toBe(assignee.id);
  });

  it('creates an issue with labels', async () => {
    const { project, cookie } = setupProjectWithUser();
    const label = createTestLabel(project.id, {
      name: 'Bug',
      color: '#ef4444',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
      payload: { title: 'With label', labelIds: [label.id] },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.labels).toHaveLength(1);
    expect(body.data.labels[0].labelId).toBe(label.id);
  });

  it('creates a sub-issue with parentId', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const parentIssue = createTestIssue(project.id, user.id, {
      title: 'Parent',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
      payload: { title: 'Sub-task', parentId: parentIssue.id },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.parentId).toBe(parentIssue.id);
  });

  it('creates an issue with priority', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
      payload: { title: 'Urgent', priority: 'high' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.priority).toBe('high');
  });

  it('records a creation activity', async () => {
    const { project, user, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
      payload: { title: 'Activity test' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    const issueId = body.data.id;

    // Check that an activity was recorded
    const activity = stores.activities.find((a) => a.issueId === issueId && a.action === 'created');
    expect(activity).toBeDefined();
    expect(activity?.actorId).toBe(user.id);
  });

  it('returns 403 when non-member tries to create', async () => {
    const { project } = setupProjectWithUser();
    const outsider = createTestUser({ name: 'Outsider' });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie: outsiderCookie },
      payload: { title: 'No access' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    const { project } = setupProjectWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues`,
      payload: { title: 'No auth' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when title is missing', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/v1/projects/:projectId/issues', () => {
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

  it('lists issues with pagination', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, { title: 'Issue A' });
    createTestIssue(project.id, user.id, { title: 'Issue B' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.pagination.has_more).toBe(false);
  });

  it('filters by priority', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, {
      title: 'Urgent',
      priority: 'urgent',
    });
    createTestIssue(project.id, user.id, { title: 'Low', priority: 'low' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues?priority=urgent`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].priority).toBe('urgent');
  });

  it('filters by statusId', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const status = stores.issueStatuses.find(
      (s) => s.projectId === project.id && s.name === 'Done',
    );
    createTestIssue(project.id, user.id, {
      title: 'Done issue',
      statusId: status?.id,
    });
    createTestIssue(project.id, user.id, { title: 'No status' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues?statusId=${status?.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Done issue');
  });

  it('searches by title', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    createTestIssue(project.id, user.id, { title: 'Fix login bug' });
    createTestIssue(project.id, user.id, { title: 'Add feature' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues?search=login`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toContain('login');
  });

  it('returns empty list when no issues match', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
  });

  it('supports pagination with limit', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    for (let i = 0; i < 3; i++) {
      createTestIssue(project.id, user.id, {
        title: `Issue ${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      });
    }

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues?limit=2`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.pagination.has_more).toBe(true);
    expect(body.pagination.next_cursor).toBeDefined();
  });
});

describe('PATCH /api/v1/projects/:projectId/issues/:issueId', () => {
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

  it('updates issue title', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, {
      title: 'Old Title',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}`,
      headers: { cookie },
      payload: { title: 'New Title' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.title).toBe('New Title');
  });

  it('updates issue priority and records activity', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, {
      title: 'Priority Issue',
      priority: 'none',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}`,
      headers: { cookie },
      payload: { priority: 'high' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.priority).toBe('high');

    // Verify activity was recorded
    const activity = stores.activities.find(
      (a) => a.issueId === issue.id && a.action === 'updated' && a.field === 'priority',
    );
    expect(activity).toBeDefined();
    expect(activity?.oldValue).toBe('none');
    expect(activity?.newValue).toBe('high');
  });

  it('returns 404 when issue does not exist', async () => {
    const { project, cookie } = setupProjectWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}/issues/${fakeId}`,
      headers: { cookie },
      payload: { title: 'Nope' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when non-member tries to update', async () => {
    const { project, user } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, { title: 'Protected' });
    const outsider = createTestUser({ name: 'Outsider' });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}`,
      headers: { cookie: outsiderCookie },
      payload: { title: 'No access' },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('DELETE /api/v1/projects/:projectId/issues/:issueId', () => {
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

  it('soft deletes an issue and returns 204', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, { title: 'To Delete' });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    const deleted = stores.issues.find((i) => i.id === issue.id);
    expect(deleted?.deletedAt).not.toBeNull();
  });

  it('promotes sub-issues by setting parentId to null on delete', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const parent = createTestIssue(project.id, user.id, { title: 'Parent' });
    const child = createTestIssue(project.id, user.id, {
      title: 'Child',
      parentId: parent.id,
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/issues/${parent.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    // Verify child's parentId was set to null
    const updatedChild = stores.issues.find((i) => i.id === child.id);
    expect(updatedChild?.parentId).toBeNull();
  });

  it('records a deletion activity', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, { title: 'Logged' });

    await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}`,
      headers: { cookie },
    });

    const activity = stores.activities.find(
      (a) => a.issueId === issue.id && a.action === 'deleted',
    );
    expect(activity).toBeDefined();
    expect(activity?.actorId).toBe(user.id);
  });

  it('returns 404 when issue does not exist', async () => {
    const { project, cookie } = setupProjectWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/issues/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when viewer tries to delete', async () => {
    const { project, user } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, { title: 'Protected' });
    const viewer = createTestUser({ name: 'Viewer' });
    addProjectMember(project.id, viewer.id, 'viewer');
    const viewerCookie = loginAsUser(viewer);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}`,
      headers: { cookie: viewerCookie },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('POST /api/v1/projects/:projectId/issues/:issueId/assignees', () => {
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

  it('adds an assignee to an issue', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, { title: 'Assign me' });
    const assignee = createTestUser({ name: 'Assignee' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}/assignees`,
      headers: { cookie },
      payload: { userId: assignee.id },
    });

    expect(res.statusCode).toBe(201);

    // Verify assignee was recorded
    const record = stores.issueAssignees.find(
      (a) => a.issueId === issue.id && a.userId === assignee.id,
    );
    expect(record).toBeDefined();
  });

  it('records an assignee_added activity', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, { title: 'Activity' });
    const assignee = createTestUser({ name: 'Assignee' });

    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}/assignees`,
      headers: { cookie },
      payload: { userId: assignee.id },
    });

    const activity = stores.activities.find(
      (a) => a.issueId === issue.id && a.action === 'assignee_added',
    );
    expect(activity).toBeDefined();
    expect(activity?.newValue).toBe(assignee.id);
  });
});

describe('DELETE /api/v1/projects/:projectId/issues/:issueId/assignees/:userId', () => {
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

  it('removes an assignee from an issue', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, { title: 'Unassign' });
    const assignee = createTestUser({ name: 'Assignee' });

    // Manually add assignee to store
    stores.issueAssignees.push({
      id: 'assign-id',
      issueId: issue.id,
      userId: assignee.id,
      assignedAt: new Date(),
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}/assignees/${assignee.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    // Verify assignee was removed
    const found = stores.issueAssignees.find(
      (a) => a.issueId === issue.id && a.userId === assignee.id,
    );
    expect(found).toBeUndefined();
  });

  it('records an assignee_removed activity', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, { title: 'Activity' });
    const assignee = createTestUser({ name: 'Assignee' });
    stores.issueAssignees.push({
      id: 'assign-id-2',
      issueId: issue.id,
      userId: assignee.id,
      assignedAt: new Date(),
    });

    await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}/assignees/${assignee.id}`,
      headers: { cookie },
    });

    const activity = stores.activities.find(
      (a) => a.issueId === issue.id && a.action === 'assignee_removed',
    );
    expect(activity).toBeDefined();
    expect(activity?.oldValue).toBe(assignee.id);
  });
});

describe('POST /api/v1/projects/:projectId/issues/:issueId/labels', () => {
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

  it('adds a label to an issue', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, { title: 'Label me' });
    const label = createTestLabel(project.id, {
      name: 'Bug',
      color: '#ef4444',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}/labels`,
      headers: { cookie },
      payload: { labelId: label.id },
    });

    expect(res.statusCode).toBe(201);

    const record = stores.issueLabels.find((l) => l.issueId === issue.id && l.labelId === label.id);
    expect(record).toBeDefined();
  });

  it('records a label_added activity', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, { title: 'Activity' });
    const label = createTestLabel(project.id, {
      name: 'Feature',
      color: '#22c55e',
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}/labels`,
      headers: { cookie },
      payload: { labelId: label.id },
    });

    const activity = stores.activities.find(
      (a) => a.issueId === issue.id && a.action === 'label_added',
    );
    expect(activity).toBeDefined();
    expect(activity?.newValue).toBe(label.id);
  });
});

describe('DELETE /api/v1/projects/:projectId/issues/:issueId/labels/:labelId', () => {
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

  it('removes a label from an issue', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, { title: 'Unlabel' });
    const label = createTestLabel(project.id, {
      name: 'Bug',
      color: '#ef4444',
    });

    stores.issueLabels.push({
      id: 'il-id',
      issueId: issue.id,
      labelId: label.id,
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}/labels/${label.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    const found = stores.issueLabels.find((l) => l.issueId === issue.id && l.labelId === label.id);
    expect(found).toBeUndefined();
  });

  it('records a label_removed activity', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, { title: 'Activity' });
    const label = createTestLabel(project.id, {
      name: 'To Remove',
      color: '#000000',
    });
    stores.issueLabels.push({
      id: 'il-id-2',
      issueId: issue.id,
      labelId: label.id,
    });

    await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}/labels/${label.id}`,
      headers: { cookie },
    });

    const activity = stores.activities.find(
      (a) => a.issueId === issue.id && a.action === 'label_removed',
    );
    expect(activity).toBeDefined();
    expect(activity?.oldValue).toBe(label.id);
  });
});

describe('GET /api/v1/projects/:projectId/issues/:issueId/activities', () => {
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

  it('lists activities for an issue', async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, {
      title: 'Activity Issue',
    });

    // Create some activities directly
    stores.activities.push({
      id: 'act-1',
      actorId: user.id,
      issueId: issue.id,
      projectId: project.id,
      action: 'created',
      field: null,
      oldValue: null,
      newValue: null,
      metadata: null,
      createdAt: new Date(Date.now() - 2000),
    });
    stores.activities.push({
      id: 'act-2',
      actorId: user.id,
      issueId: issue.id,
      projectId: project.id,
      action: 'updated',
      field: 'title',
      oldValue: 'Old',
      newValue: 'New',
      metadata: null,
      createdAt: new Date(Date.now() - 1000),
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}/activities`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].action).toBeDefined();
    expect(body.pagination.has_more).toBe(false);
  });
});
