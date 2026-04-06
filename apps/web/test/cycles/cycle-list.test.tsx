/**
 * CycleList, CycleCard, CycleEmptyState, CycleProgressBar, and
 * CycleStatusBadge component tests.
 *
 * Tests cycle card rendering, status badges, progress bar segments,
 * empty state, loading skeleton simulation, and sort order expectations.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mocks ─────────────────────────────────────────────────────────────

vi.mock("../../src/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    getList: vi.fn(),
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

vi.mock("@worknest/ui", () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => React.createElement("span", { "data-testid": "badge", className }, children),
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => React.createElement("button", { onClick, ...rest }, children),
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement("div", { "data-testid": "skeleton", className }),
}));

vi.mock("lucide-react", () => {
  const icon = (testId: string) =>
    ({ className }: { className?: string }) =>
      React.createElement("span", { "data-testid": testId, className });
  return {
    RefreshCw: icon("refresh-cw-icon"),
    Plus: icon("plus-icon"),
  };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) =>
    React.createElement(
      "a",
      {
        href: to,
        "data-params": JSON.stringify(params),
        className,
      },
      children,
    ),
}));

// ── Import components after mocks ────────────────────────────────────

import {
  CycleCard,
  CycleList,
  CycleEmptyState,
  CycleStatusBadge,
  CycleProgressBar,
  CycleProgressText,
  formatCycleDateRange,
} from "../../src/components/cycles/cycle-list";

// ── Fixtures ─────────────────────────────────────────────────────────

function makeCycle(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `cycle-${Math.random().toString(36).slice(2, 8)}`,
    projectId: "proj-1",
    name: "Sprint 1",
    description: null,
    status: "draft",
    startDate: "2026-04-01",
    endDate: "2026-04-14",
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

function makeProgress(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    total: 10,
    byCategory: {
      completed: 3,
      started: 2,
      unstarted: 3,
      backlog: 1,
      cancelled: 1,
    },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("CycleStatusBadge", () => {
  it("renders 'Draft' label for draft status", () => {
    render(React.createElement(CycleStatusBadge, { status: "draft" }));
    expect(screen.getByText("Draft")).toBeDefined();
  });

  it("renders 'Active' label for active status", () => {
    render(React.createElement(CycleStatusBadge, { status: "active" }));
    expect(screen.getByText("Active")).toBeDefined();
  });

  it("renders 'Completed' label for completed status", () => {
    render(React.createElement(CycleStatusBadge, { status: "completed" }));
    expect(screen.getByText("Completed")).toBeDefined();
  });

  it("applies status-specific class names to badges", () => {
    const { rerender } = render(
      React.createElement(CycleStatusBadge, { status: "draft" }),
    );
    const draftBadge = screen.getByTestId("badge");
    expect(draftBadge.className).toContain("status-backlog");

    rerender(React.createElement(CycleStatusBadge, { status: "active" }));
    const activeBadge = screen.getByTestId("badge");
    expect(activeBadge.className).toContain("status-unstarted");

    rerender(React.createElement(CycleStatusBadge, { status: "completed" }));
    const completedBadge = screen.getByTestId("badge");
    expect(completedBadge.className).toContain("status-completed");
  });

  it("falls back to draft config for unknown status", () => {
    render(React.createElement(CycleStatusBadge, { status: "unknown" }));
    expect(screen.getByText("Draft")).toBeDefined();
  });
});

describe("CycleProgressBar", () => {
  it("renders empty bar when progress is undefined", () => {
    const { container } = render(
      React.createElement(CycleProgressBar, { progress: undefined }),
    );
    const bar = container.firstChild as HTMLElement;
    expect(bar).toBeDefined();
    expect(bar.className).toContain("bg-muted");
    // No segment children
    expect(bar.children.length).toBe(0);
  });

  it("renders empty bar when total is 0", () => {
    const { container } = render(
      React.createElement(CycleProgressBar, {
        progress: { total: 0, byCategory: {} } as never,
      }),
    );
    const bar = container.firstChild as HTMLElement;
    expect(bar.children.length).toBe(0);
  });

  it("renders correct number of segments based on non-zero categories", () => {
    const progress = makeProgress() as never;
    const { container } = render(
      React.createElement(CycleProgressBar, { progress }),
    );
    // 5 categories all non-zero in our fixture
    const bar = container.firstChild as HTMLElement;
    expect(bar.children.length).toBe(5);
  });

  it("renders segments with correct width percentages", () => {
    const progress = {
      total: 10,
      byCategory: { completed: 5, started: 5 },
    } as never;
    const { container } = render(
      React.createElement(CycleProgressBar, { progress }),
    );
    const bar = container.firstChild as HTMLElement;
    const segments = Array.from(bar.children) as HTMLElement[];
    expect(segments.length).toBe(2);
    expect(segments[0].style.width).toBe("50%");
    expect(segments[1].style.width).toBe("50%");
  });
});

describe("CycleProgressText", () => {
  it("renders null when progress is undefined", () => {
    const { container } = render(
      React.createElement(CycleProgressText, { progress: undefined }),
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows category counts and total", () => {
    const progress = makeProgress() as never;
    render(React.createElement(CycleProgressText, { progress }));
    expect(screen.getByText(/완료 3/)).toBeDefined();
    expect(screen.getByText(/진행 중 2/)).toBeDefined();
    expect(screen.getByText(/미시작 3/)).toBeDefined();
    expect(screen.getByText(/총 10개/)).toBeDefined();
  });
});

describe("formatCycleDateRange", () => {
  it("returns empty string when both dates are null", () => {
    expect(formatCycleDateRange(null, null)).toBe("");
  });

  it("formats start and end date range", () => {
    const result = formatCycleDateRange("2026-04-01", "2026-04-14");
    expect(result).toBe("04/01 - 04/14");
  });

  it("shows only start date when end date is null", () => {
    const result = formatCycleDateRange("2026-04-01", null);
    expect(result).toBe("04/01 -");
  });

  it("shows only end date when start date is null", () => {
    const result = formatCycleDateRange(null, "2026-04-14");
    expect(result).toBe("- 04/14");
  });
});

describe("CycleCard", () => {
  it("renders cycle name, status badge, and date range", () => {
    const cycle = makeCycle({
      name: "Sprint Alpha",
      status: "active",
      startDate: "2026-04-01",
      endDate: "2026-04-14",
    }) as never;

    render(
      React.createElement(CycleCard, {
        cycle,
        progress: undefined,
        orgSlug: "org-1",
        wsSlug: "ws-1",
        projectId: "proj-1",
      }),
    );

    expect(screen.getByText("Sprint Alpha")).toBeDefined();
    expect(screen.getByText("Active")).toBeDefined();
    expect(screen.getByText("04/01 - 04/14")).toBeDefined();
  });

  it("renders description when provided", () => {
    const cycle = makeCycle({
      name: "Sprint Beta",
      description: "Release candidate build",
    }) as never;

    render(
      React.createElement(CycleCard, {
        cycle,
        progress: undefined,
        orgSlug: "org-1",
        wsSlug: "ws-1",
        projectId: "proj-1",
      }),
    );

    expect(screen.getByText("Release candidate build")).toBeDefined();
  });

  it("does not render description when it is null", () => {
    const cycle = makeCycle({
      name: "Sprint Gamma",
      description: null,
    }) as never;

    render(
      React.createElement(CycleCard, {
        cycle,
        progress: undefined,
        orgSlug: "org-1",
        wsSlug: "ws-1",
        projectId: "proj-1",
      }),
    );

    expect(screen.queryByText("Release candidate build")).toBeNull();
  });

  it("renders progress bar and text when progress is provided", () => {
    const cycle = makeCycle({ name: "With Progress" }) as never;
    const progress = makeProgress() as never;

    render(
      React.createElement(CycleCard, {
        cycle,
        progress,
        orgSlug: "org-1",
        wsSlug: "ws-1",
        projectId: "proj-1",
      }),
    );

    expect(screen.getByText(/총 10개/)).toBeDefined();
  });

  it("generates correct link with route params", () => {
    const cycle = makeCycle({ id: "cycle-123", name: "Link Test" }) as never;

    render(
      React.createElement(CycleCard, {
        cycle,
        progress: undefined,
        orgSlug: "my-org",
        wsSlug: "my-ws",
        projectId: "proj-abc",
      }),
    );

    const link = screen.getByText("Link Test").closest("a");
    expect(link).toBeDefined();
    const params = JSON.parse(link!.getAttribute("data-params") ?? "{}");
    expect(params.orgSlug).toBe("my-org");
    expect(params.wsSlug).toBe("my-ws");
    expect(params.projectId).toBe("proj-abc");
    expect(params.cycleId).toBe("cycle-123");
  });
});

describe("CycleList", () => {
  it("renders multiple cycle cards", () => {
    const cycles = [
      makeCycle({ id: "c-1", name: "Sprint 1" }),
      makeCycle({ id: "c-2", name: "Sprint 2" }),
      makeCycle({ id: "c-3", name: "Sprint 3" }),
    ] as never[];

    render(
      React.createElement(CycleList, {
        cycles,
        progressMap: {},
        orgSlug: "org-1",
        wsSlug: "ws-1",
        projectId: "proj-1",
      }),
    );

    expect(screen.getByText("Sprint 1")).toBeDefined();
    expect(screen.getByText("Sprint 2")).toBeDefined();
    expect(screen.getByText("Sprint 3")).toBeDefined();
  });

  it("renders cycles sorted by the order provided (active first, draft, completed)", () => {
    const cycles = [
      makeCycle({ id: "c-active", name: "Active Sprint", status: "active" }),
      makeCycle({ id: "c-draft", name: "Draft Sprint", status: "draft" }),
      makeCycle({ id: "c-complete", name: "Completed Sprint", status: "completed" }),
    ] as never[];

    const { container } = render(
      React.createElement(CycleList, {
        cycles,
        progressMap: {},
        orgSlug: "org-1",
        wsSlug: "ws-1",
        projectId: "proj-1",
      }),
    );

    // Verify order: active, draft, completed
    const links = container.querySelectorAll("a");
    const names = Array.from(links).map((link) => {
      const span = link.querySelector("span");
      return span?.textContent;
    });
    expect(names[0]).toBe("Active Sprint");
    expect(names[1]).toBe("Draft Sprint");
    expect(names[2]).toBe("Completed Sprint");
  });
});

describe("CycleEmptyState", () => {
  it("renders empty state message and CTA button", () => {
    const onCreateClick = vi.fn();
    render(
      React.createElement(CycleEmptyState, { onCreateClick }),
    );

    expect(screen.getByText("아직 사이클이 없습니다")).toBeDefined();
    expect(
      screen.getByText(
        "사이클을 만들어 이슈를 그룹화하고 진행 상황을 추적하세요",
      ),
    ).toBeDefined();
    expect(screen.getByText("사이클 생성")).toBeDefined();
  });

  it("calls onCreateClick when CTA button is clicked", () => {
    const onCreateClick = vi.fn();
    render(
      React.createElement(CycleEmptyState, { onCreateClick }),
    );

    fireEvent.click(screen.getByText("사이클 생성"));
    expect(onCreateClick).toHaveBeenCalledTimes(1);
  });

  it("renders the refresh icon", () => {
    render(
      React.createElement(CycleEmptyState, { onCreateClick: vi.fn() }),
    );

    expect(screen.getByTestId("refresh-cw-icon")).toBeDefined();
  });
});
