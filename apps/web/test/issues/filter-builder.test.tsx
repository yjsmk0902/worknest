/**
 * Filter builder tests.
 *
 * Tests the useIssueFilters hook logic (searchToFilters / filtersToSearch)
 * and FilterBar component rendering.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Router mock setup ────────────────────────────────────────────────

let mockSearch: Record<string, unknown> = {};
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearch: () => mockSearch,
  useLocation: () => ({
    pathname: "/org/ws/projects/proj-1/issues",
  }),
  useParams: () => ({
    orgSlug: "org",
    wsSlug: "ws",
    projectId: "proj-1",
  }),
  Link: ({
    children,
    to,
  }: {
    children: React.ReactNode;
    to: string;
  }) => React.createElement("a", { href: to }, children),
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
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  Popover: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  PopoverContent: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
}));

vi.mock("lucide-react", () => ({
  X: ({ className }: { className?: string }) =>
    React.createElement("span", { "data-testid": "x-icon", className }),
  Filter: ({ className }: { className?: string }) =>
    React.createElement("span", { "data-testid": "filter-icon", className }),
  Plus: ({ className }: { className?: string }) =>
    React.createElement("span", { "data-testid": "plus-icon", className }),
}));

// Mock FilterChip and FilterPopover since they are complex sub-components
vi.mock("../../src/components/issues/filter-builder/filter-chip", () => ({
  FilterChip: ({
    filter,
    onEdit,
    onRemove,
  }: {
    filter: { field: string; operator: string; value?: unknown };
    onEdit: () => void;
    onRemove: () => void;
    statuses: unknown[];
    types: unknown[];
    members: unknown[];
    labels: unknown[];
  }) =>
    React.createElement(
      "div",
      { "data-testid": `filter-chip-${filter.field}` },
      React.createElement("span", null, `${filter.field}: ${filter.operator}`),
      React.createElement("button", {
        "data-testid": `remove-filter-${filter.field}`,
        onClick: onRemove,
      }, "x"),
    ),
}));

vi.mock("../../src/components/issues/filter-builder/filter-popover", () => ({
  FilterPopover: ({
    onApply,
    trigger,
    open,
  }: {
    onApply: (filter: unknown) => void;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    editingFilter?: unknown;
    filterCount?: number;
  }) =>
    React.createElement("div", { "data-testid": "filter-popover" }, trigger),
}));

// ── Import after mocks ──────────────────────────────────────────────

import {
  useIssueFilters,
  FILTER_FIELDS,
  getFieldMeta,
  type ActiveFilter,
} from "../../src/components/issues/filter-builder/use-issue-filters";
import { FilterBar } from "../../src/components/issues/filter-builder/filter-bar";

// ── Helper to test hooks ────────────────────────────────────────────

function HookTester({ onResult }: { onResult: (result: ReturnType<typeof useIssueFilters>) => void }) {
  const result = useIssueFilters();
  React.useEffect(() => {
    onResult(result);
  });
  return null;
}

function renderHook(searchParams: Record<string, unknown> = {}) {
  mockSearch = searchParams;
  let hookResult: ReturnType<typeof useIssueFilters> | null = null;

  render(
    React.createElement(HookTester, {
      onResult: (result: ReturnType<typeof useIssueFilters>) => {
        hookResult = result;
      },
    }),
  );

  return hookResult!;
}

// ── FilterBar helpers ───────────────────────────────────────────────

function renderFilterBar() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    React.createElement(QueryClientProvider, { client: queryClient },
      React.createElement(FilterBar),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("useIssueFilters", () => {
  beforeEach(() => {
    mockSearch = {};
    mockNavigate.mockClear();
  });

  it("returns empty filters when no search params", () => {
    const result = renderHook({});
    expect(result.filters).toEqual([]);
    expect(result.hasFilters).toBe(false);
  });

  it("parses statusId search param into a filter", () => {
    const result = renderHook({ statusId: "s-1,s-2" });
    expect(result.filters).toHaveLength(1);
    expect(result.filters[0].field).toBe("statusId");
    expect(result.filters[0].operator).toBe("is");
    expect(result.filters[0].value).toEqual(["s-1", "s-2"]);
    expect(result.hasFilters).toBe(true);
  });

  it("parses statusIdNot as is_not operator", () => {
    const result = renderHook({ statusIdNot: "s-3" });
    expect(result.filters).toHaveLength(1);
    expect(result.filters[0].field).toBe("statusId");
    expect(result.filters[0].operator).toBe("is_not");
  });

  it("parses priority search param", () => {
    const result = renderHook({ priority: "high,urgent" });
    expect(result.filters).toHaveLength(1);
    expect(result.filters[0].field).toBe("priority");
    expect(result.filters[0].value).toEqual(["high", "urgent"]);
  });

  it("parses assigneeEmpty as is_empty operator", () => {
    const result = renderHook({ assigneeEmpty: true });
    expect(result.filters).toHaveLength(1);
    expect(result.filters[0].field).toBe("assigneeId");
    expect(result.filters[0].operator).toBe("is_empty");
  });

  it("parses multiple filter params simultaneously", () => {
    const result = renderHook({
      statusId: "s-1",
      priority: "high",
      title: "bug",
    });
    expect(result.filters).toHaveLength(3);
    const fields = result.filters.map((f: ActiveFilter) => f.field);
    expect(fields).toContain("statusId");
    expect(fields).toContain("priority");
    expect(fields).toContain("title");
  });

  it("parses dueDate before filter", () => {
    const result = renderHook({ dueBefore: "2025-06-01" });
    expect(result.filters).toHaveLength(1);
    expect(result.filters[0].field).toBe("dueDate");
    expect(result.filters[0].operator).toBe("before");
    expect(result.filters[0].value).toBe("2025-06-01");
  });

  it("parses labelId includes filter", () => {
    const result = renderHook({ labelId: "lbl-1,lbl-2" });
    expect(result.filters).toHaveLength(1);
    expect(result.filters[0].field).toBe("labelId");
    expect(result.filters[0].operator).toBe("includes");
  });

  it("parses title contains filter", () => {
    const result = renderHook({ title: "search term" });
    expect(result.filters).toHaveLength(1);
    expect(result.filters[0].field).toBe("title");
    expect(result.filters[0].operator).toBe("contains");
    expect(result.filters[0].value).toBe("search term");
  });

  it("addFilter calls navigate with updated search params", () => {
    const result = renderHook({});
    result.addFilter({ field: "statusId", operator: "is", value: ["s-1"] });

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({ statusId: "s-1" }),
        replace: true,
      }),
    );
  });

  it("removeFilter calls navigate without the removed filter", () => {
    const result = renderHook({ statusId: "s-1", priority: "high" });
    result.removeFilter("statusId");

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.objectContaining({ priority: "high" }),
        replace: true,
      }),
    );
    // statusId should not be in the new search
    const calledSearch = mockNavigate.mock.calls[0][0].search;
    expect(calledSearch.statusId).toBeUndefined();
  });

  it("clearAllFilters removes all filter params", () => {
    const result = renderHook({ statusId: "s-1", priority: "high" });
    result.clearAllFilters();

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: expect.not.objectContaining({ statusId: "s-1" }),
        replace: true,
      }),
    );
  });

  it("preserves sort/order params when modifying filters", () => {
    const result = renderHook({ sort: "priority", order: "desc", statusId: "s-1" });
    result.removeFilter("statusId");

    const calledSearch = mockNavigate.mock.calls[0][0].search;
    expect(calledSearch.sort).toBe("priority");
    expect(calledSearch.order).toBe("desc");
  });
});

describe("FILTER_FIELDS metadata", () => {
  it("has 7 filter fields defined", () => {
    expect(FILTER_FIELDS).toHaveLength(7);
  });

  it("each field has label, operators, defaultOperator, and valueType", () => {
    for (const field of FILTER_FIELDS) {
      expect(field.label).toBeDefined();
      expect(field.operators.length).toBeGreaterThan(0);
      expect(field.defaultOperator).toBeDefined();
      expect(field.valueType).toBeDefined();
    }
  });

  it("getFieldMeta returns correct metadata for statusId", () => {
    const meta = getFieldMeta("statusId");
    expect(meta).toBeDefined();
    expect(meta!.label).toBe("상태");
    expect(meta!.operators).toContain("is");
    expect(meta!.operators).toContain("is_not");
  });

  it("getFieldMeta returns undefined for unknown field", () => {
    const meta = getFieldMeta("unknown" as never);
    expect(meta).toBeUndefined();
  });
});

describe("FilterBar", () => {
  beforeEach(() => {
    mockSearch = {};
    mockNavigate.mockClear();
  });

  it("returns null when no filters are active", () => {
    mockSearch = {};
    const { container } = renderFilterBar();
    // FilterBar returns null when no filters
    expect(container.innerHTML).toBe("");
  });

  it("renders filter chips when filters are active", () => {
    mockSearch = { statusId: "s-1" };
    renderFilterBar();

    // Should render the filter bar region
    const region = screen.getByRole("region", { name: "활성 필터" });
    expect(region).toBeDefined();
  });

  it("renders '필터 초기화' button when filters active", () => {
    mockSearch = { statusId: "s-1" };
    renderFilterBar();

    expect(screen.getByText("필터 초기화")).toBeDefined();
  });

  it("clicking '필터 초기화' calls navigate to clear all filters", () => {
    mockSearch = { statusId: "s-1", priority: "high" };
    renderFilterBar();

    fireEvent.click(screen.getByText("필터 초기화"));

    expect(mockNavigate).toHaveBeenCalled();
  });
});
