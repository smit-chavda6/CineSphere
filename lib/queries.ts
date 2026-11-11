import { api } from '@/lib/tmdb/browser';
import { blend, localize, pinned, type Focus } from '@/lib/focus';
import type {
  CollectionDetails,
  MovieDetails,
  MovieSummary,
  Paginated,
  PersonDetails,
} from '@/types/tmdb';

/** React Query definitions shared by places and capsules. Everything goes through /api/tmdb. */

const DAY = 1000 * 60 * 60 * 24;
const HALF_HOUR = 1000 * 60 * 30;

export const FILM_APPEND =
  'credits,videos,keywords,release_dates,watch/providers,similar,recommendations';

export const filmQuery = (id: number) => ({
  queryKey: ['film', id] as const,
  queryFn: () =>
    api<MovieDetails>(`movie/${id}`, {
      append_to_response: FILM_APPEND,
      include_video_language: 'en,hi,ta,te,ml,kn,ko,ja,null',
    }),
  staleTime: DAY,
});

/** Bare details (runtime etc.) without appended lists. */
export const filmLiteQuery = (id: number) => ({
  queryKey: ['film-lite', id] as const,
  queryFn: () => api<MovieDetails>(`movie/${id}`),
  staleTime: DAY,
});

export const personQuery = (id: number) => ({
  queryKey: ['person', id] as const,
  queryFn: () => api<PersonDetails>(`person/${id}`, { append_to_response: 'movie_credits' }),
  staleTime: DAY,
});

export const collectionQuery = (id: number) => ({
  queryKey: ['collection', id] as const,
  queryFn: () => api<CollectionDetails>(`collection/${id}`),
  staleTime: DAY,
});

export type ListParams = Record<string, string | number>;

/** Same cache key as `fetchDiscover` in the recommendation pipeline, so results are shared. */
export const discoverQuery = (params: ListParams) => ({
  queryKey: ['discover', params] as const,
  queryFn: () => api<Paginated<MovieSummary>>('discover/movie', params),
  staleTime: HALF_HOUR,
});

export const listQuery = (path: string, params: ListParams = {}) => ({
  queryKey: ['list', path, params] as const,
  queryFn: () => api<Paginated<MovieSummary>>(path, params),
  staleTime: HALF_HOUR,
});

/**
 * One page of /discover, blended with the same page limited to the viewer's
 * region (see lib/focus.ts). Used by the places that load page after page.
 */
export async function blendedDiscover(
  params: Record<string, string | number>,
  page: number,
  opts: { region: string; focus: Focus; voteScale?: number; signal?: AbortSignal },
): Promise<Paginated<MovieSummary>> {
  const focus = pinned(params) ? 'world' : opts.focus;
  const get = (p: Record<string, string | number>) =>
    api<Paginated<MovieSummary>>('discover/movie', { ...p, page }, opts.signal);
  const [world, local] = await Promise.all([
    focus === 'local' ? null : get(params),
    focus === 'world' ? null : get(localize(params, opts.region, opts.voteScale)).catch(() => null),
  ]);
  const base = focus === 'local' ? local : world;
  const pages = Math.max(world?.total_pages ?? 0, local?.total_pages ?? 0);
  // Keep roughly three local films to one worldwide per page; worldwide fills in when local runs dry.
  const localList = local?.results ?? [];
  const worldList = world?.results ?? [];
  const worldShare =
    focus === 'mostly'
      ? worldList.slice(0, Math.max(Math.ceil(localList.length / 3), 20 - localList.length))
      : worldList;
  return {
    page,
    total_pages: pages,
    total_results: base?.total_results ?? local?.total_results ?? 0,
    results: blend(localList, worldShare, focus),
  };
}
