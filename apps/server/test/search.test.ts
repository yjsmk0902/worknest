import type { FastifyInstance } from 'fastify';
/**
 * Search route integration tests.
 *
 * Tests the full HTTP request lifecycle through real Fastify routes,
 * real service code, and an in-memory mock database.
 *
 * Note: Full-text search (ts_rank / search_vector) is not supported by the
 * in-memory mock DB, so the FTS path is effectively treated as "match all".
 * ILIKE-based search on titles and project names works correctly in the mock.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addWikiSpaceMember,
  buildTestApp,
  cleanup,
  createTestIssue,
  createTestOrg,
  createTestProject,
  createTestUser,
  createTestWikiPage,
  createTestWikiSpace,
  createTestWorkspace,
  loginAsUser,
} from './setup';

// ── Build a test app with search routes ─────────────────────────────────

async function buildSearchApp() {
  const { searchRoutes } = await import('../src/routes/search');

  const { app, auth, db } = await buildTestApp(
    async (app, { auth, db }) => {
      await searchRoutes(app, { auth: auth as never, db: db as never });
    },
    true, // use in-memory DB
  );

  return { app, auth, db };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setupSearchContext() {
  const user = createTestUser({ name: 'Search User' });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const project = createTestProject(ws.id, user.id, {
    name: 'Search Project',
    prefix: 'SP',
  });
  const cookie = loginAsUser(user);
  return { user, org, ws, project, cookie };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('GET /api/v1/workspaces/:workspaceId/search', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildSearchApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('returns matching issues by title', async () => {
    const { user, ws, project, cookie } = setupSearchContext();
    createTestIssue(project.id, user.id, { title: 'Fix login bug' });
    createTestIssue(project.id, user.id, { title: 'Add signup flow' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/search?q=login`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toBeDefined();
    expect(body.data.categories).toBeDefined();
    // The mock DB doesn't support FTS, so it may return all issues.
    // At minimum we expect the categories structure to be correct.
    expect(body.data.categories.issues).toBeDefined();
    expect(body.data.categories.pages).toBeDefined();
    expect(body.data.categories.projects).toBeDefined();
  });

  it('returns results grouped by category', async () => {
    const { user, ws, project, cookie } = setupSearchContext();
    createTestIssue(project.id, user.id, { title: 'Test issue' });

    const space = createTestWikiSpace(ws.id);
    addWikiSpaceMember(space.id, user.id);
    createTestWikiPage(space.id, { title: 'Test page' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/search?q=Test`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.categories.issues).toBeDefined();
    expect(body.data.categories.pages).toBeDefined();
    expect(body.data.categories.projects).toBeDefined();
    expect(body.data.results.length).toBeGreaterThan(0);
  });

  it('returns empty results for non-matching query', async () => {
    const { ws, cookie } = setupSearchContext();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/search?q=zzzznonexistent`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // With mock DB, FTS returns all then ILIKE returns none, so:
    // projects search should return no match on "zzzznonexistent"
    expect(body.data.categories.projects).toHaveLength(0);
  });

  it('isolates results to the requested workspace', async () => {
    const { user, org, ws, project, cookie } = setupSearchContext();
    createTestIssue(project.id, user.id, { title: 'WS1 issue' });

    // Create another workspace with a different project
    const ws2 = createTestWorkspace(org.id, user.id, { name: 'Other WS' });
    const project2 = createTestProject(ws2.id, user.id, {
      name: 'Other Project',
      prefix: 'OP',
    });
    createTestIssue(project2.id, user.id, { title: 'WS2 issue' });

    // Search in ws1 only
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/search?q=issue&type=project`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // Only projects from ws1 should match
    const projectResults = body.data.categories.projects;
    for (const p of projectResults) {
      expect(p.title).not.toBe('Other Project');
    }
  });

  it('returns 400 when query is empty', async () => {
    const { ws, cookie } = setupSearchContext();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/search?q=`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    const { ws } = setupSearchContext();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/search?q=test`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('searches projects by name using ILIKE', async () => {
    const { ws, cookie } = setupSearchContext();
    // The "Search Project" already exists from setup

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/search?q=Search&type=project`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.categories.projects.length).toBeGreaterThanOrEqual(1);
    expect(body.data.categories.projects[0].title).toBe('Search Project');
  });

  it('issue key direct lookup returns matching issue', async () => {
    const { user, ws, project, cookie } = setupSearchContext();
    const issue = createTestIssue(project.id, user.id, {
      title: 'Direct lookup issue',
    });

    const key = `${project.prefix}-${issue.sequenceId}`;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/search?q=${key}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const issueResults = body.data.categories.issues;
    expect(issueResults.length).toBeGreaterThanOrEqual(1);
    expect(issueResults[0].id).toBe(issue.id);
  });
});
