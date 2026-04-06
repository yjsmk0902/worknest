/**
 * File route integration tests.
 *
 * Tests file metadata retrieval, listing, and deletion through real
 * Fastify routes, real service code, and an in-memory mock database.
 *
 * Note: Multipart upload is hard to test with app.inject, so upload
 * tests are omitted. We focus on GET, DELETE, and listing endpoints.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  cleanup,
  createTestUser,
  createTestWorkspace,
  createTestOrg,
  createTestFile,
  createTestWikiSpace,
  createTestWikiPage,
  addWikiSpaceMember,
  loginAsUser,
  buildTestApp,
  stores,
} from "./setup";

// ── Mock file system and queue ──────────────────────────────────────────

vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    unlinkSync: vi.fn(),
  };
});

vi.mock("../src/lib/queue", () => ({
  addJob: vi.fn(),
}));

// ── Build a test app with file routes ───────────────────────────────────

async function buildFileApp() {
  const { fileRoutes } = await import("../src/routes/files");

  const { app, auth, db } = await buildTestApp(
    async (app, { auth, db }) => {
      await fileRoutes(app, { auth: auth as never, db: db as never });
    },
    true, // use in-memory DB
  );

  return { app, auth, db };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setupWithUser() {
  const user = createTestUser({ name: "File User" });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const cookie = loginAsUser(user);
  return { user, org, ws, cookie };
}

// ── Tests: File Retrieval ───────────────────────────────────────────────

describe("GET /api/v1/files/:fileId", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildFileApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("returns a file by ID", async () => {
    const { user, cookie } = setupWithUser();
    const file = createTestFile({
      name: "readme.md",
      mimeType: "text/markdown",
      size: 2048,
      uploadedBy: user.id,
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/files/${file.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(file.id);
    expect(body.data.name).toBe("readme.md");
    expect(body.data.mimeType).toBe("text/markdown");
    expect(body.data.size).toBe(2048);
  });

  it("returns 404 for non-existent file", async () => {
    const { cookie } = setupWithUser();
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/files/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    const { user } = setupWithUser();
    const file = createTestFile({ uploadedBy: user.id });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/files/${file.id}`,
    });

    expect(res.statusCode).toBe(401);
  });
});

// ── Tests: File Deletion ────────────────────────────────────────────────

describe("DELETE /api/v1/files/:fileId", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildFileApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("deletes a file and returns 204", async () => {
    const { user, cookie } = setupWithUser();
    const file = createTestFile({
      name: "to-delete.txt",
      uploadedBy: user.id,
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/files/${file.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    const found = stores.files.find((f) => f.id === file.id);
    expect(found).toBeUndefined();
  });

  it("returns 404 for non-existent file", async () => {
    const { cookie } = setupWithUser();
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/files/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 403 when non-uploader tries to delete", async () => {
    const { user } = setupWithUser();
    const file = createTestFile({
      name: "owned.txt",
      uploadedBy: user.id,
    });
    const otherUser = createTestUser({ name: "Other" });
    const otherCookie = loginAsUser(otherUser);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/files/${file.id}`,
      headers: { cookie: otherCookie },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ── Tests: File Listing by Page ─────────────────────────────────────────

describe("GET /api/v1/wiki-pages/:pageId/files", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildFileApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("returns files for a page", async () => {
    const { user, ws, cookie } = setupWithUser();
    const space = createTestWikiSpace(ws.id, { name: "File Space" });
    addWikiSpaceMember(space.id, user.id, "editor");
    const page = createTestWikiPage(space.id, { title: "File Page" });

    createTestFile({
      name: "image.png",
      pageId: page.id,
      uploadedBy: user.id,
    });
    createTestFile({
      name: "doc.pdf",
      pageId: page.id,
      uploadedBy: user.id,
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/wiki-pages/${page.id}/files`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(2);
    expect(body.pagination.has_more).toBe(false);
  });

  it("returns empty list when page has no files", async () => {
    const { user, ws, cookie } = setupWithUser();
    const space = createTestWikiSpace(ws.id, { name: "Empty File Space" });
    addWikiSpaceMember(space.id, user.id, "editor");
    const page = createTestWikiPage(space.id, { title: "No Files" });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/wiki-pages/${page.id}/files`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
  });

  it("does not return files from other pages", async () => {
    const { user, ws, cookie } = setupWithUser();
    const space = createTestWikiSpace(ws.id, { name: "Multi Page" });
    addWikiSpaceMember(space.id, user.id, "editor");
    const page1 = createTestWikiPage(space.id, { title: "Page 1" });
    const page2 = createTestWikiPage(space.id, { title: "Page 2" });

    createTestFile({
      name: "page1-file.txt",
      pageId: page1.id,
      uploadedBy: user.id,
    });
    createTestFile({
      name: "page2-file.txt",
      pageId: page2.id,
      uploadedBy: user.id,
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/wiki-pages/${page1.id}/files`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("page1-file.txt");
  });
});
