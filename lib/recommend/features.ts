import type { MovieDetails, MovieSummary } from '@/types/tmdb';
import type { Entity } from '@/types/app';
import { yearOf } from '@/lib/utils';

/** The normalised signal set the scoring engine works with. */
export interface MovieFeatures {
  id: number;
  title: string;
  genres: number[];
  keywords: Entity[];
  directors: Entity[];
  /** Top-billed cast, in billing order. */
  cast: Entity[];
  year: number | null;
  language: string | null;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  collectionId: number | null;
  runtime: number | null;
  posterPath: string | null;
  /** True when keywords/credits are known (full details), false for list summaries. */
  rich: boolean;
}

export const TOP_CAST = 5;

export const decadeOf = (year: number) => Math.floor(year / 10) * 10;

export function featuresFromDetails(d: MovieDetails): MovieFeatures {
  return {
    id: d.id,
    title: d.title,
    genres: d.genres.map((g) => g.id),
    keywords: (d.keywords?.keywords ?? []).map((k) => ({ id: k.id, name: k.name })),
    directors: (d.credits?.crew ?? [])
      .filter((c) => c.job === 'Director')
      .map((c) => ({ id: c.id, name: c.name })),
    cast: (d.credits?.cast ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .slice(0, TOP_CAST)
      .map((c) => ({ id: c.id, name: c.name })),
    year: yearOf(d.release_date),
    language: d.original_language || null,
    voteAverage: d.vote_average ?? 0,
    voteCount: d.vote_count ?? 0,
    popularity: d.popularity ?? 0,
    collectionId: d.belongs_to_collection?.id ?? null,
    runtime: d.runtime ?? null,
    posterPath: d.poster_path ?? null,
    rich: Boolean(d.keywords || d.credits),
  };
}

export function featuresFromSummary(m: MovieSummary): MovieFeatures {
  return {
    id: m.id,
    title: m.title,
    genres: m.genre_ids ?? [],
    keywords: [],
    directors: [],
    cast: [],
    year: yearOf(m.release_date),
    language: m.original_language || null,
    voteAverage: m.vote_average ?? 0,
    voteCount: m.vote_count ?? 0,
    popularity: m.popularity ?? 0,
    collectionId: null,
    runtime: null,
    posterPath: m.poster_path ?? null,
    rich: false,
  };
}
