import type { FastifyInstance } from 'fastify';
/**
 * Label route integration tests.
 *
 * Tests the full HTTP request lifecycle through real Fastify routes,
 * real service code, and an in-memory mock database.
 * No service methods are mocked -- business logic is actually executed.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addProjectMember,
  buildTestApp,
  cleanup,
  createTestLabel,
  createTestOrg,
  createTestProject,
  createTestUser,
  createTestWorkspace,
  loginAsUser,
  stores,
} from './setup';

// ── Build a test app with label routes ──────────────────────────────────

async function buildLabelApp() {
  const { labelRoutes } = await import('../src/routes/labels');

  const { app, auth, db } = await buildTestApp(
    async (app, { auth, db }) => {
      await labelRoutes(app, { auth: auth as never, db: db as never });
    },
    true, // use in-memory DB
  );

  return { app, auth, db };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setupProjectWithUser() {
  const user = createTestUser({ name: 'Admin User' });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const project = createTestProject(ws.id, user.id, {
    name: 'Label Project',
    prefix: 'LP',
  });
  const cookie = loginAsUser(user);
  return { user, org, ws, project, cookie };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('POST /api/v1/projects/:projectId/labels', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildLabelApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('creates a label and returns 201 with correct shape', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/labels`,
      headers: { cookie },
      payload: { name: 'Bug', color: '#ef4444' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('Bug');
    expect(body.data.color).toBe('#ef4444');
    expect(body.data.projectId).toBe(project.id);
    expect(body.data.description).toBeNull();
    expect(body.data.id).toBeDefined();
    expect(body.data.createdAt).toBeDefined();
  });

  it('creates a label with optional description', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/labels`,
      headers: { cookie },
      payload: {
        name: 'Feature',
        color: '#22c55e',
        description: 'New feature requests',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.description).toBe('New feature requests');
  });

  it('allows member role to create labels', async () => {
    const { project, user } = setupProjectWithUser();
    const member = createTestUser({ name: 'Member' });
    addProjectMember(project.id, member.id, 'member');
    const memberCookie = loginAsUser(member);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/labels`,
      headers: { cookie: memberCookie },
      payload: { name: 'Enhancement', color: '#3b82f6' },
    });

    expect(res.statusCode).toBe(201);
  });

  it('returns 403 when viewer tries to create', async () => {
    const { project } = setupProjectWithUser();
    const viewer = createTestUser({ name: 'Viewer' });
    addProjectMember(project.id, viewer.id, 'viewer');
    const viewerCookie = loginAsUser(viewer);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/labels`,
      headers: { cookie: viewerCookie },
      payload: { name: 'Blocked', color: '#000000' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when non-member tries to create', async () => {
    const { project } = setupProjectWithUser();
    const outsider = createTestUser({ name: 'Outsider' });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/labels`,
      headers: { cookie: outsiderCookie },
      payload: { name: 'No access', color: '#000000' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 400 when name is missing', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/labels`,
      headers: { cookie },
      payload: { color: '#000000' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when color format is invalid', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/labels`,
      headers: { cookie },
      payload: { name: 'Bad Color', color: 'not-a-color' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    const { project } = setupProjectWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/labels`,
      payload: { name: 'No Auth', color: '#000000' },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/v1/projects/:projectId/labels', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildLabelApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('lists labels for a project', async () => {
    const { project, cookie } = setupProjectWithUser();
    createTestLabel(project.id, { name: 'Bug', color: '#ef4444' });
    createTestLabel(project.id, { name: 'Feature', color: '#22c55e' });
    createTestLabel(project.id, { name: 'Improvement', color: '#3b82f6' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/labels`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(3);
  });

  it('returns empty list when project has no labels', async () => {
    const { project, cookie } = setupProjectWithUser();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/labels`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
  });

  it('returns 403 for non-members', async () => {
    const { project } = setupProjectWithUser();
    const outsider = createTestUser({ name: 'Outsider' });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/labels`,
      headers: { cookie: outsiderCookie },
    });

    expect(res.statusCode).toBe(403);
  });

  it('allows viewer to list labels', async () => {
    const { project } = setupProjectWithUser();
    const viewer = createTestUser({ name: 'Viewer' });
    addProjectMember(project.id, viewer.id, 'viewer');
    const viewerCookie = loginAsUser(viewer);
    createTestLabel(project.id, { name: 'Visible', color: '#000000' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/labels`,
      headers: { cookie: viewerCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
  });
});

describe('PATCH /api/v1/projects/:projectId/labels/:labelId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildLabelApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('updates label name', async () => {
    const { project, cookie } = setupProjectWithUser();
    const label = createTestLabel(project.id, {
      name: 'Old Name',
      color: '#000000',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}/labels/${label.id}`,
      headers: { cookie },
      payload: { name: 'New Name' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('New Name');
  });

  it('updates label color', async () => {
    const { project, cookie } = setupProjectWithUser();
    const label = createTestLabel(project.id, {
      name: 'Colored',
      color: '#000000',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}/labels/${label.id}`,
      headers: { cookie },
      payload: { color: '#ff0000' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.color).toBe('#ff0000');
  });

  it('updates label description', async () => {
    const { project, cookie } = setupProjectWithUser();
    const label = createTestLabel(project.id, {
      name: 'Described',
      color: '#000000',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}/labels/${label.id}`,
      headers: { cookie },
      payload: { description: 'Updated description' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.description).toBe('Updated description');
  });

  it('updates multiple fields at once', async () => {
    const { project, cookie } = setupProjectWithUser();
    const label = createTestLabel(project.id, {
      name: 'Old',
      color: '#000000',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}/labels/${label.id}`,
      headers: { cookie },
      payload: {
        name: 'Critical Bug',
        color: '#b91c1c',
        description: 'Critical bugs only',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('Critical Bug');
    expect(body.data.color).toBe('#b91c1c');
    expect(body.data.description).toBe('Critical bugs only');
  });

  it('allows member role to update labels', async () => {
    const { project } = setupProjectWithUser();
    const member = createTestUser({ name: 'Member' });
    addProjectMember(project.id, member.id, 'member');
    const memberCookie = loginAsUser(member);
    const label = createTestLabel(project.id, {
      name: 'Editable',
      color: '#000000',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}/labels/${label.id}`,
      headers: { cookie: memberCookie },
      payload: { name: 'Edited' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('Edited');
  });

  it('returns 403 when viewer tries to update', async () => {
    const { project } = setupProjectWithUser();
    const viewer = createTestUser({ name: 'Viewer' });
    addProjectMember(project.id, viewer.id, 'viewer');
    const viewerCookie = loginAsUser(viewer);
    const label = createTestLabel(project.id, {
      name: 'Protected',
      color: '#000000',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}/labels/${label.id}`,
      headers: { cookie: viewerCookie },
      payload: { name: 'Should Fail' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 404 when label does not exist', async () => {
    const { project, cookie } = setupProjectWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}/labels/${fakeId}`,
      headers: { cookie },
      payload: { name: 'Nope' },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/v1/projects/:projectId/labels/:labelId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildLabelApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('deletes a label as admin and returns 204', async () => {
    const { project, cookie } = setupProjectWithUser();
    const label = createTestLabel(project.id, {
      name: 'To Delete',
      color: '#000000',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/labels/${label.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    // Verify label was removed from store
    const found = stores.labels.find((l) => l.id === label.id);
    expect(found).toBeUndefined();
  });

  it('returns 403 when member tries to delete (admin only)', async () => {
    const { project } = setupProjectWithUser();
    const member = createTestUser({ name: 'Member' });
    addProjectMember(project.id, member.id, 'member');
    const memberCookie = loginAsUser(member);
    const label = createTestLabel(project.id, {
      name: 'Protected',
      color: '#000000',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/labels/${label.id}`,
      headers: { cookie: memberCookie },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when viewer tries to delete', async () => {
    const { project } = setupProjectWithUser();
    const viewer = createTestUser({ name: 'Viewer' });
    addProjectMember(project.id, viewer.id, 'viewer');
    const viewerCookie = loginAsUser(viewer);
    const label = createTestLabel(project.id, {
      name: 'Protected',
      color: '#000000',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/labels/${label.id}`,
      headers: { cookie: viewerCookie },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when non-member tries to delete', async () => {
    const { project } = setupProjectWithUser();
    const outsider = createTestUser({ name: 'Outsider' });
    const outsiderCookie = loginAsUser(outsider);
    const label = createTestLabel(project.id, {
      name: 'Protected',
      color: '#000000',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/labels/${label.id}`,
      headers: { cookie: outsiderCookie },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 404 when label does not exist', async () => {
    const { project, cookie } = setupProjectWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/labels/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });
});
