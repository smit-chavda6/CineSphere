import { NextResponse, type NextRequest } from 'next/server';
import { tmdb } from '@/lib/tmdb/server';
import { TmdbError } from '@/lib/tmdb/errors';

/**
 * Read-only proxy so the browser can query TMDB without ever seeing the API key.
 * Only an allowlist of GET endpoints is forwarded.
 */
const ALLOWED: RegExp[] = [
  /^discover\/movie$/,
  /^movie\/\d+$/,
  /^movie\/\d+\/(recommendations|similar|keywords|credits|videos|release_dates|watch\/providers)$/,
  /^movie\/(now_playing|upcoming|top_rated|popular)$/,
  /^trending\/movie\/(day|week)$/,
  /^search\/(movie|person|collection|keyword|company|multi)$/,
  /^person\/\d+$/,
  /^collection\/\d+$/,
  /^genre\/movie\/list$/,
  /^configuration\/(languages|countries)$/,
  /^watch\/providers\/(movie|regions)$/,
  /^certification\/movie\/list$/,
];

const LONG_CACHE: RegExp[] = [
  /^movie\/\d+/,
  /^person\/\d+/,
  /^collection\/\d+/,
  /^genre\//,
  /^configuration\//,
  /^certification\//,
  /^watch\/providers\//,
];

const MAX_PARAMS = 40;
const MAX_VALUE_LENGTH = 600;

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  if (!ALLOWED.some((r) => r.test(path))) {
    return NextResponse.json(
      { error: 'Endpoint not allowed', code: 'bad_request' },
      { status: 400 },
    );
  }

  const query: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of req.nextUrl.searchParams) {
    if (k === 'api_key' || k === 'include_adult') continue;
    if (++count > MAX_PARAMS || v.length > MAX_VALUE_LENGTH) {
      return NextResponse.json({ error: 'Query too large', code: 'bad_request' }, { status: 400 });
    }
    query[k] = v;
  }
  if (!query.language) query.language = 'en-US';

  const revalidate = LONG_CACHE.some((r) => r.test(path)) ? 86400 : 3600;
  try {
    const data = await tmdb<unknown>(path, query, { revalidate });
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate * 2}`,
      },
    });
  } catch (err) {
    const e = err instanceof TmdbError ? err : new TmdbError('Unexpected error', 500);
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
}
