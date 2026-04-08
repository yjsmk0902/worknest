import { type APIRequestContext, type Page, test as base } from '@playwright/test';

// Unique suffix per worker so parallel workers don't collide.
function workerEmail(workerIndex: number): string {
  return `e2e-user-${workerIndex}-${Date.now()}@worknest.test`;
}

const TEST_PASSWORD = 'Passw0rd!e2e';

interface TestUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Extended test fixtures that provide an authenticated browser context.
 *
 * Usage in test files:
 * ```ts
 * import { test, expect } from '../fixtures/auth';
 *
 * test('shows dashboard', async ({ authedPage }) => {
 *   await authedPage.goto('/');
 *   await expect(authedPage.locator('h1')).toBeVisible();
 * });
 * ```
 */
export const test = base.extend<
  {
    /** Authenticated Page with session cookie already set. */
    authedPage: Page;
    /** Authenticated APIRequestContext for direct API calls. */
    authedRequest: APIRequestContext;
    /** Info about the test user created for this worker. */
    testUser: TestUser;
  },
  {
    /** Worker-scoped: registers + logs in once per worker. */
    _workerAuth: {
      user: TestUser;
      cookies: { name: string; value: string; domain: string; path: string }[];
    };
  }
>({
  // ── Worker-scoped fixture (runs once per parallel worker) ──────────

  _workerAuth: [
    async ({ playwright }, use, workerInfo) => {
      const baseURL = process.env.BASE_URL || 'http://localhost:3000';
      const email = workerEmail(workerInfo.workerIndex);
      const name = `E2E User ${workerInfo.workerIndex}`;

      const request = await playwright.request.newContext({ baseURL });

      // Register
      const registerRes = await request.post('/api/v1/auth/register', {
        data: { email, password: TEST_PASSWORD, name },
      });

      if (!registerRes.ok()) {
        const body = await registerRes.text();
        throw new Error(`Registration failed (${registerRes.status()}): ${body}`);
      }

      const registerData = await registerRes.json();
      const user: TestUser = registerData.data;

      // Login (to get a clean session cookie)
      const loginRes = await request.post('/api/v1/auth/login', {
        data: { email, password: TEST_PASSWORD },
      });

      if (!loginRes.ok()) {
        const body = await loginRes.text();
        throw new Error(`Login failed (${loginRes.status()}): ${body}`);
      }

      // Extract cookies from the request context (set via set-cookie header)
      const storageState = await request.storageState();
      const cookies = storageState.cookies;

      await request.dispose();

      await use({ user, cookies });
    },
    { scope: 'worker', timeout: 30_000 },
  ],

  // ── Test-scoped fixtures ──────────────────────────────────────────

  testUser: async ({ _workerAuth }, use) => {
    await use(_workerAuth.user);
  },

  authedPage: async ({ browser, _workerAuth }, use) => {
    const context = await browser.newContext();
    await context.addCookies(_workerAuth.cookies);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  authedRequest: async ({ playwright, _workerAuth }, use) => {
    const baseURL = process.env.BASE_URL || 'http://localhost:3000';

    // Replay cookies so API calls are authenticated.
    // Playwright APIRequestContext doesn't support addCookies directly,
    // so we build a Cookie header from the stored cookies.
    const cookieHeader = _workerAuth.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const authedContext = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Cookie: cookieHeader },
    });

    await use(authedContext);
    await authedContext.dispose();
  },
});

export { expect } from '@playwright/test';
