'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/storage';
import { DEFAULT_REGION } from '@/config/regions';
import type { CardMovie, Entity, MovieSnapshot } from '@/types/app';
import type { SwipeAction } from '@/lib/recommend/feed';

export interface CustomList {
  id: string;
  name: string;
  movieIds: number[];
  createdAt: number;
}

export interface SwipeRecord {
  id: number;
  action: SwipeAction;
  at: number;
  /** Whether this swipe added the movie to watchlist/seen, so undo can revert exactly that. */
  added?: boolean;
}

export interface SavedFilter {
  id: string;
  name: string;
  query: string;
  at: number;
}

interface PersistedState {
  region: string;
  movies: Record<number, MovieSnapshot>;
  watchlist: Record<number, { addedAt: number; tags: string[] }>;
  seen: Record<number, { at: number }>;
  ratings: Record<number, { stars: number; at: number }>;
  notInterested: Record<number, { at: number }>;
  lists: CustomList[];
  swipes: SwipeRecord[];
  savedFilters: SavedFilter[];
  recentSearches: string[];
}

interface Actions {
  setRegion: (code: string) => void;
  remember: (movie: CardMovie | MovieSnapshot) => void;
  patchMovie: (id: number, patch: Partial<MovieSnapshot>) => void;
  toggleWatchlist: (movie: CardMovie, tags?: string[]) => boolean;
  addToWatchlist: (movie: CardMovie, tags?: string[]) => void;
  removeFromWatchlist: (id: number) => void;
  setSeen: (movie: CardMovie, seen: boolean) => void;
  toggleSeen: (movie: CardMovie) => boolean;
  rate: (movie: CardMovie, stars: number) => void;
  markNotInterested: (movie: CardMovie) => void;
  clearNotInterested: (id: number) => void;
  createList: (name: string) => string;
  renameList: (id: string, name: string) => void;
  deleteList: (id: string) => void;
  toggleInList: (listId: string, movie: CardMovie) => void;
  recordSwipe: (movie: CardMovie, action: SwipeAction) => void;
  undoSwipe: () => SwipeRecord | undefined;
  saveFilter: (name: string, query: string) => void;
  deleteFilter: (id: string) => void;
  addRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;
  exportData: () => ExportShape;
  importData: (raw: unknown) => { ok: true } | { ok: false; error: string };
}

export interface ExportShape extends PersistedState {
  app: 'cinesphere';
  version: 1;
  exportedAt: string;
}

export type LibraryState = PersistedState & Actions & { hydrated: boolean };

const uid = () => Math.random().toString(36).slice(2, 10);

/** Copies only the fields we persist, so stored snapshots stay small. */
export function toSnapshot(m: CardMovie | MovieSnapshot): MovieSnapshot {
  const s = m as MovieSnapshot & { genres?: { id: number }[] };
  return {
    id: m.id,
    title: m.title,
    poster_path: m.poster_path ?? null,
    backdrop_path: m.backdrop_path ?? null,
    release_date: m.release_date ?? '',
    vote_average: m.vote_average ?? 0,
    vote_count: m.vote_count ?? 0,
    original_language: m.original_language,
    genre_ids: s.genre_ids ?? s.genres?.map((g) => g.id) ?? [],
    runtime: s.runtime ?? undefined,
    directors: s.directors as Entity[] | undefined,
  };
}

const initial: PersistedState = {
  region: DEFAULT_REGION,
  movies: {},
  watchlist: {},
  seen: {},
  ratings: {},
  notInterested: {},
  lists: [],
  swipes: [],
  savedFilters: [],
  recentSearches: [],
};

const omit = <T extends Record<number, unknown>>(rec: T, id: number): T => {
  const copy = { ...rec };
  delete copy[id];
  return copy;
};

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => {
      const remember = (movie: CardMovie | MovieSnapshot) =>
        set((s) => {
          const prev = s.movies[movie.id];
          const snap = toSnapshot(movie);
          // Never lose enrichment (runtime/directors) we already have.
          const merged: MovieSnapshot = {
            ...prev,
            ...snap,
            genre_ids: snap.genre_ids.length ? snap.genre_ids : (prev?.genre_ids ?? []),
            runtime: snap.runtime ?? prev?.runtime,
            directors: snap.directors ?? prev?.directors,
          };
          return { movies: { ...s.movies, [movie.id]: merged } };
        });

      return {
        ...initial,
        hydrated: false,

        setRegion: (region) => set({ region }),
        remember,
        patchMovie: (id, patch) =>
          set((s) =>
            s.movies[id] ? { movies: { ...s.movies, [id]: { ...s.movies[id], ...patch } } } : s,
          ),

        addToWatchlist: (movie, tags = []) => {
          remember(movie);
          set((s) => {
            const cur = s.watchlist[movie.id];
            const merged = Array.from(new Set([...(cur?.tags ?? []), ...tags]));
            return {
              watchlist: {
                ...s.watchlist,
                [movie.id]: { addedAt: cur?.addedAt ?? Date.now(), tags: merged },
              },
              notInterested: omit(s.notInterested, movie.id),
            };
          });
        },
        removeFromWatchlist: (id) => set((s) => ({ watchlist: omit(s.watchlist, id) })),
        toggleWatchlist: (movie, tags) => {
          const has = Boolean(get().watchlist[movie.id]);
          if (has) get().removeFromWatchlist(movie.id);
          else get().addToWatchlist(movie, tags);
          return !has;
        },

        setSeen: (movie, seen) => {
          if (seen) remember(movie);
          set((s) => ({
            seen: seen ? { ...s.seen, [movie.id]: { at: Date.now() } } : omit(s.seen, movie.id),
            // Watching something takes it off the watchlist.
            watchlist: seen ? omit(s.watchlist, movie.id) : s.watchlist,
          }));
        },
        toggleSeen: (movie) => {
          const next = !get().seen[movie.id];
          get().setSeen(movie, next);
          return next;
        },

        rate: (movie, stars) => {
          remember(movie);
          set((s) => {
            if (!stars) return { ratings: omit(s.ratings, movie.id) };
            return {
              ratings: { ...s.ratings, [movie.id]: { stars, at: Date.now() } },
              seen: s.seen[movie.id] ? s.seen : { ...s.seen, [movie.id]: { at: Date.now() } },
              watchlist: omit(s.watchlist, movie.id),
            };
          });
        },

        markNotInterested: (movie) => {
          remember(movie);
          set((s) => ({
            notInterested: { ...s.notInterested, [movie.id]: { at: Date.now() } },
            watchlist: omit(s.watchlist, movie.id),
          }));
        },
        clearNotInterested: (id) => set((s) => ({ notInterested: omit(s.notInterested, id) })),

        createList: (name) => {
          const id = uid();
          set((s) => ({
            lists: [
              ...s.lists,
              { id, name: name.trim() || 'Untitled list', movieIds: [], createdAt: Date.now() },
            ],
          }));
          return id;
        },
        renameList: (id, name) =>
          set((s) => ({
            lists: s.lists.map((l) => (l.id === id ? { ...l, name: name.trim() || l.name } : l)),
          })),
        deleteList: (id) => set((s) => ({ lists: s.lists.filter((l) => l.id !== id) })),
        toggleInList: (listId, movie) => {
          remember(movie);
          set((s) => ({
            lists: s.lists.map((l) =>
              l.id !== listId
                ? l
                : {
                    ...l,
                    movieIds: l.movieIds.includes(movie.id)
                      ? l.movieIds.filter((x) => x !== movie.id)
                      : [...l.movieIds, movie.id],
                  },
            ),
          }));
        },

        recordSwipe: (movie, action) => {
          remember(movie);
          const s = get();
          let added = false;
          if (action === 'watch' && !s.watchlist[movie.id]) {
            s.addToWatchlist(movie);
            added = true;
          }
          if (action === 'seen' && !s.seen[movie.id]) {
            s.setSeen(movie, true);
            added = true;
          }
          set((st) => ({
            swipes: [...st.swipes.slice(-499), { id: movie.id, action, at: Date.now(), added }],
          }));
        },
        undoSwipe: () => {
          const last = get().swipes.at(-1);
          if (!last) return undefined;
          set((s) => ({
            swipes: s.swipes.slice(0, -1),
            watchlist:
              last.added && last.action === 'watch' ? omit(s.watchlist, last.id) : s.watchlist,
            seen: last.added && last.action === 'seen' ? omit(s.seen, last.id) : s.seen,
          }));
          return last;
        },

        saveFilter: (name, query) =>
          set((s) => ({
            savedFilters: [
              { id: uid(), name: name.trim() || 'My filter', query, at: Date.now() },
              ...s.savedFilters,
            ].slice(0, 30),
          })),
        deleteFilter: (id) =>
          set((s) => ({ savedFilters: s.savedFilters.filter((f) => f.id !== id) })),

        addRecentSearch: (q) => {
          const query = q.trim();
          if (!query) return;
          set((s) => ({
            recentSearches: [
              query,
              ...s.recentSearches.filter((x) => x.toLowerCase() !== query.toLowerCase()),
            ].slice(0, 8),
          }));
        },
        clearRecentSearches: () => set({ recentSearches: [] }),

        exportData: () => {
          const s = get();
          const data: PersistedState = {
            region: s.region,
            movies: s.movies,
            watchlist: s.watchlist,
            seen: s.seen,
            ratings: s.ratings,
            notInterested: s.notInterested,
            lists: s.lists,
            swipes: s.swipes,
            savedFilters: s.savedFilters,
            recentSearches: s.recentSearches,
          };
          return { app: 'cinesphere', version: 1, exportedAt: new Date().toISOString(), ...data };
        },

        importData: (raw) => {
          if (!raw || typeof raw !== 'object')
            return { ok: false, error: 'That file is not valid JSON data.' };
          const d = raw as Partial<ExportShape>;
          if (d.app !== 'cinesphere')
            return { ok: false, error: 'This file was not exported from CineSphere.' };
          const isObj = (v: unknown): v is Record<string, unknown> =>
            !!v && typeof v === 'object' && !Array.isArray(v);
          if (!isObj(d.movies) || !isObj(d.watchlist) || !isObj(d.seen)) {
            return { ok: false, error: 'The file is missing required sections.' };
          }
          set((s) => ({
            movies: { ...s.movies, ...(d.movies as PersistedState['movies']) },
            watchlist: { ...s.watchlist, ...(d.watchlist as PersistedState['watchlist']) },
            seen: { ...s.seen, ...(d.seen as PersistedState['seen']) },
            ratings: {
              ...s.ratings,
              ...(isObj(d.ratings) ? (d.ratings as PersistedState['ratings']) : {}),
            },
            notInterested: {
              ...s.notInterested,
              ...(isObj(d.notInterested)
                ? (d.notInterested as PersistedState['notInterested'])
                : {}),
            },
            lists: [
              ...s.lists,
              ...(Array.isArray(d.lists) ? d.lists : []).filter(
                (l) => !s.lists.some((x) => x.id === l.id),
              ),
            ],
            swipes: Array.isArray(d.swipes) ? [...s.swipes, ...d.swipes].slice(-500) : s.swipes,
            savedFilters: Array.isArray(d.savedFilters)
              ? [...d.savedFilters, ...s.savedFilters].slice(0, 30)
              : s.savedFilters,
          }));
          return { ok: true };
        },
      };
    },
    {
      name: 'cinesphere-library',
      version: 1,
      storage: createJSONStorage(() => safeStorage('local')),
      skipHydration: true,
      partialize: (s): PersistedState => ({
        region: s.region,
        movies: s.movies,
        watchlist: s.watchlist,
        seen: s.seen,
        ratings: s.ratings,
        notInterested: s.notInterested,
        lists: s.lists,
        swipes: s.swipes,
        savedFilters: s.savedFilters,
        recentSearches: s.recentSearches,
      }),
    },
  ),
);

/** Ids of movies the user never wants to see recommended again (seen + not interested). */
export function excludedIds(s: Pick<LibraryState, 'seen' | 'notInterested'>): Set<number> {
  return new Set([...Object.keys(s.seen), ...Object.keys(s.notInterested)].map(Number));
}
