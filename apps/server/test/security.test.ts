import type { FastifyInstance } from 'fastify';
/**
 * Security tests.
 *
 * Tests authentication bypass, cross-user access control, XSS sanitization,
 * and rate limiting on auth endpoints.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildTestApp,
  cleanup,
  createMockAuth,
  createTestFavorite,
  createTestIssue,
  createTestNotification,
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
}));

vi.mock('../src/websocket/comment-events', () => ({
  broadcastCommentCreated: vi.fn(),
  broadcastCommentUpdated: vi.fn(),
  broadcastCommentDeleted: vi.fn(),
  broadcastReactionToggled: vi.fn(),
}));

vi.mock('../src/lib/sanitize', () => ({
  sanitizeContent: vi.fn((content: unknown) => content),
}));

vi.mock('../src/lib/queue', () => ({
  addJob: vi.fn().mockResolvedValue(undefined),
}));

// ── App builder ──────────────────────────────────────────────────────────

async function buildSecurityApp() {
  const { issueRoutes } = await import('../src/routes/issues');
  const { commentRoutes } = await import('../src/routes/comments');
  const { notificationRoutes } = await import('../src/routes/notifications');
  const { favoriteRoutes } = await import('../src/routes/favorites');
  const { projectRoutes } = await import('../src/routes/projects');
  const { searchRoutes } = await import('../src/routes/search');

  const { app, auth, db } = await buildTestApp(async (app, { auth, db }) => {
    await issueRoutes(app, { auth: auth as never, db: db as never });
    await commentRoutes(app, { auth: auth as never, db: db as never });
    await notificationRoutes(app, { auth: auth as never, db: db as never });
    await favoriteRoutes(app, { auth: auth as never, db: db as never });
    await projectRoutes(app, { auth: auth as never, db: db as never });
    await searchRoutes(app, { auth: auth as never, db: db as never });
  }, true);

  return { app, auth, db };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setupTwoUsers() {
  // User A: owns the org/workspace/project
  const userA = createTestUser({ name: 'User A' });
  const org = createTestOrg(userA.id);
  const ws = createTestWorkspace(org.id, userA.id);
  const project = createTestProject(ws.id, userA.id, {
    name: 'Secure Project',
    prefix: 'SEC',
  });
  const cookieA = loginAsUser(userA);

  // User B: a completely separate user with no memberships
  const userB = createTestUser({ name: 'User B' });
  const cookieB = loginAsUser(userB);

  return { userA, userB, org, ws, project, cookieA, cookieB };
}

// ══════════════════════════════════════════════════════════════════════════
// 1. Auth bypass: unauthenticated access to protected routes
// ══════════════════════════════════════════════════════════════════════════

describe('Auth bypass: unauthenticated access returns 401', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildSecurityApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('GET /api/v1/projects/:id/issues requires auth', async () => {
    const { project } = setupTwoUsers();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues`,
      // No cookie header
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/projects/:id/issues requires auth', async () => {
    const { project } = setupTwoUsers();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues`,
      payload: { title: 'Hacked issue' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/my/notifications requires auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/my/notifications',
    });

    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/my/favorites requires auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/my/favorites',
    });

    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/workspaces/:id/search requires auth', async () => {
    const { ws } = setupTwoUsers();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/${ws.id}/search?q=test`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/v1/projects/:id/issues/:issueId requires auth', async () => {
    const { project, userA } = setupTwoUsers();
    const issue = createTestIssue(project.id, userA.id, {
      title: 'Protected issue',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/projects/${project.id}/issues/${issue.id}`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 2. Cross-user access: user B cannot access user A's resources
// ══════════════════════════════════════════════════════════════════════════

describe('Cross-user access: user B cannot access user A resources', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildSecurityApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('user B cannot list issues in user A project', async () => {
    const { project, cookieB } = setupTwoUsers();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie: cookieB },
    });

    expect(res.statusCode).toBe(403);
  });

  it('user B cannot create issues in user A project', async () => {
    const { project, cookieB } = setupTwoUsers();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${project.id}/issues`,
      headers: { cookie: cookieB },
      payload: { title: 'Cross-user issue' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('user B cannot post comments on user A issues', async () => {
    const { project, userA, cookieB } = setupTwoUsers();
    const issue = createTestIssue(project.id, userA.id, {
      title: 'User A issue',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/issues/${issue.id}/comments`,
      headers: { cookie: cookieB },
      payload: {
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Cross-user comment' }],
            },
          ],
        },
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('user B cannot read user A notifications', async () => {
    const { userA, cookieB } = setupTwoUsers();

    // Create a notification for user A
    createTestNotification({
      userId: userA.id,
      type: 'assigned',
      message: 'Private notification for A',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/my/notifications',
      headers: { cookie: cookieB },
    });

    // Should return 200 but only show user B's notifications (empty)
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const notifications = body.data ?? [];
    const hasUserANotification = notifications.some(
      (n: { message: string }) => n.message === 'Private notification for A',
    );
    expect(hasUserANotification).toBe(false);
  });

  it('user B cannot see user A favorites', async () => {
    const { userA, project, cookieB } = setupTwoUsers();

    // Create a favorite for user A
    createTestFavorite({
      userId: userA.id,
      projectId: project.id,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/my/favorites',
      headers: { cookie: cookieB },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const favorites = body.data ?? [];
    const hasUserAFavorite = favorites.some(
      (f: { projectId: string }) => f.projectId === project.id,
    );
    expect(hasUserAFavorite).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 3. XSS: sanitizeContent() unit tests
// ══════════════════════════════════════════════════════════════════════════

describe('sanitizeContent XSS prevention', () => {
  // Import the real sanitizeContent (not the mocked version)
  // We use a dynamic import so we can test the real implementation.
  let sanitizeContent: (content: unknown) => unknown;

  beforeEach(async () => {
    // Reset modules so we get the real implementation
    const module = await vi.importActual<{
      sanitizeContent: (content: unknown) => unknown;
    }>('../src/lib/sanitize');
    sanitizeContent = module.sanitizeContent;
  });

  it('strips script nodes entirely', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Safe text' }],
        },
        {
          type: 'script',
          content: [{ type: 'text', text: 'alert("XSS")' }],
        },
      ],
    };

    const result = sanitizeContent(content) as { content: unknown[] };
    expect(result.content).toHaveLength(1);
    expect(result.content.some((n: { type?: string }) => n.type === 'script')).toBe(false);
  });

  it('strips iframe nodes entirely', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'iframe',
          attrs: { src: 'https://evil.com' },
        },
      ],
    };

    const result = sanitizeContent(content) as { content: unknown[] };
    expect(result.content).toHaveLength(0);
  });

  it('strips event handler attributes (onclick, onerror, onload)', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: {
            src: 'image.png',
            onerror: 'alert("XSS")',
            onclick: 'document.location="evil.com"',
            onload: 'stealCookies()',
            alt: 'safe alt',
          },
        },
      ],
    };

    const result = sanitizeContent(content) as {
      content: { attrs?: Record<string, unknown> }[];
    };
    const imgAttrs = result.content[0]?.attrs!;
    expect(imgAttrs.onerror).toBeUndefined();
    expect(imgAttrs.onclick).toBeUndefined();
    expect(imgAttrs.onload).toBeUndefined();
    expect(imgAttrs.src).toBe('image.png');
    expect(imgAttrs.alt).toBe('safe alt');
  });

  it('strips javascript: URIs from attributes', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Click me',
              marks: [
                {
                  type: 'link',
                  attrs: { href: 'javascript:alert(1)' },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = sanitizeContent(content) as {
      content: {
        content: {
          marks: { attrs?: Record<string, unknown> }[];
        }[];
      }[];
    };
    const linkMark = result.content[0]?.content[0]?.marks[0]!;
    // The href should be stripped because it starts with javascript:
    expect(linkMark.attrs?.href).toBeUndefined();
  });

  it('strips data: URIs from attributes', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: {
            src: 'data:text/html,<script>alert(1)</script>',
            alt: 'photo',
          },
        },
      ],
    };

    const result = sanitizeContent(content) as {
      content: { attrs?: Record<string, unknown> }[];
    };
    const attrs = result.content[0]?.attrs!;
    expect(attrs.src).toBeUndefined();
    expect(attrs.alt).toBe('photo');
  });

  it('strips embed, object, and applet nodes', () => {
    const content = {
      type: 'doc',
      content: [
        { type: 'embed', attrs: { src: 'evil.swf' } },
        { type: 'object', attrs: { data: 'evil.jar' } },
        { type: 'applet', attrs: { code: 'Evil.class' } },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Safe' }],
        },
      ],
    };

    const result = sanitizeContent(content) as { content: unknown[] };
    expect(result.content).toHaveLength(1);
    expect((result.content[0] as { type: string }).type).toBe('paragraph');
  });

  it('handles null and undefined content gracefully', () => {
    expect(sanitizeContent(null)).toBeNull();
    expect(sanitizeContent(undefined)).toBeNull();
  });

  it('handles non-object content gracefully', () => {
    expect(sanitizeContent('just a string')).toBe('just a string');
    expect(sanitizeContent(42)).toBe(42);
  });

  it('strips vbscript: URIs from attributes', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Link',
              marks: [
                {
                  type: 'link',
                  attrs: { href: "vbscript:MsgBox('XSS')" },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = sanitizeContent(content) as {
      content: {
        content: {
          marks: { attrs?: Record<string, unknown> }[];
        }[];
      }[];
    };
    const linkMark = result.content[0]?.content[0]?.marks[0]!;
    expect(linkMark.attrs?.href).toBeUndefined();
  });

  it('preserves safe content and attributes', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Hello world',
              marks: [
                {
                  type: 'link',
                  attrs: { href: 'https://example.com' },
                },
                { type: 'bold' },
              ],
            },
          ],
        },
        {
          type: 'image',
          attrs: { src: 'https://cdn.example.com/img.png', alt: 'A photo' },
        },
      ],
    };

    const result = sanitizeContent(content) as {
      content: unknown[];
    };
    expect(result.content).toHaveLength(2);
    // Ensure link and bold marks are preserved
    const paragraph = result.content[0] as {
      content: {
        marks: { type: string; attrs?: Record<string, unknown> }[];
      }[];
    };
    expect(paragraph.content[0]?.marks).toHaveLength(2);
    expect(paragraph.content[0]?.marks[0]?.attrs?.href).toBe('https://example.com');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 4. Rate limiting: auth endpoints return 429 after threshold
// ══════════════════════════════════════════════════════════════════════════

describe('Rate limiting on auth endpoints', () => {
  it('returns 429 after exceeding auth rate limit', async () => {
    // Build a dedicated app for auth routes (uses its own rate limiter)
    const { default: Fastify } = await import('fastify');
    const { default: cookie } = await import('@fastify/cookie');
    const { errorHandler } = await import('../src/lib/errors');
    const { authRoutes } = await import('../src/routes/auth');
    const { OrganizationService } = await import('../src/services/organization-service');
    const { WorkspaceService } = await import('../src/services/workspace-service');

    cleanup();
    const app = Fastify({ logger: false });
    await app.register(cookie);
    app.setErrorHandler(errorHandler);

    const auth = createMockAuth();

    vi.spyOn(OrganizationService.prototype, 'acceptInvitation').mockResolvedValue(null);
    vi.spyOn(WorkspaceService.prototype, 'acceptInvitation').mockResolvedValue(null);

    await authRoutes(app, { auth, db: {} as never });
    await app.ready();

    // The auth rate limit is 10 requests per 15 minutes.
    // Fire 10 requests to exhaust the limit, then check for 429.
    const results: number[] = [];

    for (let i = 0; i < 12; i++) {
      const user = createTestUser({
        email: `ratelimit-${i}@test.com`,
        name: `Rate Limit User ${i}`,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: user.email, password: 'password' },
        // All requests come from the same IP by default in inject
      });
      results.push(res.statusCode);
    }

    // At least one request should have been rate-limited (429)
    expect(results).toContain(429);

    // The first few requests should succeed
    expect(results.slice(0, 5).every((s) => s !== 429)).toBe(true);

    await app.close();
    cleanup();
  });
});
