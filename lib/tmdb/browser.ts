import { friendlyMessage, type TmdbErrorCode, codeForStatus } from './errors';

/** Error thrown by the browser API helper; carries an HTTP status for retry decisions. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: TmdbErrorCode;
  constructor(message: string, status: number, code: TmdbErrorCode) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export type ApiParams = Record<string, string | number | boolean | null | undefined>;

/**
 * Browser-side TMDB access. Every call goes through our own `/api/tmdb/*` route,
 * which adds the secret key on the server.
 */
export async function api<T>(
  path: string,
  params: ApiParams = {},
  signal?: AbortSignal,
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const query = qs.toString();
  let res: Response;
  try {
    res = await fetch(`/api/tmdb/${path}${query ? `?${query}` : ''}`, { signal });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(friendlyMessage({ code: 'unreachable' }), 0, 'unreachable');
  }
  if (!res.ok) {
    let code: TmdbErrorCode = codeForStatus(res.status);
    try {
      const body = (await res.json()) as { code?: TmdbErrorCode };
      if (body.code) code = body.code;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new ApiError(friendlyMessage({ code }), res.status, code);
  }
  return (await res.json()) as T;
}

/** React Query retry policy: do not retry client errors, retry transient ones twice. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = error instanceof ApiError ? error.status : 0;
  if (status >= 400 && status < 500 && status !== 429) return false;
  return failureCount < 2;
}
