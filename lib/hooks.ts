'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/tmdb/browser';
import { useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';
import type { Certification, Country, Genre, Language, ProviderListItem } from '@/types/tmdb';

export function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Calls `onVisible` whenever the sentinel scrolls into view. */
export function useInView<T extends Element>(onVisible: () => void, enabled = true) {
  const ref = useRef<T>(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && cb.current(),
      {
        rootMargin: '600px 0px',
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}

const LONG = { staleTime: 1000 * 60 * 60 * 24, gcTime: 1000 * 60 * 60 * 24 };

export const useGenres = () =>
  useQuery({
    queryKey: ['genres'],
    queryFn: () => api<{ genres: Genre[] }>('genre/movie/list'),
    ...LONG,
  });

export const useLanguages = () =>
  useQuery({
    queryKey: ['languages'],
    queryFn: () => api<Language[]>('configuration/languages'),
    ...LONG,
  });

export const useCountries = () =>
  useQuery({
    queryKey: ['countries'],
    queryFn: () => api<Country[]>('configuration/countries'),
    ...LONG,
  });

export const useProviders = (region: string) =>
  useQuery({
    queryKey: ['providers', region],
    queryFn: () =>
      api<{ results: ProviderListItem[] }>('watch/providers/movie', { watch_region: region }),
    ...LONG,
  });

export const useCertifications = (region: string) =>
  useQuery({
    queryKey: ['certifications'],
    queryFn: () =>
      api<{ certifications: Record<string, Certification[]> }>('certification/movie/list'),
    ...LONG,
    select: (d) => (d.certifications[region] ?? []).slice().sort((a, b) => a.order - b.order),
  });

/** The viewer's region and how strongly to favour its films. */
export function useFocus() {
  const region = useLibrary((s) => s.region);
  const focus = useUi((s) => s.focus);
  return { region, focus };
}
