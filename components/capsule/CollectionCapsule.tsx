'use client';

import { useEffect, useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { collectionQuery, filmLiteQuery } from '@/lib/queries';
import { formatRuntime } from '@/lib/recommend/time';
import { useLibrary } from '@/store/library';
import { Go } from '@/components/atlas/nav';
import { ErrorNote, Frame, Pic } from '@/components/ui/kit';
import { CapsuleLayout, CapsuleSkeleton } from './parts';
import { cn, formatDate, isoDate, yearOf } from '@/lib/utils';

/** A franchise as a marathon plan: every film in release order, with runtime and progress. */
export function CollectionCapsule({ id, onName }: { id: number; onName: (label: string) => void }) {
  const q = useQuery(collectionQuery(id));
  const c = q.data;
  const seen = useLibrary((s) => s.seen);
  const setSeen = useLibrary((s) => s.setSeen);
  const name = c?.name.replace(/ Collection$/, '') ?? '';

  useEffect(() => {
    if (name) onName(name);
  }, [name, onName]);

  const ordered = useMemo(
    () =>
      (c?.parts ?? [])
        .slice()
        .sort((a, b) => (a.release_date || '9999').localeCompare(b.release_date || '9999')),
    [c],
  );
  // Runtimes are not in the collection payload; fetch each film's details (cached for a day).
  const details = useQueries({ queries: ordered.map((p) => filmLiteQuery(p.id)) });
  const parts = ordered.map((p, i) => ({ ...p, runtime: details[i]?.data?.runtime ?? null }));

  if (q.isLoading) return <CapsuleSkeleton />;
  if (q.isError || !c) {
    return (
      <div className="grid h-full place-items-center p-8">
        <ErrorNote error={q.error} onRetry={() => q.refetch()} className="max-w-xl" />
      </div>
    );
  }

  const today = isoDate(new Date());
  const released = parts.filter((p) => p.release_date && p.release_date <= today);
  const seenCount = released.filter((p) => seen[p.id]).length;
  const total = released.reduce((s, p) => s + (p.runtime ?? 0), 0);
  const remaining = released.filter((p) => !seen[p.id]).reduce((s, p) => s + (p.runtime ?? 0), 0);
  const pct = released.length ? Math.round((seenCount / released.length) * 100) : 0;

  return (
    <CapsuleLayout
      backdrop={<Pic path={c.backdrop_path} kind="backdrop" alt="" sizes="100vw" priority />}
      side={
        <div className="relative mx-auto aspect-[2/3] w-44 overflow-hidden rounded-[4px] border border-ink/40 shadow-[6px_6px_0_rgb(0_0_0/0.6)] sm:w-52 lg:w-full">
          <Pic
            path={c.poster_path}
            kind="poster"
            alt={`Poster of ${c.name}`}
            sizes="290px"
            priority
            title={name}
          />
        </div>
      }
    >
      <Frame as="header" glass className="shrink-0" inner="px-5 py-4 sm:px-7 sm:py-5">
        <p className="t-mono text-accent">Franchise · marathon planner · {parts.length} films</p>
        <h1 className="t-display mt-3 text-balance text-[clamp(2.3rem,5vw,4.75rem)] lg:line-clamp-2">
          {name}
        </h1>
        {c.overview && (
          <p className="t-place mt-2 line-clamp-2 max-w-3xl text-[clamp(1.05rem,1.6vw,1.35rem)] leading-snug text-ink/75">
            {c.overview}
          </p>
        )}
      </Frame>

      <div className="mt-5 grid grid-cols-2 gap-x-6 sm:grid-cols-4">
        {[
          ['Films', String(released.length)],
          ['Total runtime', formatRuntime(total)],
          ['Left to watch', formatRuntime(remaining)],
          ['Watched', `${seenCount}/${released.length}`],
        ].map(([l, v]) => (
          <div key={l} className="border-t border-ink/30 py-2.5">
            <p className="t-display text-3xl sm:text-4xl">{v}</p>
            <p className="t-mono mt-1 text-dim">{l}</p>
          </div>
        ))}
      </div>
      <div
        className="h-[4px] bg-ink/15"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Marathon progress"
      >
        <div
          className="h-full bg-accent transition-all duration-700 ease-expo"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="mt-4 pr-1 [overflow-anchor:none] lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {parts.map((p, i) => {
          const isSeen = Boolean(seen[p.id]);
          const upcoming = !p.release_date || p.release_date > today;
          return (
            <li
              key={p.id}
              className="grid grid-cols-[2.5rem_2.75rem_1fr_auto] items-center gap-4 border-b border-ink/15 py-2.5 sm:grid-cols-[3.5rem_3rem_1fr_auto]"
            >
              <span
                className={cn(
                  't-display text-3xl tabular-nums sm:text-4xl',
                  isSeen ? 'text-accent' : 'text-ink/30',
                )}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <Go
                href={`/movie/${p.id}`}
                className="relative aspect-[2/3] overflow-hidden rounded-[2px] border border-ink/25"
                tabIndex={-1}
                aria-hidden
              >
                <Pic path={p.poster_path} kind="poster" alt="" sizes="48px" title={p.title} />
              </Go>
              <div className="min-w-0">
                <Go
                  href={`/movie/${p.id}`}
                  className={cn(
                    'block truncate text-[17px] font-medium hover:text-accent',
                    isSeen && 'text-ink/50 line-through decoration-accent/70',
                  )}
                >
                  {p.title}
                </Go>
                <p className="font-mono text-[10.5px] uppercase tracking-wide text-dim">
                  {p.release_date ? formatDate(p.release_date) : (yearOf(p.release_date) ?? 'TBA')}{' '}
                  · {formatRuntime(p.runtime)}
                </p>
              </div>
              {upcoming ? (
                <span className="t-place text-lg text-accent">Coming</span>
              ) : (
                <button
                  type="button"
                  aria-pressed={isSeen}
                  onClick={() => setSeen(p, !isSeen)}
                  className={cn('btn btn-sm', isSeen && 'border-accent bg-accent text-on-accent')}
                  aria-label={
                    isSeen ? `Mark ${p.title} as not watched` : `Mark ${p.title} as watched`
                  }
                >
                  <Check className="h-3.5 w-3.5" aria-hidden />{' '}
                  <span className="hidden sm:inline">{isSeen ? 'Watched' : 'Watched it'}</span>
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </CapsuleLayout>
  );
}
