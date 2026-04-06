/**
 * CarryOverModal component tests.
 *
 * Tests incomplete issues list, target cycle dropdown,
 * remove-from-backlog option, confirm behavior, and cancel.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────

const mockPost = vi.fn();
const mockGetList = vi.fn();

vi.mock("../../src/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    getList: (...args: unknown[]) => mockGetList(...args),
    post: (...args: unknown[]) => mockPost(...args),
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

const mockToast = vi.fn();

vi.mock("@worknest/ui", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange?: (v: boolean) => void;
  }) => (open ? React.createElement("div", { "data-testid": "dialog" }, children) : null),
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => React.createElement("div", { className }, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement("h2", null, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement("p", null, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "dialog-footer" }, children),
  Button: ({
    children,
    onClick,
    variant,
    disabled,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    disabled?: boolean;
    [key: string]: unknown;
  }) =>
    React.createElement(
      "button",
      { onClick, "data-variant": variant, disabled, ...rest },
      children,
    ),
  Separator: () => React.createElement("hr"),
  toast: (...args: unknown[]) => mockToast(...args),
}));

// ── Import component after mocks ────────────────────────────────────

import { CarryOverModal } from "../../src/components/cycles/carry-over-modal";

// ── Fixtures ─────────────────────────────────────────────────────────

const statuses = [
  { id: "s-open", name: "Open", color: "#3b82f6", category: "unstarted", sortOrder: 0, isDefault: true, projectId: "proj-1" },
  { id: "s-progress", name: "In Progress", color: "#f59e0b", category: "started", sortOrder: 1, isDefault: false, projectId: "proj-1" },
  { id: "s-done", name: "Done", color: "#22c55e", category: "completed", sortOrder: 2, isDefault: false, projectId: "proj-1" },
  { id: "s-cancel", name: "Cancelled", color: "#94a3b8", category: "cancelled", sortOrder: 3, isDefault: false, projectId: "proj-1" },
];

function makeIssue(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `issue-${Math.random().toString(36).slice(2, 8)}`,
    projectId: "proj-1",
    sequenceId: 1,
    title: "Test issue",
    statusId: "s-open",
    priority: "none",
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function renderModal(
  overrides: Partial<React.ComponentProps<typeof CarryOverModal>> = {},
) {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    projectId: "proj-1",
    cycleId: "cycle-1",
    issues: [] as never[],
    statuses: statuses as never[],
    projectPrefix: "WN",
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
        React.createElement(CarryOverModal, defaultProps as never),
      ),
    ),
    onOpenChange: defaultProps.onOpenChange,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("CarryOverModal", () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGetList.mockReset();
    mockToast.mockReset();
    // Return available cycles for target dropdown
    mockGetList.mockResolvedValue({
      data: [
        { id: "cycle-2", name: "Sprint 2", status: "draft", startDate: null, endDate: null },
        { id: "cycle-3", name: "Sprint 3", status: "active", startDate: null, endDate: null },
      ],
      pagination: { next_cursor: null, has_more: false },
    });
  });

  it("shows incomplete issues list filtered by status category", () => {
    const issues = [
      makeIssue({ id: "i-1", sequenceId: 1, title: "Open issue", statusId: "s-open" }),
      makeIssue({ id: "i-2", sequenceId: 2, title: "In progress issue", statusId: "s-progress" }),
      makeIssue({ id: "i-3", sequenceId: 3, title: "Done issue", statusId: "s-done" }),
      makeIssue({ id: "i-4", sequenceId: 4, title: "Cancelled issue", statusId: "s-cancel" }),
    ] as never[];

    renderModal({ issues });

    // Only incomplete issues (unstarted + started) should appear
    expect(screen.getByText("Open issue")).toBeDefined();
    expect(screen.getByText("In progress issue")).toBeDefined();
    expect(screen.queryByText("Done issue")).toBeNull();
    expect(screen.queryByText("Cancelled issue")).toBeNull();
  });

  it("shows issue keys with project prefix", () => {
    const issues = [
      makeIssue({ id: "i-1", sequenceId: 42, title: "Keyed issue", statusId: "s-open" }),
    ] as never[];

    renderModal({ issues, projectPrefix: "PROJ" });

    expect(screen.getByText("PROJ-42")).toBeDefined();
  });

  it("shows status name and color indicator for each issue", () => {
    const issues = [
      makeIssue({ id: "i-1", sequenceId: 1, title: "Status display", statusId: "s-open" }),
    ] as never[];

    renderModal({ issues });

    expect(screen.getByText("Open")).toBeDefined();
  });

  it("displays count of incomplete issues in description", () => {
    const issues = [
      makeIssue({ id: "i-1", sequenceId: 1, title: "Issue A", statusId: "s-open" }),
      makeIssue({ id: "i-2", sequenceId: 2, title: "Issue B", statusId: "s-progress" }),
    ] as never[];

    renderModal({ issues });

    // Description: "미완료 이슈가 2개 있습니다"
    expect(screen.getByText(/미완료 이슈가 2개 있습니다/)).toBeDefined();
  });

  it("target cycle dropdown shows available cycles", async () => {
    const issues = [
      makeIssue({ id: "i-1", sequenceId: 1, title: "Issue A", statusId: "s-open" }),
    ] as never[];

    renderModal({ issues });

    // Wait for cycles query
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });

    // The "Remove from backlog" option
    const selectEl = screen.getByLabelText("이동 대상") as HTMLSelectElement;
    expect(selectEl).toBeDefined();

    // Check for the backlog removal option
    const options = selectEl.querySelectorAll("option");
    const optionTexts = Array.from(options).map((o) => o.textContent);
    expect(optionTexts).toContain("사이클에서 제거 (백로그)");
  });

  it("'Remove from backlog' option sets targetCycleId to empty string", async () => {
    const issues = [
      makeIssue({ id: "i-1", sequenceId: 1, title: "Issue A", statusId: "s-open" }),
    ] as never[];

    renderModal({ issues });

    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });

    const selectEl = screen.getByLabelText("이동 대상") as HTMLSelectElement;
    fireEvent.change(selectEl, { target: { value: "" } });
    expect(selectEl.value).toBe("");
  });

  it("confirm button calls complete API", async () => {
    mockPost.mockResolvedValue({});

    const issues = [
      makeIssue({ id: "i-1", sequenceId: 1, title: "Issue A", statusId: "s-open" }),
    ] as never[];

    renderModal({ issues });

    fireEvent.click(screen.getByText("사이클 완료"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/cycles/cycle-1/complete",
      expect.objectContaining({}),
    );
  });

  it("cancel button calls onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    const issues = [
      makeIssue({ id: "i-1", sequenceId: 1, title: "Issue A", statusId: "s-open" }),
    ] as never[];

    renderModal({ issues, onOpenChange });

    fireEvent.click(screen.getByText("취소"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
