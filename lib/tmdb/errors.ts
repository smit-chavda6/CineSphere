export type TmdbErrorCode =
  | 'missing_key'
  | 'unauthorized'
  | 'not_found'
  | 'rate_limited'
  | 'unreachable'
  | 'bad_request'
  | 'unknown';

export class TmdbError extends Error {
  readonly status: number;
  readonly code: TmdbErrorCode;

  constructor(message: string, status: number, code: TmdbErrorCode = 'unknown') {
    super(message);
    this.name = 'TmdbError';
    this.status = status;
    this.code = code;
  }
}

export function codeForStatus(status: number): TmdbErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'unreachable';
  if (status >= 400) return 'bad_request';
  return 'unknown';
}

/** Turns any error into a short message that is safe and useful to show to people. */
export function friendlyMessage(err: unknown): string {
  const code = err instanceof TmdbError ? err.code : (err as { code?: TmdbErrorCode })?.code;
  switch (code) {
    case 'missing_key':
      return 'The movie database is not connected yet. Add TMDB_API_KEY to .env.local and restart.';
    case 'unauthorized':
      return 'The TMDB API key was rejected. Check TMDB_API_KEY.';
    case 'not_found':
      return 'We could not find that one.';
    case 'rate_limited':
      return 'Too many requests right now — give it a few seconds and try again.';
    case 'unreachable':
      return 'The movie database is not responding. Please try again shortly.';
    default:
      return 'Something went wrong while loading movies. Please try again.';
  }
}
