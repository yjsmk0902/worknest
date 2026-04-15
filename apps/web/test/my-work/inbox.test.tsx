import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
/**
 * InboxPage (notifications inbox) component tests.
 *
 * Tests notification rendering, unread indicator, mark-all-read,
 * filter toggles, empty state, and click-to-read behavior.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

const mockGetList = vi.fn();
const mockPatch = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
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
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }
  },
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => {
    const routeOpts = (opts: Record<string, unknown>) => ({
      ...opts,
      useParams: () => ({ orgSlug: 'my-org', wsSlug: 'my-ws' }),
    });
    return routeOpts;
  },
  useNavigate: () => mockNavigate,
}));

vi.mock('../../src/contexts/workspace-context', () => ({
  useWorkspaceContext: () => ({
    orgId: 'org-1',
    orgSlug: 'my-org',
    orgName: 'My Org',
    wsId: 'ws-1',
    wsSlug: 'my-ws',
    wsName: 'My Workspace',
  }),
}));

vi.mock('../../src/lib/format-time', () => ({
  formatRelativeTime: () => '1시간 전',
}));

vi.mock('@worknest/ui', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
    size?: string;
    [k: string]: unknown;
  }) =>
    React.createElement(
      'button',
      { onClick, disabled, className, 'data-variant': variant, ...rest },
      children,
    ),
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement('div', { 'data-testid': 'skeleton', className }),
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock('lucide-react', () => {
  const icon =
    (testId: string) =>
    ({ className }: { className?: string }) =>
      React.createElement('span', { 'data-testid': testId, className });
  return {
    Bell: icon('bell-icon'),
    CheckCheck: icon('check-check-icon'),
    UserPlus: icon('user-plus-icon'),
    AtSign: icon('at-sign-icon'),
    MessageSquare: icon('message-square-icon'),
    RefreshCw: icon('refresh-cw-icon'),
    Mail: icon('mail-icon'),
  };
});

vi.mock('@worknest/shared', () => ({}));

// ── Import component after mocks ─────────────────────────────────────

import { Route } from '../../src/routes/_app/$orgSlug/$wsSlug/my/inbox';

// The Route is { component: InboxPage, useParams: () => ... } via our mock
const InboxPage = (Route as { component: React.ComponentType }).component;

// ── Fixtures ─────────────────────────────────────────────────────────

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: `notif-${Math.random().toString(36).slice(2, 8)}`,
    type: 'commented' as const,
    message: 'User replied to your comment',
    issueId: 'issue-1',
    pageId: null,
    readAt: null,
    createdAt: '2025-06-01T10:00:00Z',
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function renderInbox() {
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
      React.createElement(InboxPage),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('InboxPage', () => {
  beforeEach(() => {
    mockGetList.mockReset();
    mockPatch.mockReset();
    mockNavigate.mockReset();
  });

  it('renders notification items', async () => {
    mockGetList.mockResolvedValue({
      data: [
        makeNotification({ id: 'n1', message: 'You were mentioned in WN-42' }),
        makeNotification({ id: 'n2', message: 'Status changed to Done' }),
      ],
      pagination: { next_cursor: null, has_more: false },
    });

    renderInbox();

    await waitFor(() => {
      expect(screen.getByText('You were mentioned in WN-42')).toBeDefined();
      expect(screen.getByText('Status changed to Done')).toBeDefined();
    });
  });

  it('shows unread indicator (dot) for unread notifications', async () => {
    mockGetList.mockResolvedValue({
      data: [
        makeNotification({ id: 'n1', readAt: null, message: 'Unread message' }),
        makeNotification({ id: 'n2', readAt: '2025-06-01T11:00:00Z', message: 'Read message' }),
      ],
      pagination: { next_cursor: null, has_more: false },
    });

    renderInbox();

    await waitFor(() => {
      const unreadDots = screen.getAllByLabelText('읽지 않음');
      expect(unreadDots.length).toBe(1);
    });
  });

  it("renders '모두 읽음 처리' button", async () => {
    mockGetList.mockResolvedValue({
      data: [makeNotification({ id: 'n1' })],
      pagination: { next_cursor: null, has_more: false },
    });

    renderInbox();

    await waitFor(() => {
      const markAllButton = screen.getByLabelText('모든 알림 읽음 처리');
      expect(markAllButton).toBeDefined();
      expect(markAllButton.textContent).toContain('모두 읽음 처리');
    });
  });

  it('filter toggles show (전체/읽지 않음)', async () => {
    mockGetList.mockResolvedValue({
      data: [],
      pagination: { next_cursor: null, has_more: false },
    });

    renderInbox();

    await waitFor(() => {
      expect(screen.getByText('전체')).toBeDefined();
      expect(screen.getByText('읽지 않음')).toBeDefined();
    });
  });

  it('empty state renders when no notifications', async () => {
    mockGetList.mockResolvedValue({
      data: [],
      pagination: { next_cursor: null, has_more: false },
    });

    renderInbox();

    await waitFor(() => {
      expect(screen.getByText('새로운 알림이 없습니다')).toBeDefined();
      expect(screen.getByText('알림이 도착하면 여기에 표시됩니다')).toBeDefined();
    });
  });

  it('clicking notification item triggers markRead mutation for unread items', async () => {
    mockGetList.mockResolvedValue({
      data: [makeNotification({ id: 'n1', readAt: null, message: 'Click me' })],
      pagination: { next_cursor: null, has_more: false },
    });
    mockPatch.mockResolvedValue({});

    renderInbox();

    await waitFor(() => {
      expect(screen.getByText('Click me')).toBeDefined();
    });

    const notifButton = screen.getByLabelText('Click me');
    fireEvent.click(notifButton);

    expect(mockPatch).toHaveBeenCalledWith('/notifications/n1', { read: true });
  });
});
