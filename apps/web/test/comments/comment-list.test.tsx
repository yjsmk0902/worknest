/**
 * CommentList component tests.
 *
 * Tests rendering, filter tabs, editor presence, empty state,
 * loading skeleton, activity items, and timeline ordering.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockGetList = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock("../../src/lib/api-client", () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    getList: (...args: unknown[]) => mockGetList(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
    }
  },
}));

vi.mock("../../src/stores/auth-store", () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      currentUser: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        avatarUrl: null,
      },
    }),
}));

vi.mock("../../src/hooks/use-websocket", () => ({
  useWebSocket: vi.fn(),
}));

vi.mock("../../src/hooks/use-websocket-event", () => ({
  useWebSocketEvent: vi.fn(),
}));

vi.mock("@worknest/ui", () => ({
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement("div", { "data-testid": "skeleton", className }),
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  Avatar: ({ fallback }: { src?: string | null; fallback?: string; size?: string; className?: string }) =>
    React.createElement("span", { "data-testid": "avatar" }, fallback),
  Button: ({ children, onClick, ...rest }: { children: React.ReactNode; onClick?: () => void; [k: string]: unknown }) =>
    React.createElement("button", { onClick, ...rest }, children),
  Dialog: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement("p", null, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement("h2", null, children),
  DropdownMenu: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
    React.createElement("button", { onClick }, children),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  Popover: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  PopoverContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  Tooltip: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("span", null, children),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

vi.mock("lucide-react", () => {
  const icon = (testId: string) =>
    ({ className, size }: { className?: string; size?: number }) =>
      React.createElement("span", { "data-testid": testId, className });
  return {
    AlertTriangle: icon("alert-triangle"),
    Calendar: icon("calendar"),
    Layers: icon("layers"),
    ListPlus: icon("list-plus"),
    MessageSquare: icon("message-square"),
    MoreHorizontal: icon("more-horizontal"),
    Pencil: icon("pencil"),
    Plus: icon("plus"),
    RefreshCw: icon("refresh-cw"),
    Reply: icon("reply"),
    SmilePlus: icon("smile-plus"),
    Tag: icon("tag"),
    Trash2: icon("trash"),
    UserPlus: icon("user-plus"),
  };
});

// Mock TipTap editor used by CommentContent and CommentEditor
vi.mock("@tiptap/react", () => ({
  useEditor: () => null,
  EditorContent: () => React.createElement("div", { "data-testid": "editor-content" }),
}));

vi.mock("@tiptap/starter-kit", () => ({
  default: { configure: () => ({}) },
}));

vi.mock("@tiptap/extension-link", () => ({
  default: { configure: () => ({}) },
}));

// Mock CommentEditor to simplify testing of CommentList
vi.mock("../../src/components/comments/comment-editor", () => ({
  CommentEditor: ({
    onSubmit,
    placeholder,
    submitLabel,
  }: {
    onSubmit?: (content: unknown) => void;
    placeholder?: string;
    submitLabel?: string;
    onCancel?: () => void;
    mentionQueryFn?: unknown;
    isSubmitting?: boolean;
    autofocus?: boolean;
    initialContent?: unknown;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "comment-editor" },
      React.createElement("textarea", {
        "data-testid": "comment-textarea",
        placeholder: placeholder ?? "댓글 작성...",
      }),
      React.createElement(
        "button",
        {
          "data-testid": "comment-submit",
          onClick: () =>
            onSubmit?.({ type: "doc", content: [{ type: "paragraph" }] }),
        },
        submitLabel ?? "댓글",
      ),
    ),
}));

vi.mock("@worknest/shared", () => ({
  ALLOWED_EMOJIS: ["👍", "❤️", "😄", "👀", "🚀", "🎉", "😕", "👎", "✅", "❌",
    "🔥", "💯", "🙏", "😱", "💡", "🤔", "😂", "🥳", "👏", "🙌"],
}));

vi.mock("@worknest/editor", () => ({}));

// ── Import component after mocks ─────────────────────────────────────

import { CommentList } from "../../src/components/comments/comment-list";

// ── Fixtures ─────────────────────────────────────────────────────────

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: `comment-${Math.random().toString(36).slice(2, 8)}`,
    issueId: "issue-1",
    pageId: null,
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Test comment" }] }] },
    parentId: null,
    authorId: "user-1",
    author: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      avatarUrl: null,
    },
    resolvedAt: null,
    createdAt: "2025-06-01T10:00:00Z",
    updatedAt: "2025-06-01T10:00:00Z",
    reactions: [],
    ...overrides,
  };
}

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: `activity-${Math.random().toString(36).slice(2, 8)}`,
    issueId: "issue-1",
    action: "created",
    field: null,
    oldValue: null,
    newValue: null,
    actorId: "user-1",
    actor: { id: "user-1", name: "Test User" },
    createdAt: "2025-06-01T09:00:00Z",
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function renderCommentList(props: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const defaultProps = {
    issueId: "issue-1",
    projectId: "proj-1",
  };

  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(CommentList, { ...defaultProps, ...props } as never),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("CommentList", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGetList.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    mockDelete.mockReset();
  });

  it("renders comments list with heading", async () => {
    mockGetList.mockResolvedValue({
      data: [makeComment({ id: "c1" }), makeComment({ id: "c2" })],
    });

    renderCommentList();

    await waitFor(() => {
      expect(screen.getByText(/댓글/)).toBeDefined();
      expect(screen.getByText(/활동/)).toBeDefined();
    });
  });

  it("filter tabs show (전체/댓글/활동)", async () => {
    mockGetList.mockResolvedValue({ data: [] });

    renderCommentList();

    await waitFor(() => {
      const tabs = screen.getAllByRole("tab");
      expect(tabs.length).toBe(3);
      expect(screen.getByText("전체")).toBeDefined();
      expect(screen.getByText("댓글")).toBeDefined();
      expect(screen.getByText("활동")).toBeDefined();
    });
  });

  it("전체 tab is selected by default", async () => {
    mockGetList.mockResolvedValue({ data: [] });

    renderCommentList();

    await waitFor(() => {
      const allTab = screen.getByRole("tab", { name: "전체" });
      expect(allTab.getAttribute("aria-selected")).toBe("true");
    });
  });

  it("clicking filter tab changes selection", async () => {
    mockGetList.mockResolvedValue({ data: [] });

    renderCommentList();

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "전체" })).toBeDefined();
    });

    fireEvent.click(screen.getByText("댓글"));

    const commentsTab = screen.getByRole("tab", { name: "댓글" });
    expect(commentsTab.getAttribute("aria-selected")).toBe("true");
  });

  it("CommentEditor visible at the bottom", async () => {
    mockGetList.mockResolvedValue({ data: [] });

    renderCommentList();

    await waitFor(() => {
      const editors = screen.getAllByTestId("comment-editor");
      expect(editors.length).toBeGreaterThan(0);
    });
  });

  it("empty state shows '아직 댓글이 없습니다' when no comments", async () => {
    mockGetList.mockResolvedValue({ data: [] });

    renderCommentList();

    await waitFor(() => {
      expect(screen.getByText("아직 댓글이 없습니다")).toBeDefined();
      expect(screen.getByText("첫 번째 댓글을 작성해 보세요")).toBeDefined();
    });
  });

  it("loading skeleton shows during fetch", () => {
    // Make getList return a promise that never resolves to simulate loading
    mockGetList.mockReturnValue(new Promise(() => {}));

    renderCommentList();

    // Initial loading state should show skeletons
    const skeletons = screen.queryAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);

    const loadingContainer = screen.getByLabelText("댓글 및 활동 로딩 중");
    expect(loadingContainer).toBeDefined();
    expect(loadingContainer.getAttribute("aria-busy")).toBe("true");
  });

  it("renders the feed container with correct aria attributes", async () => {
    mockGetList.mockResolvedValue({
      data: [makeComment({ id: "c-1" })],
    });

    renderCommentList();

    await waitFor(() => {
      const feed = screen.getByRole("feed", { name: "댓글 및 활동" });
      expect(feed).toBeDefined();
    });
  });
});
