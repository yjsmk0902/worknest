/**
 * useFileUpload hook tests.
 *
 * Tests file size validation (25MB max), blocked extensions,
 * and allowed file types. Uses renderHook from @testing-library/react.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Mocks ─────────────────────────────────────────────────────────────

// Mock XMLHttpRequest
class MockXHR {
  static lastInstance: MockXHR | null = null;

  open = vi.fn();
  send = vi.fn();
  withCredentials = false;
  status = 200;
  responseText = '{"data":{"id":"file-1","name":"test.png","url":"/files/test.png"}}';

  upload = {
    addEventListener: vi.fn(),
  };

  addEventListener = vi.fn((event: string, handler: () => void) => {
    if (event === "load") {
      // Store the load handler for later invocation
      (this as Record<string, unknown>)._loadHandler = handler;
    }
  });

  constructor() {
    MockXHR.lastInstance = this;
  }

  // Simulate completing the upload
  triggerLoad() {
    const handler = (this as Record<string, unknown>)._loadHandler as (() => void) | undefined;
    if (handler) handler();
  }
}

const originalXHR = globalThis.XMLHttpRequest;

// ── Import hook after mocks ─────────────────────────────────────────

import { useFileUpload } from "../../src/hooks/use-file-upload";

// ── Helpers ───────────────────────────────────────────────────────────

function createFile(
  name: string,
  sizeBytes: number,
  type = "application/octet-stream",
): File {
  const content = new Uint8Array(Math.min(sizeBytes, 1024));
  const file = new File([content], name, { type });
  // Override the size property since File constructor may not honor exact size
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("useFileUpload", () => {
  beforeEach(() => {
    MockXHR.lastInstance = null;
    globalThis.XMLHttpRequest = MockXHR as unknown as typeof XMLHttpRequest;
  });

  afterEach(() => {
    globalThis.XMLHttpRequest = originalXHR;
  });

  it("rejects files exceeding 25MB", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useFileUpload({ onError }));

    const largeFile = createFile("big-file.zip", 26 * 1024 * 1024);

    let uploadResult: unknown;
    await act(async () => {
      uploadResult = await result.current.upload(largeFile);
    });

    expect(uploadResult).toBeNull();
    expect(result.current.error).toBe("파일 크기는 25MB를 초과할 수 없습니다");
    expect(onError).toHaveBeenCalledWith("파일 크기는 25MB를 초과할 수 없습니다");
  });

  it("accepts files at exactly 25MB", async () => {
    const { result } = renderHook(() => useFileUpload());

    const exactFile = createFile("exact.zip", 25 * 1024 * 1024);

    // Start upload — it won't reject for size
    act(() => {
      result.current.upload(exactFile);
    });

    // File was not rejected, XHR was created
    expect(MockXHR.lastInstance).not.toBeNull();
    expect(MockXHR.lastInstance!.open).toHaveBeenCalledWith(
      "POST",
      "/api/v1/files/upload",
    );
  });

  it("blocks .exe files", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useFileUpload({ onError }));

    const exeFile = createFile("malware.exe", 1024);

    let uploadResult: unknown;
    await act(async () => {
      uploadResult = await result.current.upload(exeFile);
    });

    expect(uploadResult).toBeNull();
    expect(result.current.error).toBe("이 파일 형식은 업로드할 수 없습니다");
    expect(onError).toHaveBeenCalledWith("이 파일 형식은 업로드할 수 없습니다");
  });

  it("blocks .bat files", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useFileUpload({ onError }));

    const batFile = createFile("script.bat", 1024);

    let uploadResult: unknown;
    await act(async () => {
      uploadResult = await result.current.upload(batFile);
    });

    expect(uploadResult).toBeNull();
    expect(result.current.error).toBe("이 파일 형식은 업로드할 수 없습니다");
  });

  it("blocks .cmd, .sh, and .ps1 files", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useFileUpload({ onError }));

    for (const ext of [".cmd", ".sh", ".ps1"]) {
      const file = createFile(`script${ext}`, 1024);

      await act(async () => {
        await result.current.upload(file);
      });

      expect(result.current.error).toBe("이 파일 형식은 업로드할 수 없습니다");
    }
  });

  it("allows valid file types (png, pdf, docx)", async () => {
    const { result } = renderHook(() => useFileUpload());

    const validFiles = [
      createFile("photo.png", 1024, "image/png"),
      createFile("document.pdf", 2048, "application/pdf"),
      createFile("report.docx", 4096, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ];

    for (const file of validFiles) {
      MockXHR.lastInstance = null;

      act(() => {
        result.current.upload(file);
      });

      // Should create an XHR request (not reject)
      expect(MockXHR.lastInstance).not.toBeNull();
      expect(MockXHR.lastInstance!.open).toHaveBeenCalledWith(
        "POST",
        "/api/v1/files/upload",
      );
    }
  });

  it("sets uploading to true during upload", () => {
    const { result } = renderHook(() => useFileUpload());

    const file = createFile("test.png", 1024, "image/png");

    act(() => {
      result.current.upload(file);
    });

    expect(result.current.uploading).toBe(true);
  });
});
