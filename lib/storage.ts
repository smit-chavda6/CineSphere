import type { StateStorage } from 'zustand/middleware';

/**
 * localStorage/sessionStorage wrapper that never throws
 * (private mode, quota exceeded, blocked storage, SSR).
 */
export function safeStorage(kind: 'local' | 'session' = 'local'): StateStorage {
  const get = (): Storage | null => {
    try {
      if (typeof window === 'undefined') return null;
      return kind === 'local' ? window.localStorage : window.sessionStorage;
    } catch {
      return null;
    }
  };
  return {
    getItem: (name) => {
      try {
        return get()?.getItem(name) ?? null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        get()?.setItem(name, value);
      } catch {
        /* quota or blocked storage: keep working in memory */
      }
    },
    removeItem: (name) => {
      try {
        get()?.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
}
