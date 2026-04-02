/**
 * Server test setup — helpers for building a testable Fastify app
 * and creating test entities (users, orgs, workspaces).
 *
 * These helpers mock Better Auth and wire up a real Fastify instance
 * with the actual route handlers so we can test the full HTTP path
 * (middleware -> handler -> service -> mock DB).
 */
import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { randomUUID } from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────────

export interface TestUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestOrg {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestOrgMember {
  id: string;
  orgId: string;
  userId: string;
  role: string;
  joinedAt: Date;
}

export interface TestWorkspace {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestWsMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  invitedBy: string | null;
  joinedAt: Date;
}

export interface TestInvitation {
  id: string;
  orgId: string | null;
  workspaceId: string | null;
  email: string;
  role: string;
  tokenHash: string;
  invitedBy: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

// ── In-memory data stores ─────────────────────────────────────────────

export const stores = {
  users: [] as TestUser[],
  organizations: [] as TestOrg[],
  orgMembers: [] as TestOrgMember[],
  workspaces: [] as TestWorkspace[],
  workspaceMembers: [] as TestWsMember[],
  invitations: [] as TestInvitation[],
  sessions: new Map<string, TestUser>(),
};

// ── Factory helpers ───────────────────────────────────────────────────

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const user: TestUser = {
    id: randomUUID(),
    email: `user-${randomUUID().slice(0, 8)}@test.com`,
    name: "Test User",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  stores.users.push(user);
  return user;
}

export function createTestOrg(
  ownerId: string,
  overrides: Partial<TestOrg> = {},
): TestOrg {
  const org: TestOrg = {
    id: randomUUID(),
    name: "Test Org",
    slug: `org-${randomUUID().slice(0, 8)}`,
    logo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
  stores.organizations.push(org);

  // Owner membership
  stores.orgMembers.push({
    id: randomUUID(),
    orgId: org.id,
    userId: ownerId,
    role: "owner",
    joinedAt: new Date(),
  });

  return org;
}

export function createTestWorkspace(
  orgId: string,
  creatorId: string,
  overrides: Partial<TestWorkspace> = {},
): TestWorkspace {
  const ws: TestWorkspace = {
    id: randomUUID(),
    orgId,
    name: "Test Workspace",
    slug: `ws-${randomUUID().slice(0, 8)}`,
    logo: null,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
  stores.workspaces.push(ws);

  // Creator becomes admin
  stores.workspaceMembers.push({
    id: randomUUID(),
    workspaceId: ws.id,
    userId: creatorId,
    role: "admin",
    invitedBy: null,
    joinedAt: new Date(),
  });

  return ws;
}

export function addOrgMember(
  orgId: string,
  userId: string,
  role: string,
): TestOrgMember {
  const member: TestOrgMember = {
    id: randomUUID(),
    orgId,
    userId,
    role,
    joinedAt: new Date(),
  };
  stores.orgMembers.push(member);
  return member;
}

export function addWsMember(
  workspaceId: string,
  userId: string,
  role: string,
): TestWsMember {
  const member: TestWsMember = {
    id: randomUUID(),
    workspaceId,
    userId,
    role,
    invitedBy: null,
    joinedAt: new Date(),
  };
  stores.workspaceMembers.push(member);
  return member;
}

/**
 * Create a session cookie value for a user, simulating a logged-in session.
 */
export function loginAsUser(user: TestUser): string {
  const sessionId = randomUUID();
  stores.sessions.set(sessionId, user);
  return `worknest.session_token=${sessionId}`;
}

// ── Cleanup ───────────────────────────────────────────────────────────

export function cleanup(): void {
  stores.users.length = 0;
  stores.organizations.length = 0;
  stores.orgMembers.length = 0;
  stores.workspaces.length = 0;
  stores.workspaceMembers.length = 0;
  stores.invitations.length = 0;
  stores.sessions.clear();
}

// ── Mock Auth ─────────────────────────────────────────────────────────

/**
 * Create a mock Auth object that resolves sessions from our in-memory store.
 * This simulates Better Auth's session management.
 */
export function createMockAuth() {
  return {
    api: {
      getSession: vi.fn(async ({ headers }: { headers: Headers | Record<string, string | undefined> }) => {
        let cookieValue: string | undefined | null;

        if (headers instanceof Headers) {
          cookieValue = headers.get("cookie");
        } else {
          cookieValue = headers?.cookie as string | undefined;
        }

        if (!cookieValue) return null;

        // Extract session token from cookie string
        const match = cookieValue.match(/worknest\.session_token=([^;]+)/);
        if (!match) return null;

        const sessionId = match[1];
        const user = stores.sessions.get(sessionId!);
        if (!user) return null;

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          session: { id: sessionId },
        };
      }),

      signUpEmail: vi.fn(async ({ body }: { body: { email: string; password: string; name: string } }) => {
        const existing = stores.users.find((u) => u.email === body.email);
        if (existing) return null;

        const user = createTestUser({
          email: body.email,
          name: body.name,
        });

        const sessionId = randomUUID();
        stores.sessions.set(sessionId, user);

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          headers: new Headers({
            "set-cookie": `worknest.session_token=${sessionId}; Path=/; HttpOnly`,
          }),
        };
      }),

      signInEmail: vi.fn(async ({ body }: { body: { email: string; password: string } }) => {
        const user = stores.users.find((u) => u.email === body.email);
        // In tests, any non-empty password works unless the user doesn't exist
        if (!user) return null;

        const sessionId = randomUUID();
        stores.sessions.set(sessionId, user);

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          headers: new Headers({
            "set-cookie": `worknest.session_token=${sessionId}; Path=/; HttpOnly`,
          }),
        };
      }),

      signOut: vi.fn(async ({ headers }: { headers: Headers | Record<string, string | undefined> }) => {
        let cookieValue: string | undefined | null;
        if (headers instanceof Headers) {
          cookieValue = headers.get("cookie");
        } else {
          cookieValue = headers?.cookie as string | undefined;
        }

        if (cookieValue) {
          const match = cookieValue.match(/worknest\.session_token=([^;]+)/);
          if (match?.[1]) {
            stores.sessions.delete(match[1]);
          }
        }
      }),
    },
  };
}

// ── Mock Database ─────────────────────────────────────────────────────

/**
 * Create a mock Database object that operates on in-memory stores.
 * This is a simplified mock; services that need complex queries
 * should have their methods mocked directly.
 */
export function createMockDb(): unknown {
  // Return a minimal mock. Individual test files will mock service methods
  // at a higher level, since the Drizzle query builder is hard to fully mock.
  return {};
}

// ── Build Test App ────────────────────────────────────────────────────

/**
 * Build a Fastify instance with the routes we want to test.
 * Callers pass in route registration functions.
 */
export async function buildTestApp(
  registerRoutes: (app: FastifyInstance, opts: { auth: ReturnType<typeof createMockAuth>; db: unknown }) => Promise<void>,
): Promise<{ app: FastifyInstance; auth: ReturnType<typeof createMockAuth> }> {
  const app = Fastify({ logger: false });

  await app.register(cookie);

  const auth = createMockAuth();
  const db = createMockDb();

  // Import and set error handler
  const { errorHandler } = await import("../src/lib/errors");
  app.setErrorHandler(errorHandler);

  await registerRoutes(app, { auth, db });

  await app.ready();

  return { app, auth };
}
