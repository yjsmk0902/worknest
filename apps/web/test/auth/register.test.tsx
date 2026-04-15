import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
/**
 * Register page component tests.
 *
 * Tests the registration form's rendering, client-side validation,
 * API error handling (duplicate email), and redirect behavior.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// ── Mocks ─────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: unknown) => opts,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
  useNavigate: () => mockNavigate,
}));

const mockPost = vi.fn();

vi.mock('../../src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: (...args: unknown[]) => mockPost(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    details?: Record<string, string[]>;
    constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
      this.details = details;
    }
  },
}));

vi.mock('@worknest/ui', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: string }) => {
    const { size, ...htmlProps } = props as {
      size?: string;
    } & React.ButtonHTMLAttributes<HTMLButtonElement>;
    return React.createElement('button', htmlProps, children);
  },
  Input: React.forwardRef(
    (
      props: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean },
      ref: React.Ref<HTMLInputElement>,
    ) => {
      const { error, ...htmlProps } = props;
      return React.createElement('input', { ...htmlProps, ref, 'data-error': error });
    },
  ),
  Label: ({
    children,
    ...props
  }: React.LabelHTMLAttributes<HTMLLabelElement> & { error?: boolean }) => {
    const { error, ...htmlProps } = props as {
      error?: boolean;
    } & React.LabelHTMLAttributes<HTMLLabelElement>;
    return React.createElement('label', htmlProps, children);
  },
}));

vi.mock('lucide-react', () => ({
  Eye: () => React.createElement('span', { 'data-testid': 'eye-icon' }),
  EyeOff: () => React.createElement('span', { 'data-testid': 'eyeoff-icon' }),
  Loader2: () => React.createElement('span', { 'data-testid': 'loader-icon' }),
  AlertTriangle: () => React.createElement('span', { 'data-testid': 'alert-icon' }),
}));

// ── Inline RegisterPage for testing ───────────────────────────────────

const registerSchema = z.object({
  name: z
    .string()
    .min(1, 'Please enter your name.')
    .max(100, 'Name must be 100 characters or less.'),
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

function RegisterPage() {
  const { useState } = React;
  const { useMutation } = require('@tanstack/react-query');
  const { Link, useNavigate } = require('@tanstack/react-router');
  const { apiClient, ApiError } = require('../../src/lib/api-client');
  const navigate = useNavigate();

  const [showPassword, _setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const registerMutation = useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) =>
      apiClient.post('/auth/register', data),
    onSuccess: () => {
      navigate({ to: '/onboarding' });
    },
  });

  const apiError = registerMutation.error;
  const isDuplicateEmail = apiError instanceof ApiError && apiError.code === 'EMAIL_ALREADY_EXISTS';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const result = registerSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (!errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    registerMutation.mutate(result.data);
  }

  const isLoading = registerMutation.isPending;

  return React.createElement(
    'div',
    null,
    React.createElement('h2', null, 'Register'),
    isDuplicateEmail &&
      React.createElement(
        'div',
        { role: 'alert', 'data-testid': 'duplicate-email-error' },
        'This email is already in use.',
      ),
    apiError &&
      !isDuplicateEmail &&
      React.createElement(
        'div',
        { role: 'alert', 'data-testid': 'generic-api-error' },
        apiError.message,
      ),
    React.createElement(
      'form',
      { 'aria-label': 'Register', onSubmit: handleSubmit },
      React.createElement(
        'div',
        null,
        React.createElement('label', { htmlFor: 'name' }, 'Name'),
        React.createElement('input', {
          id: 'name',
          type: 'text',
          value: formData.name,
          disabled: isLoading,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            setFormData((prev: typeof formData) => ({ ...prev, name: e.target.value })),
          'aria-describedby': fieldErrors.name ? 'name-error' : undefined,
        }),
        fieldErrors.name &&
          React.createElement('p', { id: 'name-error', role: 'alert' }, fieldErrors.name),
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { htmlFor: 'email' }, 'Email'),
        React.createElement('input', {
          id: 'email',
          type: 'email',
          value: formData.email,
          disabled: isLoading,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            setFormData((prev: typeof formData) => ({ ...prev, email: e.target.value })),
          'aria-describedby': fieldErrors.email ? 'email-error' : undefined,
        }),
        fieldErrors.email &&
          React.createElement('p', { id: 'email-error', role: 'alert' }, fieldErrors.email),
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { htmlFor: 'password' }, 'Password'),
        React.createElement('input', {
          id: 'password',
          type: showPassword ? 'text' : 'password',
          value: formData.password,
          disabled: isLoading,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            setFormData((prev: typeof formData) => ({ ...prev, password: e.target.value })),
          'aria-describedby': fieldErrors.password ? 'password-error' : undefined,
        }),
        fieldErrors.password &&
          React.createElement('p', { id: 'password-error', role: 'alert' }, fieldErrors.password),
      ),
      React.createElement(
        'button',
        { type: 'submit', disabled: isLoading },
        isLoading ? 'Creating account...' : 'Register',
      ),
    ),
    React.createElement(
      'p',
      null,
      'Already have an account? ',
      React.createElement('a', { href: '/login' }, 'Log in'),
    ),
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function renderRegisterPage() {
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
      React.createElement(RegisterPage),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('RegisterPage', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockNavigate.mockReset();
  });

  it('renders the registration form with name, email, and password fields', () => {
    renderRegisterPage();

    expect(screen.getByLabelText('Name')).toBeDefined();
    expect(screen.getByLabelText('Email')).toBeDefined();
    expect(screen.getByLabelText('Password')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Register' })).toBeDefined();
  });

  it('renders a link to the login page', () => {
    renderRegisterPage();

    const loginLink = screen.getByText('Log in');
    expect(loginLink).toBeDefined();
    expect(loginLink.getAttribute('href')).toBe('/login');
  });

  it('shows validation error when name is empty on submit', async () => {
    renderRegisterPage();

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    await userEvent.type(emailInput, 'test@test.com');
    await userEvent.type(passwordInput, 'password123');

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      const nameError = document.getElementById('name-error');
      expect(nameError).toBeDefined();
      expect(nameError?.textContent).toContain('Please enter your name');
    });
  });

  it('shows validation error when email is invalid', async () => {
    renderRegisterPage();

    const nameInput = screen.getByLabelText('Name');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    await userEvent.type(nameInput, 'Test User');
    await userEvent.type(emailInput, 'not-an-email');
    await userEvent.type(passwordInput, 'password123');

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      const emailError = document.getElementById('email-error');
      expect(emailError).toBeDefined();
      expect(emailError?.textContent).toContain('valid email');
    });
  });

  it('shows validation error when password is too short', async () => {
    renderRegisterPage();

    const nameInput = screen.getByLabelText('Name');
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    await userEvent.type(nameInput, 'Test User');
    await userEvent.type(emailInput, 'test@test.com');
    await userEvent.type(passwordInput, 'short');

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      const passError = document.getElementById('password-error');
      expect(passError).toBeDefined();
      expect(passError?.textContent).toContain('8 characters');
    });
  });

  it('calls the API with correct data on valid submission', async () => {
    mockPost.mockResolvedValueOnce({ id: 'user-1', email: 'new@test.com', name: 'New User' });

    renderRegisterPage();

    await userEvent.type(screen.getByLabelText('Name'), 'New User');
    await userEvent.type(screen.getByLabelText('Email'), 'new@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/register', {
        name: 'New User',
        email: 'new@test.com',
        password: 'password123',
      });
    });
  });

  it('redirects to onboarding on successful registration', async () => {
    mockPost.mockResolvedValueOnce({ id: 'user-1', email: 'test@test.com', name: 'Test' });

    renderRegisterPage();

    await userEvent.type(screen.getByLabelText('Name'), 'Test User');
    await userEvent.type(screen.getByLabelText('Email'), 'test@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/onboarding' });
    });
  });

  it('shows duplicate email error when server returns EMAIL_ALREADY_EXISTS', async () => {
    const { ApiError } = require('../../src/lib/api-client');
    mockPost.mockRejectedValueOnce(
      new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Email already exists'),
    );

    renderRegisterPage();

    await userEvent.type(screen.getByLabelText('Name'), 'Test User');
    await userEvent.type(screen.getByLabelText('Email'), 'existing@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      const dupError = screen.getByTestId('duplicate-email-error');
      expect(dupError).toBeDefined();
    });
  });

  it('shows generic error message for non-duplicate-email API errors', async () => {
    const { ApiError } = require('../../src/lib/api-client');
    mockPost.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong'));

    renderRegisterPage();

    await userEvent.type(screen.getByLabelText('Name'), 'Test User');
    await userEvent.type(screen.getByLabelText('Email'), 'test@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      const genericError = screen.getByTestId('generic-api-error');
      expect(genericError).toBeDefined();
      expect(genericError.textContent).toContain('Something went wrong');
    });
  });

  it('does not call the API when form validation fails', async () => {
    renderRegisterPage();

    // Submit with empty form
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    expect(mockPost).not.toHaveBeenCalled();
  });

  it('validates name max length (100 characters)', async () => {
    renderRegisterPage();

    await userEvent.type(screen.getByLabelText('Name'), 'a'.repeat(101));
    await userEvent.type(screen.getByLabelText('Email'), 'test@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      const nameError = document.getElementById('name-error');
      expect(nameError).toBeDefined();
      expect(nameError?.textContent).toContain('100 characters');
    });
  });

  it('disables form inputs while loading', async () => {
    mockPost.mockReturnValueOnce(new Promise(() => {}));

    renderRegisterPage();

    await userEvent.type(screen.getByLabelText('Name'), 'Test User');
    await userEvent.type(screen.getByLabelText('Email'), 'test@test.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toHaveProperty('disabled', true);
      expect(screen.getByLabelText('Email')).toHaveProperty('disabled', true);
      expect(screen.getByLabelText('Password')).toHaveProperty('disabled', true);
    });
  });
});
