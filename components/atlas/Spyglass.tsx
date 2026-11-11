'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { api } from '@/lib/tmdb/browser';
import { useDebounced, useInView } from '@/lib/hooks';
import { useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';
import { EmptyNote, ErrorNote, GRID, GridSkeleton, Pic, Seg } from '@/components/ui/kit';
import { PosterGrid } from '@/components/ui/Poster';
import { Go } from './nav';
import type {
  CollectionSummary,
  Keyword,
  MovieSummary,
  Paginated,
  PersonSummary,
} from '@/types/tmdb';

type Tab = 'movie' | 'person' | 'collection' | 'keyword';
const TABS: { value: Tab; label: string }[] = [
  { value: 'movie', label: 'Films' },
  { value: 'person', label: 'People' },
  { value: 'collection', label: 'Franchises' },
  { value: 'keyword', label: 'Themes' },
];
type Hit = MovieSummary | PersonSummary | CollectionSummary | Keyword;

/** Search, as a lens laid over wherever you are. Opens with "/" or Ctrl/⌘+K. */
export function Spyglass({ onClose }: { onClose: () => void }) {
  const open = useUi((s) => s.searchOpen);
  const seed = useUi((s) => s.searchSeed);
  const recent = useLibrary((s) => s.recentSearches);
  const addRecent = useLibrary((s) => s.addRecentSearch);
  const clearRecent = useLibrary((s) => s.clearRecentSearches);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('movie');
  const query = useDebounced(q.trim(), 280);

  useEffect(() => {
    if (!open) return;
    if (seed) setQ(seed);
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => input.current?.focus(), 40);
    return () => {
      clearTimeout(t);
      prev?.focus?.();
    };
  }, [open, seed]);

  const search = useInfiniteQuery({
    queryKey: ['search', tab, query],
    enabled: open && query.length >= 2,
    initialPageParam: 1,
    staleTime: 1000 * 60 * 10,
    queryFn: ({ pageParam, signal }) =>
      api<Paginated<Hit>>(`search/${tab}`, { query, page: pageParam }, signal),
    getNextPageParam: (l) => (l.page < Math.min(l.total_pages, 500) ? l.page + 1 : undefined),
  });
  const sentinel = useInView<HTMLDivElement>(
    () => {
      if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage();
    },
    open && Boolean(search.hasNextPage),
  );
  const results = search.data?.pages.flatMap((p) => p.results) ?? [];
  const total = search.data?.pages[0]?.total_results ?? 0;

  const leave = () => {
    if (q.trim().length >= 2) addRecent(q.trim());
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          className="parchment absolute inset-0 z-[60] overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              onClose();
            }
          }}
          onClickCapture={(e) => {
            // Any link inside (a film, a person…) closes the lens as it travels.
            if ((e.target as Element).closest('a[href]')) leave();
          }}
        >
          <div className="mx-auto max-w-[1280px] px-6 pb-24 pt-7 sm:px-10">
            <div className="flex items-center justify-between">
              <p className="t-mono text-accent">Spyglass · search the archive</p>
              <button
                type="button"
                onClick={onClose}
                className="icon-btn"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <motion.div
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="relative mt-6"
            >
              <label htmlFor="spyglass" className="sr-only">
                Search films, people, franchises and themes
              </label>
              <input
                id="spyglass"
                ref={input}
                autoComplete="off"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && q.trim() && addRecent(q.trim())}
                placeholder="A film, a face, a franchise…"
                className="big-input pr-12 text-[clamp(2.2rem,7vw,5.5rem)]"
              />
              {search.isFetching && (
                <Loader2
                  className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 animate-spin text-dim"
                  aria-hidden
                />
              )}
            </motion.div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <Seg label="Result type" value={tab} onChange={setTab} options={TABS} />
              <p className="t-mono text-dim" aria-live="polite">
                {query.length >= 2 && search.isSuccess
                  ? `${total.toLocaleString('en-US')} results`
                  : 'Type at least two letters'}
              </p>
            </div>

            <div className="mt-8">
              {query.length < 2 ? (
                recent.length > 0 ? (
                  <div>
                    <div className="mb-3 flex items-center gap-4">
                      <p className="t-mono text-dim">Recent</p>
                      <button
                        type="button"
                        className="t-mono text-dim underline-offset-4 hover:text-accent hover:underline"
                        onClick={clearRecent}
                      >
                        Clear
                      </button>
                    </div>
                    <ul className="flex flex-wrap gap-2">
                      {recent.map((r) => (
                        <li key={r}>
                          <button type="button" className="chip" onClick={() => setQ(r)}>
                            {r}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="t-place text-2xl text-dim">
                    Try “Satyajit Ray”, “time travel” or “Baahubali”.
                  </p>
                )
              ) : search.isLoading ? (
                <GridSkeleton />
              ) : search.isError ? (
                <ErrorNote error={search.error} onRetry={() => search.refetch()} />
              ) : !results.length ? (
                <EmptyNote title="Nothing sighted">
                  Check the spelling, or look under another tab.
                </EmptyNote>
              ) : tab === 'movie' ? (
                <PosterGrid movies={results as MovieSummary[]} />
              ) : tab === 'keyword' ? (
                <ul className="flex flex-wrap gap-2">
                  {(results as Keyword[]).map((k) => (
                    <li key={k.id}>
                      <Go
                        href={`/discover?kw=${encodeURIComponent(`${k.id}:${k.name}`)}`}
                        className="chip h-9 px-4 text-sm"
                      >
                        #{k.name}
                      </Go>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className={GRID}>
                  {(results as (PersonSummary | CollectionSummary)[]).map((r) => {
                    const person = tab === 'person';
                    const image = person
                      ? (r as PersonSummary).profile_path
                      : (r as CollectionSummary).poster_path;
                    return (
                      <li key={r.id}>
                        <Go
                          href={person ? `/person/${r.id}` : `/collection/${r.id}`}
                          className="group block"
                        >
                          <span className="relative block aspect-[2/3] overflow-hidden rounded-[3px] border border-ink/25 transition group-hover:-translate-x-[3px] group-hover:-translate-y-[3px] group-hover:border-ink group-hover:shadow-print">
                            <Pic
                              path={image}
                              kind={person ? 'profile' : 'poster'}
                              alt={person ? `Photo of ${r.name}` : `Poster of ${r.name}`}
                              sizes="170px"
                              title={r.name}
                            />
                          </span>
                          <span className="mt-2 block truncate text-[13.5px] font-semibold">
                            {r.name}
                          </span>
                          {person && (
                            <span className="font-mono text-[10.5px] text-dim">
                              {(r as PersonSummary).known_for_department}
                            </span>
                          )}
                        </Go>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div ref={sentinel} className="mt-10 flex justify-center">
              {query.length >= 2 && search.hasNextPage && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => search.fetchNextPage()}
                  disabled={search.isFetchingNextPage}
                >
                  {search.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
