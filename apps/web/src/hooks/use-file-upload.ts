import { useState, useCallback, useRef } from 'react';
import type { FileOutput } from '@worknest/shared/schemas/files';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.ps1'];

interface UseFileUploadOptions {
  /** Called on successful upload */
  onSuccess?: (file: FileOutput) => void;
  /** Called on error */
  onError?: (error: string) => void;
}

interface UseFileUploadReturn {
  /** Upload a file via multipart POST */
  upload: (file: File) => Promise<FileOutput | null>;
  /** Upload progress (0-100) */
  progress: number;
  /** Whether an upload is in progress */
  uploading: boolean;
  /** Error message if upload failed */
  error: string | null;
  /** The most recently uploaded file */
  uploadedFile: FileOutput | null;
}

/**
 * Hook for uploading files to the server.
 *
 * Validates file size (25MB max) and blocked extensions
 * before uploading. Returns progress, status, and error state.
 */
export function useFileUpload(
  options: UseFileUploadOptions = {},
): UseFileUploadReturn {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<FileOutput | null>(null);
  const abortRef = useRef<XMLHttpRequest | null>(null);

  const upload = useCallback(
    async (file: File): Promise<FileOutput | null> => {
      // Client-side validation
      if (file.size > MAX_FILE_SIZE) {
        const msg = '파일 크기는 25MB를 초과할 수 없습니다';
        setError(msg);
        options.onError?.(msg);
        return null;
      }

      const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
      if (BLOCKED_EXTENSIONS.includes(ext)) {
        const msg = '이 파일 형식은 업로드할 수 없습니다';
        setError(msg);
        options.onError?.(msg);
        return null;
      }

      setUploading(true);
      setError(null);
      setProgress(0);

      return new Promise<FileOutput | null>((resolve) => {
        const xhr = new XMLHttpRequest();
        abortRef.current = xhr;

        const formData = new FormData();
        formData.append('file', file);

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setProgress(pct);
          }
        });

        xhr.addEventListener('load', () => {
          setUploading(false);
          abortRef.current = null;

          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              const fileData = response.data ?? response;
              setUploadedFile(fileData);
              setProgress(100);
              options.onSuccess?.(fileData);
              resolve(fileData);
            } catch {
              const msg = '서버 응답을 처리할 수 없습니다';
              setError(msg);
              options.onError?.(msg);
              resolve(null);
            }
          } else {
            let msg = '업로드에 실패했습니다';
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              msg = errorResponse?.error?.message ?? msg;
            } catch {
              // Use default message
            }
            setError(msg);
            options.onError?.(msg);
            resolve(null);
          }
        });

        xhr.addEventListener('error', () => {
          setUploading(false);
          abortRef.current = null;
          const msg = '네트워크 오류가 발생했습니다';
          setError(msg);
          options.onError?.(msg);
          resolve(null);
        });

        xhr.addEventListener('abort', () => {
          setUploading(false);
          abortRef.current = null;
          setProgress(0);
          resolve(null);
        });

        xhr.open('POST', '/api/v1/files/upload');
        xhr.withCredentials = true;
        xhr.send(formData);
      });
    },
    [options],
  );

  return { upload, progress, uploading, error, uploadedFile };
}
