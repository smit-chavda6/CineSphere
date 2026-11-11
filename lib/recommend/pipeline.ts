import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/tmdb/browser';
import { mapLimit } from '@/lib/utils';
import type { MovieDetails, MovieSummary, Paginated } from '@/types/tmdb';
import { collectCandidates, profileDiscoverQueries } from './candidates';
import { rankWithDiversity, seriesKey, spreadFranchises } from './diversify';
import { featuresFromDetails, featuresFromSummary, type MovieFeatures } from './features';
import { topIds, type TasteProfile } from './profile';
import type { Focus } from '@/lib/focus';
import { scoreAll, type ScoredMovie } from './score';

/**
 * Browser-side orchestration: fetches seeds and candidates through the API proxy
 * (cached by React Query) and hands them to the pure scoring functions.
 */

const DAY = 1000 * 60 * 60 * 24;

/** Seed movies: details + signals + TMDB's own recommendation lists. */
export const seedQuery = (id: number) => ({
  queryKey: ['movie-seed', id],
  queryFn: () =>
    api<MovieDetails>(`movie/${id}`, {
      append_to_response: 'keywords,credits,recommendations,similar',
    }),
  staleTime: DAY,
});

/** Candidate movies: details + signals only (smaller payload). */
export const featureQuery = (id: number) => ({
  queryKey: ['movie-features', id],
  queryFn: () => api<MovieDetails>(`movie/${id}`, { append_to_response: 'keywords,credits' }),
  staleTime: DAY,
});

export const fetchSeed = (qc: QueryClient, id: number) => qc.fetchQuery(seedQuery(id));
export const fetchFeatures = async (qc: QueryClient, id: number) =>
  featuresFromDetails(await qc.fetchQuery(featureQuery(id)));

export const fetchDiscover = (qc: QueryClient, params: Record<string, string | number>) =>
  qc.fetchQuery({
    queryKey: ['discover', params],
    queryFn: () => api<Paginated<MovieSummary>>('discover/movie', params),
    staleTime: 1000 * 60 * 30,
  });

export interface RecommendInput {
  profile: TasteProfile;
  /** Seed details with `recommendations` and `similar` appended. */
  seeds: MovieDetails[];
  exclude: Set<number>;
  /** Extra /discover params applied to profile-driven queries (e.g. language, runtime). */
  extraParams?: Record<string, string>;
  /** Cheap pre-filter on list summaries. */
  filter?: (m: MovieSummary) => boolean;
  /** Post-filter on full features (e.g. runtime). */
  accept?: (f: MovieFeatures) => boolean;
  limit?: number;
  /** How many top preliminary candidates get full details fetched. */
  deep?: number;
  /** Favour films made in the viewer's region (see lib/focus.ts). */
  local?: { region: string; focus: Focus };
}

/** Main languages of a region's own cinema, used to recognise its films among TMDB's recommendations. */
const REGION_LANGUAGES: Record<string, string[]> = {
  IN: ['hi', 'ta', 'te', 'ml', 'kn', 'bn', 'mr', 'gu', 'pa', 'or', 'as', 'ur'],
  KR: ['ko'],
  JP: ['ja'],
  FR: ['fr'],
  ES: ['es'],
  MX: ['es'],
  DE: ['de'],
  IT: ['it'],
  BR: ['pt'],
  PK: ['ur', 'pa'],
  BD: ['bn'],
  LK: ['si', 'ta'],
  NP: ['ne'],
  SE: ['sv'],
  NL: ['nl'],
};

export async function gatherCandidates(qc: QueryClient, input: RecommendInput) {
  const queries = profileDiscoverQueries(input.profile).map((q) => ({
    ...q,
    ...input.extraParams,
  }));
  // Extra candidates made in the viewer's region, matching the taste's strongest genres and themes.
  const local = input.local && input.local.focus !== 'world' ? input.local : null;
  const localQueries: Record<string, string>[] = [];
  if (local) {
    const genres = topIds(input.profile.genres, 3).join('|');
    const keywords = topIds(input.profile.keywords, 4).join('|');
    const base = { with_origin_country: local.region, ...input.extraParams };
    if (genres) {
      localQueries.push({
        ...base,
        with_genres: genres,
        sort_by: 'popularity.desc',
        'vote_count.gte': '40',
      });
      localQueries.push({
        ...base,
        with_genres: genres,
        sort_by: 'vote_average.desc',
        'vote_count.gte': '120',
      });
    }
    if (keywords)
      localQueries.push({
        ...base,
        with_keywords: keywords,
        sort_by: 'popularity.desc',
        'vote_count.gte': '20',
      });
    if (!genres && !keywords)
      localQueries.push({ ...base, sort_by: 'popularity.desc', 'vote_count.gte': '100' });
  }
  const [discovered, localFound] = await Promise.all([
    Promise.all(queries.map((q) => fetchDiscover(qc, q).catch(() => null))),
    Promise.all(localQueries.map((q) => fetchDiscover(qc, q).catch(() => null))),
  ]);
  const localIds = new Set(localFound.flatMap((d) => d?.results ?? []).map((m) => m.id));
  const pool = collectCandidates(
    [
      ...input.seeds.flatMap((s) => [
        { list: s.recommendations?.results ?? [], counts: true },
        { list: s.similar?.results ?? [], counts: true },
      ]),
      ...discovered.map((d) => ({ list: d?.results ?? [], counts: false })),
      ...localFound.map((d) => ({ list: d?.results ?? [], counts: false })),
    ],
    input.exclude,
  );
  let movies = Array.from(pool.movies.values());
  if (input.filter) movies = movies.filter(input.filter);
  // A film counts as local if a local query found it or it is in one of the region's languages.
  const langs = new Set(local ? (REGION_LANGUAGES[local.region] ?? []) : []);
  const isLocal = (id: number, language: string | null | undefined) =>
    localIds.has(id) || (language ? langs.has(language) : false);
  return { movies, hits: pool.hits, isLocal };
}

/** Full pipeline: candidates → preliminary score → enrich top N → final score → diversify. */
export async function recommend(qc: QueryClient, input: RecommendInput): Promise<ScoredMovie[]> {
  const { profile, limit = 30, deep = 32 } = input;
  const { movies: all, hits, isLocal } = await gatherCandidates(qc, input);
  const focus = input.local?.focus ?? 'world';
  const movies = focus === 'local' ? all.filter((m) => isLocal(m.id, m.original_language)) : all;
  // In "mostly", local films get a nudge so they are not drowned out by Hollywood's vote counts.
  const nudge = <T extends { features: MovieFeatures; score: number }>(list: T[]) =>
    focus === 'mostly'
      ? list
          .map((x) =>
            isLocal(x.features.id, x.features.language) ? { ...x, score: x.score + 0.12 } : x,
          )
          .sort((a, b) => b.score - a.score)
      : list;
  const prelim = nudge(
    scoreAll(profile, movies.map(featuresFromSummary), { sourceHits: hits }),
  ).slice(0, deep);
  const enriched = await mapLimit(prelim, 12, (s) => fetchFeatures(qc, s.features.id));
  let feats = prelim.map((s, i) => enriched[i] ?? s.features);
  if (input.accept) feats = feats.filter(input.accept);
  const ranked = rankWithDiversity(nudge(scoreAll(profile, feats, { sourceHits: hits })), {
    limit,
  });
  // Never show two films from the same franchise within three slots of each other.
  return spreadFranchises(
    ranked,
    (s) => (s.features.collectionId ? `c${s.features.collectionId}` : seriesKey(s.features.title)),
    [],
    { gap: 3 },
  );
}
