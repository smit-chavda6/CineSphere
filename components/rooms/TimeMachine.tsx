'use client';

import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/tmdb/browser';
import { G, GENRE_NAMES } from '@/config/genres';
import { ReelSkeleton, Room } from '@/components/ui/kit';
import { PosterReel } from '@/components/ui/Poster';
import { cn } from '@/lib/utils';
import { useFocus } from '@/lib/hooks';
import { blend, localize } from '@/lib/focus';
import type { MovieSummary, Paginated } from '@/types/tmdb';

const DECADES = Array.from({ length: 13 }, (_, i) => 1900 + i * 10);
const GROUPS = [
  G.drama,
  G.comedy,
  G.romance,
  G.action,
  G.thriller,
  G.crime,
  G.scifi,
  G.horror,
  G.animation,
  G.western,
  G.war,
  G.music,
];

export function TimeMachine() {
  const [decade, setDecade] = useState(1990);
  const [year, setYear] = useState('');
  const exact = /^\d{4}$/.test(year) ? Number(year) : null;
  const from = exact ?? decade;
  const to = exact ?? decade + 9;
  const label = exact ? String(exact) : `${decade}s`;
  const minVotes = from < 1950 ? 30 : from < 1980 ? 100 : 300;
  const base = useMemo(
    () => ({
      'primary_release_date.gte': `${from}-01-01`,
      'primary_release_date.lte': `${to}-12-31`,
    }),
    [from, to],
  );

  const { region, focus } = useFocus();
  const queries = useQueries({
    queries: [
      { ...base, sort_by: 'vote_average.desc', 'vote_count.gte': String(minVotes) },
      { ...base, sort_by: 'vote_count.desc' },
      ...GROUPS.map((g) => ({
        ...base,
        with_genres: String(g),
        sort_by: 'vote_count.desc',
        'vote_count.gte': String(Math.round(minVotes / 3)),
      })),
    ].map((params) => ({
      queryKey: ['decade', params, focus, region],
      // Each row blends that decade's worldwide films with those made in the viewer's region.
      queryFn: async (): Promise<Paginated<MovieSummary>> => {
        const [world, local] = await Promise.all([
          focus === 'local' ? null : api<Paginated<MovieSummary>>('discover/movie', params),
          focus === 'world'
            ? null
            : api<Paginated<MovieSummary>>('discover/movie', localize(params, region, 0.15)).catch(
                () => null,
              ),
        ]);
        const page = (world ?? local)!;
        return { ...page, results: blend(local?.results ?? [], world?.results ?? [], focus) };
      },
      staleTime: 1000 * 60 * 60,
    })),
  });
  const [best, popular, ...genres] = queries;

  return (
    <Room
      mark="Time Machine · any decade, any year"
      title={
        <>
          The best of <span className="text-accent">{label}</span>
        </>
      }
      lede="Slide along the ruler, or type a single year."
    >
      {/* A ruler of decades: the control is the timeline itself. */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div
          role="radiogroup"
          aria-label="Decade"
          className="no-scrollbar -mx-1 flex max-w-full flex-1 items-end overflow-x-auto border-b border-ink/40 px-1"
        >
          {DECADES.map((d) => {
            const on = !exact && decade === d;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setDecade(d);
                  setYear('');
                }}
                className="group relative flex min-w-[58px] flex-1 flex-col items-center pb-3 pt-1"
              >
                <span
                  className={cn(
                    't-display transition-all duration-300 ease-expo',
                    on
                      ? 'text-4xl text-accent sm:text-5xl'
                      : 'text-2xl text-ink/35 group-hover:text-ink',
                  )}
                >
                  {d === 1900 || d === 2000 ? d : `’${String(d).slice(2)}`}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'absolute bottom-0 w-px bg-ink transition-all',
                    on ? 'h-3 w-[3px] bg-accent' : 'h-2',
                  )}
                />
              </button>
            );
          })}
        </div>
        <label className="w-36">
          <span className="t-mono text-dim">Or one year</span>
          <input
            className="field font-mono"
            inputMode="numeric"
            maxLength={4}
            placeholder="1975"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
          />
        </label>
      </div>

      <div className="mt-10 space-y-12">
        <Row title={`Best of ${label}`} aside="highest rated" q={best} rank />
        <Row title="Most watched" aside={label} q={popular} />
        {genres.map((q, i) => (
          <Row key={GROUPS[i]} title={GENRE_NAMES[GROUPS[i]]} aside={label} q={q} hideEmpty />
        ))}
      </div>
    </Room>
  );
}

function Row({
  title,
  aside,
  q,
  hideEmpty,
  rank,
}: {
  title: string;
  aside?: string;
  q: { data?: Paginated<MovieSummary>; isLoading: boolean };
  hideEmpty?: boolean;
  rank?: boolean;
}) {
  if (q.isLoading) return <ReelSkeleton />;
  const movies = q.data?.results ?? [];
  if (!movies.length)
    return hideEmpty ? null : <p className="text-dim">No films found for {title.toLowerCase()}.</p>;
  return <PosterReel title={title} aside={aside} movies={movies} rank={rank} />;
}
