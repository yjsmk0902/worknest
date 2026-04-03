/**
 * ViewToolbar component tests.
 *
 * Tests view tab rendering, active tab highlighting, sort controls,
 * issue count display, and navigation between views.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Router mock setup ────────────────────────────────────────────────

let mockPathname = "/org/ws/projects/proj-1/issues";
let mockSearch: Record<string, unknown> = {};
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => mockSearch,
  useLocation: () => ({
    pathname: mockPathname,
  }),
  useParams: () => ({
    orgSlug: "org",
    wsSlug: "ws",
    projectId: "proj-1",
  }),
}));

vi.mock("../../src/lib/api-client", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue([]),
    getList: vi.fn().mockResolvedValue({ data: [], pagination: { next_cursor: null, has_more: false } }),
    post: vi.fn(),
    patch: vi.fn(),
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

vi.mock("../../src/contexts/project-context", () => ({
  useProjectContext: () => ({
    projectId: "proj-1",
    projectName: "Test Project",
    prefix: "WN",
    wsId: "ws-1",
  }),
}));

vi.mock("@worknest/ui", () => ({
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => React.createElement("button", { onClick, ...rest }, children),
  Separator: ({ orientation }: { orientation?: string }) =>
    React.createElement("hr", { "data-orientation": orientation }),
  DropdownMenu: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "dropdown" }, children),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "dropdown-content" }, children),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) =>
    React.createElement("span", null, children),
  DropdownMenuSeparator: () => React.createElement("hr"),
  DropdownMenuRadioGroup: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange?: (value: string) => void;
  }) =>
    React.createElement("div", { "data-value": value, "data-testid": "radio-group" }, children),
  DropdownMenuRadioItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) =>
    React.createElement("button", { "data-value": value, "data-testid": "radio-item" }, children),
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  List: ({ className }: { className?: string }) =>
    React.createElement("span", { "data-testid": "list-icon", className }),
  Columns3: ({ className }: { className?: string }) =>
    React.createElement("span", { "data-testid": "columns3-icon", className }),
  ArrowUpDown: ({ className }: { className?: string }) =>
    React.createElement("span", { "data-testid": "arrow-updown-icon", className }),
  Filter: ({ className }: { className?: string }) =>
    React.createElement("span", { "data-testid": "filter-icon", className }),
  Bookmark: ({ className }: { className?: string }) =>
    React.createElement("span", { "data-testid": "bookmark-icon", className }),
  Plus: ({ className }: { className?: string }) =>
    React.createElement("span", { "data-testid": "plus-icon", className }),
  MoreHorizontal: ({ className }: { className?: string }) =>
    React.createElement("span", null),
  Trash2: ({ className }: { className?: string }) =>
    React.createElement("span", null),
}));

// Mock sub-components used by ViewToolbar
vi.mock("../../src/components/issues/filter-builder/filter-popover", () => ({
  FilterPopover: ({
    filterCount,
    onApply,
  }: {
    filterCount: number;
    onApply: (filter: unknown) => void;
  }) =>
    React.createElement(
      "button",
      { "data-testid": "filter-popover", "data-count": filterCount },
      "필터",
    ),
}));

vi.mock("../../src/components/views/saved-views-dropdown", () => ({
  SavedViewsDropdown: ({ currentViewType }: { currentViewType: string }) =>
    React.createElement(
      "button",
      { "data-testid": "saved-views", "data-view-type": currentViewType },
      "뷰",
    ),
}));

// ── Import component after mocks ─────────────────────────────────────

import { ViewToolbar } from "../../src/components/issues/view-toolbar";

// ── Helpers ───────────────────────────────────────────────────────────

function renderToolbar(overrides: { totalCount?: number } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(ViewToolbar, overrides),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("ViewToolbar", () => {
  beforeEach(() => {
    mockPathname = "/org/ws/projects/proj-1/issues";
    mockSearch = {};
    mockNavigate.mockClear();
  });

  it("renders view tabs (리스트, 보드)", () => {
    renderToolbar();

    expect(screen.getByText("리스트")).toBeDefined();
    expect(screen.getByText("보드")).toBeDefined();
  });

  it("highlights list tab as active when on issues route", () => {
    mockPathname = "/org/ws/projects/proj-1/issues";
    renderToolbar();

    const listTab = screen.getByRole("tab", { name: /리스트/ });
    expect(listTab.getAttribute("aria-selected")).toBe("true");

    const boardTab = screen.getByRole("tab", { name: /보드/ });
    expect(boardTab.getAttribute("aria-selected")).toBe("false");
  });

  it("highlights board tab as active when on board route", () => {
    mockPathname = "/org/ws/projects/proj-1/board";
    renderToolbar();

    const boardTab = screen.getByRole("tab", { name: /보드/ });
    expect(boardTab.getAttribute("aria-selected")).toBe("true");

    const listTab = screen.getByRole("tab", { name: /리스트/ });
    expect(listTab.getAttribute("aria-selected")).toBe("false");
  });

  it("clicking board tab navigates to board view", () => {
    mockPathname = "/org/ws/projects/proj-1/issues";
    renderToolbar();

    const boardTab = screen.getByRole("tab", { name: /보드/ });
    fireEvent.click(boardTab);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.stringContaining("board"),
      }),
    );
  });

  it("clicking list tab navigates to list view from board", () => {
    mockPathname = "/org/ws/projects/proj-1/board";
    renderToolbar();

    const listTab = screen.getByRole("tab", { name: /리스트/ });
    fireEvent.click(listTab);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.stringContaining("issues"),
      }),
    );
  });

  it("does not navigate when clicking the already active tab", () => {
    mockPathname = "/org/ws/projects/proj-1/issues";
    renderToolbar();

    const listTab = screen.getByRole("tab", { name: /리스트/ });
    fireEvent.click(listTab);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("displays issue count when totalCount is provided", () => {
    renderToolbar({ totalCount: 42 });

    expect(screen.getByText("42개 이슈")).toBeDefined();
  });

  it("does not display issue count when totalCount is undefined", () => {
    renderToolbar({ totalCount: undefined });

    expect(screen.queryByText(/개 이슈/)).toBeNull();
  });

  it("has toolbar role and correct aria-label", () => {
    renderToolbar();

    const toolbar = screen.getByRole("toolbar", { name: "이슈 뷰 제어" });
    expect(toolbar).toBeDefined();
  });

  it("has tablist role for view tabs", () => {
    renderToolbar();

    const tablist = screen.getByRole("tablist", { name: "뷰 전환" });
    expect(tablist).toBeDefined();
  });

  it("renders sort dropdown with sort options", () => {
    renderToolbar();

    // Sort radio items are rendered
    const radioItems = screen.getAllByTestId("radio-item");
    expect(radioItems.length).toBeGreaterThan(0);

    // Check sort option labels
    expect(screen.getByText("생성일")).toBeDefined();
    expect(screen.getByText("수정일")).toBeDefined();
    expect(screen.getByText("우선순위")).toBeDefined();
    expect(screen.getByText("마감일")).toBeDefined();
    expect(screen.getByText("수동")).toBeDefined();
  });

  it("renders order options (ascending/descending)", () => {
    renderToolbar();

    expect(screen.getByText(/오름차순/)).toBeDefined();
    expect(screen.getByText(/내림차순/)).toBeDefined();
  });

  it("issue count has aria-live for accessibility", () => {
    renderToolbar({ totalCount: 10 });

    const countElement = screen.getByText("10개 이슈");
    expect(countElement.getAttribute("aria-live")).toBe("polite");
  });
});
