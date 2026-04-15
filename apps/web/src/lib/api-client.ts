const API_BASE_URL = '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ApiErrorResponse | undefined;
    try {
      errorData = (await response.json()) as ApiErrorResponse;
    } catch {
      // Response body is not JSON
    }

    throw new ApiError(
      response.status,
      errorData?.error?.code ?? 'UNKNOWN_ERROR',
      errorData?.error?.message ?? `HTTP ${response.status}`,
      errorData?.error?.details,
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const json = await response.json();

  // Unwrap standard `{ data: T }` envelope if present.
  // List endpoints return `{ data: [...], pagination: {...} }` — return as-is.
  if (json && typeof json === 'object' && 'data' in json && !('pagination' in json)) {
    return json.data as T;
  }

  return json as T;
}

export interface ListResponse<T> {
  data: T[];
  pagination: {
    next_cursor: string | null;
    has_more: boolean;
  };
}

export const apiClient = {
  async getList<T>(path: string, params?: Record<string, string>): Promise<ListResponse<T>> {
    const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    const response = await fetch(url.toString(), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      let errorData: ApiErrorResponse | undefined;
      try {
        errorData = (await response.json()) as ApiErrorResponse;
      } catch {
        /* empty */
      }
      throw new ApiError(
        response.status,
        errorData?.error?.code ?? 'UNKNOWN_ERROR',
        errorData?.error?.message ?? `HTTP ${response.status}`,
        errorData?.error?.details,
      );
    }
    return (await response.json()) as ListResponse<T>;
  },

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    const response = await fetch(url.toString(), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return handleResponse<T>(response);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      credentials: 'include',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    return handleResponse<T>(response);
  },
};
