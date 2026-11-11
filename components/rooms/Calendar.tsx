'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BellPlus, BellRing } from 'lucide-react';
import { api } from '@/lib/tmdb/browser';
import { useLibrary } from '@/store/library';
import { regionName } from '@/config/regions';
import { Go } from '@/components/atlas/nav';
import { EmptyNote, ErrorNote, GridSkeleton, Pic, Room, Seg } from '@/components/ui/kit';
import { addDays, cn, isoDate } from '@/lib/utils';
import type { MovieSummary, Paginated } from '@/types/tmdb';

const DAYS_AHEAD = 120;
const MAX_PAGES = 5;

function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDate(d);
}
const fmt = (date: string, o: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', o);

export function Calendar() {
  const region = useLibrary((s) => s.region);
  const watchlist = useLibrary((s) => s.watchlist);
  const add = useLibrary((s) => s.addToWatchlist);
  const remove = useLibrary((s) => s.removeFromWatchlist);
  const [group, setGroup] = useState<'week' | 'month'>('week');

  const q = useQuery({
    queryKey: ['upcoming-calendar', region],
    queryFn: async () => {
      const today = new Date();
      const params = {
        region,
        'release_date.gte': isoDate(addDays(today, 1)),
        'release_date.lte': isoDate(addDays(today, DAYS_AHEAD)),
        with_release_type: '2|3',
        sort_by: 'popularity.desc',
      };
      const first = await api<Paginated<MovieSummary>>('discover/movie', { ...params, page: 1 });
      const rest = await Promise.all(
        Array.from({ length: Math.min(first.total_pages, MAX_PAGES) - 1 }, (_, i) =>
          api<Paginated<MovieSummary>>('discover/movie', { ...params, page: i + 2 }).catch(
            () => null,
          ),
        ),
      );
      const all = [first, ...rest].flatMap((p) => p?.results ?? []);
      return Array.from(new Map(all.map((m) => [m.id, m])).values()).filter((m) => m.release_date);
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, MovieSummary[]>();
    (q.data ?? [])
      .slice()
      .sort((a, b) => a.release_date.localeCompare(b.release_date))
      .forEach((m) => {
        const key = group === 'week' ? weekStart(m.release_date) : m.release_date.slice(0, 7);
        map.set(key, [...(map.get(key) ?? []), m]);
      });
    return Array.from(map.entries());
  }, [q.data, group]);

  return (
    <Room
      mark="Calendar · what is releasing next"
      title="Coming soon"
      lede={`Releases in ${regionName(region)} over the next ${DAYS_AHEAD} days. Change the region in the top bar.`}
      actions={
        <Seg
          label="Group by"
          value={group}
          onChange={setGroup}
          options={[
            { value: 'week', label: 'By week' },
            { value: 'month', label: 'By month' },
          ]}
        />
      }
    >
      {q.isLoading ? (
        <GridSkeleton />
      ) : q.isError ? (
        <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      ) : !groups.length ? (
        <EmptyNote title="Calm seas">
          No releases are listed for this region yet. Try another region.
        </EmptyNote>
      ) : (
        <ol className="space-y-10">
          {groups.map(([key, movies]) => (
            <li key={key} className="grid gap-x-8 gap-y-3 lg:grid-cols-[190px_1fr]">
              <div className="flex items-baseline gap-3 lg:sticky lg:top-20 lg:block lg:h-fit">
                {group === 'week' ? (
                  <>
                    <p className="t-mono text-accent">Week of</p>
                    <p className="t-display text-5xl lg:mt-1 lg:text-7xl">
                      {fmt(key, { day: '2-digit' })}
                    </p>
                    <p className="t-place text-xl text-dim">
                      {fmt(key, { month: 'long', year: 'numeric' })}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="t-display text-5xl lg:text-7xl">
                      {fmt(`${key}-01`, { month: 'short' })}
                    </p>
                    <p className="t-place text-xl text-dim">{key.slice(0, 4)}</p>
                  </>
                )}
              </div>
              <ul className="border-t border-ink/25">
                {movies.map((m) => {
                  const on = Boolean(watchlist[m.id]?.tags.includes('Upcoming'));
                  return (
                    <li
                      key={m.id}
                      className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-4 border-b border-ink/15 py-2.5 sm:grid-cols-[2.75rem_4.5rem_1fr_auto]"
                    >
                      <Go
                        href={`/movie/${m.id}`}
                        className="relative aspect-[2/3] overflow-hidden rounded-[2px] border border-ink/25"
                        tabIndex={-1}
                        aria-hidden
                      >
                        <Pic
                          path={m.poster_path}
                          kind="poster"
                          alt=""
                          sizes="44px"
                          title={m.title}
                        />
                      </Go>
                      <span className="hidden font-mono text-[11px] uppercase tabular-nums text-dim sm:block">
                        {fmt(m.release_date, { day: '2-digit', month: 'short' })}
                      </span>
                      <Go href={`/movie/${m.id}`} className="min-w-0">
                        <span className="block truncate text-[17px] font-medium hover:text-accent">
                          {m.title}
                        </span>
                        <span className="font-mono text-[10.5px] uppercase text-dim sm:hidden">
                          {fmt(m.release_date, { day: '2-digit', month: 'short' })}
                        </span>
                      </Go>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => (on ? remove(m.id) : add(m, ['Upcoming']))}
                        className={cn('btn btn-sm', on && 'border-accent bg-accent text-on-accent')}
                        aria-label={
                          on ? `Stop reminding me about ${m.title}` : `Remind me about ${m.title}`
                        }
                      >
                        {on ? (
                          <BellRing className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <BellPlus className="h-3.5 w-3.5" aria-hidden />
                        )}
                        <span className="hidden sm:inline">
                          {on ? 'On watchlist' : 'Remind me'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Room>
  );
}
