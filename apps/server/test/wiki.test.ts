import type { FastifyInstance } from 'fastify';
/**
 * Wiki route integration tests.
 *
 * Tests wiki spaces, wiki space members, and wiki pages through real
 * Fastify routes, real service code, and an in-memory mock database.
 * No service methods are mocked -- business logic is actually executed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addWikiSpaceMember,
  buildTestApp,
  cleanup,
  createTestOrg,
  createTestUser,
  createTestWikiPage,
  createTestWikiSpace,
  createTestWorkspace,
  loginAsUser,
  stores,
} from './setup';

// ── Mock modules that wiki page service depends on ──────────────────────

vi.mock('../src/lib/sanitize', () => ({
  sanitizeContent: vi.fn((content: unknown) => content),
}));

vi.mock('../src/lib/extract-text', () => ({
  extractPlainText: vi.fn((_content: unknown) => 'extracted text'),
}));

// ── Build a test app with wiki routes ───────────────────────────────────

async function buildWikiApp() {
  const { wikiSpaceRoutes } = await import('../src/routes/wiki-spaces');
  const { wikiPageRoutes } = await import('../src/routes/wiki-pages');

  const { app, auth, db } = await buildTestApp(
    async (app, { auth, db }) => {
      await wikiSpaceRoutes(app, { auth: auth as never, db: db as never });
      await wikiPageRoutes(app, { auth: auth as never, db: db as never });
    },
    true, // use in-memory DB
  );

  return { app, auth, db };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setupWorkspaceWithUser() {
  const user = createTestUser({ name: 'Wiki Admin' });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const cookie = loginAsUser(user);
  return { user, org, ws, cookie };
}

// ── Tests: WikiSpace CRUD ───────────────────────────────────────────────

describe('POST /api/v1/workspaces/:workspaceId/wiki-spaces', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildWikiApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('creates a wiki space and returns 201 with creator as editor', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/wiki-spaces`,
      headers: { cookie },
      payload: { name: 'Engineering Wiki', slug: 'engineering' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('Engineering Wiki');
    expect(body.data.slug).toBe('engineering');
    expect(body.data.workspaceId).toBe(ws.id);
    expect(body.data.createdBy).toBe(user.id);
    expect(body.data.createdAt).toBeDefined();

    // Verify creator was added as editor
    const membership = stores.wikiSpaceMembers.find(
      (m) => m.wikiSpaceId === body.data.id && m.userId === user.id,
    );
    expect(membership).toBeDefined();
    expect(membership?.role).toBe('editor');
  });

  it('returns 409 when slug already exists in workspace', async () => {
    const { ws, cookie } = setupWorkspaceWithUser();
    createTestWikiSpace(ws.id, { slug: 'engineering' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/wiki-spaces`,
      headers: { cookie },
      payload: { name: 'Another Wiki', slug: 'engineering' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('returns 400 when name is missing', async () => {
    const { ws, cookie } = setupWorkspaceWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/wiki-spaces`,
      headers: { cookie },
      payload: { slug: 'no-name' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    const { ws } = setupWorkspaceWithUser();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/wiki-spaces`,
      payload: { name: 'No Auth', slug: 'no-auth' },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/v1/workspaces/:workspaceId/wiki-spaces', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildWikiApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('returns wiki spaces where user is a member', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space1 = createTestWikiSpace(ws.id, { name: 'Space 1' });
    const space2 = createTestWikiSpace(ws.id, { name: 'Space 2' });
    addWikiSpaceMember(space1.id, user.id, 'editor');
    addWikiSpaceMember(space2.id, user.id, 'viewer');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/wiki-spaces`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.pagination.has_more).toBe(false);
  });

  it('returns empty list when user is not a member of any space', async () => {
    const { ws, cookie } = setupWorkspaceWithUser();
    createTestWikiSpace(ws.id, { name: 'Not a member' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/wiki-spaces`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
  });
});

describe('GET /api/v1/wiki-spaces/:spaceId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildWikiApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('returns a wiki space by ID', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Get Space' });
    addWikiSpaceMember(space.id, user.id, 'editor');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/wiki-spaces/${space.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(space.id);
    expect(body.data.name).toBe('Get Space');
  });

  it('returns 404 for non-existent space', async () => {
    const { cookie } = setupWorkspaceWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/wiki-spaces/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when non-member tries to access', async () => {
    const { ws } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Private Space' });
    const outsider = createTestUser({ name: 'Outsider' });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/wiki-spaces/${space.id}`,
      headers: { cookie: outsiderCookie },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('PATCH /api/v1/wiki-spaces/:spaceId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildWikiApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('updates wiki space name', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Old Name' });
    addWikiSpaceMember(space.id, user.id, 'editor');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/wiki-spaces/${space.id}`,
      headers: { cookie },
      payload: { name: 'New Name' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('New Name');
  });

  it('updates wiki space description', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Desc Space' });
    addWikiSpaceMember(space.id, user.id, 'editor');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/wiki-spaces/${space.id}`,
      headers: { cookie },
      payload: { description: 'Updated description' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.description).toBe('Updated description');
  });

  it('updates wiki space slug', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, {
      name: 'Slug Space',
      slug: 'old-slug',
    });
    addWikiSpaceMember(space.id, user.id, 'editor');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/wiki-spaces/${space.id}`,
      headers: { cookie },
      payload: { slug: 'new-slug' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.slug).toBe('new-slug');
  });

  it('returns 403 when viewer tries to update', async () => {
    const { ws } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'View Only' });
    const viewer = createTestUser({ name: 'Viewer' });
    addWikiSpaceMember(space.id, viewer.id, 'viewer');
    const viewerCookie = loginAsUser(viewer);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/wiki-spaces/${space.id}`,
      headers: { cookie: viewerCookie },
      payload: { name: 'Hacked' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 404 when space does not exist', async () => {
    const { cookie } = setupWorkspaceWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/wiki-spaces/${fakeId}`,
      headers: { cookie },
      payload: { name: 'Nope' },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/v1/wiki-spaces/:spaceId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildWikiApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('deletes a wiki space and returns 204', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'To Delete' });
    addWikiSpaceMember(space.id, user.id, 'editor');

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/wiki-spaces/${space.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    const found = stores.wikiSpaces.find((s) => s.id === space.id);
    expect(found).toBeUndefined();
  });

  it('returns 404 when space does not exist', async () => {
    const { cookie } = setupWorkspaceWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/wiki-spaces/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when viewer tries to delete', async () => {
    const { ws } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Viewer Delete' });
    const viewer = createTestUser({ name: 'Viewer' });
    addWikiSpaceMember(space.id, viewer.id, 'viewer');
    const viewerCookie = loginAsUser(viewer);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/wiki-spaces/${space.id}`,
      headers: { cookie: viewerCookie },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ── Tests: WikiSpace Members ────────────────────────────────────────────

describe('GET /api/v1/wiki-spaces/:spaceId/members', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildWikiApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('lists members of a wiki space', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Members Space' });
    addWikiSpaceMember(space.id, user.id, 'editor');
    const otherUser = createTestUser({ name: 'Other' });
    addWikiSpaceMember(space.id, otherUser.id, 'viewer');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/wiki-spaces/${space.id}/members`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.pagination.has_more).toBe(false);
  });
});

describe('POST /api/v1/wiki-spaces/:spaceId/members', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildWikiApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('adds a member to a wiki space', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Add Member' });
    addWikiSpaceMember(space.id, user.id, 'editor');
    const newUser = createTestUser({ name: 'New Member' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/wiki-spaces/${space.id}/members`,
      headers: { cookie },
      payload: { userId: newUser.id, role: 'viewer' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.userId).toBe(newUser.id);
    expect(body.data.role).toBe('viewer');
  });

  it('returns 409 when user is already a member', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Dup Member' });
    addWikiSpaceMember(space.id, user.id, 'editor');
    const existing = createTestUser({ name: 'Existing' });
    addWikiSpaceMember(space.id, existing.id, 'viewer');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/wiki-spaces/${space.id}/members`,
      headers: { cookie },
      payload: { userId: existing.id, role: 'editor' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('returns 403 when viewer tries to add member', async () => {
    const { ws } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Viewer Add' });
    const viewer = createTestUser({ name: 'Viewer' });
    addWikiSpaceMember(space.id, viewer.id, 'viewer');
    const viewerCookie = loginAsUser(viewer);
    const newUser = createTestUser({ name: 'New' });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/wiki-spaces/${space.id}/members`,
      headers: { cookie: viewerCookie },
      payload: { userId: newUser.id, role: 'viewer' },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('PATCH /api/v1/wiki-spaces/:spaceId/members/:memberId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildWikiApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("updates a member's role", async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Role Update' });
    addWikiSpaceMember(space.id, user.id, 'editor');
    const member = createTestUser({ name: 'Member' });
    const membership = addWikiSpaceMember(space.id, member.id, 'viewer');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/wiki-spaces/${space.id}/members/${membership.id}`,
      headers: { cookie },
      payload: { role: 'editor' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.role).toBe('editor');
  });

  it('returns 403 when viewer tries to update role', async () => {
    const { ws } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Viewer Update' });
    const viewer = createTestUser({ name: 'Viewer' });
    addWikiSpaceMember(space.id, viewer.id, 'viewer');
    const viewerCookie = loginAsUser(viewer);
    const otherUser = createTestUser({ name: 'Other' });
    const membership = addWikiSpaceMember(space.id, otherUser.id, 'viewer');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/wiki-spaces/${space.id}/members/${membership.id}`,
      headers: { cookie: viewerCookie },
      payload: { role: 'editor' },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('DELETE /api/v1/wiki-spaces/:spaceId/members/:memberId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildWikiApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('removes a member from a wiki space', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Remove Member' });
    addWikiSpaceMember(space.id, user.id, 'editor');
    const member = createTestUser({ name: 'To Remove' });
    const membership = addWikiSpaceMember(space.id, member.id, 'viewer');

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/wiki-spaces/${space.id}/members/${membership.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    const found = stores.wikiSpaceMembers.find((m) => m.id === membership.id);
    expect(found).toBeUndefined();
  });

  it('returns 403 when viewer tries to remove member', async () => {
    const { ws } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Viewer Remove' });
    const viewer = createTestUser({ name: 'Viewer' });
    addWikiSpaceMember(space.id, viewer.id, 'viewer');
    const viewerCookie = loginAsUser(viewer);
    const otherUser = createTestUser({ name: 'Other' });
    const membership = addWikiSpaceMember(space.id, otherUser.id, 'viewer');

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/wiki-spaces/${space.id}/members/${membership.id}`,
      headers: { cookie: viewerCookie },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ── Tests: WikiPage CRUD ────────────────────────────────────────────────

describe('POST /api/v1/wiki-spaces/:spaceId/pages', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildWikiApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('creates a wiki page and returns 201', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Page Space' });
    addWikiSpaceMember(space.id, user.id, 'editor');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/wiki-spaces/${space.id}/pages`,
      headers: { cookie },
      payload: { title: 'Getting Started', slug: 'getting-started' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.title).toBe('Getting Started');
    expect(body.data.slug).toBe('getting-started');
    expect(body.data.wikiSpaceId).toBe(space.id);
    expect(body.data.parentId).toBeNull();
    expect(body.data.contentFormat).toBe('json');
  });

  it('creates a page with parentId', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Parent Space' });
    addWikiSpaceMember(space.id, user.id, 'editor');
    const parent = createTestWikiPage(space.id, {
      title: 'Parent Page',
      createdBy: user.id,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/wiki-spaces/${space.id}/pages`,
      headers: { cookie },
      payload: {
        title: 'Child Page',
        slug: 'child-page',
        parentId: parent.id,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.parentId).toBe(parent.id);
  });

  it('returns 403 when viewer tries to create', async () => {
    const { ws } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Viewer Create' });
    const viewer = createTestUser({ name: 'Viewer' });
    addWikiSpaceMember(space.id, viewer.id, 'viewer');
    const viewerCookie = loginAsUser(viewer);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/wiki-spaces/${space.id}/pages`,
      headers: { cookie: viewerCookie },
      payload: { title: 'No Access', slug: 'no-access' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 400 when title is missing', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Missing Title' });
    addWikiSpaceMember(space.id, user.id, 'editor');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/wiki-spaces/${space.id}/pages`,
      headers: { cookie },
      payload: { slug: 'no-title' },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/v1/wiki-spaces/:spaceId/pages', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildWikiApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('returns all pages in a wiki space', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'List Pages' });
    addWikiSpaceMember(space.id, user.id, 'editor');
    createTestWikiPage(space.id, { title: 'Page 1' });
    createTestWikiPage(space.id, { title: 'Page 2' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/wiki-spaces/${space.id}/pages`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.pagination.has_more).toBe(false);
  });

  it('excludes soft-deleted pages', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Deleted Pages' });
    addWikiSpaceMember(space.id, user.id, 'editor');
    createTestWikiPage(space.id, { title: 'Active' });
    createTestWikiPage(space.id, {
      title: 'Deleted',
      deletedAt: new Date(),
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/wiki-spaces/${space.id}/pages`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Active');
  });
});

describe('GET /api/v1/wiki-pages/:pageId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildWikiApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('returns a wiki page by ID', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Get Page' });
    addWikiSpaceMember(space.id, user.id, 'editor');
    const page = createTestWikiPage(space.id, { title: 'My Page' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/wiki-pages/${page.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(page.id);
    expect(body.data.title).toBe('My Page');
  });

  it('returns 404 for non-existent page', async () => {
    const { cookie } = setupWorkspaceWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/wiki-pages/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for soft-deleted page', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Deleted Page' });
    addWikiSpaceMember(space.id, user.id, 'editor');
    const page = createTestWikiPage(space.id, {
      title: 'Deleted',
      deletedAt: new Date(),
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/wiki-pages/${page.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('PATCH /api/v1/wiki-pages/:pageId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildWikiApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('updates page title', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Update Page' });
    addWikiSpaceMember(space.id, user.id, 'editor');
    const page = createTestWikiPage(space.id, { title: 'Old Title' });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/wiki-pages/${page.id}`,
      headers: { cookie },
      payload: { title: 'New Title' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.title).toBe('New Title');
  });

  it('updates page content', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Content Space' });
    addWikiSpaceMember(space.id, user.id, 'editor');
    const page = createTestWikiPage(space.id, { title: 'Content Page' });

    const content = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    };

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/wiki-pages/${page.id}`,
      headers: { cookie },
      payload: { content },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.content).toBeDefined();
  });

  it('returns 404 when page does not exist', async () => {
    const { cookie } = setupWorkspaceWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/wiki-pages/${fakeId}`,
      headers: { cookie },
      payload: { title: 'Nope' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when viewer tries to update', async () => {
    const { ws } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Viewer Update' });
    const viewer = createTestUser({ name: 'Viewer' });
    addWikiSpaceMember(space.id, viewer.id, 'viewer');
    const viewerCookie = loginAsUser(viewer);
    const page = createTestWikiPage(space.id, { title: 'Protected' });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/wiki-pages/${page.id}`,
      headers: { cookie: viewerCookie },
      payload: { title: 'Hacked' },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('DELETE /api/v1/wiki-pages/:pageId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildWikiApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('soft deletes a page (sets deletedAt)', async () => {
    const { ws, user, cookie } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Delete Page' });
    addWikiSpaceMember(space.id, user.id, 'editor');
    const page = createTestWikiPage(space.id, { title: 'To Delete' });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/wiki-pages/${page.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    const deleted = stores.wikiPages.find((p) => p.id === page.id);
    expect(deleted?.deletedAt).not.toBeNull();
  });

  it('returns 404 when page does not exist', async () => {
    const { cookie } = setupWorkspaceWithUser();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/wiki-pages/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when viewer tries to delete', async () => {
    const { ws } = setupWorkspaceWithUser();
    const space = createTestWikiSpace(ws.id, { name: 'Viewer Delete' });
    const viewer = createTestUser({ name: 'Viewer' });
    addWikiSpaceMember(space.id, viewer.id, 'viewer');
    const viewerCookie = loginAsUser(viewer);
    const page = createTestWikiPage(space.id, { title: 'Protected' });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/wiki-pages/${page.id}`,
      headers: { cookie: viewerCookie },
    });

    expect(res.statusCode).toBe(403);
  });
});
