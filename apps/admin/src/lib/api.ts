export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : `Request failed (${status})`;
    super(message);
    this.status = status;
    this.body = body;
  }
  get errors(): { path?: string; message: string }[] {
    const b = this.body as { errors?: { path?: string; message: string }[] | string[] };
    if (!b?.errors) return [];
    return b.errors.map((e) => (typeof e === 'string' ? { message: e } : e));
  }
  get code(): string | undefined {
    return (this.body as { code?: string })?.code;
  }
}

async function request<T>(method: string, path: string, body?: unknown, isForm = false): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: isForm ? {} : body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !path.startsWith('/auth/login') && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
    throw new ApiError(401, { message: 'Session expired' });
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  postForm: <T>(path: string, form: FormData) => request<T>('POST', path, form, true),
};
