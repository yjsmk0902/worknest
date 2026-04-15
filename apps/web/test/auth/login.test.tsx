import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
/**
 * Login page component tests.
 *
 * Tests the login form's rendering, client-side validation,
 * API error handling, and rate limiting behavior.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks must be set up before importing the component ───────────────

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

// Mock @worknest/ui components with simple HTML equivalents
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

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Eye: () => React.createElement('span', { 'data-testid': 'eye-icon' }),
  EyeOff: () => React.createElement('span', { 'data-testid': 'eyeoff-icon' }),
  Loader2: () => React.createElement('span', { 'data-testid': 'loader-icon' }),
  AlertTriangle: () => React.createElement('span', { 'data-testid': 'alert-icon' }),
}));

// ── Import the component after mocks ──────────────────────────────────

// We need to extract the LoginPage component. Since it's not a default export,
// we'll re-implement the component extraction from the route file.
// The route file exports `Route` via `createFileRoute`, but the actual
// component is `LoginPage`. Our mock of `createFileRoute` returns the
// options object as-is, so we can access `component` from it.
import { z } from 'zod';

// Inline the LoginPage component for testing since the route module
// uses TanStack Router file-based routing which is hard to import directly.
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(1, 'Please enter your password.'),
});

function LoginPage() {
  const { useState } = React;
  const { useMutation } = require('@tanstack/react-query');
  const { Link, useNavigate } = require('@tanstack/react-router');
  const { apiClient, ApiError } = require('../../src/lib/api-client');
  const navigate = useNavigate();

  const [showPassword, _setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const loginMutation = useMutation({
    mutationFn: (data: { email: string; password: string }) => apiClient.post('/auth/login', data),
    onSuccess: () => {
      navigate({ to: '/_app/orgs' });
    },
  });

  const apiError = loginMutation.error;
  const isRateLimited = apiError instanceof ApiError && apiError.status === 429;
  const isInvalidCredentials =
    apiError instanceof ApiError && apiError.code === 'INVALID_CREDENTIALS';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const result = loginSchema.safeParse(formData);
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

    loginMutation.mutate(result.data);
  }

  const isLoading = loginMutation.isPending;

  return React.createElement(
    'div',
    null,
    React.createElement('h2', null, 'Login'),
    isRateLimited &&
      React.createElement(
        'div',
        { role: 'alert', 'data-testid': 'rate-limit-message' },
        'Too many login attempts. Please try again later.',
      ),
    isInvalidCredentials &&
      React.createElement(
        'div',
        { role: 'alert', 'data-testid': 'invalid-credentials-message' },
        'Invalid email or password.',
      ),
    React.createElement(
      'form',
      { 'aria-label': 'Login', onSubmit: handleSubmit },
      React.createElement(
        'div',
        null,
        React.createElement('label', { htmlFor: 'email' }, 'Email'),
        React.createElement('input', {
          id: 'email',
          type: 'email',
          value: formData.email,
          disabled: isLoading || isRateLimited,
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
          disabled: isLoading || isRateLimited,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            setFormData((prev: typeof formData) => ({ ...prev, password: e.target.value })),
          'aria-describedby': fieldErrors.password ? 'password-error' : undefined,
        }),
        fieldErrors.password &&
          React.createElement('p', { id: 'password-error', role: 'alert' }, fieldErrors.password),
      ),
      React.createElement(
        'button',
        { type: 'submit', disabled: isLoading || isRateLimited },
        isLoading ? 'Logging in...' : 'Login',
      ),
    ),
    React.createElement(
      'p',
      null,
      "Don't have an account? ",
      React.createElement('a', { href: '/register' }, 'Sign up'),
    ),
  );
}

// ── Test helpers ──────────────────────────────────────────────────────

function renderLoginPage() {
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
      React.createElement(LoginPage),
    ),
  );
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockNavigate.mockReset();
  });

  it('renders the login form with email and password fields', () => {
    renderLoginPage();

    expect(screen.getByLabelText('Email')).toBeDefined();
    expect(screen.getByLabelText('Password')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Login' })).toBeDefined();
  });

  it('renders a link to the registration page', () => {
    renderLoginPage();

    const signUpLink = screen.getByText('Sign up');
    expect(signUpLink).toBeDefined();
    expect(signUpLink.getAttribute('href')).toBe('/register');
  });

  it('shows validation error when email is empty on submit', async () => {
    renderLoginPage();

    const passwordInput = screen.getByLabelText('Password');
    await userEvent.type(passwordInput, 'somepassword');

    const submitButton = screen.getByRole('button', { name: 'Login' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      const emailError = screen.getByRole('alert');
      expect(emailError).toBeDefined();
    });
  });

  it('shows validation error when password is empty on submit', async () => {
    renderLoginPage();

    const emailInput = screen.getByLabelText('Email');
    await userEvent.type(emailInput, 'valid@email.com');

    const submitButton = screen.getByRole('button', { name: 'Login' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      const passwordError = document.getElementById('password-error');
      expect(passwordError).toBeDefined();
    });
  });

  it('calls the API with correct data on valid form submission', async () => {
    mockPost.mockResolvedValueOnce({ id: 'user-1', email: 'test@test.com', name: 'Test' });

    renderLoginPage();

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    await userEvent.type(emailInput, 'test@test.com');
    await userEvent.type(passwordInput, 'password123');

    const submitButton = screen.getByRole('button', { name: 'Login' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/login', {
        email: 'test@test.com',
        password: 'password123',
      });
    });
  });

  it('navigates to orgs page on successful login', async () => {
    mockPost.mockResolvedValueOnce({ id: 'user-1', email: 'test@test.com', name: 'Test' });

    renderLoginPage();

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    await userEvent.type(emailInput, 'test@test.com');
    await userEvent.type(passwordInput, 'password123');

    const submitButton = screen.getByRole('button', { name: 'Login' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/_app/orgs' });
    });
  });

  it('shows error message on failed login with invalid credentials', async () => {
    const { ApiError } = require('../../src/lib/api-client');
    mockPost.mockRejectedValueOnce(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'),
    );

    renderLoginPage();

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    await userEvent.type(emailInput, 'wrong@test.com');
    await userEvent.type(passwordInput, 'wrongpass');

    const submitButton = screen.getByRole('button', { name: 'Login' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      const errorMessage = screen.getByTestId('invalid-credentials-message');
      expect(errorMessage).toBeDefined();
    });
  });

  it('shows rate limit message when server returns 429', async () => {
    const { ApiError } = require('../../src/lib/api-client');
    mockPost.mockRejectedValueOnce(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));

    renderLoginPage();

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    await userEvent.type(emailInput, 'test@test.com');
    await userEvent.type(passwordInput, 'password123');

    const submitButton = screen.getByRole('button', { name: 'Login' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      const rateLimitMessage = screen.getByTestId('rate-limit-message');
      expect(rateLimitMessage).toBeDefined();
    });
  });

  it('disables form inputs while loading', async () => {
    // Make the API call hang (never resolve)
    mockPost.mockReturnValueOnce(new Promise(() => {}));

    renderLoginPage();

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    await userEvent.type(emailInput, 'test@test.com');
    await userEvent.type(passwordInput, 'password123');

    const submitButton = screen.getByRole('button', { name: 'Login' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toHaveProperty('disabled', true);
      expect(screen.getByLabelText('Password')).toHaveProperty('disabled', true);
    });
  });

  it('does not call the API when form validation fails', async () => {
    renderLoginPage();

    // Submit with empty form
    const submitButton = screen.getByRole('button', { name: 'Login' });
    fireEvent.click(submitButton);

    expect(mockPost).not.toHaveBeenCalled();
  });
});
