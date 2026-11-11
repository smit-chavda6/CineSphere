'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Backpack, Check, Plus, X } from 'lucide-react';
import { api } from '@/lib/tmdb/browser';
import { filmQuery } from '@/lib/queries';
import { useDebounced } from '@/lib/hooks';
import { useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';
import { Go } from '@/components/atlas/nav';
import { GRID, Pic } from './kit';
import { cn, yearOf } from '@/lib/utils';
import type { CardMovie } from '@/types/app';
import type { MovieSummary, Paginated } from '@/types/tmdb';

export const FILM_MIME = 'application/x-cinesphere-film';

/** Reads a film dragged from any poster. */
export function droppedFilm(e: DragEvent): CardMovie | null {
  try {
    const raw = e.dataTransfer.getData(FILM_MIME);
    const m = raw ? (JSON.parse(raw) as CardMovie) : null;
    return m && Number.isInteger(m.id) ? m : null;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- PosterTile */

interface TileProps {
  movie: CardMovie;
  /** Extra line(s) under the title, e.g. why it was recommended. */
  note?: ReactNode;
  children?: ReactNode;
  priority?: boolean;
  /** Show the full release date instead of the year. */
  date?: string;
  rank?: number;
  sizes?: string;
  className?: string;
}

/** A film on the chart. Click opens it, drag carries it, the corner buttons save or pocket it. */
export function PosterTile({
  movie,
  note,
  children,
  priority,
  date,
  rank,
  sizes = '(min-width: 640px) 170px, 45vw',
  className,
}: TileProps) {
  const qc = useQueryClient();
  const inList = useLibrary((s) => Boolean(s.watchlist[movie.id]));
  const seen = useLibrary((s) => Boolean(s.seen[movie.id]));
  const toggleWatchlist = useLibrary((s) => s.toggleWatchlist);
  const carried = useUi((s) => s.pocket.some((p) => p.id === movie.id));
  const carry = useUi((s) => s.carry);
  const year = yearOf(movie.release_date);
  const rating = movie.vote_average ?? 0;

  return (
    <article
      className={cn('group/tile relative min-w-0', className)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          FILM_MIME,
          JSON.stringify({
            id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            release_date: movie.release_date ?? '',
            vote_average: rating,
            genre_ids: movie.genre_ids ?? [],
          }),
        );
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <Go
        href={`/movie/${movie.id}`}
        className="block"
        onPointerEnter={() => void qc.prefetchQuery(filmQuery(movie.id))}
      >
        <div className="relative aspect-[2/3] overflow-hidden border border-ink/60 bg-island outline outline-1 outline-offset-[3px] outline-ink/30 transition duration-200 ease-expo group-hover/tile:-translate-x-[3px] group-hover/tile:-translate-y-[3px] group-hover/tile:border-ink group-hover/tile:shadow-print [&_img]:sepia-[0.18] [&_img]:transition group-hover/tile:[&_img]:sepia-0">
          <Pic
            path={movie.poster_path}
            kind="poster"
            alt={`Poster of ${movie.title} (${year ?? 'TBA'})`}
            sizes={sizes}
            priority={priority}
            title={movie.title}
          />
          {rank !== undefined && (
            <span className="t-display absolute bottom-1 left-2 text-5xl text-white [text-shadow:2px_2px_0_rgb(0_0_0/0.85)]">
              {String(rank).padStart(2, '0')}
            </span>
          )}
          {seen && (
            <span
              className="absolute bottom-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-ok text-white"
              title="Seen"
            >
              <Check className="h-3 w-3" aria-hidden />
              <span className="sr-only">Seen</span>
            </span>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-[13.5px] font-semibold leading-[1.2]">{movie.title}</p>
        <p className="mt-1 font-mono text-[10.5px] tracking-wide text-dim">
          {date ?? year ?? 'TBA'}
          {rating > 0 && <> · ★ {rating.toFixed(1)}</>}
        </p>
      </Go>
      <div
        className={cn(
          'absolute right-1.5 top-1.5 flex flex-col gap-1 transition',
          !inList &&
            !carried &&
            'opacity-0 group-focus-within/tile:opacity-100 group-hover/tile:opacity-100',
        )}
      >
        <TileButton
          on={inList}
          label={
            inList ? `Remove ${movie.title} from watchlist` : `Add ${movie.title} to watchlist`
          }
          onClick={() => toggleWatchlist(movie)}
          hideWhenOff={carried}
        >
          {inList ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </TileButton>
        <TileButton
          on={carried}
          label={carried ? `Drop ${movie.title} from pocket` : `Carry ${movie.title} in pocket`}
          onClick={() => carry(movie)}
          hideWhenOff={inList}
        >
          <Backpack className="h-3.5 w-3.5" />
        </TileButton>
      </div>
      {note && <div className="mt-1.5 text-[12.5px] leading-snug text-dim">{note}</div>}
      {children}
    </article>
  );
}

function TileButton({
  on,
  label,
  onClick,
  children,
  hideWhenOff,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
  hideWhenOff?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-[3px] border transition',
        on
          ? 'border-accent bg-accent text-on-accent'
          : 'border-black/60 bg-white/90 text-black hover:bg-black hover:text-white',
        !on &&
          hideWhenOff &&
          'opacity-0 group-focus-within/tile:opacity-100 group-hover/tile:opacity-100',
      )}
    >
      {children}
    </button>
  );
}

export function PosterGrid({ movies, className }: { movies: CardMovie[]; className?: string }) {
  return (
    <ul className={cn(GRID, className)}>
      {movies.map((m, i) => (
        <li key={m.id}>
          <PosterTile movie={m} priority={i < 6} />
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- Scored results */

export interface ScoredItem {
  movie: CardMovie;
  reasons: string[];
  perPerson?: { name: string; percent: number }[];
}

/** Recommendation results: posters with a "why" note and optional per-person match. */
export function ScoredGrid({
  items,
  allowDismiss = true,
}: {
  items: ScoredItem[];
  allowDismiss?: boolean;
}) {
  const markNotInterested = useLibrary((s) => s.markNotInterested);
  const notInterested = useLibrary((s) => s.notInterested);
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-9 sm:grid-cols-[repeat(auto-fill,minmax(176px,1fr))]">
      {items
        .filter((i) => !notInterested[i.movie.id])
        .map(({ movie, reasons, perPerson }, i) => (
          <li key={movie.id}>
            <PosterTile
              movie={movie}
              priority={i < 5}
              note={
                <>
                  {perPerson && (
                    <ul className="mb-2 space-y-1" aria-label="Match per person">
                      {perPerson.map((p) => (
                        <li
                          key={p.name}
                          className="flex items-center gap-2 font-mono text-[10.5px]"
                        >
                          <span className="w-14 truncate text-ink">{p.name}</span>
                          <span className="h-[3px] flex-1 bg-ink/15">
                            <span
                              className="block h-full bg-accent"
                              style={{ width: `${p.percent}%` }}
                            />
                          </span>
                          <span className="w-8 text-right tabular-nums">{p.percent}%</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {reasons.length > 0 && (
                    <p className="t-place text-[14px] leading-snug">
                      <span className="sr-only">Why recommended: </span>
                      {reasons.join(' · ')}
                    </p>
                  )}
                </>
              }
            >
              {allowDismiss && (
                <button
                  type="button"
                  onClick={() => markNotInterested(movie)}
                  className="t-mono mt-2 text-[10px] text-dim hover:text-danger"
                >
                  Not interested
                </button>
              )}
            </PosterTile>
          </li>
        ))}
    </ul>
  );
}

/** Converts engine features back into the minimal card shape. */
export function featureToCard(f: {
  id: number;
  title: string;
  year: number | null;
  voteAverage: number;
  genres: number[];
  posterPath: string | null;
}): CardMovie {
  return {
    id: f.id,
    title: f.title,
    poster_path: f.posterPath,
    release_date: f.year ? `${f.year}-01-01` : '',
    vote_average: f.voteAverage,
    genre_ids: f.genres,
  };
}

/* ---------------------------------------------------------------- Reel */

/**
 * A horizontal strip. With `wheel`, a vertical mouse wheel scrolls it sideways
 * (used where the place itself does not scroll).
 */
export function Reel({
  children,
  className,
  wheel,
  label,
  scroller,
}: {
  children: ReactNode;
  className?: string;
  wheel?: boolean;
  label?: string;
  scroller?: RefObject<HTMLDivElement>;
}) {
  const own = useRef<HTMLDivElement>(null);
  const ref = scroller ?? own;
  const [edge, setEdge] = useState({ start: true, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const start = el.scrollLeft <= 2;
      const end = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
      setEdge((p) => (p.start === start && p.end === end ? p : { start, end }));
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1))
        return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    if (wheel) el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('scroll', measure);
      el.removeEventListener('wheel', onWheel);
      ro.disconnect();
    };
  }, [wheel, children, ref]);

  const nudge = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <div className="group/reel relative">
      <div
        ref={ref}
        aria-label={label}
        className={cn(
          'no-scrollbar flex gap-3 overflow-x-auto overscroll-x-contain pb-2 pl-1 pt-1',
          className,
        )}
      >
        {children}
      </div>
      {!edge.start && (
        <button
          type="button"
          aria-label="Scroll back"
          onClick={() => nudge(-1)}
          className="icon-btn absolute -left-3 top-[38%] hidden -translate-y-1/2 bg-island shadow-print-sm md:grid md:opacity-0 md:group-hover/reel:opacity-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}
      {!edge.end && (
        <button
          type="button"
          aria-label="Scroll forward"
          onClick={() => nudge(1)}
          className="icon-btn absolute -right-3 top-[38%] hidden -translate-y-1/2 bg-island shadow-print-sm md:grid md:opacity-0 md:group-hover/reel:opacity-100"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function PosterReel({
  movies,
  title,
  aside,
  action,
  rank,
  className,
}: {
  movies: CardMovie[];
  title?: string;
  aside?: string;
  action?: ReactNode;
  rank?: boolean;
  className?: string;
}) {
  if (!movies.length) return null;
  return (
    <section className={className} aria-label={title}>
      {title && (
        <div className="mb-3 flex items-baseline gap-3">
          <h3 className="t-display text-2xl sm:text-3xl">{title}</h3>
          {aside && <span className="t-place text-lg text-dim">{aside}</span>}
          {action && <span className="ml-auto">{action}</span>}
        </div>
      )}
      <Reel label={title}>
        {movies.map((m, i) => (
          <PosterTile
            key={m.id}
            movie={m}
            rank={rank ? i + 1 : undefined}
            className="w-[132px] shrink-0 sm:w-[150px]"
            sizes="150px"
          />
        ))}
      </Reel>
    </section>
  );
}

/* ---------------------------------------------------------------- MoviePicker */

export type PickedMovie = Pick<CardMovie, 'id' | 'title' | 'poster_path' | 'release_date'>;

/** Search-and-pick list of films. Also accepts posters dragged onto it and the films in your pocket. */
export function MoviePicker({
  value,
  onChange,
  max = 10,
  label = 'Add a film you love',
}: {
  value: PickedMovie[];
  onChange: (v: PickedMovie[]) => void;
  max?: number;
  label?: string;
}) {
  const id = useId();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [over, setOver] = useState(false);
  const pocket = useUi((s) => s.pocket);
  const query = useDebounced(q.trim(), 250);
  const { data, isFetching } = useQuery({
    queryKey: ['pick', query],
    enabled: query.length >= 2,
    queryFn: ({ signal }) => api<Paginated<MovieSummary>>('search/movie', { query }, signal),
    staleTime: 1000 * 60 * 10,
  });
  const results = (data?.results ?? [])
    .filter((m) => !value.some((v) => v.id === m.id))
    .slice(0, 7);
  const full = value.length >= max;
  const addMany = (movies: PickedMovie[]) => {
    const next = [...value];
    for (const m of movies) {
      if (next.length >= max) break;
      if (!next.some((v) => v.id === m.id))
        next.push({
          id: m.id,
          title: m.title,
          poster_path: m.poster_path,
          release_date: m.release_date,
        });
    }
    if (next.length !== value.length) onChange(next);
  };
  const add = (m: PickedMovie) => {
    addMany([m]);
    setQ('');
    setActive(0);
  };
  const fromPocket = pocket.filter((p) => !value.some((v) => v.id === p.id));

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(FILM_MIME)) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const m = droppedFilm(e);
        if (m) {
          e.preventDefault();
          addMany([m]);
        }
      }}
      className={cn(
        'rounded-[4px] transition',
        over && 'bg-accent/10 outline-dashed outline-2 outline-offset-8 outline-accent',
      )}
    >
      <div className="relative">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          id={id}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={`${id}-list`}
          aria-activedescendant={results[active] ? `${id}-${active}` : undefined}
          autoComplete="off"
          disabled={full}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter' && results[active]) {
              e.preventDefault();
              add(results[active]);
            } else if (e.key === 'Escape' && q) {
              e.stopPropagation();
              setQ('');
            }
          }}
          placeholder={full ? `That’s ${max} — the maximum` : label}
          className="big-input text-[clamp(1.5rem,3vw,2.4rem)] disabled:opacity-50"
        />
        {query.length >= 2 && (results.length > 0 || isFetching) && (
          <ul
            id={`${id}-list`}
            role="listbox"
            className="panel absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-80 overflow-y-auto p-1 shadow-print"
          >
            {isFetching && !results.length && (
              <li className="px-3 py-2 text-sm text-dim">Searching…</li>
            )}
            {results.map((m, i) => (
              <li key={m.id} id={`${id}-${i}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => add(m)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-[3px] px-2 py-1.5 text-left',
                    i === active && 'bg-ink text-paper',
                  )}
                >
                  <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded-[2px]">
                    <Pic path={m.poster_path} kind="poster" alt="" sizes="32px" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{m.title}</span>
                    <span className="font-mono text-[10.5px] opacity-70">
                      {yearOf(m.release_date) ?? 'TBA'}
                    </span>
                  </span>
                  <Plus className="h-4 w-4 opacity-60" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="t-mono text-dim">
          {value.length}/{max} picked · or drag any poster here
        </p>
        {fromPocket.length > 0 && !full && (
          <button type="button" className="btn btn-sm" onClick={() => addMany(fromPocket)}>
            <Backpack className="h-3.5 w-3.5" aria-hidden /> Pour in pocket ({fromPocket.length})
          </button>
        )}
      </div>
      {value.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-3" aria-label="Picked films">
          {value.map((m) => (
            <li key={m.id} className="relative w-[72px]">
              <div className="relative aspect-[2/3] overflow-hidden rounded-[3px] border border-ink/30">
                <Pic
                  path={m.poster_path}
                  kind="poster"
                  alt={`Poster of ${m.title}`}
                  sizes="72px"
                  title={m.title}
                />
              </div>
              <button
                type="button"
                aria-label={`Remove ${m.title}`}
                onClick={() => onChange(value.filter((v) => v.id !== m.id))}
                className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-ink bg-island text-ink transition hover:bg-accent hover:text-on-accent"
              >
                <X className="h-3 w-3" />
              </button>
              <p className="mt-1 truncate text-[11px] text-dim">{m.title}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
