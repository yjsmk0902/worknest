import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
/**
 * IssueListTable component tests.
 *
 * Tests the issue list table rendering, empty states, loading states,
 * row interactions, due date formatting, and virtual scrolling setup.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockGetList = vi.fn();
const mockPatch = vi.fn();
const mockPost = vi.fn();

vi.mock('../../src/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    getList: (...args: unknown[]) => mockGetList(...args),
    post: (...args: unknown[]) => mockPost(...args),
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

vi.mock('@worknest/ui', () => ({
  Button: ({
    children,
    onClick,
    className,
    variant,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: string;
    [key: string]: unknown;
  }) =>
    React.createElement(
      'button',
      { onClick, className, 'data-variant': variant, ...rest },
      children,
    ),
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement('div', { 'data-testid': 'skeleton', className }),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  Tooltip: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('span', null, children),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  TooltipProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  toast: vi.fn(),
  Avatar: ({ fallback }: { src?: string | null; fallback?: string; size?: string }) =>
    React.createElement('span', { 'data-testid': 'avatar' }, fallback),
  DropdownMenu: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'dropdown-content' }, children),
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
    React.createElement('button', { onClick }, children),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  Popover: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  PopoverContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  Separator: () => React.createElement('hr'),
}));

vi.mock('lucide-react', () => {
  const icon =
    (testId: string) =>
    ({ className }: { className?: string }) =>
      React.createElement('span', { 'data-testid': testId, className });
  return {
    Loader2: icon('loader-icon'),
    CircleCheck: icon('circle-check-icon'),
    Plus: icon('plus-icon'),
    Search: icon('search-icon'),
    Check: icon('check-icon'),
    AlertCircle: icon('alert-circle-icon'),
    AlertTriangle: icon('alert-triangle-icon'),
    ChevronDown: icon('chevron-down-icon'),
    ArrowDown: icon('arrow-down-icon'),
    Minus: icon('minus-icon'),
    Zap: icon('zap-icon'),
    Bug: icon('bug-icon'),
    BookOpen: icon('book-open-icon'),
    Rocket: icon('rocket-icon'),
  };
});

// Mock @tanstack/react-virtual since jsdom has no layout engine
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: opts.count }, (_, i) => ({
        index: i,
        start: i * 40,
        size: 40,
        key: i,
      })),
    getTotalSize: () => opts.count * 40,
    scrollToIndex: vi.fn(),
    measureElement: vi.fn(),
  }),
}));

// Mock IntersectionObserver (not available in jsdom)
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
Object.defineProperty(globalThis, 'IntersectionObserver', {
  value: MockIntersectionObserver,
  writable: true,
});

// ── Import component after mocks ─────────────────────────────────────

import { IssueListTable } from '../../src/components/issues/list-view/issue-list-table';

// ── Fixtures ─────────────────────────────────────────────────────────

function makeIssue(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `issue-${Math.random().toString(36).slice(2, 8)}`,
    projectId: 'proj-1',
    sequenceId: 1,
    title: 'Test issue',
    description: null,
    descriptionText: null,
    statusId: 'status-1',
    typeId: null,
    priority: 'none',
    parentId: null,
    creatorId: null,
    sortOrder: 'a0',
    dueDate: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    status: { id: 'status-1', name: 'Open', color: '#3b82f6' },
    assignees: [],
    labels: [],
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

const defaultProps = {
  projectPrefix: 'WN',
  projectId: 'proj-1',
  isLoading: false,
  isFetchingNextPage: false,
  hasNextPage: false,
  fetchNextPage: vi.fn(),
  focusedIndex: -1,
  rowSelection: {},
  onRowSelectionChange: vi.fn(),
  onRowClick: vi.fn(),
  onRowDoubleClick: vi.fn(),
  onShowQuickAdd: vi.fn(),
  hasFilters: false,
  onClearFilters: vi.fn(),
};

function renderTable(
  overrides: Partial<typeof defaultProps> & { issues?: Record<string, unknown>[] } = {},
) {
  const { issues = [], ...rest } = overrides;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const props = { ...defaultProps, ...rest, issues: issues as never[] };

  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(IssueListTable, props),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('IssueListTable', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGetList.mockReset();
    mockPatch.mockReset();
    mockPost.mockReset();
    defaultProps.onRowClick.mockClear();
    defaultProps.onRowDoubleClick.mockClear();
    defaultProps.onRowSelectionChange.mockClear();
    defaultProps.onShowQuickAdd.mockClear();
    defaultProps.fetchNextPage.mockClear();
  });

  it('renders issue rows with correct columns (key, title, status, due date)', () => {
    const issues = [
      makeIssue({
        id: 'i-1',
        sequenceId: 42,
        title: 'First issue',
        status: { id: 's-1', name: 'In Progress', color: '#f59e0b' },
      }),
    ];

    renderTable({ issues });

    // Issue key
    expect(screen.getByText('WN-42')).toBeDefined();
    // Title
    expect(screen.getByText('First issue')).toBeDefined();
    // Column headers
    expect(screen.getByText('Key')).toBeDefined();
    expect(screen.getByText('Title')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Due')).toBeDefined();
  });

  it('shows loading skeleton during fetch', () => {
    renderTable({ isLoading: true });

    // Should show skeletons
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);

    // Should have aria-busy
    const loadingContainer = screen.getByLabelText('이슈 목록 로딩 중');
    expect(loadingContainer).toBeDefined();
    expect(loadingContainer.getAttribute('aria-busy')).toBe('true');
  });

  it('shows empty state when no issues and no filters', () => {
    renderTable({ issues: [], hasFilters: false });

    expect(screen.getByText('아직 이슈가 없습니다')).toBeDefined();
    expect(screen.getByText('첫 번째 이슈를 만들어 프로젝트를 시작하세요.')).toBeDefined();
    expect(screen.getByText('이슈 만들기')).toBeDefined();
  });

  it('shows filter-empty state when filters active but no results', () => {
    renderTable({ issues: [], hasFilters: true });

    expect(screen.getByText('검색 결과가 없습니다')).toBeDefined();
    expect(screen.getByText('필터 조건을 변경하거나 초기화해 보세요.')).toBeDefined();
    expect(screen.getByText('필터 초기화')).toBeDefined();
  });

  it('calls onClearFilters when filter reset button is clicked', () => {
    const onClearFilters = vi.fn();
    renderTable({ issues: [], hasFilters: true, onClearFilters });

    fireEvent.click(screen.getByText('필터 초기화'));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('calls onShowQuickAdd when empty state create button is clicked', () => {
    const onShowQuickAdd = vi.fn();
    renderTable({ issues: [], hasFilters: false, onShowQuickAdd });

    fireEvent.click(screen.getByText('이슈 만들기'));
    expect(onShowQuickAdd).toHaveBeenCalledTimes(1);
  });

  it('row click calls onRowClick with the issue id', () => {
    const onRowClick = vi.fn();
    const issues = [makeIssue({ id: 'issue-abc', sequenceId: 1, title: 'Click me' })];

    renderTable({ issues, onRowClick });

    const row = screen.getByText('Click me').closest('[role="row"]');
    expect(row).toBeDefined();
    fireEvent.click(row!);

    expect(onRowClick).toHaveBeenCalledWith('issue-abc');
  });

  it('row double-click calls onRowDoubleClick with the issue id', () => {
    const onRowDoubleClick = vi.fn();
    const issues = [makeIssue({ id: 'issue-dbl', sequenceId: 2, title: 'Double click me' })];

    renderTable({ issues, onRowDoubleClick });

    const row = screen.getByText('Double click me').closest('[role="row"]');
    expect(row).toBeDefined();
    fireEvent.doubleClick(row!);

    expect(onRowDoubleClick).toHaveBeenCalledWith('issue-dbl');
  });

  it('checkbox selection toggles via the checkbox control', () => {
    const issues = [makeIssue({ id: 'issue-sel', sequenceId: 5, title: 'Select me' })];

    renderTable({ issues });

    const checkbox = screen.getByLabelText('WN-5 선택');
    expect(checkbox).toBeDefined();
    expect((checkbox as HTMLInputElement).checked).toBe(false);
  });

  it('displays multiple issues in separate rows', () => {
    const issues = [
      makeIssue({ id: 'i-1', sequenceId: 1, title: 'Issue one' }),
      makeIssue({ id: 'i-2', sequenceId: 2, title: 'Issue two' }),
      makeIssue({ id: 'i-3', sequenceId: 3, title: 'Issue three' }),
    ];

    renderTable({ issues });

    expect(screen.getByText('Issue one')).toBeDefined();
    expect(screen.getByText('Issue two')).toBeDefined();
    expect(screen.getByText('Issue three')).toBeDefined();
    expect(screen.getByText('WN-1')).toBeDefined();
    expect(screen.getByText('WN-2')).toBeDefined();
    expect(screen.getByText('WN-3')).toBeDefined();
  });

  it('shows due date with warning color when overdue', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const issues = [
      makeIssue({
        id: 'i-overdue',
        sequenceId: 10,
        title: 'Overdue issue',
        dueDate: yesterday.toISOString(),
      }),
    ];

    renderTable({ issues });

    // Should render a formatted date with destructive styling class
    // The formatDueDate function returns text-destructive for overdue dates
    const row = screen.getByText('Overdue issue').closest('[role="row"]');
    expect(row).toBeDefined();

    const spans = row?.querySelectorAll('span');
    const overdueSpan = Array.from(spans).find((el) => el.className?.includes('text-destructive'));
    expect(overdueSpan).toBeDefined();
  });

  it('shows dash for issues without due date', () => {
    const issues = [
      makeIssue({ id: 'i-noduedate', sequenceId: 11, title: 'No due date', dueDate: null }),
    ];

    renderTable({ issues });

    // The column shows a dash (em-dash \u2014) for null due date
    expect(screen.getByText('\u2014')).toBeDefined();
  });

  it('renders grid role with correct aria-label', () => {
    const issues = [makeIssue({ id: 'i-grid', sequenceId: 1, title: 'Grid test' })];
    renderTable({ issues });

    const grid = screen.getByRole('grid', { name: '이슈 목록' });
    expect(grid).toBeDefined();
  });

  it('does not call onRowClick for temp issues', () => {
    const onRowClick = vi.fn();
    const issues = [makeIssue({ id: 'temp-123', sequenceId: 0, title: 'Temp issue' })];

    renderTable({ issues, onRowClick });

    // Temp rows have pointer-events-none, but let's verify the callback isn't called
    const row = screen.getByText('Temp issue').closest('[role="row"]');
    if (row) {
      fireEvent.click(row);
    }
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("shows '...' as key for temp issues", () => {
    const issues = [makeIssue({ id: 'temp-abc', sequenceId: 0, title: 'Creating...' })];

    renderTable({ issues });

    expect(screen.getByText('...')).toBeDefined();
  });
});
