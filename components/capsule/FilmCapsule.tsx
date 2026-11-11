'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Backpack,
  Check,
  Eye,
  ListPlus,
  Play,
  Plus,
  Share2,
  ThumbsDown,
} from 'lucide-react';
import { discoverQuery, filmQuery } from '@/lib/queries';
import { pickTrailer } from '@/lib/tmdb/videos';
import { languageName } from '@/config/languages';
import { regionName } from '@/config/regions';
import { providerLink } from '@/lib/tmdb/providers';
import { formatRuntime } from '@/lib/recommend/time';
import { useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';
import { Go } from '@/components/atlas/nav';
import { ErrorNote, Frame, Pic, Stars } from '@/components/ui/kit';
import { PosterReel } from '@/components/ui/Poster';
import { CapsuleLayout, CapsuleSkeleton, Chapters } from './parts';
import { cn, formatDate, formatMoney, formatVotes, yearOf } from '@/lib/utils';
import type { MovieSnapshot } from '@/types/app';
import type {
  MovieDetails,
  ReleaseDatesResult,
  Video,
  WatchProvider,
  WatchProviderRegion,
} from '@/types/tmdb';

type Chapter = 'story' | 'cast' | 'watch' | 'facts' | 'more';

export function FilmCapsule({ id, onName }: { id: number; onName: (label: string) => void }) {
  const q = useQuery(filmQuery(id));
  const m = q.data;
  const region = useLibrary((s) => s.region);
  const [chapter, setChapter] = useState<Chapter>('story');

  const year = m ? yearOf(m.release_date) : null;
  useEffect(() => {
    if (m) onName(`${m.title}${year ? ` (${year})` : ''}`);
  }, [m, year, onName]);

  const crew = m?.credits?.crew ?? [];
  const directors = Array.from(
    new Map(crew.filter((c) => c.job === 'Director').map((c) => [c.id, c])).values(),
  );
  const director = directors[0];
  const fromDirector = useQuery({
    ...discoverQuery({ with_crew: director?.id ?? 0, sort_by: 'vote_count.desc' }),
    enabled: Boolean(director),
  });

  if (q.isLoading) return <CapsuleSkeleton />;
  if (q.isError || !m) {
    return (
      <div className="grid h-full place-items-center p-8">
        <ErrorNote error={q.error} onRetry={() => q.refetch()} className="max-w-xl" />
      </div>
    );
  }

  const writers = Array.from(
    new Map(
      crew.filter((c) => ['Screenplay', 'Writer', 'Story'].includes(c.job)).map((c) => [c.id, c]),
    ).values(),
  ).slice(0, 3);
  const composer = crew.find((c) => c.job === 'Original Music Composer');
  const dop = crew.find((c) => c.job === 'Director of Photography');
  const cast = (m.credits?.cast ?? []).slice(0, 24);
  const trailer = pickTrailer(m.videos?.results ?? []);
  const keywords = m.keywords?.keywords ?? [];
  const cert = certification(m.release_dates?.results ?? [], region);
  const directorMovies = (fromDirector.data?.results ?? []).filter((x) => x.id !== m.id);
  const recs = m.recommendations?.results ?? [];
  const similar = m.similar?.results ?? [];

  const snapshot: MovieSnapshot = {
    id: m.id,
    title: m.title,
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path,
    release_date: m.release_date,
    vote_average: m.vote_average,
    vote_count: m.vote_count,
    original_language: m.original_language,
    genre_ids: m.genres.map((g) => g.id),
    runtime: m.runtime,
    directors: directors.map((c) => ({ id: c.id, name: c.name })),
  };

  const person = (p: { id: number; name: string }, last: boolean) => (
    <span key={p.id}>
      <Go
        href={`/person/${p.id}`}
        className="underline decoration-ink/30 underline-offset-4 transition hover:text-accent hover:decoration-accent"
      >
        {p.name}
      </Go>
      {!last && ', '}
    </span>
  );
  const people = (list: { id: number; name: string }[]) =>
    list.map((p, i) => person(p, i === list.length - 1));

  const facts: [string, ReactNode][] = [
    ['Directed by', directors.length ? people(directors) : '—'],
    ...(writers.length ? ([['Written by', people(writers)]] as [string, ReactNode][]) : []),
    ...(composer ? ([['Music', people([composer])]] as [string, ReactNode][]) : []),
    ...(dop ? ([['Cinematography', people([dop])]] as [string, ReactNode][]) : []),
    ['Released', formatDate(m.release_date)],
    ['Language', languageName(m.original_language)],
    ['Status', m.status],
    ['Budget', formatMoney(m.budget)],
    ['Box office', formatMoney(m.revenue)],
    ['Countries', m.production_countries.map((c) => c.name).join(', ') || '—'],
    [
      'Studios',
      m.production_companies.length
        ? m.production_companies.slice(0, 4).map((c, i, a) => (
            <span key={c.id}>
              <Go
                className="underline decoration-ink/30 underline-offset-4 hover:text-accent"
                href={`/discover?co=${encodeURIComponent(`${c.id}:${c.name}`)}`}
              >
                {c.name}
              </Go>
              {i < a.length - 1 && ', '}
            </span>
          ))
        : '—',
    ],
  ];

  return (
    <CapsuleLayout
      backdrop={<Pic path={m.backdrop_path} kind="backdrop" alt="" sizes="100vw" priority />}
      side={
        <>
          <figure className="mx-auto w-44 sm:w-52 lg:w-full">
            <div className="relative aspect-[2/3] overflow-hidden border-2 border-ink/80 shadow-print outline outline-1 outline-offset-[5px] outline-ink/40">
              <Pic
                path={m.poster_path}
                kind="poster"
                alt={`Poster of ${m.title} (${year ?? 'unreleased'})`}
                sizes="290px"
                priority
                title={m.title}
              />
            </div>
            <figcaption className="t-place mt-3 text-center text-[15px] text-dim">
              Plate I. — {m.title}
              {year ? `, ${year}` : ''}
            </figcaption>
          </figure>
          <div className="mt-6 hidden lg:block">
            <FilmActions movie={snapshot} />
          </div>
        </>
      }
    >
      <Frame as="header" glass className="shrink-0" inner="px-5 py-4 sm:px-7 sm:py-5">
        <p className="t-mono flex flex-wrap items-center gap-x-3 gap-y-1 text-dim">
          <span className="bg-accent px-1.5 py-0.5 text-on-accent">
            ★ {m.vote_average.toFixed(1)}
          </span>
          <span>{formatVotes(m.vote_count)} votes</span>
          {year && <span>{year}</span>}
          {m.runtime ? <span>{formatRuntime(m.runtime)}</span> : null}
          <span className="border border-ink/40 px-1.5">{cert ?? 'NR'}</span>
        </p>
        <h1 className="t-display mt-3 text-balance text-[clamp(2.3rem,5vw,4.75rem)] lg:line-clamp-2">
          {m.title}
        </h1>
        {m.original_title !== m.title && (
          <p className="mt-1.5 text-sm text-dim">Original title: {m.original_title}</p>
        )}
        {m.tagline && (
          <p className="t-place mt-2 text-[clamp(1.1rem,1.8vw,1.5rem)] text-ink/75">
            “{m.tagline}”
          </p>
        )}
      </Frame>

      <div className="mt-5 lg:hidden">
        <FilmActions movie={snapshot} />
      </div>

      <div className="mt-5">
        <Chapters
          value={chapter}
          onChange={setChapter}
          options={[
            { value: 'story', label: 'Story' },
            { value: 'cast', label: 'Cast', count: m.credits?.cast.length },
            { value: 'watch', label: 'Watch' },
            { value: 'facts', label: 'Facts' },
            { value: 'more', label: 'More like this' },
          ]}
        />
      </div>

      <div
        key={chapter}
        className="fade-in mt-5 pr-1 [overflow-anchor:none] lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
      >
        {chapter === 'story' && (
          <div className="max-w-3xl space-y-6">
            <p className="text-[17px] leading-relaxed text-ink/90">
              {m.overview || 'No synopsis yet.'}
            </p>
            <ul className="flex flex-wrap gap-1.5" aria-label="Genres">
              {m.genres.map((g) => (
                <li key={g.id}>
                  <Go href={`/discover?g=${g.id}`} className="chip">
                    {g.name}
                  </Go>
                </li>
              ))}
            </ul>
            <dl className="grid gap-x-8 gap-y-2 text-[15px] sm:grid-cols-2">
              <div>
                <dt className="t-mono text-dim">Directed by</dt>
                <dd className="mt-0.5">{directors.length ? people(directors) : '—'}</dd>
              </div>
              <div>
                <dt className="t-mono text-dim">Starring</dt>
                <dd className="mt-0.5">{cast.length ? people(cast.slice(0, 3)) : '—'}</dd>
              </div>
            </dl>
            {trailer && <Trailer video={trailer} title={m.title} />}
            {m.belongs_to_collection && (
              <Go
                href={`/collection/${m.belongs_to_collection.id}`}
                className="panel group flex items-center gap-4 p-3 transition hover:border-accent"
              >
                <span className="relative h-20 w-14 shrink-0 overflow-hidden rounded-[2px]">
                  <Pic
                    path={m.belongs_to_collection.poster_path}
                    kind="poster"
                    alt=""
                    sizes="56px"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="t-mono block text-accent">Part of a franchise</span>
                  <span className="t-display mt-1 block truncate text-2xl">
                    {m.belongs_to_collection.name}
                  </span>
                  <span className="text-sm text-dim">Plan the marathon in release order</span>
                </span>
                <ArrowUpRight
                  className="h-5 w-5 shrink-0 transition group-hover:rotate-45 group-hover:text-accent"
                  aria-hidden
                />
              </Go>
            )}
          </div>
        )}

        {chapter === 'cast' &&
          (cast.length ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-3 gap-y-5">
              {cast.map((c) => (
                <li key={c.id}>
                  <Go href={`/person/${c.id}`} className="group block">
                    <span className="relative block aspect-[3/4] overflow-hidden rounded-[3px] border border-ink/25 transition group-hover:border-accent">
                      <Pic
                        path={c.profile_path}
                        kind="profile"
                        alt={`Photo of ${c.name}`}
                        sizes="130px"
                        title={c.name}
                        className="grayscale transition duration-500 group-hover:scale-105 group-hover:grayscale-0"
                      />
                    </span>
                    <span className="mt-1.5 block truncate text-[13px] font-semibold group-hover:text-accent">
                      {c.name}
                    </span>
                    <span className="block truncate text-[12px] text-dim">{c.character}</span>
                  </Go>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-dim">No cast listed yet.</p>
          ))}

        {chapter === 'watch' && (
          <div className="max-w-2xl space-y-6">
            <WhereToWatch
              providers={m['watch/providers']?.results ?? {}}
              region={region}
              title={m.title}
              year={year}
            />
            {trailer && <Trailer video={trailer} title={m.title} />}
          </div>
        )}

        {chapter === 'facts' && (
          <div className="max-w-3xl">
            <dl className="border-t border-ink/20">
              {facts.map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-[8.5rem_1fr] gap-4 border-b border-ink/15 py-2.5 text-[15px]"
                >
                  <dt className="t-mono pt-0.5 text-dim">{k}</dt>
                  <dd className="min-w-0">{v}</dd>
                </div>
              ))}
            </dl>
            {keywords.length > 0 && (
              <>
                <p className="t-mono mt-7 text-dim">Themes — tap one to find more like it</p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {keywords.map((k) => (
                    <li key={k.id}>
                      <Go
                        href={`/discover?kw=${encodeURIComponent(`${k.id}:${k.name}`)}`}
                        className="chip"
                      >
                        #{k.name}
                      </Go>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {chapter === 'more' && (
          <div className="space-y-9 px-3">
            <PosterReel title="If you liked this" movies={recs} />
            <PosterReel title="Similar films" movies={similar} />
            {director && (
              <PosterReel
                title={`More from ${director.name}`}
                movies={directorMovies}
                action={
                  <Go
                    href={`/person/${director.id}`}
                    className="t-mono text-accent underline-offset-4 hover:underline"
                  >
                    Filmography →
                  </Go>
                }
              />
            )}
            {!recs.length && !similar.length && !directorMovies.length && (
              <p className="text-dim">Nothing related is listed for this film yet.</p>
            )}
          </div>
        )}
      </div>
    </CapsuleLayout>
  );
}

/* ---------------------------------------------------------------- pieces */

/** Certification for the viewer's region, falling back to India, then the US. */
function certification(results: ReleaseDatesResult[], region: string): string | null {
  const pick = (code: string) => {
    const r = results.find((x) => x.iso_3166_1 === code);
    if (!r) return null;
    const sorted = r.release_dates
      .slice()
      .sort((a, b) => Number(b.type === 3) - Number(a.type === 3));
    return sorted.find((d) => d.certification)?.certification ?? null;
  };
  return pick(region) ?? pick('IN') ?? pick('US');
}

function FilmActions({ movie }: { movie: MovieSnapshot }) {
  const lib = useLibrary();
  const carried = useUi((s) => s.pocket.some((p) => p.id === movie.id));
  const carry = useUi((s) => s.carry);
  const inWatchlist = Boolean(lib.watchlist[movie.id]);
  const seen = Boolean(lib.seen[movie.id]);
  const notInterested = Boolean(lib.notInterested[movie.id]);
  const stars = lib.ratings[movie.id]?.stars ?? 0;
  const [toast, setToast] = useState<string | null>(null);
  const [listsOpen, setListsOpen] = useState(false);
  const [newList, setNewList] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Keep the stored snapshot enriched (runtime, directors) whenever this film is opened.
  const { remember, hydrated } = lib;
  const tracked = Boolean(lib.movies[movie.id]);
  const stamp = `${movie.id}:${movie.runtime}:${movie.directors?.length}`;
  useEffect(() => {
    if (hydrated && tracked) remember(movie);
    // Re-run only when the film or its enrichment changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, tracked, stamp, remember]);

  useEffect(() => {
    if (!listsOpen) return;
    const close = (e: MouseEvent) =>
      !menuRef.current?.contains(e.target as Node) && setListsOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [listsOpen]);

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2200);
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: movie.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      flash('Link copied');
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') flash('Could not share');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={inWatchlist}
          onClick={() => lib.toggleWatchlist(movie)}
          className={cn(inWatchlist ? 'btn btn-on' : 'btn-solid', 'flex-1 whitespace-nowrap')}
        >
          {inWatchlist ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Plus className="h-3.5 w-3.5" aria-hidden />
          )}
          {inWatchlist ? 'On watchlist' : 'Watchlist'}
        </button>
        <button
          type="button"
          aria-pressed={seen}
          onClick={() => lib.toggleSeen(movie)}
          className={cn('btn flex-1 whitespace-nowrap', seen && 'border-ok text-ok')}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden /> {seen ? 'Seen it' : 'Seen?'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={cn('icon-btn', carried && 'border-accent bg-accent text-on-accent')}
          aria-pressed={carried}
          aria-label={carried ? 'Drop from pocket' : 'Carry in pocket'}
          title={carried ? 'In your pocket' : 'Carry in pocket'}
          onClick={() => carry(movie)}
        >
          <Backpack className="h-4 w-4" />
        </button>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="icon-btn"
            aria-haspopup="menu"
            aria-expanded={listsOpen}
            aria-label="Add to a list"
            title="Add to a list"
            onClick={() => setListsOpen((o) => !o)}
          >
            <ListPlus className="h-4 w-4" />
          </button>
          {listsOpen && (
            <div
              role="menu"
              className="panel absolute left-0 top-[calc(100%+6px)] z-30 w-64 p-2 shadow-[4px_4px_0_rgb(0_0_0/0.7)]"
            >
              {lib.lists.length === 0 && (
                <p className="px-2 py-2 text-sm text-dim">No lists yet — create one below.</p>
              )}
              {lib.lists.map((l) => {
                const has = l.movieIds.includes(movie.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={has}
                    onClick={() => lib.toggleInList(l.id, movie)}
                    className="flex w-full items-center justify-between rounded-[3px] px-2 py-2 text-left text-sm hover:bg-ink/10"
                  >
                    {l.name}
                    {has && <Check className="h-4 w-4 text-accent" aria-hidden />}
                  </button>
                );
              })}
              <form
                className="mt-1 flex items-end gap-2 border-t border-ink/15 px-1 pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newList.trim()) return;
                  const id = lib.createList(newList);
                  lib.toggleInList(id, movie);
                  setNewList('');
                }}
              >
                <label className="flex-1">
                  <span className="sr-only">New list name</span>
                  <input
                    className="field min-h-[34px] text-sm"
                    placeholder="New list…"
                    value={newList}
                    onChange={(e) => setNewList(e.target.value)}
                  />
                </label>
                <button type="submit" className="btn btn-sm">
                  Add
                </button>
              </form>
            </div>
          )}
        </div>
        <button type="button" className="icon-btn" onClick={share} aria-label="Share" title="Share">
          <Share2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={cn('icon-btn', notInterested && 'border-danger text-danger')}
          aria-pressed={notInterested}
          aria-label={notInterested ? 'Undo not interested' : 'Not interested'}
          title="Not interested"
          onClick={() =>
            notInterested ? lib.clearNotInterested(movie.id) : lib.markNotInterested(movie)
          }
        >
          <ThumbsDown className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="t-mono text-dim">Your rating</span>
        <Stars
          value={stars}
          onChange={(n) => lib.rate(movie, n)}
          label={`Your rating for ${movie.title}`}
        />
      </div>
      <p
        aria-live="polite"
        className={cn(
          't-mono text-accent transition-opacity',
          toast ? 'opacity-100' : 'h-0 opacity-0',
        )}
      >
        {toast ?? ''}
      </p>
    </div>
  );
}

const GROUPS: { key: keyof Omit<WatchProviderRegion, 'link'>; label: string }[] = [
  { key: 'flatrate', label: 'Stream' },
  { key: 'free', label: 'Free' },
  { key: 'ads', label: 'With ads' },
  { key: 'rent', label: 'Rent' },
  { key: 'buy', label: 'Buy' },
];

function WhereToWatch({
  providers,
  region,
  title,
  year,
}: {
  providers: Record<string, WatchProviderRegion>;
  region: string;
  title: string;
  year: number | null;
}) {
  const data = providers[region];
  return (
    <section aria-labelledby="wtw">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="wtw" className="t-display text-2xl">
          Where to watch
        </h2>
        <span className="t-place text-lg text-dim">in {regionName(region)}</span>
      </div>
      {!data ? (
        <p className="border-t border-ink/20 pt-4 text-[15px] text-dim">
          Not streaming, renting or selling in {regionName(region)} right now. You can switch region
          from the top bar of the chart.
        </p>
      ) : (
        <div className="divide-y divide-ink/15 border-y border-ink/20">
          {GROUPS.map(({ key, label }) => {
            const list = (data[key] ?? []) as WatchProvider[];
            if (!list.length) return null;
            return (
              <div key={key} className="flex items-center gap-4 py-3">
                <span className="t-mono w-20 shrink-0 text-dim">{label}</span>
                <ul className="flex flex-wrap gap-2">
                  {list.map((p) => (
                    <li key={p.provider_id}>
                      {/* Opens the service itself, searching for this film there. */}
                      <a
                        href={providerLink(p.provider_name, title, year, region)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${label} on ${p.provider_name}: opens ${p.provider_name} in a new tab`}
                        className="group flex items-center gap-2 border border-ink/40 bg-island py-1 pl-1 pr-2.5 transition hover:-translate-y-0.5 hover:border-accent"
                      >
                        <Pic
                          path={p.logo_path}
                          kind="logo"
                          alt=""
                          fill={false}
                          width={30}
                          height={30}
                          className="rounded-[4px]"
                        />
                        <span className="text-[14px] leading-tight group-hover:text-accent">
                          {p.provider_name}
                        </span>
                        <ArrowUpRight
                          className="h-3.5 w-3.5 text-dim group-hover:text-accent"
                          aria-hidden
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-xs text-dim">
        Each service opens in a new tab, searching for this film. Availability data by{' '}
        <a
          href="https://www.justwatch.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-ink"
        >
          JustWatch
        </a>
      </p>
    </section>
  );
}

/** Click-to-load: no YouTube code is downloaded until the viewer presses play. */
function Trailer({ video, title }: { video: Video; title: string }) {
  const [play, setPlay] = useState(false);
  return (
    <figure className="max-w-2xl">
      <div className="relative aspect-video overflow-hidden rounded-[4px] border border-ink/30 bg-island">
        {play ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1&rel=0`}
            title={`${title} — ${video.name}`}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlay(true)}
            className="group absolute inset-0 grid place-items-center"
            aria-label={`Play trailer: ${video.name}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${video.key}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              width={480}
              height={360}
              className="absolute inset-0 h-full w-full object-cover opacity-60 transition duration-700 group-hover:scale-105 group-hover:opacity-85"
            />
            <span className="relative flex items-center gap-3 border border-accent bg-accent px-5 py-3 text-on-accent shadow-[4px_4px_0_rgb(0_0_0/0.8)] transition group-hover:-translate-x-0.5 group-hover:-translate-y-0.5">
              <Play className="h-5 w-5 fill-current" aria-hidden />
              <span className="t-mono font-semibold">Play trailer</span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-2 text-[13px] text-dim">{video.name}</figcaption>
    </figure>
  );
}
