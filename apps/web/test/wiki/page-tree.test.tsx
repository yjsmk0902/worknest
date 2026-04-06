/**
 * PageTree component tests.
 *
 * Tests hierarchical page rendering, expand/collapse,
 * current page highlight, navigation, new page button,
 * empty state, and nested indentation.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────

const mockPost = vi.fn();
const mockPatch = vi.fn();

vi.mock("../../src/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    getList: vi.fn(),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: vi.fn(),
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

const mockToast = vi.fn();

vi.mock("@worknest/ui", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => {
  const icon = (testId: string) =>
    ({ className }: { className?: string }) =>
      React.createElement("span", { "data-testid": testId, className });
  return {
    Plus: icon("plus-icon"),
    Loader2: icon("loader-icon"),
    ChevronRight: icon("chevron-right-icon"),
    FileText: icon("file-text-icon"),
    GripVertical: icon("grip-vertical-icon"),
  };
});

// Track which pageId the router returns
let mockCurrentPageId: string | undefined;

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ pageId: mockCurrentPageId }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement("a", { href: to }, children),
}));

// Mock @dnd-kit/core
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "dnd-context" }, children),
  closestCenter: vi.fn(),
  KeyboardSensor: class KeyboardSensor {},
  PointerSensor: class PointerSensor {},
  useSensor: () => ({}),
  useSensors: () => [],
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

// ── Import component after mocks ────────────────────────────────────

import { PageTree } from "../../src/components/wiki/page-tree/page-tree";

// ── Fixtures ─────────────────────────────────────────────────────────

function makePage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `page-${Math.random().toString(36).slice(2, 8)}`,
    spaceId: "space-1",
    title: "Untitled",
    slug: "untitled",
    parentId: null,
    sortOrder: "a0",
    contentFormat: "tiptap",
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function renderTree(
  overrides: Partial<React.ComponentProps<typeof PageTree>> = {},
) {
  const defaultProps = {
    spaceId: "space-1",
    pages: [] as never[],
    isLoading: false,
    onPageSelect: vi.fn(),
    orgSlug: "org-1",
    wsSlug: "ws-1",
    ...overrides,
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    ...render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(PageTree, defaultProps as never),
      ),
    ),
    onPageSelect: defaultProps.onPageSelect,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("PageTree", () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockPatch.mockReset();
    mockToast.mockReset();
    mockCurrentPageId = undefined;
  });

  it("renders hierarchical pages", () => {
    const pages = [
      makePage({ id: "p-1", title: "Getting Started", parentId: null, sortOrder: "a0" }),
      makePage({ id: "p-2", title: "API Reference", parentId: null, sortOrder: "a1" }),
    ] as never[];

    renderTree({ pages });

    expect(screen.getByText("Getting Started")).toBeDefined();
    expect(screen.getByText("API Reference")).toBeDefined();
  });

  it("shows loading skeleton when isLoading is true", () => {
    const { container } = renderTree({ isLoading: true });

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(4);
  });

  it("shows empty state when no pages exist", () => {
    renderTree({ pages: [] });

    expect(screen.getByText("페이지가 없습니다")).toBeDefined();
  });

  it("highlights the current page", () => {
    mockCurrentPageId = "p-selected";

    const pages = [
      makePage({ id: "p-selected", title: "Selected Page", parentId: null, sortOrder: "a0" }),
      makePage({ id: "p-other", title: "Other Page", parentId: null, sortOrder: "a1" }),
    ] as never[];

    renderTree({ pages });

    // The selected page should have aria-selected=true
    const selectedItem = screen.getByText("Selected Page").closest('[role="treeitem"]');
    expect(selectedItem).toBeDefined();
    expect(selectedItem!.getAttribute("aria-selected")).toBe("true");

    const otherItem = screen.getByText("Other Page").closest('[role="treeitem"]');
    expect(otherItem).toBeDefined();
    expect(otherItem!.getAttribute("aria-selected")).toBe("false");
  });

  it("click on page calls onPageSelect", () => {
    const onPageSelect = vi.fn();
    const pages = [
      makePage({ id: "p-click", title: "Click me", parentId: null, sortOrder: "a0" }),
    ] as never[];

    renderTree({ pages, onPageSelect });

    const item = screen.getByText("Click me").closest('[role="treeitem"]');
    fireEvent.click(item!);

    expect(onPageSelect).toHaveBeenCalledWith("p-click");
  });

  it("'New Page' button is visible at the bottom", () => {
    renderTree({ pages: [] });

    expect(screen.getByText("새 페이지")).toBeDefined();
  });

  it("'New Page' button calls create API", async () => {
    mockPost.mockResolvedValue({
      id: "new-page",
      title: "새 페이지",
      slug: "page-1234",
    });

    const onPageSelect = vi.fn();
    renderTree({ pages: [], onPageSelect });

    fireEvent.click(screen.getByText("새 페이지"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/wiki-spaces/space-1/pages",
      expect.objectContaining({ title: "새 페이지" }),
    );
  });

  it("expand/collapse toggles children visibility", () => {
    const pages = [
      makePage({ id: "p-parent", title: "Parent Page", parentId: null, sortOrder: "a0" }),
      makePage({ id: "p-child", title: "Child Page", parentId: "p-parent", sortOrder: "a0" }),
    ] as never[];

    renderTree({ pages });

    // Initially children are hidden (not expanded)
    expect(screen.getByText("Parent Page")).toBeDefined();
    expect(screen.queryByText("Child Page")).toBeNull();

    // Click expand button
    const expandButton = screen.getByLabelText("Expand");
    fireEvent.click(expandButton);

    // Now the child should be visible
    expect(screen.getByText("Child Page")).toBeDefined();

    // Click collapse button
    const collapseButton = screen.getByLabelText("Collapse");
    fireEvent.click(collapseButton);

    // Child should be hidden again
    expect(screen.queryByText("Child Page")).toBeNull();
  });

  it("nested pages are indented via paddingLeft style", () => {
    const pages = [
      makePage({ id: "p-root", title: "Root", parentId: null, sortOrder: "a0" }),
      makePage({ id: "p-child", title: "Child", parentId: "p-root", sortOrder: "a0" }),
      makePage({ id: "p-grandchild", title: "Grandchild", parentId: "p-child", sortOrder: "a0" }),
    ] as never[];

    // Need to expand all nodes to see nesting
    const { container } = renderTree({ pages });

    // Expand root to show child
    const expandButtons = screen.getAllByLabelText("Expand");
    fireEvent.click(expandButtons[0]);

    // Now expand child to show grandchild
    const expandButtons2 = screen.getAllByLabelText("Expand");
    // The second expand button belongs to the child
    if (expandButtons2.length > 1) {
      fireEvent.click(expandButtons2[1]);
    } else if (expandButtons2.length === 1) {
      fireEvent.click(expandButtons2[0]);
    }

    // Verify all three are visible
    expect(screen.getByText("Root")).toBeDefined();
    expect(screen.getByText("Child")).toBeDefined();
    expect(screen.getByText("Grandchild")).toBeDefined();

    // Check indentation: root=level 0 (8px), child=level 1 (24px), grandchild=level 2 (40px)
    const rootItem = screen.getByText("Root").closest('[role="treeitem"]') as HTMLElement;
    const childItem = screen.getByText("Child").closest('[role="treeitem"]') as HTMLElement;
    const grandchildItem = screen.getByText("Grandchild").closest('[role="treeitem"]') as HTMLElement;

    // paddingLeft follows the formula: Math.min(level, 5) * 16 + 8
    expect(rootItem.style.paddingLeft).toBe("8px");
    expect(childItem.style.paddingLeft).toBe("24px");
    expect(grandchildItem.style.paddingLeft).toBe("40px");
  });

  it("renders tree role on the root container", () => {
    renderTree({ pages: [] });

    const tree = screen.getByRole("tree");
    expect(tree).toBeDefined();
  });
});
