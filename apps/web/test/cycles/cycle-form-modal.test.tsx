/**
 * CycleFormModal component tests.
 *
 * Tests create and edit modes, form validation, API calls,
 * cancel behavior, and date overlap warning.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks ─────────────────────────────────────────────────────────────

const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockGetList = vi.fn();

vi.mock("../../src/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
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
      this.name = "ApiError";
      this.status = status;
      this.code = code;
    }
  },
}));

const mockToast = vi.fn();

vi.mock("@worknest/ui", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange?: (v: boolean) => void;
  }) => (open ? React.createElement("div", { "data-testid": "dialog" }, children) : null),
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => React.createElement("div", { className }, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement("h2", null, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement("p", null, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "dialog-footer" }, children),
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
      "button",
      { onClick, type, "data-variant": variant, disabled, ...rest },
      children,
    ),
  Input: ({
    id,
    value,
    onChange,
    type,
    placeholder,
    autoFocus,
    maxLength,
    ...rest
  }: {
    id?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
    placeholder?: string;
    autoFocus?: boolean;
    maxLength?: number;
    [key: string]: unknown;
  }) =>
    React.createElement("input", {
      id,
      value,
      onChange,
      type: type ?? "text",
      placeholder,
      autoFocus,
      maxLength,
      ...rest,
    }),
  Label: ({
    children,
    htmlFor,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
  }) => React.createElement("label", { htmlFor }, children),
  Separator: () => React.createElement("hr"),
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock("lucide-react", () => {
  const icon = (testId: string) =>
    ({ className }: { className?: string }) =>
      React.createElement("span", { "data-testid": testId, className });
  return {
    AlertTriangle: icon("alert-triangle-icon"),
  };
});

// ── Import component after mocks ────────────────────────────────────

import { CycleFormModal } from "../../src/components/cycles/cycle-form-modal";

// ── Helpers ───────────────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderModal(props: Partial<React.ComponentProps<typeof CycleFormModal>> = {}) {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    projectId: "proj-1",
    ...props,
  };

  const queryClient = createQueryClient();

  return {
    ...render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(CycleFormModal, defaultProps as never),
      ),
    ),
    onOpenChange: defaultProps.onOpenChange,
    queryClient,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("CycleFormModal", () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockPatch.mockReset();
    mockGetList.mockReset();
    mockToast.mockReset();
    // Default: return empty cycles list for overlap check
    mockGetList.mockResolvedValue({ data: [], pagination: { next_cursor: null, has_more: false } });
  });

  it("renders create form with empty fields when no cycle provided", () => {
    renderModal();

    expect(screen.getByText("사이클 생성")).toBeDefined();
    expect(screen.getByText("새로운 사이클을 생성합니다.")).toBeDefined();

    const nameInput = screen.getByPlaceholderText("사이클 이름을 입력하세요") as HTMLInputElement;
    expect(nameInput.value).toBe("");

    const descInput = screen.getByPlaceholderText(
      "사이클 목표나 설명을 입력하세요 (선택)",
    ) as HTMLTextAreaElement;
    expect(descInput.value).toBe("");
  });

  it("renders edit form with pre-filled data when cycle is provided", () => {
    const cycle = {
      id: "cycle-1",
      projectId: "proj-1",
      name: "Sprint 1",
      description: "First sprint",
      status: "active",
      startDate: "2026-04-01",
      endDate: "2026-04-14",
      createdAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-01T00:00:00Z",
    };

    renderModal({ cycle: cycle as never });

    expect(screen.getByText("사이클 편집")).toBeDefined();
    expect(screen.getByText("사이클 정보를 수정합니다.")).toBeDefined();

    const nameInput = screen.getByPlaceholderText("사이클 이름을 입력하세요") as HTMLInputElement;
    expect(nameInput.value).toBe("Sprint 1");

    const descInput = screen.getByPlaceholderText(
      "사이클 목표나 설명을 입력하세요 (선택)",
    ) as HTMLTextAreaElement;
    expect(descInput.value).toBe("First sprint");
  });

  it("shows validation error when name is empty on submit", () => {
    renderModal();

    const form = screen.getByPlaceholderText("사이클 이름을 입력하세요").closest("form")!;
    fireEvent.submit(form);

    expect(screen.getByText("사이클 이름은 필수입니다")).toBeDefined();
  });

  it("calls create API on submit for new cycle", async () => {
    mockPost.mockResolvedValue({ id: "new-cycle", name: "New Sprint" });
    renderModal();

    const nameInput = screen.getByPlaceholderText("사이클 이름을 입력하세요");
    fireEvent.change(nameInput, { target: { value: "New Sprint" } });

    const form = nameInput.closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/projects/proj-1/cycles",
      expect.objectContaining({ name: "New Sprint" }),
    );
  });

  it("calls update API on submit for existing cycle", async () => {
    mockPatch.mockResolvedValue({ id: "cycle-1", name: "Updated Sprint" });

    const cycle = {
      id: "cycle-1",
      projectId: "proj-1",
      name: "Sprint 1",
      description: null,
      status: "draft",
      startDate: null,
      endDate: null,
      createdAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-01T00:00:00Z",
    };

    renderModal({ cycle: cycle as never });

    const nameInput = screen.getByPlaceholderText("사이클 이름을 입력하세요");
    fireEvent.change(nameInput, { target: { value: "Updated Sprint" } });

    const form = nameInput.closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledTimes(1);
    });

    expect(mockPatch).toHaveBeenCalledWith(
      "/cycles/cycle-1",
      expect.objectContaining({ name: "Updated Sprint" }),
    );
  });

  it("cancel button calls onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    renderModal({ onOpenChange });

    fireEvent.click(screen.getByText("취소"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows date overlap warning when dates conflict with existing cycle", async () => {
    // Simulate existing cycle in date range
    mockGetList.mockResolvedValue({
      data: [
        {
          id: "existing-cycle",
          name: "Existing Sprint",
          status: "active",
          startDate: "2026-04-05",
          endDate: "2026-04-15",
        },
      ],
      pagination: { next_cursor: null, has_more: false },
    });

    renderModal();

    // Wait for query to resolve
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });

    // Set overlapping dates
    const startDateInput = screen.getByLabelText("시작일") as HTMLInputElement;
    const endDateInput = screen.getByLabelText("종료일") as HTMLInputElement;

    fireEvent.change(startDateInput, { target: { value: "2026-04-01" } });
    fireEvent.change(endDateInput, { target: { value: "2026-04-10" } });

    await waitFor(() => {
      expect(screen.getByText(/Existing Sprint/)).toBeDefined();
      expect(screen.getByText(/겹칩니다/)).toBeDefined();
    });
  });

  it("does not render when open is false", () => {
    renderModal({ open: false });

    expect(screen.queryByText("사이클 생성")).toBeNull();
    expect(screen.queryByText("사이클 편집")).toBeNull();
  });
});
