import cookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
/**
 * Auth route integration tests.
 *
 * Tests the full HTTP request lifecycle for:
 * - POST /api/v1/auth/register
 * - POST /api/v1/auth/login
 * - POST /api/v1/auth/logout
 * - Rate limiting on auth endpoints
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, createMockAuth, createTestUser, loginAsUser } from './setup';

// ── Build a test app with auth routes ─────────────────────────────────

async function buildAuthApp() {
  const app = Fastify({ logger: false });
  await app.register(cookie);

  const auth = createMockAuth();

  const { errorHandler } = await import('../src/lib/errors');
  app.setErrorHandler(errorHandler);

  // We need to register the auth routes with the mock auth
  // but the routes import authRateLimit and createRequireAuth internally.
  // We'll mock those modules.
  const { authRoutes } = await import('../src/routes/auth');
  const { OrganizationService } = await import('../src/services/organization-service');
  const { WorkspaceService } = await import('../src/services/workspace-service');

  // Mock services used by the invitation accept route
  vi.spyOn(OrganizationService.prototype, 'acceptInvitation').mockResolvedValue(null);
  vi.spyOn(WorkspaceService.prototype, 'acceptInvitation').mockResolvedValue(null);

  await authRoutes(app, { auth, db: {} as never });
  await app.ready();

  return { app, auth };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  let app: FastifyInstance;
  let auth: ReturnType<typeof createMockAuth>;

  beforeEach(async () => {
    cleanup();
    const result = await buildAuthApp();
    app = result.app;
    auth = result.auth;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('creates a new account with valid data and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'new@test.com',
        password: 'securepassword',
        name: 'New User',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveProperty('id');
    expect(body.data.email).toBe('new@test.com');
    expect(body.data.name).toBe('New User');
  });

  it('sets a session cookie on successful registration', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'cookie@test.com',
        password: 'securepassword',
        name: 'Cookie User',
      },
    });

    expect(res.statusCode).toBe(201);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(String(setCookie)).toContain('worknest.session_token');
  });

  it('returns 400 when email is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        password: 'securepassword',
        name: 'No Email',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when password is too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'short@test.com',
        password: 'abc',
        name: 'Short Pass',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when name is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'noname@test.com',
        password: 'securepassword',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when email is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'not-an-email',
        password: 'securepassword',
        name: 'Bad Email',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when duplicate email is used', async () => {
    createTestUser({ email: 'existing@test.com' });

    // Mock signUpEmail to return null (email exists)
    auth.api.signUpEmail.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'existing@test.com',
        password: 'securepassword',
        name: 'Duplicate',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('returns 400 when password exceeds max length', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'longpass@test.com',
        password: 'a'.repeat(129),
        name: 'Long Pass',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when name exceeds max length', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'longname@test.com',
        password: 'securepassword',
        name: 'a'.repeat(101),
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  let app: FastifyInstance;
  let auth: ReturnType<typeof createMockAuth>;

  beforeEach(async () => {
    cleanup();
    const result = await buildAuthApp();
    app = result.app;
    auth = result.auth;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('logs in with valid credentials and returns 200 with session cookie', async () => {
    const user = createTestUser({
      email: 'login@test.com',
      name: 'Login User',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'login@test.com',
        password: 'correctpassword',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(user.id);
    expect(body.data.email).toBe('login@test.com');
    expect(body.data.name).toBe('Login User');
  });

  it('sets a session cookie on successful login', async () => {
    createTestUser({ email: 'cookie-login@test.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'cookie-login@test.com',
        password: 'correctpassword',
      },
    });

    expect(res.statusCode).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(String(setCookie)).toContain('worknest.session_token');
  });

  it('returns 401 when password is wrong (user not found in mock)', async () => {
    // User doesn't exist -> signInEmail returns null -> 401
    auth.api.signInEmail.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'wrong@test.com',
        password: 'wrongpassword',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when email does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'nonexistent@test.com',
        password: 'anypassword',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when email is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        password: 'somepassword',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when password is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test@test.com',
        password: '',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when email is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'not-valid',
        password: 'somepassword',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/v1/auth/logout', () => {
  let app: FastifyInstance;
  let auth: ReturnType<typeof createMockAuth>;

  beforeEach(async () => {
    cleanup();
    const result = await buildAuthApp();
    app = result.app;
    auth = result.auth;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('logs out successfully with a valid session and returns 200', async () => {
    const user = createTestUser({ email: 'logout@test.com' });
    const sessionCookie = loginAsUser(user);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.success).toBe(true);
  });

  it('calls auth.api.signOut on logout', async () => {
    const user = createTestUser({ email: 'signout@test.com' });
    const sessionCookie = loginAsUser(user);

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(auth.api.signOut).toHaveBeenCalled();
  });

  it('returns 401 when no session cookie is provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when session cookie is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        cookie: 'worknest.session_token=invalid-session-id',
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('Auth rate limiting', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    // Build a fresh app for rate limit tests
    const result = await buildAuthApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it('allows requests within the rate limit window', async () => {
    createTestUser({ email: 'ratelimit@test.com' });

    // The rate limiter allows 10 requests per 15 minutes for auth
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'ratelimit@test.com',
        password: 'password123',
      },
    });

    // Should be 200, not 429
    expect(res.statusCode).not.toBe(429);
  });
});
