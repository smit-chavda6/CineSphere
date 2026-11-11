import 'server-only';
import { TmdbError, codeForStatus } from './errors';
import { tmdbDispatcher } from './dns';

const BASE = 'https://api.themoviedb.org/3';
const MAX_ATTEMPTS = 3;

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export interface TmdbFetchOptions {
  /** Seconds to cache in Next's data cache. Lists: 3600, details: 86400. */
  revalidate?: number;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.TMDB_API_KEY?.trim());
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Server-only TMDB fetcher. The API key never leaves the server.
 * Supports both v3 API keys (query param) and v4 read tokens (Bearer header).
 * Retries 429 / 5xx / network errors with exponential backoff, honouring Retry-After.
 */
export async function tmdb<T>(
  path: string,
  params: QueryParams = {},
  { revalidate = 3600 }: TmdbFetchOptions = {},
): Promise<T> {
  const key = process.env.TMDB_API_KEY?.trim();
  if (!key) throw new TmdbError('TMDB_API_KEY is not configured.', 503, 'missing_key');

  const url = new URL(BASE + (path.startsWith('/') ? path : `/${path}`));
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  // Adult content is always excluded, regardless of what the caller asked for.
  url.searchParams.set('include_adult', 'false');

  const headers: Record<string, string> = { accept: 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set('api_key', key);

  let lastError: TmdbError = new TmdbError('TMDB is unreachable right now.', 503, 'unreachable');

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      const dispatcher = tmdbDispatcher();
      res = await fetch(url, {
        headers,
        next: { revalidate },
        signal: AbortSignal.timeout(12000),
        // Node's fetch (undici) accepts a custom dispatcher; used to bypass ISP DNS blocks.
        ...(dispatcher ? ({ dispatcher } as Record<string, unknown>) : {}),
      });
    } catch {
      lastError = new TmdbError('TMDB is unreachable right now.', 503, 'unreachable');
      if (attempt < MAX_ATTEMPTS - 1) await sleep(300 * 2 ** attempt);
      continue;
    }

    if (res.ok) return (await res.json()) as T;

    const code = codeForStatus(res.status);
    lastError = new TmdbError(`TMDB request failed (${res.status})`, res.status, code);
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const wait =
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 300 * 2 ** attempt;
      if (attempt < MAX_ATTEMPTS - 1) await sleep(Math.min(wait, 4000));
      continue;
    }
    throw lastError; // 4xx other than 429: not retryable
  }

  throw lastError;
}

/** Resolve to null instead of throwing; used for optional page sections. */
export async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[tmdb]', err instanceof Error ? err.message : err);
    }
    return null;
  }
}
