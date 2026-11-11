import 'server-only';
import { tmdb, type QueryParams } from './server';
import { addDays, isoDate } from '@/lib/utils';
import type {
  CollectionDetails,
  Genre,
  MovieDetails,
  MovieSummary,
  Paginated,
  PersonDetails,
} from '@/types/tmdb';

const LIST = { revalidate: 3600 };
const DETAIL = { revalidate: 86400 };

export const MOVIE_APPEND =
  'credits,videos,keywords,release_dates,watch/providers,similar,recommendations';

export const getTrending = (window: 'day' | 'week') =>
  tmdb<Paginated<MovieSummary>>(`/trending/movie/${window}`, { language: 'en-US' }, LIST);

export const getNowPlaying = (region = 'IN') =>
  tmdb<Paginated<MovieSummary>>('/movie/now_playing', { region, language: 'en-US' }, LIST);

/** All-time best: TMDB's /top_rated admits very new, low-vote titles, so require a real vote base. */
export const getTopRated = () =>
  discoverMovies({
    sort_by: 'vote_average.desc',
    'vote_count.gte': 3000,
    without_genres: '99,10770',
  });

export const discoverMovies = (params: QueryParams, revalidate = 3600) =>
  tmdb<Paginated<MovieSummary>>(
    '/discover/movie',
    { language: 'en-US', ...params },
    { revalidate },
  );

/** Theatrical / digital releases in a region over the next `days` days. */
export const getUpcoming = (region = 'IN', days = 60) => {
  const today = new Date();
  return discoverMovies({
    region,
    'release_date.gte': isoDate(today),
    'release_date.lte': isoDate(addDays(today, days)),
    with_release_type: '2|3',
    sort_by: 'popularity.desc',
  });
};

export const getHiddenGems = (page = 1) =>
  discoverMovies({
    'vote_average.gte': 7.2,
    'vote_count.gte': 150,
    'vote_count.lte': 3000,
    sort_by: 'vote_average.desc',
    without_genres: '99,10770',
    page,
  });

export const getMovie = (id: number) =>
  tmdb<MovieDetails>(
    `/movie/${id}`,
    {
      language: 'en-US',
      append_to_response: MOVIE_APPEND,
      include_video_language: 'en,hi,ta,te,ml,kn,ko,ja,null',
    },
    DETAIL,
  );

export const getMovieLite = (id: number) =>
  tmdb<MovieDetails>(`/movie/${id}`, { language: 'en-US' }, DETAIL);

export const getPerson = (id: number) =>
  tmdb<PersonDetails>(
    `/person/${id}`,
    { language: 'en-US', append_to_response: 'movie_credits' },
    DETAIL,
  );

export const getCollection = (id: number) =>
  tmdb<CollectionDetails>(`/collection/${id}`, { language: 'en-US' }, DETAIL);

export const getGenres = () =>
  tmdb<{ genres: Genre[] }>('/genre/movie/list', { language: 'en-US' }, DETAIL);
