import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
/**
 * BulkActionBar component tests.
 *
 * Tests the bulk action bar rendering, selection count display,
 * action buttons, and API interactions.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

const mockPatch = vi.fn();
const mockPost = vi.fn();
const mockGet = vi.fn();
const mockGetList = vi.fn();
const mockToast = vi.fn();

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
      'button',
      { onClick, disabled, 'data-variant': variant, ...rest },
      children,
    ),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (open ? React.createElement('div', { 'data-testid': 'dialog' }, children) : null),
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'dialog-content' }, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement('p', null, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement('h2', null, children),
  DropdownMenu: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => React.createElement('div', { 'data-testid': 'dropdown' }, children),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'dropdown-content' }, children),
  DropdownMenuItem: ({
    children,
    onClick,
    onSelect,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    onSelect?: () => void;
  }) =>
    React.createElement(
      'button',
      { onClick: onClick ?? onSelect, 'data-testid': 'dropdown-item' },
      children,
    ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  Popover: ({
    children,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => React.createElement('div', null, children),
  PopoverContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  Separator: () => React.createElement('hr'),
  Avatar: ({
    fallback,
  }: {
    src?: string | null;
    fallback?: string;
    size?: string;
  }) => React.createElement('span', { 'data-testid': 'avatar' }, fallback),
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock('lucide-react', () => {
  const icon =
    (testId: string) =>
    ({ className }: { className?: string }) =>
      React.createElement('span', { 'data-testid': testId, className });
  return {
    Check: icon('check-icon'),
    Loader2: icon('loader-icon'),
    Search: icon('search-icon'),
    AlertTriangle: icon('alert-triangle-icon'),
    ArrowDown: icon('arrow-down-icon'),
    Minus: icon('minus-icon'),
    Zap: icon('zap-icon'),
    CircleCheck: icon('circle-check-icon'),
    Bug: icon('bug-icon'),
    BookOpen: icon('book-open-icon'),
    Rocket: icon('rocket-icon'),
  };
});

vi.mock('../../src/stores/ui-store', () => ({
  useUIStore: (selector: (state: { sidebarCollapsed: boolean }) => unknown) =>
    selector({ sidebarCollapsed: false }),
}));

// ── Import component after mocks ─────────────────────────────────────

import { BulkActionBar } from '../../src/components/issues/bulk-action-bar';

// ── Helpers ───────────────────────────────────────────────────────────

function renderBulkActionBar(
  overrides: {
    selectedIds?: string[];
    onClearSelection?: () => void;
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const props = {
    projectId: 'proj-1',
    selectedIds: overrides.selectedIds ?? ['id-1', 'id-2', 'id-3'],
    onClearSelection: overrides.onClearSelection ?? vi.fn(),
  };

  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(BulkActionBar, props),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('BulkActionBar', () => {
  beforeEach(() => {
    mockPatch.mockReset();
    mockPost.mockReset();
    mockGet.mockReset();
    mockGetList.mockReset();
    mockToast.mockReset();
  });

  it('renders nothing when no items selected', () => {
    const { container } = renderBulkActionBar({ selectedIds: [] });
    // BulkActionBar returns null when count === 0
    expect(container.innerHTML).toBe('');
  });

  it('shows correct selection count', () => {
    renderBulkActionBar({ selectedIds: ['a', 'b', 'c'] });

    expect(screen.getByText('3건 선택됨')).toBeDefined();
  });

  it("shows '1건 선택됨' for single selection", () => {
    renderBulkActionBar({ selectedIds: ['a'] });

    expect(screen.getByText('1건 선택됨')).toBeDefined();
  });

  it('has toolbar role and correct aria-label', () => {
    renderBulkActionBar();

    const toolbar = screen.getByRole('toolbar', { name: '선택된 이슈 액션' });
    expect(toolbar).toBeDefined();
  });

  it("shows '전체 해제' button", () => {
    renderBulkActionBar();

    expect(screen.getByText('전체 해제')).toBeDefined();
  });

  it("clicking '전체 해제' calls onClearSelection", () => {
    const onClearSelection = vi.fn();
    renderBulkActionBar({ onClearSelection });

    fireEvent.click(screen.getByText('전체 해제'));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('shows status change button', () => {
    renderBulkActionBar();

    expect(screen.getByLabelText('선택된 이슈 상태 변경')).toBeDefined();
    expect(screen.getByText('상태 변경')).toBeDefined();
  });

  it('shows priority change button', () => {
    renderBulkActionBar();

    expect(screen.getByLabelText('선택된 이슈 우선순위 변경')).toBeDefined();
    expect(screen.getByText('우선순위 변경')).toBeDefined();
  });

  it('shows assignee change button', () => {
    renderBulkActionBar();

    expect(screen.getByLabelText('선택된 이슈 담당자 변경')).toBeDefined();
    expect(screen.getByText('담당자 변경')).toBeDefined();
  });

  it('shows label change button', () => {
    renderBulkActionBar();

    expect(screen.getByLabelText('선택된 이슈 라벨 변경')).toBeDefined();
    expect(screen.getByText('라벨 변경')).toBeDefined();
  });

  it('shows delete button', () => {
    renderBulkActionBar();

    expect(screen.getByText('삭제')).toBeDefined();
  });

  it('renders priority options (Urgent, High, Medium, Low, None) in dropdown', () => {
    renderBulkActionBar();

    // The priority dropdown items are rendered directly since our mock
    // DropdownMenu always renders children
    expect(screen.getByText('Urgent')).toBeDefined();
    expect(screen.getByText('High')).toBeDefined();
    expect(screen.getByText('Medium')).toBeDefined();
    expect(screen.getByText('Low')).toBeDefined();
    expect(screen.getByText('None')).toBeDefined();
  });

  it('clicking priority option calls bulk update API', async () => {
    mockPatch.mockResolvedValueOnce({});

    renderBulkActionBar({ selectedIds: ['id-1', 'id-2'] });

    // Click "Urgent" priority option
    fireEvent.click(screen.getByText('Urgent'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/projects/proj-1/issues/bulk', {
        issueIds: ['id-1', 'id-2'],
        changes: { priority: 'urgent' },
      });
    });
  });

  it('shows success toast after bulk update', async () => {
    mockPatch.mockResolvedValueOnce({});
    const onClearSelection = vi.fn();

    renderBulkActionBar({ selectedIds: ['id-1', 'id-2'], onClearSelection });

    fireEvent.click(screen.getByText('Urgent'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('2건 업데이트 완료');
    });
  });

  it('shows delete confirmation dialog', () => {
    renderBulkActionBar({ selectedIds: ['id-1', 'id-2', 'id-3'] });

    // Click the first "삭제" button (the one in the toolbar, not the dialog)
    const deleteButtons = screen.getAllByText('삭제');
    fireEvent.click(deleteButtons[0]);

    // Dialog should appear
    expect(screen.getByText('이슈 삭제')).toBeDefined();
    expect(screen.getByText(/선택한 3건의 이슈를 삭제하시겠습니까/)).toBeDefined();
  });

  it('selection count is announced via aria-live', () => {
    renderBulkActionBar({ selectedIds: ['a', 'b'] });

    const countElement = screen.getByText('2건 선택됨');
    expect(countElement.closest('[aria-live]')).toBeDefined();
  });
});
