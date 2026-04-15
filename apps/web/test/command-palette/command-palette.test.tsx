import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
/**
 * CommandPalette component tests.
 *
 * Tests open/close behavior, search input, debounced search,
 * result grouping by category, command mode, issue ID detection,
 * recent items, and empty states.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockNavigate = vi.fn();
let mockCommandPaletteOpen = true;
const mockSetCommandPaletteOpen = vi.fn();
const mockCurrentWorkspace = { id: 'ws-1', slug: 'my-ws', name: 'My Workspace' };
const mockCurrentOrg = { id: 'org-1', slug: 'my-org', name: 'My Org' };

vi.mock('../../src/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: vi.fn(),
    delete: vi.fn(),
    getList: vi.fn(),
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
  useNavigate: () => mockNavigate,
  useParams: () => ({ orgSlug: 'my-org', wsSlug: 'my-ws' }),
}));

vi.mock('../../src/stores/ui-store', () => ({
  useUIStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      commandPaletteOpen: mockCommandPaletteOpen,
      setCommandPaletteOpen: mockSetCommandPaletteOpen,
    }),
}));

vi.mock('../../src/stores/auth-store', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      currentWorkspace: mockCurrentWorkspace,
      currentOrg: mockCurrentOrg,
    }),
}));

// Mock cmdk — render a simple structure that CommandPalette can use
vi.mock('cmdk', () => {
  const Command = Object.assign(
    ({
      children,
      onKeyDown,
      className,
      label,
    }: {
      children: React.ReactNode;
      onKeyDown?: (e: React.KeyboardEvent) => void;
      className?: string;
      label?: string;
      shouldFilter?: boolean;
      loop?: boolean;
    }) =>
      React.createElement(
        'div',
        { onKeyDown, className, 'aria-label': label, 'data-testid': 'cmdk-root' },
        children,
      ),
    {
      Input: React.forwardRef(
        (
          {
            value,
            onValueChange,
            placeholder,
            className,
            autoFocus,
          }: {
            value?: string;
            onValueChange?: (v: string) => void;
            placeholder?: string;
            className?: string;
            autoFocus?: boolean;
          },
          ref: React.Ref<HTMLInputElement>,
        ) =>
          React.createElement('input', {
            ref,
            value,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => onValueChange?.(e.target.value),
            placeholder,
            className,
            autoFocus,
            'data-testid': 'cmdk-input',
          }),
      ),
      List: ({ children, className }: { children: React.ReactNode; className?: string }) =>
        React.createElement('div', { 'data-testid': 'cmdk-list', className }, children),
      Group: ({
        children,
        heading,
      }: {
        children: React.ReactNode;
        heading?: React.ReactNode;
      }) =>
        React.createElement(
          'div',
          { 'data-testid': 'cmdk-group' },
          heading && React.createElement('div', { 'data-testid': 'cmdk-group-heading' }, heading),
          children,
        ),
      Item: ({
        children,
        value,
        onSelect,
        className,
      }: {
        children: React.ReactNode;
        value?: string;
        onSelect?: () => void;
        className?: string;
      }) =>
        React.createElement(
          'div',
          {
            'data-testid': 'cmdk-item',
            'data-value': value,
            onClick: onSelect,
            className,
            role: 'option',
          },
          children,
        ),
      Empty: ({ children }: { children: React.ReactNode }) =>
        React.createElement('div', { 'data-testid': 'cmdk-empty' }, children),
    },
  );

  return { Command };
});

vi.mock('lucide-react', () => {
  const icon =
    (testId: string) =>
    ({ className }: { className?: string }) =>
      React.createElement('span', { 'data-testid': testId, className });
  return {
    ArrowRight: icon('arrow-right-icon'),
    CircleUser: icon('circle-user-icon'),
    FileText: icon('file-text-icon'),
    Folder: icon('folder-icon'),
    Loader2: icon('loader-icon'),
    LogOut: icon('logout-icon'),
    Plus: icon('plus-icon'),
    Search: icon('search-icon'),
    Settings: icon('settings-icon'),
  };
});

// ── Import component after mocks ─────────────────────────────────────

import { CommandPalette } from '../../src/components/command-palette/command-palette';

// ── Helpers ───────────────────────────────────────────────────────────

function renderPalette() {
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
      React.createElement(CommandPalette),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('CommandPalette', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockNavigate.mockReset();
    mockSetCommandPaletteOpen.mockClear();
    mockCommandPaletteOpen = true;
    localStorage.clear();
  });

  it('renders when open=true', () => {
    mockCommandPaletteOpen = true;
    renderPalette();

    expect(screen.getByTestId('cmdk-root')).toBeDefined();
    expect(screen.getByTestId('cmdk-input')).toBeDefined();
  });

  it('returns null when open=false', () => {
    mockCommandPaletteOpen = false;
    const { container } = renderPalette();

    expect(container.innerHTML).toBe('');
  });

  it('search input has correct placeholder and autoFocus', () => {
    renderPalette();

    const input = screen.getByTestId('cmdk-input') as HTMLInputElement;
    expect(input.placeholder).toBe('검색하거나 명령어를 입력하세요...');
    expect(input.autofocus).toBe(true);
  });

  it('typing triggers debounced search query', async () => {
    mockGet.mockResolvedValue({
      categories: { issues: [], pages: [], projects: [] },
    });

    renderPalette();

    const input = screen.getByTestId('cmdk-input');
    fireEvent.change(input, { target: { value: 'test search' } });

    // API should not be called immediately due to debounce
    expect(mockGet).not.toHaveBeenCalled();

    // After debounce period (300ms), it should trigger
    await waitFor(
      () => {
        expect(mockGet).toHaveBeenCalledWith('/workspaces/ws-1/search', { q: 'test search' });
      },
      { timeout: 1000 },
    );
  });

  it('results grouped by category (Issues, Wiki, Projects)', async () => {
    mockGet.mockResolvedValue({
      categories: {
        issues: [{ id: 'i1', title: 'Bug fix', subtitle: 'WN-1', url: '/issues/1' }],
        pages: [{ id: 'p1', title: 'Doc page', subtitle: 'Wiki', url: '/pages/1' }],
        projects: [{ id: 'pr1', title: 'Worknest', subtitle: 'WN', url: '/projects/1' }],
      },
    });

    renderPalette();

    const input = screen.getByTestId('cmdk-input');
    fireEvent.change(input, { target: { value: 'work' } });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    await waitFor(() => {
      // Category headings
      expect(screen.getByText('이슈')).toBeDefined();
      expect(screen.getByText('Wiki 페이지')).toBeDefined();
      expect(screen.getByText('프로젝트')).toBeDefined();
      // Result items
      expect(screen.getByText('Bug fix')).toBeDefined();
      expect(screen.getByText('Doc page')).toBeDefined();
      expect(screen.getByText('Worknest')).toBeDefined();
    });
  });

  it('issue ID pattern detection shows direct navigation item', async () => {
    mockGet.mockResolvedValue({
      categories: { issues: [], pages: [], projects: [] },
    });

    renderPalette();

    const input = screen.getByTestId('cmdk-input');
    fireEvent.change(input, { target: { value: 'WN-42' } });

    // Should show direct navigation item immediately (no debounce needed)
    await waitFor(() => {
      expect(screen.getByText(/WN-42로 이동/)).toBeDefined();
    });
  });

  it('command mode (> prefix) shows commands', () => {
    renderPalette();

    const input = screen.getByTestId('cmdk-input');
    fireEvent.change(input, { target: { value: '>' } });

    // Should show command labels
    expect(screen.getByText('이슈 생성')).toBeDefined();
    expect(screen.getByText('프로젝트 이동')).toBeDefined();
    expect(screen.getByText('내 이슈')).toBeDefined();
    expect(screen.getByText('설정')).toBeDefined();
    expect(screen.getByText('로그아웃')).toBeDefined();
  });

  it('command mode filters by input after >', () => {
    renderPalette();

    const input = screen.getByTestId('cmdk-input');
    fireEvent.change(input, { target: { value: '>설정' } });

    expect(screen.getByText('설정')).toBeDefined();
    // Other commands should be filtered out
    expect(screen.queryByText('이슈 생성')).toBeNull();
  });

  it('Esc key calls setCommandPaletteOpen(false)', () => {
    renderPalette();

    const root = screen.getByTestId('cmdk-root');
    fireEvent.keyDown(root, { key: 'Escape' });

    expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false);
  });

  it('recent items displayed when input is empty', () => {
    // Seed recent items in localStorage
    const recentItems = [
      { type: 'issue', id: 'r1', title: 'Recent issue', url: '/issues/r1' },
      { type: 'page', id: 'r2', title: 'Recent page', url: '/pages/r2' },
    ];
    localStorage.setItem('worknest:recent-search', JSON.stringify(recentItems));

    renderPalette();

    expect(screen.getByText('최근 항목')).toBeDefined();
    expect(screen.getByText('Recent issue')).toBeDefined();
    expect(screen.getByText('Recent page')).toBeDefined();
  });

  it("empty state shows '결과가 없습니다' when search returns no results", async () => {
    mockGet.mockResolvedValue({
      categories: { issues: [], pages: [], projects: [] },
    });

    renderPalette();

    const input = screen.getByTestId('cmdk-input');
    fireEvent.change(input, { target: { value: 'nonexistent query' } });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('결과가 없습니다')).toBeDefined();
    });
  });

  it('backdrop click calls close (sets open to false)', () => {
    renderPalette();

    const backdrop = screen.getByRole('presentation');
    fireEvent.click(backdrop);

    expect(mockSetCommandPaletteOpen).toHaveBeenCalledWith(false);
  });
});
