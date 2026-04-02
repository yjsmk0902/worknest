/**
 * Web test setup — jsdom environment, mock API client, and test utilities.
 *
 * Provides a render function wrapped with the providers needed by
 * the application (QueryClientProvider, Router context, etc.).
 */
import { vi } from "vitest";

// ── Mock API Client ───────────────────────────────────────────────────

/**
 * A mock API client that mirrors the interface from `../../src/lib/api-client`.
 * Each method is a vitest mock function.
 */
export const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

/**
 * Mock ApiError class for simulating API failures in tests.
 */
export class MockApiError extends Error {
  public status: number;
  public code: string;
  public details?: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ── Mock modules ──────────────────────────────────────────────────────

// Mock the api-client module so all components that import it get mocks.
vi.mock("../../src/lib/api-client", () => ({
  apiClient: mockApiClient,
  ApiError: MockApiError,
}));

// Mock TanStack Router hooks
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) => {
      // Simple anchor tag for testing
      const anchor = Object.assign(document.createElement("a"), { href: to });
      return actual.Link ? (actual as never) : { children, to, ...props };
    },
    createFileRoute: (path: string) => (opts: unknown) => opts,
  };
});

// ── localStorage mock ─────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// ── Reset helpers ─────────────────────────────────────────────────────

export function resetMocks() {
  mockApiClient.get.mockReset();
  mockApiClient.post.mockReset();
  mockApiClient.patch.mockReset();
  mockApiClient.delete.mockReset();
  localStorageMock.clear();
}
