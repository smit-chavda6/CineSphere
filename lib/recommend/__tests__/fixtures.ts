import type { MovieFeatures } from '../features';

let nextId = 1000;

export function movie(over: Partial<MovieFeatures> = {}): MovieFeatures {
  return {
    id: nextId++,
    title: 'Untitled',
    genres: [],
    keywords: [],
    directors: [],
    cast: [],
    year: 2010,
    language: 'en',
    voteAverage: 7,
    voteCount: 1000,
    popularity: 20,
    collectionId: null,
    runtime: 120,
    posterPath: null,
    rich: true,
    ...over,
  };
}

export const NOLAN = { id: 525, name: 'Christopher Nolan' };
export const DICAPRIO = { id: 6193, name: 'Leonardo DiCaprio' };
export const TIME_TRAVEL = { id: 4379, name: 'time travel' };
export const HEIST = { id: 10051, name: 'heist' };
export const DREAM = { id: 1, name: 'dream' };

export const inception = movie({
  id: 27205,
  title: 'Inception',
  genres: [28, 878, 12],
  keywords: [DREAM, HEIST],
  directors: [NOLAN],
  cast: [DICAPRIO],
  year: 2010,
  voteAverage: 8.4,
  voteCount: 36000,
});

export const interstellar = movie({
  id: 157336,
  title: 'Interstellar',
  genres: [12, 18, 878],
  keywords: [TIME_TRAVEL],
  directors: [NOLAN],
  year: 2014,
  voteAverage: 8.4,
  voteCount: 34000,
});
