'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Backpack, Check, Plus } from 'lucide-react';
import { discoverQuery, filmQuery, listQuery, type ListParams } from '@/lib/queries';
import { GENRE_NAMES, HOME_GENRE_ROWS } from '@/config/genres';
import { regionName } from '@/config/regions';
import { useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';
import { Go, go, isTyping, useRoomActive } from '@/components/atlas/nav';
import { ErrorNote, Frame, Pic, ScaleBar } from '@/components/ui/kit';
import { Reel } from '@/components/ui/Poster';
import { Credit } from '@/components/atlas/Credit';
import { addDays, cn, isoDate, yearOf } from '@/lib/utils';
import { blend, type Focus } from '@/lib/focus';
import type { CardMovie } from '@/types/app';
import type { MovieSummary, Paginated } from '@/types/tmdb';

type ChannelId = 'week' | 'today' | 'cinemas' | 'soon' | 'top' | 'gems' | 'mine';
type Film = CardMovie & { overview?: string };

interface ListDef {
  queryKey: readonly unknown[];
  queryFn: () => Promise<Paginated<MovieSummary>>;
  staleTime: number;
}

const CHANNELS: {
  id: ChannelId;
  label: string;
  line: (region: string, local: boolean) => string;
}[] = [
  {
    id: 'week',
    label: 'This week',
    line: (r, l) => (l ? `trending in ${regionName(r)} this week` : 'trending this week'),
  },
  {
    id: 'today',
    label: 'Today',
    line: (r, l) => (l ? `new and talked about in ${regionName(r)}` : 'trending in the last day'),
  },
  { id: 'cinemas', label: 'In cinemas', line: (r) => `on screens in ${regionName(r)}` },
  { id: 'soon', label: 'Coming soon', line: (r) => `releasing in ${regionName(r)}, next 60 days` },
  {
    id: 'top',
    label: 'All-time',
    line: (r, l) => (l ? `the best of ${regionName(r)} and the world` : 'the highest rated ever'),
  },
  { id: 'gems', label: 'Hidden gems', line: () => 'loved, barely seen' },
  { id: 'mine', label: 'Your list', line: () => 'waiting on your watchlist' },
];

/** The same channel, limited to films made in the viewer's region. */
function localChannelQuery(id: ChannelId, region: string): ListDef {
  const today = new Date();
  const local = (p: ListParams): ListDef => discoverQuery({ with_origin_country: region, ...p });
  switch (id) {
    case 'today':
      return local({
        'primary_release_date.gte': isoDate(addDays(today, -45)),
        'primary_release_date.lte': isoDate(today),
        sort_by: 'popularity.desc',
      });
    case 'cinemas':
      return local({
        region,
        with_release_type: '2|3',
        'release_date.gte': isoDate(addDays(today, -45)),
        'release_date.lte': isoDate(today),
        sort_by: 'popularity.desc',
      });
    case 'soon':
      return local({
        region,
        with_release_type: '2|3',
        'release_date.gte': isoDate(today),
        'release_date.lte': isoDate(addDays(today, 60)),
        sort_by: 'popularity.desc',
      });
    case 'top':
      return local({
        sort_by: 'vote_average.desc',
        'vote_count.gte': 500,
        without_genres: '99,10770',
      });
    case 'gems':
      return local({
        'vote_average.gte': 7.2,
        'vote_count.gte': 40,
        'vote_count.lte': 800,
        sort_by: 'vote_average.desc',
        without_genres: '99,10770',
      });
    default:
      return local({
        'primary_release_date.gte': isoDate(addDays(today, -150)),
        'primary_release_date.lte': isoDate(addDays(today, 3)),
        sort_by: 'popularity.desc',
      });
  }
}

function channelQuery(id: ChannelId, region: string): ListDef {
  const today = new Date();
  const discover = (p: ListParams): ListDef => discoverQuery(p);
  switch (id) {
    case 'today':
      return listQuery('trending/movie/day');
    case 'cinemas':
      return listQuery('movie/now_playing', { region });
    case 'soon':
      return discover({
        region,
        'release_date.gte': isoDate(today),
        'release_date.lte': isoDate(addDays(today, 60)),
        with_release_type: '2|3',
        sort_by: 'popularity.desc',
      });
    case 'top':
      return discover({
        sort_by: 'vote_average.desc',
        'vote_count.gte': 3000,
        without_genres: '99,10770',
      });
    case 'gems':
      return discover({
        'vote_average.gte': 7.2,
        'vote_count.gte': 150,
        'vote_count.lte': 3000,
        sort_by: 'vote_average.desc',
        without_genres: '99,10770',
      });
    default:
      return listQuery('trending/movie/week');
  }
}

/**
 * Home harbour. One screen, no page to scroll: pick a channel, run along the
 * reel, and the sphere shows whichever film is under the needle.
 */
export function Tonight() {
  const active = useRoomActive();
  const qc = useQueryClient();
  const region = useLibrary((s) => s.region);
  const watchlist = useLibrary((s) => s.watchlist);
  const saved = useLibrary((s) => s.movies);
  const toggleWatchlist = useLibrary((s) => s.toggleWatchlist);
  const pocket = useUi((s) => s.pocket);
  const carry = useUi((s) => s.carry);

  const [channel, setChannel] = useState<ChannelId>('week');
  const [index, setIndex] = useState(0);
  const strip = useRef<HTMLDivElement>(null);

  const mine = useMemo<Film[]>(
    () =>
      Object.entries(watchlist)
        .sort((a, b) => b[1].addedAt - a[1].addedAt)
        .map(([id]) => saved[Number(id)])
        .filter(Boolean),
    [watchlist, saved],
  );
  const channels = CHANNELS.filter((c) => c.id !== 'mine' || mine.length > 0);
  const current = channels.find((c) => c.id === channel) ?? channels[0];

  // Two lists per channel, worldwide and made-in-region, blended by the viewer's choice.
  const focus: Focus = useUi((s) => s.focus);
  const worldQ = useQuery({
    ...channelQuery(current.id, region),
    enabled: current.id !== 'mine' && focus !== 'local',
  });
  const localQ = useQuery({
    ...localChannelQuery(current.id, region),
    enabled: current.id !== 'mine' && focus !== 'world',
  });
  // Errors only matter when the list we would show is the one that failed.
  const q =
    focus === 'local' ? localQ : focus === 'world' ? worldQ : worldQ.isError ? localQ : worldQ;
  const list: Film[] = useMemo(() => {
    if (current.id === 'mine') return mine;
    return blend(localQ.data?.results ?? [], worldQ.data?.results ?? [], focus).filter(
      (m) => m.poster_path,
    );
  }, [current.id, mine, worldQ.data, localQ.data, focus]);
  const at = Math.min(index, Math.max(0, list.length - 1));
  const film = list[at];

  const pick = (id: ChannelId) => {
    setChannel(id);
    setIndex(0);
    strip.current?.scrollTo({ left: 0 });
  };

  // Keep the film under the needle centred in the reel.
  useEffect(() => {
    const reel = strip.current;
    const el = reel?.children[at] as HTMLElement | undefined;
    if (!reel || !el) return;
    reel.scrollTo({
      left: el.offsetLeft - reel.clientWidth / 2 + el.clientWidth / 2,
      behavior: 'smooth',
    });
  }, [at, current.id]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(list.length - 1, i + 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // Up and down switch the channel.
        const ids = keyState.current.channels;
        const i = ids.indexOf(keyState.current.channel);
        const next = ids[(i + (e.key === 'ArrowDown' ? 1 : -1) + ids.length) % ids.length];
        if (next) pick(next);
      } else if (e.key === 'Enter') {
        // Only when nothing else has focus; a focused button or link keeps its own Enter.
        const el = document.activeElement;
        if (el && el !== document.body && el.closest('a,button,input,select,textarea')) return;
        const id = keyState.current.film;
        if (id) go('/movie/' + id);
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // pick only touches state setters and a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, list.length]);

  const keyState = useRef({ channels: [] as ChannelId[], channel: current.id, film: film?.id });
  keyState.current = { channels: channels.map((c) => c.id), channel: current.id, film: film?.id };

  const year = film ? yearOf(film.release_date) : null;
  const inList = film ? Boolean(watchlist[film.id]) : false;
  const carried = film ? pocket.some((p) => p.id === film.id) : false;
  const genres = (film?.genre_ids ?? [])
    .map((g) => GENRE_NAMES[g])
    .filter(Boolean)
    .slice(0, 3);

  return (
    <section
      className="fade-top absolute inset-0 overflow-y-auto overscroll-contain"
      aria-label="Tonight"
    >
      <div className="flex min-h-full flex-col px-7 pb-[6rem] pt-[5.25rem] sm:px-10 lg:px-16">
        <div className="grid flex-1 items-center gap-x-10 gap-y-5 py-2 lg:grid-cols-[1.12fr_0.88fr]">
          {/* ---------- the film under the needle ---------- */}
          <Frame className="order-2 min-w-0 lg:order-1" inner="px-5 py-4 sm:px-8 sm:py-5">
            <p className="t-mono text-accent">
              Tonight · {current.label}
              {list.length > 0 && (
                <span className="text-dim">
                  {' '}
                  · {String(at + 1).padStart(2, '0')}/{String(list.length).padStart(2, '0')}
                </span>
              )}
            </p>
            {q.isError && current.id !== 'mine' ? (
              <ErrorNote error={q.error} onRetry={() => q.refetch()} className="mt-5" />
            ) : !film ? (
              <div className="mt-4 space-y-4" role="status" aria-label="Loading">
                <div className="skeleton h-[clamp(3rem,7vw,7rem)] w-4/5" />
                <div className="skeleton h-[clamp(3rem,7vw,7rem)] w-3/5" />
                <div className="skeleton h-16 w-full max-w-xl" />
              </div>
            ) : (
              <div key={film.id} className="fade-in">
                <h1 className="t-display mt-3 line-clamp-2 text-balance text-[clamp(2.3rem,5vw,5rem)]">
                  <Go href={`/movie/${film.id}`} className="transition-colors hover:text-accent">
                    {film.title}
                  </Go>
                </h1>
                <p className="mt-4 font-mono text-[12px] tracking-wide text-dim">
                  {year ?? 'TBA'}
                  {(film.vote_average ?? 0) > 0 && <> · ★ {film.vote_average!.toFixed(1)}</>}
                  {genres.length > 0 && <> · {genres.join(' / ')}</>}
                </p>
                {film.overview && (
                  <p className="mt-3 line-clamp-3 max-w-xl text-[15px] leading-relaxed text-ink/85">
                    {film.overview}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap gap-2.5">
                  <Go
                    href={`/movie/${film.id}`}
                    className="btn-solid"
                    onPointerEnter={() => void qc.prefetchQuery(filmQuery(film.id))}
                  >
                    Open the film <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </Go>
                  <button
                    type="button"
                    className={cn('btn', inList && 'btn-on')}
                    aria-pressed={inList}
                    onClick={() => toggleWatchlist(film)}
                  >
                    {inList ? (
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {inList ? 'On watchlist' : 'Watchlist'}
                  </button>
                  <button
                    type="button"
                    className={cn('btn', carried && 'btn-on')}
                    aria-pressed={carried}
                    onClick={() => carry(film)}
                  >
                    <Backpack className="h-3.5 w-3.5" aria-hidden />{' '}
                    {carried ? 'In pocket' : 'Carry'}
                  </button>
                </div>
              </div>
            )}
            <div className="mt-5 hidden items-end justify-between gap-6 border-t border-ink/25 pt-4 xl:flex">
              <p className="t-mono flex flex-wrap items-center gap-x-4 gap-y-1 text-dim">
                <span className="text-ink">Start anywhere</span>
                {HOME_GENRE_ROWS.map((g) => (
                  <Go
                    key={g}
                    href={`/discover?g=${g}`}
                    className="underline-offset-4 hover:text-accent hover:underline"
                  >
                    {GENRE_NAMES[g]}
                  </Go>
                ))}
                <Go
                  href="/recommend/mood"
                  className="underline-offset-4 hover:text-accent hover:underline"
                >
                  By mood
                </Go>
                <Go href="/atlas" className="text-accent underline-offset-4 hover:underline">
                  Whole chart →
                </Go>
              </p>
              <div className="shrink-0 text-right">
                <ScaleBar />
                <Credit className="mt-1 text-[13px]" />
              </div>
            </div>
          </Frame>

          {/* ---------- the plate: the film's still, framed like an engraving in an atlas ---------- */}
          <div className="order-1 lg:order-2">
            {film ? (
              <figure className="mx-auto w-full max-w-[640px]">
                <Go
                  href={`/movie/${film.id}`}
                  className="group relative block"
                  aria-label={`Open ${film.title}`}
                >
                  <Frame
                    inner="p-[6px]"
                    className="shadow-print transition duration-300 group-hover:-translate-x-[2px] group-hover:-translate-y-[2px]"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden border border-ink/50 bg-ink/10">
                      <AnimatePresence initial={false}>
                        <motion.span
                          key={film.id}
                          className="absolute inset-0"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <Pic
                            path={film.backdrop_path ?? film.poster_path}
                            kind={film.backdrop_path ? 'backdrop' : 'poster'}
                            alt=""
                            sizes="(min-width: 1024px) 640px, 92vw"
                            priority
                            title={film.title}
                            className="saturate-[0.85] sepia-[0.3] transition duration-[1200ms] ease-expo group-hover:scale-[1.03] group-hover:saturate-100 group-hover:sepia-0"
                          />
                        </motion.span>
                      </AnimatePresence>
                      {/* a soft vignette, as on an old print */}
                      <span
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(40,24,10,0.45)_100%)]"
                        aria-hidden
                      />
                    </div>
                  </Frame>
                  {(film.vote_average ?? 0) > 0 && (
                    // the rating, pressed into the corner like a wax seal
                    <span className="absolute -bottom-5 -right-3 grid h-[4.25rem] w-[4.25rem] rotate-[-9deg] place-items-center rounded-full bg-accent text-on-accent shadow-print">
                      <span
                        className="absolute inset-[4px] rounded-full border border-dashed border-on-accent/60"
                        aria-hidden
                      />
                      <span className="t-display text-[1.35rem] leading-none">
                        ★{film.vote_average!.toFixed(1)}
                      </span>
                    </span>
                  )}
                </Go>
                <figcaption className="t-place mt-3 pr-16 text-[16px] text-dim">
                  Plate {at + 1}. — {film.title}
                  {year ? `, ${year}` : ''}
                </figcaption>
              </figure>
            ) : (
              <div className="skeleton mx-auto aspect-[16/9] w-full max-w-[640px]" />
            )}
          </div>
        </div>

        {/* ---------- channels + reel ---------- */}
        <div className="border-t border-ink/25 pt-3">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div
              role="tablist"
              aria-label="Channel"
              className="no-scrollbar -mx-1 flex max-w-full gap-1 overflow-x-auto px-1"
            >
              {channels.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={c.id === current.id}
                  onClick={() => pick(c.id)}
                  className={cn(
                    't-mono shrink-0 rounded-full border px-3 py-1.5 transition',
                    c.id === current.id
                      ? 'border-ink bg-ink text-paper'
                      : 'border-transparent text-dim hover:border-ink/40 hover:text-ink',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="t-place ml-auto hidden text-lg text-dim sm:block">
              {current.line(region, focus !== 'world')} · ← → to browse
            </p>
          </div>
          {list.length === 0 && !q.isError ? (
            <div className="flex gap-3 overflow-hidden" role="status" aria-label="Loading">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="skeleton aspect-[2/3] w-[80px] shrink-0 sm:w-[90px]" />
              ))}
            </div>
          ) : (
            <Reel wheel scroller={strip} label={current.label} className="!pt-3">
              {list.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  aria-current={i === at}
                  aria-label={`${m.title}${i === at ? ' (open)' : ''}`}
                  title={m.title}
                  onClick={() => (i === at ? go(`/movie/${m.id}`) : setIndex(i))}
                  className={cn(
                    'relative aspect-[2/3] w-[80px] shrink-0 overflow-hidden border transition duration-300 ease-expo sm:w-[90px]',
                    i === at
                      ? '-translate-y-2 border-2 border-accent shadow-print'
                      : 'border-ink/50 opacity-70 sepia-[0.35] hover:opacity-100 hover:sepia-0',
                  )}
                >
                  <Pic path={m.poster_path} kind="poster" alt="" sizes="100px" title={m.title} />
                  {/* legend number, as on a map key */}
                  <span
                    className={cn(
                      'absolute bottom-0 left-0 px-1 font-mono text-[10px] leading-[1.5]',
                      i === at ? 'bg-accent text-on-accent' : 'bg-island text-ink',
                    )}
                  >
                    {i + 1}
                  </span>
                </button>
              ))}
            </Reel>
          )}
        </div>
      </div>
    </section>
  );
}
