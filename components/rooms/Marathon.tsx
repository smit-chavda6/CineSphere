'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/tmdb/browser';
import { useDebounced } from '@/lib/hooks';
import { Go } from '@/components/atlas/nav';
import { EmptyNote, GridSkeleton, Pic, Room } from '@/components/ui/kit';
import type { CollectionSummary, Paginated } from '@/types/tmdb';

const SUGGESTIONS = [
  'Baahubali',
  'Dhoom',
  'Golmaal',
  'Harry Potter',
  'Lord of the Rings',
  'Mission: Impossible',
  'Avengers',
  'Star Wars',
  'Toy Story',
  'Spider-Verse',
];

export function Marathon() {
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim(), 300);
  const { data, isFetching } = useQuery({
    queryKey: ['collections', query],
    enabled: query.length >= 2,
    queryFn: ({ signal }) =>
      api<Paginated<CollectionSummary>>('search/collection', { query }, signal),
  });

  return (
    <Room
      mark="Marathons · franchises in order"
      title="Plan a marathon"
      lede="Find a franchise and get every film in release order, with total runtime and what you have left."
    >
      <div className="max-w-4xl">
        <label htmlFor="franchise" className="sr-only">
          Search franchises
        </label>
        <input
          id="franchise"
          className="big-input text-[clamp(2rem,5vw,3.75rem)]"
          placeholder="Search a franchise…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
        <div className="mt-4 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => setQ(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-10 max-w-4xl">
        {query.length < 2 ? null : isFetching && !data ? (
          <GridSkeleton count={6} />
        ) : !data?.results.length ? (
          <EmptyNote title="No franchises found" />
        ) : (
          <ul className="border-t border-ink/20">
            {data.results.map((c, i) => (
              <li key={c.id}>
                <Go
                  href={`/collection/${c.id}`}
                  className="group grid grid-cols-[2rem_3.25rem_1fr_auto] items-center gap-4 border-b border-ink/20 py-3 transition hover:bg-ink hover:px-3 hover:text-paper"
                >
                  <span className="font-mono text-[11px] tabular-nums opacity-60">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="relative aspect-[2/3] overflow-hidden rounded-[2px] border border-ink/25">
                    <Pic path={c.poster_path} kind="poster" alt="" sizes="52px" title={c.name} />
                  </span>
                  <span className="t-display truncate text-[clamp(1.4rem,3vw,2.5rem)] leading-none">
                    {c.name.replace(/ Collection$/, '')}
                  </span>
                  <ArrowUpRight
                    className="h-5 w-5 opacity-50 transition group-hover:rotate-45 group-hover:opacity-100"
                    aria-hidden
                  />
                </Go>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Room>
  );
}
