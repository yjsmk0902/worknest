import type { FastifyInstance } from 'fastify';
/**
 * Project route integration tests.
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
  createTestOrg,
  createTestProject,
  createTestUser,
  createTestWorkspace,
  loginAsUser,
  stores,
} from './setup';

// ── Build a test app with project routes ────────────────────────────────

async function buildProjectApp() {
  const { projectRoutes } = await import('../src/routes/projects');

  const { app, auth, db } = await buildTestApp(
    async (app, { auth, db }) => {
      await projectRoutes(app, { auth: auth as never, db: db as never });
    },
    true, // use in-memory DB
  );

  return { app, auth, db };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setupUserAndWorkspace() {
  const user = createTestUser({ name: 'Admin User' });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const cookie = loginAsUser(user);
  return { user, org, ws, cookie };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('POST /api/v1/workspaces/:workspaceId/projects', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildProjectApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('creates a project and returns 201 with correct shape', async () => {
    const { ws, cookie } = setupUserAndWorkspace();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/projects`,
      headers: { cookie },
      payload: { name: 'My Project', prefix: 'MP' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('My Project');
    expect(body.data.prefix).toBe('MP');
    expect(body.data.workspaceId).toBe(ws.id);
    expect(body.data.issueCounter).toBe(0);
    expect(body.data.description).toBeNull();
    expect(body.data.iconUrl).toBeNull();
    expect(body.data.createdAt).toBeDefined();
    expect(body.data.updatedAt).toBeDefined();
  });

  it('seeds 5 default statuses on project creation', async () => {
    const { ws, cookie } = setupUserAndWorkspace();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/projects`,
      headers: { cookie },
      payload: { name: 'Status Project', prefix: 'SP' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    const projectId = body.data.id;

    // Check that 5 statuses were seeded in our in-memory store
    const statuses = stores.issueStatuses.filter((s) => s.projectId === projectId);
    expect(statuses).toHaveLength(5);
    const names = statuses.map((s) => s.name).sort();
    expect(names).toEqual(['Backlog', 'Cancelled', 'Done', 'In Progress', 'Todo'].sort());
  });

  it('seeds 4 default issue types on project creation', async () => {
    const { ws, cookie } = setupUserAndWorkspace();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/projects`,
      headers: { cookie },
      payload: { name: 'Type Project', prefix: 'TP' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    const projectId = body.data.id;

    const types = stores.issueTypes.filter((t) => t.projectId === projectId);
    expect(types).toHaveLength(4);
    const names = types.map((t) => t.name).sort();
    expect(names).toEqual(['Bug', 'Epic', 'Story', 'Task'].sort());
  });

  it('makes the creator an admin member', async () => {
    const { ws, user, cookie } = setupUserAndWorkspace();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/projects`,
      headers: { cookie },
      payload: { name: 'Admin Project', prefix: 'AP' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    const projectId = body.data.id;

    const membership = stores.projectMembers.find(
      (m) => m.projectId === projectId && m.userId === user.id,
    );
    expect(membership).toBeDefined();
    expect(membership?.role).toBe('admin');
  });

  it('returns 409 when prefix is already taken in the workspace', async () => {
    const { ws, user, cookie } = setupUserAndWorkspace();
    createTestProject(ws.id, user.id, { prefix: 'DUP' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/projects`,
      headers: { cookie },
      payload: { name: 'Duplicate Prefix', prefix: 'DUP' },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('PREFIX_ALREADY_EXISTS');
  });

  it('creates a project with optional description and iconUrl', async () => {
    const { ws, cookie } = setupUserAndWorkspace();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/projects`,
      headers: { cookie },
      payload: {
        name: 'Full Project',
        prefix: 'FP',
        description: 'A project with all fields',
        iconUrl: 'https://example.com/icon.png',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.description).toBe('A project with all fields');
    expect(body.data.iconUrl).toBe('https://example.com/icon.png');
  });

  it('returns 400 when prefix format is invalid', async () => {
    const { ws, cookie } = setupUserAndWorkspace();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/projects`,
      headers: { cookie },
      payload: { name: 'Bad Prefix', prefix: 'toolong!!' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when name is missing', async () => {
    const { ws, cookie } = setupUserAndWorkspace();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/projects`,
      headers: { cookie },
      payload: { prefix: 'NM' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    const { ws } = setupUserAndWorkspace();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/projects`,
      payload: { name: 'No Auth', prefix: 'NA' },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/v1/workspaces/:workspaceId/projects', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildProjectApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('lists projects the user is a member of', async () => {
    const { ws, user, cookie } = setupUserAndWorkspace();
    createTestProject(ws.id, user.id, { name: 'Project A', prefix: 'PA' });
    createTestProject(ws.id, user.id, { name: 'Project B', prefix: 'PB' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/projects`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.has_more).toBe(false);
  });

  it('does not list projects the user is not a member of', async () => {
    const { ws, user, cookie } = setupUserAndWorkspace();
    const otherUser = createTestUser({ name: 'Other User' });
    createTestProject(ws.id, user.id, { name: 'My Project', prefix: 'MY' });
    createTestProject(ws.id, otherUser.id, {
      name: 'Other Project',
      prefix: 'OP',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/projects`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // User should only see their own project
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('My Project');
  });

  it('supports pagination with limit', async () => {
    const { ws, user, cookie } = setupUserAndWorkspace();
    // Create 3 projects with slightly different timestamps
    for (let i = 1; i <= 3; i++) {
      createTestProject(ws.id, user.id, {
        name: `Project ${i}`,
        prefix: `P${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      });
    }

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/projects?limit=2`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.pagination.has_more).toBe(true);
    expect(body.pagination.next_cursor).toBeDefined();
  });
});

describe('GET /api/v1/workspaces/:workspaceId/projects/check-prefix', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildProjectApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('returns available true for unused prefix', async () => {
    const { ws, cookie } = setupUserAndWorkspace();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/projects/check-prefix?prefix=NEW`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.available).toBe(true);
  });

  it('returns available false for taken prefix', async () => {
    const { ws, user, cookie } = setupUserAndWorkspace();
    createTestProject(ws.id, user.id, { prefix: 'TAKEN' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/projects/check-prefix?prefix=TAKEN`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.available).toBe(false);
  });
});

describe('PATCH /api/v1/workspaces/:workspaceId/projects/:projectId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildProjectApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('updates project name as admin', async () => {
    const { ws, user, cookie } = setupUserAndWorkspace();
    const project = createTestProject(ws.id, user.id, {
      name: 'Old Name',
      prefix: 'ON',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${ws.id}/projects/${project.id}`,
      headers: { cookie },
      payload: { name: 'New Name' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('New Name');
  });

  it('returns 403 when non-admin tries to update', async () => {
    const { ws, user, cookie: adminCookie } = setupUserAndWorkspace();
    const project = createTestProject(ws.id, user.id, {
      name: 'Admin Project',
      prefix: 'AP',
    });
    const member = createTestUser({ name: 'Member' });
    addProjectMember(project.id, member.id, 'member');
    const memberCookie = loginAsUser(member);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${ws.id}/projects/${project.id}`,
      headers: { cookie: memberCookie },
      payload: { name: 'Should Fail' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when viewer tries to update', async () => {
    const { ws, user } = setupUserAndWorkspace();
    const project = createTestProject(ws.id, user.id, { prefix: 'VP' });
    const viewer = createTestUser({ name: 'Viewer' });
    addProjectMember(project.id, viewer.id, 'viewer');
    const viewerCookie = loginAsUser(viewer);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${ws.id}/projects/${project.id}`,
      headers: { cookie: viewerCookie },
      payload: { name: 'Should Fail' },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('DELETE /api/v1/workspaces/:workspaceId/projects/:projectId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildProjectApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('soft deletes project as admin and returns 204', async () => {
    const { ws, user, cookie } = setupUserAndWorkspace();
    const project = createTestProject(ws.id, user.id, { prefix: 'SD' });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${ws.id}/projects/${project.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    // Verify the project is soft-deleted in the store
    const deleted = stores.projects.find((p) => p.id === project.id);
    expect(deleted?.deletedAt).toBeDefined();
    expect(deleted?.deletedAt).not.toBeNull();
  });

  it('returns 403 when non-admin tries to delete', async () => {
    const { ws, user } = setupUserAndWorkspace();
    const project = createTestProject(ws.id, user.id, { prefix: 'ND' });
    const member = createTestUser({ name: 'Member' });
    addProjectMember(project.id, member.id, 'member');
    const memberCookie = loginAsUser(member);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${ws.id}/projects/${project.id}`,
      headers: { cookie: memberCookie },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('POST /api/v1/projects/:projectId/members', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildProjectApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('adds a member to the project', async () => {
    const { ws, user, cookie } = setupUserAndWorkspace();
    const project = createTestProject(ws.id, user.id, { prefix: 'AM' });
    const newUser = createTestUser({ name: 'New Member' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/members`,
      headers: { cookie },
      payload: { userId: newUser.id, role: 'member' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.userId).toBe(newUser.id);
    expect(body.data.role).toBe('member');
    expect(body.data.user.name).toBe('New Member');
  });

  it('returns 409 when adding an existing member', async () => {
    const { ws, user, cookie } = setupUserAndWorkspace();
    const project = createTestProject(ws.id, user.id, { prefix: 'EM' });
    const existing = createTestUser({ name: 'Existing' });
    addProjectMember(project.id, existing.id, 'member');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/members`,
      headers: { cookie },
      payload: { userId: existing.id, role: 'member' },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('ALREADY_A_MEMBER');
  });

  it('returns 403 when non-admin tries to add a member', async () => {
    const { ws, user } = setupUserAndWorkspace();
    const project = createTestProject(ws.id, user.id, { prefix: 'NM' });
    const member = createTestUser({ name: 'Member' });
    addProjectMember(project.id, member.id, 'member');
    const memberCookie = loginAsUser(member);
    const newUser = createTestUser({ name: 'Another' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/members`,
      headers: { cookie: memberCookie },
      payload: { userId: newUser.id, role: 'member' },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('DELETE /api/v1/projects/:projectId/members/:memberId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildProjectApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('removes a member from the project', async () => {
    const { ws, user, cookie } = setupUserAndWorkspace();
    const project = createTestProject(ws.id, user.id, { prefix: 'RM' });
    const memberUser = createTestUser({ name: 'To Remove' });
    const membership = addProjectMember(project.id, memberUser.id, 'member');

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/members/${membership.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    // Verify member was removed
    const found = stores.projectMembers.find((m) => m.id === membership.id);
    expect(found).toBeUndefined();
  });

  it('returns 403 when trying to remove the last admin', async () => {
    const { ws, user, cookie } = setupUserAndWorkspace();
    const project = createTestProject(ws.id, user.id, { prefix: 'LA' });

    // Find the admin membership
    const adminMembership = stores.projectMembers.find(
      (m) => m.projectId === project.id && m.userId === user.id,
    );

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/members/${adminMembership?.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.message).toContain('last admin');
  });
});

describe('PATCH /api/v1/projects/:projectId/members/:memberId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildProjectApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('prevents demoting the last admin', async () => {
    const { ws, user, cookie } = setupUserAndWorkspace();
    const project = createTestProject(ws.id, user.id, { prefix: 'DL' });

    const adminMembership = stores.projectMembers.find(
      (m) => m.projectId === project.id && m.userId === user.id,
    );

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}/members/${adminMembership?.id}`,
      headers: { cookie },
      payload: { role: 'member' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.message).toContain('last admin');
  });

  it('allows demoting an admin when other admins exist', async () => {
    const { ws, user, cookie } = setupUserAndWorkspace();
    const project = createTestProject(ws.id, user.id, { prefix: 'DA' });
    const otherAdmin = createTestUser({ name: 'Other Admin' });
    const otherMembership = addProjectMember(project.id, otherAdmin.id, 'admin');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}/members/${otherMembership.id}`,
      headers: { cookie },
      payload: { role: 'member' },
    });

    expect(res.statusCode).toBe(200);
  });

  it('returns 403 when non-admin tries to change roles', async () => {
    const { ws, user } = setupUserAndWorkspace();
    const project = createTestProject(ws.id, user.id, { prefix: 'NR' });
    const member = createTestUser({ name: 'Member' });
    const _memberShip = addProjectMember(project.id, member.id, 'member');
    const memberCookie = loginAsUser(member);

    const anotherMember = createTestUser({ name: 'Another' });
    const anotherShip = addProjectMember(project.id, anotherMember.id, 'viewer');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${project.id}/members/${anotherShip.id}`,
      headers: { cookie: memberCookie },
      payload: { role: 'member' },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('GET /api/v1/projects/:projectId/members', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildProjectApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('lists project members with user details', async () => {
    const { ws, user, cookie } = setupUserAndWorkspace();
    const project = createTestProject(ws.id, user.id, { prefix: 'LM' });
    const member = createTestUser({ name: 'Member User' });
    addProjectMember(project.id, member.id, 'member');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/members`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    const roles = body.data.map((m: { role: string }) => m.role).sort();
    expect(roles).toEqual(['admin', 'member']);
  });

  it('returns 403 for non-members', async () => {
    const { ws, user } = setupUserAndWorkspace();
    const project = createTestProject(ws.id, user.id, { prefix: 'NM' });
    const outsider = createTestUser({ name: 'Outsider' });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/members`,
      headers: { cookie: outsiderCookie },
    });

    expect(res.statusCode).toBe(403);
  });
});
