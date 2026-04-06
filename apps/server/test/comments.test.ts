/**
 * Comment and reaction route integration tests.
 *
 * Tests the full HTTP request lifecycle through real Fastify routes,
 * real service code, and an in-memory mock database.
 * No service methods are mocked -- business logic is actually executed.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  cleanup,
  createTestUser,
  createTestWorkspace,
  createTestOrg,
  createTestProject,
  createTestIssue,
  createTestComment,
  createTestReaction,
  createTestWikiSpace,
  createTestWikiPage,
  addProjectMember,
  addWikiSpaceMember,
  loginAsUser,
  buildTestApp,
  stores,
} from "./setup";

// ── Mock WebSocket broadcasts ───────────────────────────────────────────

vi.mock("../src/websocket/comment-events", () => ({
  broadcastCommentCreated: vi.fn(),
  broadcastCommentUpdated: vi.fn(),
  broadcastCommentDeleted: vi.fn(),
  broadcastReactionToggled: vi.fn(),
}));

// ── Mock sanitize (pass-through) ────────────────────────────────────────

vi.mock("../src/lib/sanitize", () => ({
  sanitizeContent: vi.fn((content: unknown) => content),
}));

// ── Build a test app with comment routes ────────────────────────────────

async function buildCommentApp() {
  const { commentRoutes } = await import("../src/routes/comments");

  const { app, auth, db } = await buildTestApp(
    async (app, { auth, db }) => {
      await commentRoutes(app, { auth: auth as never, db: db as never });
    },
    true, // use in-memory DB
  );

  return { app, auth, db };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function setupProjectWithUser() {
  const user = createTestUser({ name: "Comment Admin" });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const project = createTestProject(ws.id, user.id, {
    name: "Comment Project",
    prefix: "CP",
  });
  const cookie = loginAsUser(user);
  return { user, org, ws, project, cookie };
}

function setupWikiWithUser() {
  const user = createTestUser({ name: "Wiki Admin" });
  const org = createTestOrg(user.id);
  const ws = createTestWorkspace(org.id, user.id);
  const space = createTestWikiSpace(ws.id, { createdBy: user.id });
  addWikiSpaceMember(space.id, user.id, "admin");
  const page = createTestWikiPage(space.id, { createdBy: user.id });
  const cookie = loginAsUser(user);
  return { user, org, ws, space, page, cookie };
}

const sampleContent = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
  ],
};

// ── Tests: POST issue comment ───────────────────────────────────────────

describe("POST /api/v1/issues/:issueId/comments", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCommentApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("creates a comment on an issue and returns 201", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id, { title: "Test Issue" });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/issues/${issue.id}/comments`,
      headers: { cookie },
      payload: { content: sampleContent },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.issueId).toBe(issue.id);
    expect(body.data.content).toEqual(sampleContent);
    expect(body.data.authorId).toBe(user.id);
    expect(body.data.parentId).toBeNull();
    expect(body.data.id).toBeDefined();
    expect(body.data.createdAt).toBeDefined();
  });

  it("succeeds with null content since content is z.unknown()", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/issues/${issue.id}/comments`,
      headers: { cookie },
      payload: { content: null },
    });

    // content is z.unknown(), so null is valid
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.content).toBeNull();
  });

  it("returns 403 when non-member tries to comment", async () => {
    const { project, user } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);
    const outsider = createTestUser({ name: "Outsider" });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/issues/${issue.id}/comments`,
      headers: { cookie: outsiderCookie },
      payload: { content: sampleContent },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    const { project, user } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/issues/${issue.id}/comments`,
      payload: { content: sampleContent },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ── Tests: POST page comment ────────────────────────────────────────────

describe("POST /api/v1/wiki-pages/:pageId/comments", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCommentApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("creates a comment on a wiki page and returns 201", async () => {
    const { user, page, cookie } = setupWikiWithUser();

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/wiki-pages/${page.id}/comments`,
      headers: { cookie },
      payload: { content: sampleContent },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.pageId).toBe(page.id);
    expect(body.data.content).toEqual(sampleContent);
    expect(body.data.authorId).toBe(user.id);
  });

  it("returns 403 when non-space-member tries to comment", async () => {
    const { page } = setupWikiWithUser();
    const outsider = createTestUser({ name: "Outsider" });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/wiki-pages/${page.id}/comments`,
      headers: { cookie: outsiderCookie },
      payload: { content: sampleContent },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ── Tests: POST reply (flat threading) ──────────────────────────────────

describe("POST /api/v1/issues/:issueId/comments (replies)", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCommentApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("creates a reply to a top-level comment and returns 201", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);
    const parent = createTestComment({
      issueId: issue.id,
      authorId: user.id,
      content: sampleContent,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/issues/${issue.id}/comments`,
      headers: { cookie },
      payload: { content: sampleContent, parentId: parent.id },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.parentId).toBe(parent.id);
  });

  it("rejects nested reply (reply to a reply) with 400", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);
    const grandparent = createTestComment({
      issueId: issue.id,
      authorId: user.id,
      content: sampleContent,
    });
    const parent = createTestComment({
      issueId: issue.id,
      authorId: user.id,
      parentId: grandparent.id,
      content: sampleContent,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/issues/${issue.id}/comments`,
      headers: { cookie },
      payload: { content: sampleContent, parentId: parent.id },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ── Tests: GET issue comments ───────────────────────────────────────────

describe("GET /api/v1/issues/:issueId/comments", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCommentApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("lists comments with reactions for an issue", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);
    const comment = createTestComment({
      issueId: issue.id,
      authorId: user.id,
      content: sampleContent,
    });
    createTestReaction({
      commentId: comment.id,
      userId: user.id,
      emoji: "👍",
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/issues/${issue.id}/comments`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(comment.id);
    expect(body.data[0].reactions).toHaveLength(1);
    expect(body.data[0].reactions[0].emoji).toBe("👍");
  });

  it("returns empty list when issue has no comments", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/issues/${issue.id}/comments`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(0);
  });

  it("returns 403 for non-members", async () => {
    const { project, user } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);
    const outsider = createTestUser({ name: "Outsider" });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/issues/${issue.id}/comments`,
      headers: { cookie: outsiderCookie },
    });

    expect(res.statusCode).toBe(403);
  });

  it("does not return soft-deleted comments", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);
    createTestComment({
      issueId: issue.id,
      authorId: user.id,
      content: sampleContent,
      deletedAt: new Date(),
    });
    createTestComment({
      issueId: issue.id,
      authorId: user.id,
      content: sampleContent,
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/issues/${issue.id}/comments`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
  });
});

// ── Tests: GET page comments ────────────────────────────────────────────

describe("GET /api/v1/wiki-pages/:pageId/comments", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCommentApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("lists comments for a wiki page", async () => {
    const { user, page, cookie } = setupWikiWithUser();
    createTestComment({
      pageId: page.id,
      authorId: user.id,
      content: sampleContent,
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/wiki-pages/${page.id}/comments`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].pageId).toBe(page.id);
  });

  it("returns 403 for non-space-members", async () => {
    const { page } = setupWikiWithUser();
    const outsider = createTestUser({ name: "Outsider" });
    const outsiderCookie = loginAsUser(outsider);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/wiki-pages/${page.id}/comments`,
      headers: { cookie: outsiderCookie },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ── Tests: PATCH comment ────────────────────────────────────────────────

describe("PATCH /api/v1/comments/:commentId", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCommentApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("updates a comment (author only)", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);
    const comment = createTestComment({
      issueId: issue.id,
      authorId: user.id,
      content: sampleContent,
    });

    const newContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Updated" }] },
      ],
    };

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/comments/${comment.id}`,
      headers: { cookie },
      payload: { content: newContent },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.content).toEqual(newContent);
  });

  it("returns 403 when non-author tries to update", async () => {
    const { project, user } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);
    const comment = createTestComment({
      issueId: issue.id,
      authorId: user.id,
      content: sampleContent,
    });

    const otherUser = createTestUser({ name: "Other User" });
    addProjectMember(project.id, otherUser.id, "member");
    const otherCookie = loginAsUser(otherUser);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/comments/${comment.id}`,
      headers: { cookie: otherCookie },
      payload: { content: sampleContent },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when comment does not exist", async () => {
    const { cookie } = setupProjectWithUser();
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/comments/${fakeId}`,
      headers: { cookie },
      payload: { content: sampleContent },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ── Tests: DELETE comment ───────────────────────────────────────────────

describe("DELETE /api/v1/comments/:commentId", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCommentApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("soft deletes a comment and returns 204", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);
    const comment = createTestComment({
      issueId: issue.id,
      authorId: user.id,
      content: sampleContent,
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/comments/${comment.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);

    // Verify soft delete: deletedAt should be set
    const found = stores.comments.find((c) => c.id === comment.id);
    expect(found).toBeDefined();
    expect(found!.deletedAt).not.toBeNull();
  });

  it("returns 403 when non-author tries to delete", async () => {
    const { project, user } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);
    const comment = createTestComment({
      issueId: issue.id,
      authorId: user.id,
      content: sampleContent,
    });

    const otherUser = createTestUser({ name: "Other User" });
    addProjectMember(project.id, otherUser.id, "member");
    const otherCookie = loginAsUser(otherUser);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/comments/${comment.id}`,
      headers: { cookie: otherCookie },
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when comment does not exist", async () => {
    const { cookie } = setupProjectWithUser();
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/comments/${fakeId}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ── Tests: POST reaction toggle ─────────────────────────────────────────

describe("POST /api/v1/comments/:commentId/reactions", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCommentApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("adds a reaction and returns 200 with added=true", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);
    const comment = createTestComment({
      issueId: issue.id,
      authorId: user.id,
      content: sampleContent,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/comments/${comment.id}/reactions`,
      headers: { cookie },
      payload: { emoji: "👍" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.added).toBe(true);
    expect(body.data.emoji).toBe("👍");
  });

  it("toggles off an existing reaction (added=false)", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);
    const comment = createTestComment({
      issueId: issue.id,
      authorId: user.id,
      content: sampleContent,
    });
    createTestReaction({
      commentId: comment.id,
      userId: user.id,
      emoji: "👍",
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/comments/${comment.id}/reactions`,
      headers: { cookie },
      payload: { emoji: "👍" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.added).toBe(false);
    expect(body.data.emoji).toBe("👍");
  });

  it("returns 400 when emoji is not allowed", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);
    const comment = createTestComment({
      issueId: issue.id,
      authorId: user.id,
      content: sampleContent,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/comments/${comment.id}/reactions`,
      headers: { cookie },
      payload: { emoji: "not-an-emoji" },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ── Tests: DELETE reaction ──────────────────────────────────────────────

describe("DELETE /api/v1/comments/:commentId/reactions/:emoji", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    cleanup();
    const result = await buildCommentApp();
    app = result.app;
  });

  afterEach(async () => {
    await app.close();
    cleanup();
  });

  it("removes a reaction and returns 204", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);
    const comment = createTestComment({
      issueId: issue.id,
      authorId: user.id,
      content: sampleContent,
    });
    createTestReaction({
      commentId: comment.id,
      userId: user.id,
      emoji: "👍",
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/comments/${comment.id}/reactions/${encodeURIComponent("👍")}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);
  });

  it("returns 404 when reaction does not exist", async () => {
    const { project, user, cookie } = setupProjectWithUser();
    const issue = createTestIssue(project.id, user.id);
    const comment = createTestComment({
      issueId: issue.id,
      authorId: user.id,
      content: sampleContent,
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/comments/${comment.id}/reactions/${encodeURIComponent("👍")}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
  });
});
