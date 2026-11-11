'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from '@/lib/storage';

/** Per-tab state (sessionStorage): Surprise Me never repeats within a session. */
interface SessionState {
  surpriseShown: number[];
  markSurprise: (id: number) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      surpriseShown: [],
      markSurprise: (id) => set((s) => ({ surpriseShown: [...s.surpriseShown, id].slice(-1000) })),
    }),
    { name: 'cinesphere-session', storage: createJSONStorage(() => safeStorage('session')) },
  ),
);
