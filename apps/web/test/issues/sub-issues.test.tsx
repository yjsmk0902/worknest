import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
/**
 * SubIssues component tests.
 *
 * Tests sub-issue list rendering, progress bar calculation,
 * collapse/expand toggle, add button, and empty state.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

const mockGetList = vi.fn();
const mockPost = vi.fn();

vi.mock('../../src/lib/api-client', () => ({
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
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }
  },
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
    [key: string]: unknown;
  }) =>
    React.createElement(
      'a',
      { href: to, className, 'aria-busy': rest['aria-busy'], 'aria-label': rest['aria-label'] },
      children,
    ),
}));

vi.mock('@worknest/ui', () => ({
  Avatar: ({ fallback }: { src?: string | null; fallback?: string; size?: string }) =>
    React.createElement('span', { 'data-testid': 'avatar' }, fallback),
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement('div', { 'data-testid': 'skeleton', className }),
  toast: vi.fn(),
}));

vi.mock('lucide-react', () => ({
  ChevronDown: () => React.createElement('span', { 'data-testid': 'chevron-down' }),
  ChevronRight: () => React.createElement('span', { 'data-testid': 'chevron-right' }),
  Plus: () => React.createElement('span', { 'data-testid': 'plus-icon' }),
  CircleCheck: () => React.createElement('span', { 'data-testid': 'circle-check' }),
}));

// ── Import after mocks ───────────────────────────────────────────────

import { SubIssues } from '../../src/components/issues/sub-issues';

// ── Fixtures ─────────────────────────────────────────────────────────

function makeSubIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: `issue-${Math.random().toString(36).slice(2, 8)}`,
    projectId: 'proj-1',
    sequenceId: 1,
    title: 'Sub-issue title',
    description: null,
    descriptionText: null,
    statusId: 'status-1',
    typeId: null,
    priority: 'none',
    parentId: 'issue-parent',
    creatorId: null,
    sortOrder: 'a',
    dueDate: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    status: { id: 'status-1', name: 'Open', color: '#3b82f6' },
    assignees: [],
    ...overrides,
  };
}

function makeListResponse(issues: unknown[]) {
  return {
    data: issues,
    pagination: { next_cursor: null, has_more: false },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

const defaultProps = {
  projectId: 'proj-1',
  issueId: 'issue-parent',
  projectPrefix: 'WN',
  orgSlug: 'my-org',
  wsSlug: 'my-ws',
};

function renderSubIssues(props: Partial<typeof defaultProps> = {}) {
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
      React.createElement(SubIssues, { ...defaultProps, ...props }),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('SubIssues', () => {
  beforeEach(() => {
    mockGetList.mockReset();
    mockPost.mockReset();
  });

  it('renders sub-issue list with correct count', async () => {
    const issues = [
      makeSubIssue({ id: 'i-1', sequenceId: 1, title: 'First' }),
      makeSubIssue({ id: 'i-2', sequenceId: 2, title: 'Second' }),
      makeSubIssue({ id: 'i-3', sequenceId: 3, title: 'Third' }),
    ];
    mockGetList.mockResolvedValueOnce(makeListResponse(issues));

    renderSubIssues();

    await waitFor(() => {
      expect(screen.getByText('First')).toBeDefined();
      expect(screen.getByText('Second')).toBeDefined();
      expect(screen.getByText('Third')).toBeDefined();
    });

    // Count display: (0/3) since none are Done
    expect(screen.getByText('(0/3)')).toBeDefined();
  });

  it('shows progress bar with correct percentage', async () => {
    const issues = [
      makeSubIssue({ id: 'i-1', status: { id: 's-1', name: 'Done', color: '#22c55e' } }),
      makeSubIssue({ id: 'i-2', status: { id: 's-2', name: 'Open', color: '#3b82f6' } }),
      makeSubIssue({ id: 'i-3', status: { id: 's-3', name: 'Cancelled', color: '#ef4444' } }),
      makeSubIssue({ id: 'i-4', status: { id: 's-4', name: 'In Progress', color: '#f59e0b' } }),
    ];
    mockGetList.mockResolvedValueOnce(makeListResponse(issues));

    renderSubIssues();

    // 2 out of 4 completed (Done + Cancelled) = 50%
    await waitFor(() => {
      expect(screen.getByText('50%')).toBeDefined();
    });

    expect(screen.getByText('(2/4)')).toBeDefined();
  });

  it('toggles collapse/expand', async () => {
    const issues = [makeSubIssue({ id: 'i-1', sequenceId: 1, title: 'Toggle test' })];
    mockGetList.mockResolvedValueOnce(makeListResponse(issues));

    renderSubIssues();

    await waitFor(() => {
      expect(screen.getByText('Toggle test')).toBeDefined();
    });

    // Click the toggle button (contains "서브이슈" text)
    const toggleButton = screen.getByText('서브이슈').closest('button');
    expect(toggleButton).toBeDefined();

    // Collapse
    fireEvent.click(toggleButton!);

    // After collapse, the sub-issue title should not be visible
    expect(screen.queryByText('Toggle test')).toBeNull();

    // Expand again
    fireEvent.click(toggleButton!);

    expect(screen.getByText('Toggle test')).toBeDefined();
  });

  it("shows '서브이슈 추가' button in empty state", async () => {
    mockGetList.mockResolvedValueOnce(makeListResponse([]));

    renderSubIssues();

    await waitFor(() => {
      const addButton = screen.getByText('서브이슈 추가');
      expect(addButton).toBeDefined();
    });
  });

  it("shows '서브이슈 추가' button within expanded sub-issue list", async () => {
    const issues = [makeSubIssue({ id: 'i-1', sequenceId: 1, title: 'Existing' })];
    mockGetList.mockResolvedValueOnce(makeListResponse(issues));

    renderSubIssues();

    await waitFor(() => {
      expect(screen.getByText('Existing')).toBeDefined();
    });

    // The "서브이슈 추가" button at the bottom of the list
    const addButtons = screen.getAllByText('서브이슈 추가');
    expect(addButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('displays issue keys with project prefix', async () => {
    const issues = [makeSubIssue({ id: 'i-1', sequenceId: 42, title: 'Keyed issue' })];
    mockGetList.mockResolvedValueOnce(makeListResponse(issues));

    renderSubIssues({ projectPrefix: 'WN' });

    await waitFor(() => {
      expect(screen.getByText('WN-42')).toBeDefined();
    });
  });

  it('shows skeleton loading state', () => {
    // Never resolve - keeps in loading state
    mockGetList.mockReturnValueOnce(new Promise(() => {}));

    renderSubIssues();

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows 100% progress when all sub-issues are completed', async () => {
    const issues = [
      makeSubIssue({ id: 'i-1', status: { id: 's-1', name: 'Done', color: '#22c55e' } }),
      makeSubIssue({ id: 'i-2', status: { id: 's-2', name: 'Done', color: '#22c55e' } }),
    ];
    mockGetList.mockResolvedValueOnce(makeListResponse(issues));

    renderSubIssues();

    await waitFor(() => {
      expect(screen.getByText('100%')).toBeDefined();
      expect(screen.getByText('(2/2)')).toBeDefined();
    });
  });

  it('shows 0% progress when no sub-issues are completed', async () => {
    const issues = [
      makeSubIssue({ id: 'i-1', status: { id: 's-1', name: 'Open', color: '#3b82f6' } }),
      makeSubIssue({ id: 'i-2', status: { id: 's-2', name: 'In Progress', color: '#f59e0b' } }),
    ];
    mockGetList.mockResolvedValueOnce(makeListResponse(issues));

    renderSubIssues();

    await waitFor(() => {
      expect(screen.getByText('0%')).toBeDefined();
      expect(screen.getByText('(0/2)')).toBeDefined();
    });
  });

  it('renders assignee avatar when assignees exist', async () => {
    const issues = [
      makeSubIssue({
        id: 'i-1',
        sequenceId: 1,
        title: 'Assigned issue',
        assignees: [
          {
            id: 'a-1',
            userId: 'u-1',
            user: { id: 'u-1', name: 'Alice', email: 'alice@test.com', avatarUrl: null },
          },
        ],
      }),
    ];
    mockGetList.mockResolvedValueOnce(makeListResponse(issues));

    renderSubIssues();

    await waitFor(() => {
      const avatar = screen.getByTestId('avatar');
      expect(avatar).toBeDefined();
      expect(avatar.textContent).toBe('Alice');
    });
  });

  it('opens QuickAdd when add button is clicked in empty state', async () => {
    mockGetList.mockResolvedValueOnce(makeListResponse([]));

    renderSubIssues();

    await waitFor(() => {
      const addButton = screen.getByText('서브이슈 추가');
      expect(addButton).toBeDefined();
    });

    // Click the add button
    fireEvent.click(screen.getByText('서브이슈 추가'));

    // QuickAdd should now be rendered (has the input placeholder)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('이슈 제목을 입력하세요...')).toBeDefined();
    });
  });
});
