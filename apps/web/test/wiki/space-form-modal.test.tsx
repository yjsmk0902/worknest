import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
/**
 * SpaceFormModal component tests.
 *
 * Tests create form rendering, slug auto-generation from name,
 * API calls on submit, cancel behavior, and name validation.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

const mockPost = vi.fn();
const mockPatch = vi.fn();

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

const mockToast = vi.fn();

vi.mock('@worknest/ui', () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange?: (v: boolean) => void;
  }) => (open ? React.createElement('div', { 'data-testid': 'dialog' }, children) : null),
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => React.createElement('div', { className }, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement('h2', null, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'dialog-footer' }, children),
  Button: ({
    children,
    onClick,
    type,
    variant,
    disabled,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: string;
    variant?: string;
    disabled?: boolean;
    [key: string]: unknown;
  }) =>
    React.createElement(
      'button',
      { onClick, type, 'data-variant': variant, disabled, ...rest },
      children,
    ),
  Input: ({
    id,
    value,
    onChange,
    placeholder,
    disabled,
    maxLength,
    className,
    autoFocus,
    ...rest
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    disabled?: boolean;
    maxLength?: number;
    className?: string;
    autoFocus?: boolean;
    [key: string]: unknown;
  }) =>
    React.createElement('input', {
      id,
      value,
      onChange,
      placeholder,
      disabled,
      maxLength,
      className,
      autoFocus,
      ...rest,
    }),
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
  }) => React.createElement('label', { htmlFor }, children),
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock('lucide-react', () => {
  const icon =
    (testId: string) =>
    ({ className }: { className?: string }) =>
      React.createElement('span', { 'data-testid': testId, className });
  return {
    Loader2: icon('loader-icon'),
  };
});

// ── Import component after mocks ────────────────────────────────────

import { SpaceFormModal } from '../../src/components/wiki/space-form-modal';

// ── Helpers ───────────────────────────────────────────────────────────

function renderModal(overrides: Partial<React.ComponentProps<typeof SpaceFormModal>> = {}) {
  const defaultProps = {
    workspaceId: 'ws-1',
    open: true,
    onOpenChange: vi.fn(),
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
        React.createElement(SpaceFormModal, defaultProps as never),
      ),
    ),
    onOpenChange: defaultProps.onOpenChange,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('SpaceFormModal', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockPatch.mockReset();
    mockToast.mockReset();
  });

  it('renders create form with correct title and empty fields', () => {
    renderModal();

    expect(screen.getByText('스페이스 만들기')).toBeDefined();

    const nameInput = screen.getByPlaceholderText('스페이스 이름') as HTMLInputElement;
    expect(nameInput.value).toBe('');

    const slugInput = screen.getByPlaceholderText('space-slug') as HTMLInputElement;
    expect(slugInput.value).toBe('');
  });

  it('auto-generates slug when name is typed', () => {
    renderModal();

    const nameInput = screen.getByPlaceholderText('스페이스 이름');
    fireEvent.change(nameInput, { target: { value: 'My New Space' } });

    const slugInput = screen.getByPlaceholderText('space-slug') as HTMLInputElement;
    expect(slugInput.value).toBe('my-new-space');
  });

  it('stops auto-generating slug after manual slug edit', () => {
    renderModal();

    const nameInput = screen.getByPlaceholderText('스페이스 이름');
    const slugInput = screen.getByPlaceholderText('space-slug');

    // Type name first
    fireEvent.change(nameInput, { target: { value: 'First Name' } });
    expect((slugInput as HTMLInputElement).value).toBe('first-name');

    // Manually edit slug
    fireEvent.change(slugInput, { target: { value: 'custom-slug' } });
    expect((slugInput as HTMLInputElement).value).toBe('custom-slug');

    // Now change name again — slug should NOT update
    fireEvent.change(nameInput, { target: { value: 'Second Name' } });
    expect((slugInput as HTMLInputElement).value).toBe('custom-slug');
  });

  it('calls create API on form submit', async () => {
    mockPost.mockResolvedValue({ id: 'new-space', name: 'Test Space' });
    const onOpenChange = vi.fn();
    renderModal({ onOpenChange });

    const nameInput = screen.getByPlaceholderText('스페이스 이름');
    fireEvent.change(nameInput, { target: { value: 'Test Space' } });

    const form = nameInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/workspaces/ws-1/wiki-spaces',
      expect.objectContaining({
        name: 'Test Space',
        slug: 'test-space',
      }),
    );
  });

  it('cancel button calls onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    renderModal({ onOpenChange });

    fireEvent.click(screen.getByText('취소'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not submit when name is empty', () => {
    renderModal();

    const nameInput = screen.getByPlaceholderText('스페이스 이름');
    const form = nameInput.closest('form')!;
    fireEvent.submit(form);

    // No API call should be made
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('renders edit form with pre-filled data when space is provided', () => {
    const space = {
      id: 'space-1',
      workspaceId: 'ws-1',
      name: 'Existing Space',
      slug: 'existing-space',
      description: 'A description',
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    };

    renderModal({ space: space as never });

    expect(screen.getByText('스페이스 수정')).toBeDefined();

    const nameInput = screen.getByPlaceholderText('스페이스 이름') as HTMLInputElement;
    expect(nameInput.value).toBe('Existing Space');

    const slugInput = screen.getByPlaceholderText('space-slug') as HTMLInputElement;
    expect(slugInput.value).toBe('existing-space');
  });
});
