'use client';

import { createContext, useContext, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { STATIONS, type StationId } from './stations';

/**
 * Navigation without pages. The URL is still the source of truth (every place and
 * film is a shareable link), but moving between them is `history.pushState`: the
 * shell stays mounted and the camera travels instead of the document reloading.
 */

export type EntityKind = 'movie' | 'person' | 'collection';

export interface Route {
  /** The place this URL belongs to, if it is one. */
  station: StationId | null;
  /** A film, person or franchise opened on top of the chart. */
  entity: { kind: EntityKind; id: number } | null;
  /** The whole chart, zoomed out. */
  overview: boolean;
  search: boolean;
  unknown: boolean;
}

const BY_PATH = new Map<string, StationId>(STATIONS.map((s) => [s.path, s.id]));

export function parseRoute(pathname: string): Route {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const base: Route = {
    station: null,
    entity: null,
    overview: false,
    search: false,
    unknown: false,
  };
  const station = BY_PATH.get(path);
  if (station) return { ...base, station };
  if (path === '/atlas' || path === '/recommend') return { ...base, overview: true };
  if (path === '/search') return { ...base, search: true };
  const m = path.match(/^\/(movie|person|collection)\/(\d+)/);
  if (m) return { ...base, entity: { kind: m[1] as EntityKind, id: Number(m[2]) } };
  return { ...base, overview: true, unknown: true };
}

/** Where the last press happened, so a film can open like a camera iris from that point. */
let pointer: { x: number; y: number } | null = null;
export const trackPointer = (e: { clientX: number; clientY: number }) => {
  pointer = { x: e.clientX, y: e.clientY };
};
export const lastPointer = () =>
  pointer ?? {
    x: typeof window === 'undefined' ? 0 : window.innerWidth / 2,
    y: typeof window === 'undefined' ? 0 : window.innerHeight / 2,
  };

/** Travel to an in-app URL. Next.js keeps `usePathname` / `useSearchParams` in sync with pushState. */
export function go(href: string, { replace = false }: { replace?: boolean } = {}) {
  if (typeof window === 'undefined') return;
  const url = new URL(href, window.location.href);
  const next = url.pathname + url.search;
  const here = window.location.pathname + window.location.search;
  if (next === here) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', next);
}

type GoProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  replace?: boolean;
};

/** An in-app link: a real anchor (right-click, new tab, crawlers) that travels on plain click. */
export function Go({ href, replace, onClick, ...rest }: GoProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    e.preventDefault();
    go(href, { replace });
  };
  return <a href={href} onClick={handle} {...rest} />;
}

/** True while a place is the one on screen (not hidden, not under a film or the spyglass). */
export const RoomActive = createContext(false);
export const useRoomActive = () => useContext(RoomActive);

export const isTyping = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('input,textarea,select,[contenteditable]'));
