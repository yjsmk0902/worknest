import type { FastifyInstance } from 'fastify';
/**
 * Favorite route integration tests.
 *
 * Tests the full HTTP request lifecycle through real Fastify routes,
 * real service code, and an in-memory mock database.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildTestApp,
  cleanup,
  createTestFavorite,
  createTestOrg,
  createTestProject,
  createTestUser,
  createTestWorkspace,
  loginAsUser,
  stores,
} from './setup';

// ── Build a test app with favorite routes ───────────────────────────────

async function buildFavoriteApp() {
  const { favoriteRoutes } = await import('../src/routes/favorites');

  const { app, auth, db } = await buildTestApp(
    async (app, { auth, db }) => {
      await favoriteRoutes(app, { auth: auth as never, db: db as never });
    },
    true, // use in-memory DB
  );

  return { app, auth, db };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setupUserWithProject() {
  const user = createTestUser({ name: 'Favorites User' });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const project = createTestProject(ws.id, user.id, {
    name: 'Favorite Project',
    prefix: 'FP',
  });
  const cookie = loginAsUser(user);
  return { user, org, ws, project, cookie };
}

// ── Tests: POST create ──────────────────────────────────────────────────

describe('POST /api/v1/my/favorites', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildFavoriteApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('creates a favorite and returns 201', async () => {
    const { user, project, cookie } = setupUserWithProject();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/my/favorites',
      headers: { cookie },
      payload: {
        entityType: 'project',
        entityId: project.id,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.userId).toBe(user.id);
    expect(body.data.projectId).toBe(project.id);
    expect(body.data.entityType).toBe('project');
    expect(body.data.sortOrder).toBeDefined();
    expect(body.data.id).toBeDefined();
  });

  it('returns 409 when duplicating a favorite', async () => {
    const { user, project, cookie } = setupUserWithProject();

    // Pre-create a favorite
    createTestFavorite({
      userId: user.id,
      projectId: project.id,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/my/favorites',
      headers: { cookie },
      payload: {
        entityType: 'project',
        entityId: project.id,
      },
    });

    expect(res.statusCode).toBe(409);
  });

  it('returns 401 when not authenticated', async () => {
    const { project } = setupUserWithProject();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/my/favorites',
      payload: {
        entityType: 'project',
        entityId: project.id,
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for invalid entityType', async () => {
    const { cookie } = setupUserWithProject();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/my/favorites',
      headers: { cookie },
      payload: {
        entityType: 'invalid_type',
        entityId: '00000000-0000-0000-0000-000000000000',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ── Tests: GET list ─────────────────────────────────────────────────────

describe('GET /api/v1/my/favorites', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildFavoriteApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('lists favorites for the current user', async () => {
    const { user, project, cookie } = setupUserWithProject();

    createTestFavorite({
      userId: user.id,
      projectId: project.id,
      sortOrder: 'a0',
    });
    createTestFavorite({
      userId: user.id,
      projectId: null,
      issueId: '00000000-0000-0000-0000-000000000001',
      sortOrder: 'b0',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/my/favorites',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
  });

  it('returns empty list when no favorites', async () => {
    const { cookie } = setupUserWithProject();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/my/favorites',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
  });

  it("does not return other user's favorites", async () => {
    const { user, project, cookie } = setupUserWithProject();
    const otherUser = createTestUser({ name: 'Other User' });

    createTestFavorite({
      userId: user.id,
      projectId: project.id,
    });
    createTestFavorite({
      userId: otherUser.id,
      projectId: project.id,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/my/favorites',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].userId).toBe(user.id);
  });
});

// ── Tests: PATCH update sortOrder ───────────────────────────────────────

describe('PATCH /api/v1/favorites/:favoriteId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildFavoriteApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('updates sortOrder and returns 200', async () => {
    const { user, project, cookie } = setupUserWithProject();
    const fav = createTestFavorite({
      userId: user.id,
      projectId: project.id,
      sortOrder: 'a0',
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/favorites/${fav.id}`,
      headers: { cookie },
      payload: { sortOrder: 'm0' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.sortOrder).toBe('m0');
  });

  it('returns 404 when favorite does not exist', async () => {
    const { cookie } = setupUserWithProject();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/favorites/${fakeId}`,
      headers: { cookie },
      payload: { sortOrder: 'm0' },
    });

    expect(res.statusCode).toBe(404);
  });

  it("cannot modify another user's favorite", async () => {
    const { project } = setupUserWithProject();
    const otherUser = createTestUser({ name: 'Other' });
    const fav = createTestFavorite({
      userId: otherUser.id,
      projectId: project.id,
    });

    const attacker = createTestUser({ name: 'Attacker' });
    const attackerCookie = loginAsUser(attacker);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/favorites/${fav.id}`,
      headers: { cookie: attackerCookie },
      payload: { sortOrder: 'z0' },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ── Tests: DELETE favorite ──────────────────────────────────────────────

describe('DELETE /api/v1/favorites/:favoriteId', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildFavoriteApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('deletes a favorite and returns 204', async () => {
    const { user, project, cookie } = setupUserWithProject();
    const fav = createTestFavorite({
      userId: user.id,
      projectId: project.id,
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/favorites/${fav.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    // Verify removed from store
    const found = stores.favorites.find((f) => f.id === fav.id);
    expect(found).toBeUndefined();
  });

  it('returns 404 when favorite does not exist', async () => {
    const { cookie } = setupUserWithProject();
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/favorites/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it("cannot delete another user's favorite", async () => {
    const { project } = setupUserWithProject();
    const otherUser = createTestUser({ name: 'Other' });
    const fav = createTestFavorite({
      userId: otherUser.id,
      projectId: project.id,
    });

    const attacker = createTestUser({ name: 'Attacker' });
    const attackerCookie = loginAsUser(attacker);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/favorites/${fav.id}`,
      headers: { cookie: attackerCookie },
    });

    expect(res.statusCode).toBe(404);
  });
});
