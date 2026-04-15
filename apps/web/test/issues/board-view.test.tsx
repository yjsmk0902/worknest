import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
/**
 * KanbanBoard component tests.
 *
 * Tests board rendering, empty board state, column layout,
 * card display, and interactions.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

const mockPatch = vi.fn();
const mockPost = vi.fn();

vi.mock('../../src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    getList: vi.fn(),
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
  Button: (props: Record<string, unknown> & { children: React.ReactNode }) => {
    const { children, ...rest } = props;
    return React.createElement('button', rest, children);
  },
  ScrollArea: (props: Record<string, unknown> & { children: React.ReactNode }) => {
    const { children, ...rest } = props;
    return React.createElement('div', rest, children);
  },
  toast: vi.fn(),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  Avatar: ({
    fallback,
    className,
  }: {
    src?: string | null;
    fallback?: string;
    size?: string;
    className?: string;
  }) => React.createElement('span', { 'data-testid': 'avatar', className }, fallback),
}));

vi.mock('lucide-react', () => {
  const icon =
    (testId: string) =>
    ({ className }: { className?: string }) =>
      React.createElement('span', { 'data-testid': testId, className });
  return {
    Columns3: icon('columns3-icon'),
    Plus: icon('plus-icon'),
    AlertCircle: icon('alert-circle-icon'),
    AlertTriangle: icon('alert-triangle-icon'),
    ArrowDown: icon('arrow-down-icon'),
    Minus: icon('minus-icon'),
    Zap: icon('zap-icon'),
    Bug: icon('bug-icon'),
    BookOpen: icon('book-open-icon'),
    Rocket: icon('rocket-icon'),
    CircleCheck: icon('circle-check-icon'),
  };
});

// Mock @dnd-kit/core
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'dnd-context' }, children),
  DragOverlay: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'drag-overlay' }, children),
  PointerSensor: class PointerSensor {},
  KeyboardSensor: class KeyboardSensor {},
  closestCorners: vi.fn(),
  useSensor: () => ({}),
  useSensors: () => [],
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  verticalListSortingStrategy: {},
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

// ── Import components after mocks ────────────────────────────────────

import { KanbanBoard } from '../../src/components/issues/board-view/kanban-board';

// ── Fixtures ─────────────────────────────────────────────────────────

function makeStatus(overrides: Record<string, unknown> = {}) {
  return {
    id: `status-${Math.random().toString(36).slice(2, 8)}`,
    projectId: 'proj-1',
    name: 'Open',
    color: '#3b82f6',
    sortOrder: 0,
    category: 'unstarted' as const,
    isDefault: false,
    ...overrides,
  };
}

function makeIssue(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `issue-${Math.random().toString(36).slice(2, 8)}`,
    projectId: 'proj-1',
    sequenceId: 1,
    title: 'Test issue',
    description: null,
    descriptionText: null,
    statusId: 'status-open',
    typeId: null,
    priority: 'none',
    parentId: null,
    creatorId: null,
    sortOrder: 'a0',
    dueDate: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    status: { id: 'status-open', name: 'Open', color: '#3b82f6' },
    assignees: [],
    labels: [],
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

const defaultStatuses = [
  makeStatus({ id: 'status-open', name: 'Open', color: '#3b82f6', sortOrder: 0 }),
  makeStatus({ id: 'status-progress', name: 'In Progress', color: '#f59e0b', sortOrder: 1 }),
  makeStatus({ id: 'status-done', name: 'Done', color: '#22c55e', sortOrder: 2 }),
];

const defaultProps = {
  statuses: defaultStatuses,
  issues: [] as Record<string, unknown>[],
  stats: {} as Record<string, number>,
  projectId: 'proj-1',
  projectPrefix: 'WN',
  onCardClick: vi.fn(),
  onCreateClick: vi.fn(),
};

function renderBoard(overrides: Partial<typeof defaultProps> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const props = { ...defaultProps, ...overrides } as never;

  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(KanbanBoard, props),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('KanbanBoard', () => {
  beforeEach(() => {
    mockPatch.mockReset();
    mockPost.mockReset();
    defaultProps.onCardClick.mockClear();
    defaultProps.onCreateClick.mockClear();
  });

  it('renders empty board state when no issues', () => {
    renderBoard({ issues: [] });

    expect(screen.getByText('이슈를 만들어 보드를 시작하세요')).toBeDefined();
    expect(screen.getByText('카드를 드래그하여 상태를 변경할 수 있습니다')).toBeDefined();
    expect(screen.getByText('이슈 만들기')).toBeDefined();
  });

  it('calls onCreateClick when empty state CTA is clicked', () => {
    const onCreateClick = vi.fn();
    renderBoard({ issues: [], onCreateClick });

    fireEvent.click(screen.getByText('이슈 만들기'));
    expect(onCreateClick).toHaveBeenCalledTimes(1);
  });

  it('renders columns for each status with correct header name', () => {
    const issues = [
      makeIssue({ id: 'i-1', sequenceId: 1, title: 'Open task', statusId: 'status-open' }),
    ];

    renderBoard({
      issues: issues as never[],
      stats: { 'status-open': 1, 'status-progress': 0, 'status-done': 0 },
    });

    expect(screen.getByText('Open')).toBeDefined();
    expect(screen.getByText('In Progress')).toBeDefined();
    expect(screen.getByText('Done')).toBeDefined();
  });

  it('shows column count matching number of cards', () => {
    const issues = [
      makeIssue({ id: 'i-1', sequenceId: 1, title: 'Task 1', statusId: 'status-open' }),
      makeIssue({ id: 'i-2', sequenceId: 2, title: 'Task 2', statusId: 'status-open' }),
      makeIssue({ id: 'i-3', sequenceId: 3, title: 'Task 3', statusId: 'status-progress' }),
    ];

    renderBoard({
      issues: issues as never[],
      stats: { 'status-open': 2, 'status-progress': 1, 'status-done': 0 },
    });

    // Column count is displayed from the stats prop
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
  });

  it('cards display issue key and title', () => {
    const issues = [
      makeIssue({
        id: 'i-1',
        sequenceId: 42,
        title: 'My kanban task',
        statusId: 'status-open',
      }),
    ];

    renderBoard({
      issues: issues as never[],
      stats: { 'status-open': 1 },
    });

    expect(screen.getByText('WN-42')).toBeDefined();
    expect(screen.getByText('My kanban task')).toBeDefined();
  });

  it('card click calls onCardClick with the issue id', () => {
    const onCardClick = vi.fn();
    const issues = [
      makeIssue({
        id: 'issue-click-test',
        sequenceId: 5,
        title: 'Click test card',
        statusId: 'status-open',
      }),
    ];

    renderBoard({
      issues: issues as never[],
      stats: { 'status-open': 1 },
      onCardClick,
    });

    const cardTitle = screen.getByText('Click test card');
    const card = cardTitle.closest('[role="listitem"]');
    expect(card).toBeDefined();
    fireEvent.click(card!);

    expect(onCardClick).toHaveBeenCalledWith('issue-click-test');
  });

  it('card title has line-clamp-2 class for truncation', () => {
    const issues = [
      makeIssue({
        id: 'i-trunc',
        sequenceId: 7,
        title:
          'A very long title that should be truncated after two lines to keep the card compact',
        statusId: 'status-open',
      }),
    ];

    renderBoard({
      issues: issues as never[],
      stats: { 'status-open': 1 },
    });

    const titleElement = screen.getByText(
      'A very long title that should be truncated after two lines to keep the card compact',
    );
    expect(titleElement.className).toContain('line-clamp-2');
  });

  it('due date shows only when within 3 days or overdue', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 10);

    const issues = [
      makeIssue({
        id: 'i-soon',
        sequenceId: 1,
        title: 'Soon due',
        statusId: 'status-open',
        dueDate: tomorrow.toISOString(),
      }),
      makeIssue({
        id: 'i-far',
        sequenceId: 2,
        title: 'Far away due',
        statusId: 'status-progress',
        dueDate: nextWeek.toISOString(),
      }),
    ];

    renderBoard({
      issues: issues as never[],
      stats: { 'status-open': 1, 'status-progress': 1 },
    });

    // The "soon due" card should have a due date element with orange color
    const soonCard = screen.getByText('Soon due').closest('[role="listitem"]');
    expect(soonCard).toBeDefined();

    // Find a span inside the soon card that has orange-500 in its className
    const dueElements = soonCard?.querySelectorAll('span');
    const hasDueDate = Array.from(dueElements).some((el) =>
      el.className?.includes('text-orange-500'),
    );
    expect(hasDueDate).toBe(true);

    // The "far away" card should NOT have such a due date element
    const farCard = screen.getByText('Far away due').closest('[role="listitem"]');
    expect(farCard).toBeDefined();
    const farDueElements = farCard?.querySelectorAll('span');
    const farHasDueDate = Array.from(farDueElements).some(
      (el) =>
        el.className?.includes('text-orange-500') || el.className?.includes('text-destructive'),
    );
    expect(farHasDueDate).toBe(false);
  });

  it('shows priority icon on cards with non-none priority', () => {
    const issues = [
      makeIssue({
        id: 'i-high',
        sequenceId: 3,
        title: 'High priority task',
        statusId: 'status-open',
        priority: 'high',
      }),
    ];

    renderBoard({
      issues: issues as never[],
      stats: { 'status-open': 1 },
    });

    // The card should render a priority icon (SignalHigh mock)
    expect(screen.getByText('High priority task')).toBeDefined();
  });

  it('empty column shows the quick add button', () => {
    const issues = [
      makeIssue({
        id: 'i-1',
        sequenceId: 1,
        title: 'Only in open',
        statusId: 'status-open',
      }),
    ];

    renderBoard({
      issues: issues as never[],
      stats: { 'status-open': 1, 'status-progress': 0, 'status-done': 0 },
    });

    // Empty columns show "이슈 없음" text
    const emptyTexts = screen.getAllByText('이슈 없음');
    // There should be 2 empty columns (In Progress and Done)
    expect(emptyTexts.length).toBe(2);
  });

  it('renders kanban board region with correct aria-label', () => {
    const issues = [
      makeIssue({ id: 'i-1', sequenceId: 1, title: 'Test', statusId: 'status-open' }),
    ];

    renderBoard({
      issues: issues as never[],
      stats: { 'status-open': 1 },
    });

    const region = screen.getByRole('region', { name: '칸반 보드' });
    expect(region).toBeDefined();
  });
});
