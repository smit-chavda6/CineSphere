/** Typed subset of TMDB API v3 responses used by this app. */

export interface Paginated<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface Genre {
  id: number;
  name: string;
}

export interface MovieSummary {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
  adult?: boolean;
  video?: boolean;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
  known_for_department?: string;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface Credits {
  cast: CastMember[];
  crew: CrewMember[];
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at: string;
  size: number;
  iso_639_1?: string;
}

export interface Keyword {
  id: number;
  name: string;
}

export interface ReleaseDate {
  certification: string;
  release_date: string;
  type: number;
  note: string;
}

export interface ReleaseDatesResult {
  iso_3166_1: string;
  release_dates: ReleaseDate[];
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

export interface WatchProviderRegion {
  link: string;
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
  free?: WatchProvider[];
  ads?: WatchProvider[];
}

export interface CollectionRef {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
}

export interface ProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface ProductionCountry {
  iso_3166_1: string;
  name: string;
}

export interface SpokenLanguage {
  iso_639_1: string;
  english_name: string;
  name: string;
}

export interface MovieDetails extends Omit<MovieSummary, 'genre_ids'> {
  genres: Genre[];
  runtime: number | null;
  tagline: string | null;
  status: string;
  budget: number;
  revenue: number;
  imdb_id: string | null;
  homepage: string | null;
  spoken_languages: SpokenLanguage[];
  production_companies: ProductionCompany[];
  production_countries: ProductionCountry[];
  belongs_to_collection: CollectionRef | null;
  credits?: Credits;
  videos?: { results: Video[] };
  keywords?: { keywords: Keyword[] };
  release_dates?: { results: ReleaseDatesResult[] };
  'watch/providers'?: { results: Record<string, WatchProviderRegion> };
  similar?: Paginated<MovieSummary>;
  recommendations?: Paginated<MovieSummary>;
}

export interface PersonMovieCast extends MovieSummary {
  character: string;
  credit_id: string;
}

export interface PersonMovieCrew extends MovieSummary {
  job: string;
  department: string;
  credit_id: string;
}

export interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  also_known_as: string[];
  imdb_id: string | null;
  homepage: string | null;
  popularity: number;
  movie_credits?: { cast: PersonMovieCast[]; crew: PersonMovieCrew[] };
}

export interface PersonSummary {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  known_for?: Array<{ id: number; title?: string; name?: string; media_type: string }>;
}

export interface CollectionDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: MovieSummary[];
}

export interface CollectionSummary {
  id: number;
  name: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path: string | null;
}

export interface CompanySummary {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country?: string;
}

export type MultiSearchResult =
  | (MovieSummary & { media_type: 'movie' })
  | (PersonSummary & { media_type: 'person' })
  | { media_type: 'tv'; id: number; name: string };

export interface Language {
  iso_639_1: string;
  english_name: string;
  name: string;
}

export interface Country {
  iso_3166_1: string;
  english_name: string;
  native_name?: string;
}

export interface ProviderListItem extends WatchProvider {
  display_priorities?: Record<string, number>;
}

export interface Certification {
  certification: string;
  meaning: string;
  order: number;
}
