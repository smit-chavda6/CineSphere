import type { MovieSummary } from '@/types/tmdb';
import { topIds, topLanguage, type TasteProfile } from './profile';

export interface CandidatePool {
  movies: Map<number, MovieSummary>;
  /** How many seed lists (recommendations/similar) contained each movie. */
  hits: Record<number, number>;
}

/**
 * Merges candidate lists, dropping excluded ids and counting how often each movie
 * appears in seed-derived lists (a strong collaborative signal from TMDB).
 */
export function collectCandidates(
  sources: { list: MovieSummary[]; counts: boolean }[],
  exclude: Set<number>,
): CandidatePool {
  const movies = new Map<number, MovieSummary>();
  const hits: Record<number, number> = {};
  for (const { list, counts } of sources) {
    for (const m of list) {
      if (exclude.has(m.id) || m.adult) continue;
      if (!movies.has(m.id)) movies.set(m.id, m);
      if (counts) hits[m.id] = (hits[m.id] ?? 0) + 1;
    }
  }
  return { movies, hits };
}

/**
 * Builds a few /discover queries from the profile's strongest signals so that
 * candidates are not limited to TMDB's own recommendation lists.
 */
export function profileDiscoverQueries(p: TasteProfile): Record<string, string>[] {
  const queries: Record<string, string>[] = [];
  const genres = topIds(p.genres, 2);
  const keywords = topIds(p.keywords, 4);
  const directors = topIds(p.directors, 2);
  const lang = topLanguage(p);
  const base = { sort_by: 'vote_average.desc', 'vote_count.gte': '250' };

  if (keywords.length)
    queries.push({ ...base, with_keywords: keywords.join('|'), sort_by: 'popularity.desc' });
  if (genres.length) {
    const q: Record<string, string> = { ...base, with_genres: genres.join(',') };
    if (lang && lang.share >= 0.6) q.with_original_language = lang.code;
    queries.push(q);
  }
  if (directors.length)
    queries.push({ ...base, with_crew: directors.join('|'), 'vote_count.gte': '50' });
  if (lang && lang.share >= 0.4 && lang.code !== 'en') {
    queries.push({ ...base, with_original_language: lang.code, 'vote_count.gte': '100' });
  }
  return queries;
}
