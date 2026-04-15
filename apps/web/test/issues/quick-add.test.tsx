import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
/**
 * QuickAdd component tests.
 *
 * Tests the quick issue creation form's rendering,
 * input handling, keyboard interactions, and API calls.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

const mockPost = vi.fn();

vi.mock('../../src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    getList: vi.fn(),
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

vi.mock('@worknest/ui', () => ({
  toast: vi.fn(),
}));

vi.mock('lucide-react', () => ({
  CircleCheck: ({ className }: { className?: string }) =>
    React.createElement('span', { 'data-testid': 'circle-check-icon', className }),
}));

// ── Import component after mocks ─────────────────────────────────────

import { QuickAdd } from '../../src/components/issues/quick-add';

// ── Helpers ───────────────────────────────────────────────────────────

function renderQuickAdd(
  props: {
    projectId?: string;
    parentId?: string;
    onCreated?: (issue: unknown) => void;
    onClose?: () => void;
  } = {},
) {
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
      React.createElement(QuickAdd, {
        projectId: props.projectId ?? 'proj-1',
        parentId: props.parentId,
        onCreated: props.onCreated,
        onClose: props.onClose,
      }),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('QuickAdd', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('renders input with correct placeholder', () => {
    renderQuickAdd();

    const input = screen.getByPlaceholderText('이슈 제목을 입력하세요...');
    expect(input).toBeDefined();
    expect(input.tagName.toLowerCase()).toBe('input');
  });

  it('renders with form role and accessible label', () => {
    renderQuickAdd();

    const form = screen.getByRole('form', { name: '이슈 빠른 생성' });
    expect(form).toBeDefined();
  });

  it('creates issue on Enter and clears input', async () => {
    const createdIssue = {
      id: 'issue-1',
      projectId: 'proj-1',
      sequenceId: 1,
      title: 'New issue',
    };
    mockPost.mockResolvedValueOnce(createdIssue);

    renderQuickAdd();

    const input = screen.getByPlaceholderText('이슈 제목을 입력하세요...');
    await userEvent.type(input, 'New issue');

    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/projects/proj-1/issues', { title: 'New issue' });
    });

    // Input should be cleared after submission
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('creates issue with parentId when provided', async () => {
    mockPost.mockResolvedValueOnce({ id: 'issue-2', title: 'Sub issue' });

    renderQuickAdd({ parentId: 'parent-1' });

    const input = screen.getByPlaceholderText('이슈 제목을 입력하세요...');
    await userEvent.type(input, 'Sub issue');

    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/projects/proj-1/issues', {
        title: 'Sub issue',
        parentId: 'parent-1',
      });
    });
  });

  it('does not create issue with empty or whitespace-only title', async () => {
    renderQuickAdd();

    const input = screen.getByPlaceholderText('이슈 제목을 입력하세요...');

    // Try submitting empty input
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockPost).not.toHaveBeenCalled();

    // Try submitting whitespace-only input
    await userEvent.type(input, '   ');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape and clears input', async () => {
    const onClose = vi.fn();
    renderQuickAdd({ onClose });

    const input = screen.getByPlaceholderText('이슈 제목을 입력하세요...');
    await userEvent.type(input, 'Some text');

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('calls onClose when blurring with empty input', () => {
    const onClose = vi.fn();
    renderQuickAdd({ onClose });

    const input = screen.getByPlaceholderText('이슈 제목을 입력하세요...');
    fireEvent.blur(input);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits and calls onClose when blurring with non-empty input', async () => {
    const onClose = vi.fn();
    mockPost.mockResolvedValueOnce({ id: 'issue-3', title: 'Blur issue' });

    renderQuickAdd({ onClose });

    const input = screen.getByPlaceholderText('이슈 제목을 입력하세요...');
    await userEvent.type(input, 'Blur issue');

    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/projects/proj-1/issues', { title: 'Blur issue' });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onCreated callback after successful creation', async () => {
    const onCreated = vi.fn();
    const createdIssue = {
      id: 'issue-4',
      projectId: 'proj-1',
      sequenceId: 4,
      title: 'Callback issue',
    };
    mockPost.mockResolvedValueOnce(createdIssue);

    renderQuickAdd({ onCreated });

    const input = screen.getByPlaceholderText('이슈 제목을 입력하세요...');
    await userEvent.type(input, 'Callback issue');

    // Shift+Enter creates and closes
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(createdIssue);
    });
  });

  it('keeps quick add open on Enter (without Shift) for continuous creation', async () => {
    const onClose = vi.fn();
    mockPost.mockResolvedValueOnce({ id: 'issue-5', title: 'First' });

    renderQuickAdd({ onClose });

    const input = screen.getByPlaceholderText('이슈 제목을 입력하세요...');
    await userEvent.type(input, 'First');

    // Enter without Shift should NOT call onClose
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
    });

    // onClose should NOT have been called (continuous creation mode)
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Shift+Enter', async () => {
    const onClose = vi.fn();
    mockPost.mockResolvedValueOnce({ id: 'issue-6', title: 'Close me' });

    renderQuickAdd({ onClose });

    const input = screen.getByPlaceholderText('이슈 제목을 입력하세요...');
    await userEvent.type(input, 'Close me');

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('trims the title before sending to the API', async () => {
    mockPost.mockResolvedValueOnce({ id: 'issue-7', title: 'Trimmed' });

    renderQuickAdd();

    const input = screen.getByPlaceholderText('이슈 제목을 입력하세요...');
    await userEvent.type(input, '  Trimmed  ');

    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/projects/proj-1/issues', { title: 'Trimmed' });
    });
  });
});
