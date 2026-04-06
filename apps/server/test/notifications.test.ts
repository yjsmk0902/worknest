/**
 * Notification route integration tests.
 *
 * Tests the full HTTP request lifecycle through real Fastify routes,
 * real service code, and an in-memory mock database.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  cleanup,
  createTestUser,
  createTestNotification,
  loginAsUser,
  buildTestApp,
  stores,
} from "./setup";

// ── Mock queue (addJob) ─────────────────────────────────────────────────

vi.mock("../src/lib/queue", () => ({
  addJob: vi.fn().mockResolvedValue(undefined),
}));

// ── Build a test app with notification routes ───────────────────────────

async function buildNotificationApp() {
  const { notificationRoutes } = await import("../src/routes/notifications");

  const { app, auth, db } = await buildTestApp(
    async (app, { auth, db }) => {
      await notificationRoutes(app, { auth: auth as never, db: db as never });
    },
    true, // use in-memory DB
  );

  return { app, auth, db };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setupUserWithNotifications() {
  const user = createTestUser({ name: "Notification User" });
  const cookie = loginAsUser(user);

  const n1 = createTestNotification({
    userId: user.id,
    type: "assigned",
    message: "You were assigned to an issue",
    createdAt: new Date("2026-04-01T10:00:00Z"),
  });
  const n2 = createTestNotification({
    userId: user.id,
    type: "commented",
    message: "Someone commented on your issue",
    createdAt: new Date("2026-04-01T11:00:00Z"),
  });
  const n3 = createTestNotification({
    userId: user.id,
    type: "mentioned",
    message: "You were mentioned in a comment",
    readAt: new Date("2026-04-01T12:00:00Z"),
    createdAt: new Date("2026-04-01T12:00:00Z"),
  });

  return { user, cookie, notifications: [n1, n2, n3] };
}

// ── Tests: GET list ─────────────────────────────────────────────────────

describe("GET /api/v1/my/notifications", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildNotificationApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("returns notifications for the current user", async () => {
    const { cookie, notifications } = setupUserWithNotifications();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/my/notifications",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(notifications.length);
    expect(body.pagination).toBeDefined();
  });

  it("returns empty list for user with no notifications", async () => {
    const user = createTestUser({ name: "No Notifications" });
    const cookie = loginAsUser(user);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/my/notifications",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
    expect(body.pagination.has_more).toBe(false);
  });

  it("supports pagination with limit", async () => {
    const user = createTestUser({ name: "Paginated User" });
    const cookie = loginAsUser(user);

    // Create many notifications
    for (let i = 0; i < 5; i++) {
      createTestNotification({
        userId: user.id,
        type: "commented",
        message: `Notification ${i}`,
        createdAt: new Date(Date.now() - i * 60000),
      });
    }

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/my/notifications?limit=3",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(3);
    expect(body.pagination.has_more).toBe(true);
    expect(body.pagination.next_cursor).toBeDefined();
  });

  it("returns 401 when not authenticated", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/my/notifications",
    });

    expect(res.statusCode).toBe(401);
  });
});

// ── Tests: GET unread count ─────────────────────────────────────────────

describe("GET /api/v1/my/notifications/unread-count", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildNotificationApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("returns the correct unread count", async () => {
    const { cookie } = setupUserWithNotifications();
    // n1, n2 are unread, n3 is read

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/my/notifications/unread-count",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.count).toBe(2);
  });

  it("returns 0 when all are read", async () => {
    const user = createTestUser({ name: "All Read" });
    const cookie = loginAsUser(user);
    createTestNotification({
      userId: user.id,
      readAt: new Date(),
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/my/notifications/unread-count",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.count).toBe(0);
  });
});

// ── Tests: PATCH mark as read ───────────────────────────────────────────

describe("PATCH /api/v1/notifications/:notificationId", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildNotificationApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("marks a notification as read and sets readAt", async () => {
    const { cookie, notifications } = setupUserWithNotifications();
    const notif = notifications[0]!;

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/notifications/${notif.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(notif.id);
    expect(body.data.readAt).not.toBeNull();
  });

  it("returns 404 when notification does not exist", async () => {
    const { cookie } = setupUserWithNotifications();
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/notifications/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it("cannot mark another user's notification as read", async () => {
    const { notifications } = setupUserWithNotifications();
    const otherUser = createTestUser({ name: "Other User" });
    const otherCookie = loginAsUser(otherUser);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/notifications/${notifications[0]!.id}`,
      headers: { cookie: otherCookie },
    });

    // The service uses userId in the WHERE clause, so for other user it won't find it
    expect(res.statusCode).toBe(404);
  });
});

// ── Tests: PATCH read-all ───────────────────────────────────────────────

describe("PATCH /api/v1/my/notifications/read-all", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildNotificationApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("marks all unread notifications as read", async () => {
    const { user, cookie } = setupUserWithNotifications();

    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/my/notifications/read-all",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.updated).toBe(2); // n1 and n2 were unread

    // Verify all are now read
    const unread = stores.notifications.filter(
      (n) => n.userId === user.id && n.readAt === null,
    );
    expect(unread).toHaveLength(0);
  });
});

// ── Tests: DELETE notification ──────────────────────────────────────────

describe("DELETE /api/v1/notifications/:notificationId", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildNotificationApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("deletes a notification and returns 200", async () => {
    const { cookie, notifications } = setupUserWithNotifications();
    const notif = notifications[0]!;

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/notifications/${notif.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.success).toBe(true);

    // Verify removed from store
    const found = stores.notifications.find((n) => n.id === notif.id);
    expect(found).toBeUndefined();
  });

  it("returns 404 when notification does not exist", async () => {
    const { cookie } = setupUserWithNotifications();
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/notifications/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it("cannot delete another user's notification", async () => {
    const { notifications } = setupUserWithNotifications();
    const otherUser = createTestUser({ name: "Other User" });
    const otherCookie = loginAsUser(otherUser);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/notifications/${notifications[0]!.id}`,
      headers: { cookie: otherCookie },
    });

    // Service uses userId in WHERE, so it returns false -> 404
    expect(res.statusCode).toBe(404);
  });
});
