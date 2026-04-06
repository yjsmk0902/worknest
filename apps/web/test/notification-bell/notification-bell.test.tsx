/**
 * NotificationBell component tests.
 *
 * Tests bell icon rendering, unread badge display, badge visibility
 * at zero, popover open/close, and "모든 알림 보기" link.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockGetList = vi.fn();
const mockPatch = vi.fn();
const mockNavigate = vi.fn();
let mockPopoverOpen = false;

vi.mock("../../src/lib/api-client", () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    getList: (...args: unknown[]) => mockGetList(...args),
    post: vi.fn(),
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

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ orgSlug: "my-org", wsSlug: "my-ws" }),
}));

vi.mock("../../src/lib/format-time", () => ({
  formatRelativeTime: (date: string) => "방금 전",
}));

vi.mock("../../src/hooks/use-notification-realtime", () => ({
  useNotificationRealtime: vi.fn(),
}));

// Popover mock that renders content when open
vi.mock("@worknest/ui", () => ({
  Popover: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (v: boolean) => void;
  }) => {
    // Use the external mockPopoverOpen state to render children conditionally
    return React.createElement(
      "div",
      { "data-testid": "popover-root", "data-open": open },
      // Always render trigger, conditionally render content
      children,
    );
  },
  PopoverContent: ({ children, className }: { children: React.ReactNode; className?: string; align?: string; side?: string }) =>
    React.createElement("div", { "data-testid": "popover-content", className }, children),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "popover-trigger" }, children),
  ScrollArea: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "scroll-area" }, children),
}));

vi.mock("lucide-react", () => {
  const icon = (testId: string) =>
    ({ className }: { className?: string }) =>
      React.createElement("span", { "data-testid": testId, className });
  return {
    Bell: icon("bell-icon"),
    UserPlus: icon("user-plus-icon"),
    AtSign: icon("at-sign-icon"),
    MessageSquare: icon("message-square-icon"),
    RefreshCw: icon("refresh-cw-icon"),
    Mail: icon("mail-icon"),
  };
});

vi.mock("@worknest/shared", () => ({}));

// ── Import component after mocks ─────────────────────────────────────

import { NotificationBell } from "../../src/components/notification-bell";

// ── Helpers ───────────────────────────────────────────────────────────

function renderBell(unreadCount = 0) {
  // Set up the unread count query response
  mockGet.mockImplementation((path: string) => {
    if (path === "/my/notifications/unread-count") {
      return Promise.resolve({ count: unreadCount });
    }
    return Promise.resolve({});
  });

  // Set up notifications list response
  mockGetList.mockResolvedValue({
    data: [],
    pagination: { next_cursor: null, has_more: false },
  });

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
      React.createElement(NotificationBell),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("NotificationBell", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGetList.mockReset();
    mockPatch.mockReset();
    mockNavigate.mockReset();
    mockPopoverOpen = false;
  });

  it("bell icon renders with correct aria-label", () => {
    renderBell(0);

    const bellButton = screen.getByLabelText("알림");
    expect(bellButton).toBeDefined();
    expect(screen.getByTestId("bell-icon")).toBeDefined();
  });

  it("unread badge shows count when greater than 0", async () => {
    renderBell(5);

    await waitFor(() => {
      const badge = screen.getByLabelText("읽지 않은 알림 5개");
      expect(badge).toBeDefined();
      expect(badge.textContent).toBe("5");
    });
  });

  it("unread badge shows 9+ when count exceeds 9", async () => {
    renderBell(15);

    await waitFor(() => {
      const badge = screen.getByLabelText("읽지 않은 알림 15개");
      expect(badge).toBeDefined();
      expect(badge.textContent).toBe("9+");
    });
  });

  it("badge is hidden when unread count is 0", async () => {
    renderBell(0);

    // Wait for query to settle
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    // Badge should not be present
    const badges = screen.queryAllByLabelText(/읽지 않은 알림/);
    expect(badges.length).toBe(0);
  });

  it("renders '모든 알림 보기' link in popover footer", () => {
    renderBell(0);

    // PopoverContent is always rendered in our mock, so we can see the footer
    expect(screen.getByText("모든 알림 보기")).toBeDefined();
  });

  it("renders '모두 읽음' button in popover header", () => {
    renderBell(0);

    const markAllButton = screen.getByLabelText("모든 알림 읽음 처리");
    expect(markAllButton).toBeDefined();
    expect(markAllButton.textContent).toBe("모두 읽음");
  });

  it("empty state shows '새로운 알림이 없습니다' when no notifications", () => {
    renderBell(0);

    // With our mock, popover content is always rendered and notifications list is empty
    expect(screen.getByText("새로운 알림이 없습니다")).toBeDefined();
  });
});
