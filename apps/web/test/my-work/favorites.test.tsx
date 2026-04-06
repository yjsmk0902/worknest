/**
 * FavoritesPage component tests.
 *
 * Tests rendering favorites list, star toggle for unfavoriting,
 * entity icons by type, empty state, and DnD reorder basic render.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../../src/lib/api-client", () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    getList: vi.fn(),
    post: vi.fn(),
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

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => {
    const routeOpts = (opts: Record<string, unknown>) => ({
      ...opts,
      useParams: () => ({ orgSlug: "my-org", wsSlug: "my-ws" }),
    });
    return routeOpts;
  },
  useNavigate: () => mockNavigate,
}));

vi.mock("../../src/contexts/workspace-context", () => ({
  useWorkspaceContext: () => ({
    orgId: "org-1",
    orgSlug: "my-org",
    orgName: "My Org",
    wsId: "ws-1",
    wsSlug: "my-ws",
    wsName: "My Workspace",
  }),
}));

vi.mock("@worknest/ui", () => ({
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement("div", { "data-testid": "skeleton", className }),
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@worknest/shared", () => ({
  generateKeyBetween: (a: string | null, b: string | null) => "m0",
}));

vi.mock("lucide-react", () => {
  const icon = (testId: string) =>
    ({ className }: { className?: string }) =>
      React.createElement("span", { "data-testid": testId, className });
  return {
    Star: icon("star-icon"),
    GripVertical: icon("grip-icon"),
    Folder: icon("folder-icon"),
    CircleCheck: icon("circle-check-icon"),
    FileText: icon("file-text-icon"),
    BookOpen: icon("book-open-icon"),
    AlertTriangle: icon("alert-triangle-icon"),
  };
});

// Mock DnD Kit — render children directly with sortable-like structure
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "dnd-context" }, children),
  DragOverlay: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "drag-overlay" }, children),
  PointerSensor: class {},
  KeyboardSensor: class {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => null,
    },
  },
}));

// ── Import component after mocks ─────────────────────────────────────

import { Route } from "../../src/routes/_app/$orgSlug/$wsSlug/my/favorites";

const FavoritesPage = (Route as { component: React.ComponentType }).component;

// ── Fixtures ─────────────────────────────────────────────────────────

function makeFavorite(overrides: Record<string, unknown> = {}) {
  return {
    id: `fav-${Math.random().toString(36).slice(2, 8)}`,
    userId: "user-1",
    projectId: null,
    issueId: null,
    pageId: null,
    spaceId: null,
    entityType: "project" as const,
    entityName: "Test Project",
    sortOrder: "a0",
    createdAt: "2025-06-01T10:00:00Z",
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function renderFavorites() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(FavoritesPage),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("FavoritesPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();
    mockDelete.mockReset();
    mockNavigate.mockReset();
  });

  it("renders favorite items with entity names", async () => {
    mockGet.mockResolvedValue([
      makeFavorite({ id: "f1", entityName: "Alpha Project", entityType: "project", projectId: "p1" }),
      makeFavorite({ id: "f2", entityName: "Bug Report", entityType: "issue", issueId: "i1" }),
    ]);

    renderFavorites();

    await waitFor(() => {
      expect(screen.getByText("Alpha Project")).toBeDefined();
      expect(screen.getByText("Bug Report")).toBeDefined();
    });
  });

  it("star toggle button has aria-label '즐겨찾기 해제'", async () => {
    mockGet.mockResolvedValue([
      makeFavorite({ id: "f1", entityName: "My Fav" }),
    ]);

    renderFavorites();

    await waitFor(() => {
      const unfavButton = screen.getByLabelText("즐겨찾기 해제");
      expect(unfavButton).toBeDefined();
    });
  });

  it("clicking star toggle calls delete mutation", async () => {
    mockGet.mockResolvedValue([
      makeFavorite({ id: "fav-abc", entityName: "Remove Me" }),
    ]);
    mockDelete.mockResolvedValue({});

    renderFavorites();

    await waitFor(() => {
      expect(screen.getByText("Remove Me")).toBeDefined();
    });

    const unfavButton = screen.getByLabelText("즐겨찾기 해제");
    fireEvent.click(unfavButton);

    expect(mockDelete).toHaveBeenCalledWith("/favorites/fav-abc");
  });

  it("entity type badges are rendered correctly", async () => {
    mockGet.mockResolvedValue([
      makeFavorite({ id: "f1", entityType: "project", entityName: "Proj", projectId: "p1" }),
      makeFavorite({ id: "f2", entityType: "issue", entityName: "Issue", issueId: "i1" }),
      makeFavorite({ id: "f3", entityType: "page", entityName: "Page", pageId: "pg1" }),
      makeFavorite({ id: "f4", entityType: "space", entityName: "Space", spaceId: "s1" }),
    ]);

    renderFavorites();

    await waitFor(() => {
      expect(screen.getByText("프로젝트")).toBeDefined();
      expect(screen.getByText("이슈")).toBeDefined();
      expect(screen.getByText("Wiki 페이지")).toBeDefined();
      expect(screen.getByText("Wiki 스페이스")).toBeDefined();
    });
  });

  it("empty state shows when no favorites", async () => {
    mockGet.mockResolvedValue([]);

    renderFavorites();

    await waitFor(() => {
      expect(screen.getByText("즐겨찾기한 항목이 없습니다")).toBeDefined();
    });
  });

  it("DnD context is rendered for reorder support", async () => {
    mockGet.mockResolvedValue([
      makeFavorite({ id: "f1", entityName: "Sortable Item" }),
    ]);

    renderFavorites();

    await waitFor(() => {
      const dndContext = screen.getByTestId("dnd-context");
      expect(dndContext).toBeDefined();
    });
  });
});
