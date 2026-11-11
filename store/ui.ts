'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/storage';
import type { CardMovie } from '@/types/app';
import type { Focus } from '@/lib/focus';

export type Theme = 'day' | 'night';
export const POCKET_MAX = 10;

/** Shell state: the spyglass (search), the chart theme and the pocket of carried films. */
interface UiState {
  searchOpen: boolean;
  searchSeed: string;
  openSearch: (seed?: string) => void;
  closeSearch: () => void;

  theme: Theme;
  setTheme: (t: Theme) => void;

  /** How strongly suggestions favour films made in the viewer's region. */
  focus: Focus;
  setFocus: (f: Focus) => void;

  /** Films you are carrying between places. They feed the Blender and Together. */
  pocket: CardMovie[];
  /** Adds or removes a film. Returns true when it is now in the pocket. */
  carry: (m: CardMovie) => boolean;
  drop: (id: number) => void;
  emptyPocket: () => void;
}

const slim = (m: CardMovie): CardMovie => ({
  id: m.id,
  title: m.title,
  poster_path: m.poster_path ?? null,
  release_date: m.release_date ?? '',
  vote_average: m.vote_average ?? 0,
  genre_ids: m.genre_ids ?? [],
});

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      searchOpen: false,
      searchSeed: '',
      openSearch: (seed = '') => set({ searchOpen: true, searchSeed: seed }),
      closeSearch: () => set({ searchOpen: false }),

      theme: 'day',
      setTheme: (theme) => set({ theme }),

      focus: 'mostly',
      setFocus: (focus) => set({ focus }),

      pocket: [],
      carry: (m) => {
        const has = get().pocket.some((p) => p.id === m.id);
        if (has) {
          set((s) => ({ pocket: s.pocket.filter((p) => p.id !== m.id) }));
          return false;
        }
        if (get().pocket.length >= POCKET_MAX) return false;
        set((s) => ({ pocket: [...s.pocket, slim(m)] }));
        return true;
      },
      drop: (id) => set((s) => ({ pocket: s.pocket.filter((p) => p.id !== id) })),
      emptyPocket: () => set({ pocket: [] }),
    }),
    {
      name: 'cinesphere-ui',
      version: 1,
      storage: createJSONStorage(() => safeStorage('local')),
      skipHydration: true,
      partialize: (s) => ({ theme: s.theme, pocket: s.pocket, focus: s.focus }),
    },
  ),
);
