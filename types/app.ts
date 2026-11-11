/** App-level shared types (not TMDB response shapes). */

/** An id + display name pair; used for cast, crew, keywords, companies and providers in filters. */
export interface Entity {
  id: number;
  name: string;
}

/** Minimal movie shape needed to render a card. Any TMDB movie object satisfies it. */
export interface CardMovie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  original_language?: string;
  popularity?: number;
}

/** What we persist locally about a movie so lists can be sorted, filtered and summarised offline. */
export interface MovieSnapshot extends CardMovie {
  genre_ids: number[];
  runtime?: number | null;
  directors?: Entity[];
}
