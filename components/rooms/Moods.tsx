'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MOODS, type MoodConfig } from '@/config/moods';
import { PINNED_LANGUAGES } from '@/config/languages';
import { SORT_OPTIONS } from '@/lib/tmdb/discover';
import { api } from '@/lib/tmdb/browser';
import { parseDuration } from '@/lib/recommend/time';
import { fetchDiscover } from '@/lib/recommend/pipeline';
import { excludedIds, useLibrary } from '@/store/library';
import { go, useRoomActive } from '@/components/atlas/nav';
import { EmptyNote, ErrorNote, Frame, GridSkeleton, Picker, Room } from '@/components/ui/kit';
import { PosterGrid } from '@/components/ui/Poster';
import { cn } from '@/lib/utils';
import { useFocus } from '@/lib/hooks';
import { blend, localize, pinned, type Focus } from '@/lib/focus';
import type { Keyword, MovieSummary, Paginated } from '@/types/tmdb';

/** Resolves keyword names to TMDB ids (exact match preferred). */
async function resolveKeywords(names: string[]): Promise<number[]> {
  const ids = await Promise.all(
    names.map(async (name) => {
      try {
        const r = await api<Paginated<Keyword>>('search/keyword', { query: name });
        return (
          (r.results.find((k) => k.name.toLowerCase() === name.toLowerCase()) ?? r.results[0])
            ?.id ?? null
        );
      } catch {
        return null;
      }
    }),
  );
  return ids.filter((x): x is number => x !== null);
}

function moodParams(m: MoodConfig, minutes: number | null, lang: string): Record<string, string> {
  const p: Record<string, string> = {
    with_genres: m.withGenres.join('|'),
    'vote_average.gte': String(m.minRating),
    'vote_count.gte': String(m.minVotes),
    sort_by: SORT_OPTIONS.find((s) => s.key === m.sort)?.tmdb ?? 'popularity.desc',
  };
  if (m.withoutGenres?.length) p.without_genres = m.withoutGenres.join(',');
  if (minutes) {
    p['with_runtime.lte'] = String(minutes);
    p['with_runtime.gte'] = '40';
  }
  if (lang) {
    p.with_original_language = lang;
    p['vote_count.gte'] = String(Math.min(m.minVotes, 50));
  }
  return p;
}

const fromUrl = () => {
  if (typeof window === 'undefined') return null;
  const id = new URLSearchParams(window.location.search).get('m');
  return MOODS.some((m) => m.id === id) ? id : null;
};

export function Moods() {
  const active = useRoomActive();
  const qc = useQueryClient();
  const [moodId, setMoodId] = useState<string | null>(null);
  const [time, setTime] = useState('');
  const [lang, setLang] = useState('');
  const lib = useLibrary();
  const mood = MOODS.find((m) => m.id === moodId) ?? null;
  const minutes = parseDuration(time);

  // Arriving by a link such as /recommend/mood?m=scary selects that mood.
  useEffect(() => {
    const linked = active ? fromUrl() : null;
    if (linked) setMoodId(linked);
  }, [active]);

  // The chosen mood lives in the URL so it can be shared.
  useEffect(() => {
    if (active) go(`/recommend/mood${moodId ? `?m=${moodId}` : ''}`, { replace: true });
  }, [active, moodId]);

  const keywords = useQuery({
    queryKey: ['mood-keywords', mood?.id],
    enabled: Boolean(mood?.keywords?.length),
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: () => resolveKeywords(mood!.keywords!),
  });
  const base = useMemo(
    () => (mood ? moodParams(mood, minutes, lang) : null),
    [mood, minutes, lang],
  );
  const ready = Boolean(base) && (!mood?.keywords?.length || !keywords.isLoading);

  // A language picked here wins; otherwise films from the viewer's region are blended in.
  const { region, focus: chosen } = useFocus();
  const focus: Focus = base && pinned(base) ? 'world' : chosen;

  const results = useQuery({
    queryKey: ['mood-results', base, keywords.data, focus, region],
    enabled: ready,
    queryFn: async () => {
      const kw = keywords.data ?? [];
      const gather = async (p: Record<string, string | number>) => {
        const [withKw, plain, plain2] = await Promise.all([
          kw.length
            ? fetchDiscover(qc, { ...p, with_keywords: kw.join('|') }).catch(() => null)
            : null,
          fetchDiscover(qc, p),
          fetchDiscover(qc, { ...p, page: 2 }).catch(() => null),
        ]);
        const merged = [...(withKw?.results ?? []), ...plain.results, ...(plain2?.results ?? [])];
        return Array.from(new Map(merged.map((m) => [m.id, m])).values());
      };
      const [world, local] = await Promise.all([
        focus === 'local' ? [] : gather(base!),
        focus === 'world' ? [] : gather(localize(base!, region, 0.1)).catch(() => []),
      ]);
      return blend(local, world, focus);
    },
  });
  const exclude = excludedIds(lib);
  const movies = (results.data ?? []).filter((m: MovieSummary) => !exclude.has(m.id)).slice(0, 36);

  return (
    <Room
      mark="Moods · pick a feeling"
      title="What’s the mood?"
      lede="Each mood is a recipe of genres, themes and a quality bar. Add the time you have and a language if you like."
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(250px,320px)_1fr] lg:gap-12">
        {/* The mood list is the map's legend: an engraved symbol and a hand-tinted swatch per mood. */}
        <Frame as="aside" className="self-start" inner="px-3 py-3 lg:px-4 lg:py-4">
          <p className="t-mono hidden border-b border-ink/40 pb-2 text-center text-accent lg:block">
            Legend · twelve moods
          </p>
          <ul
            aria-label="Moods"
            className="flex gap-2 overflow-x-auto pb-1 lg:mt-1 lg:block lg:overflow-visible lg:pb-0"
          >
            {MOODS.map((m) => {
              const on = moodId === m.id;
              return (
                <li
                  key={m.id}
                  className="shrink-0 lg:border-b lg:border-dotted lg:border-ink/30 lg:last:border-0"
                >
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setMoodId(on ? null : m.id)}
                    className={cn(
                      'group relative flex w-full items-center gap-3 border px-2 py-1.5 text-left transition lg:border-0 lg:py-2',
                      on ? 'border-ink bg-ink/[0.07]' : 'border-ink/30 hover:bg-ink/[0.04]',
                    )}
                  >
                    {/* legend key: a watercolour wash with the mood's symbol engraved over it */}
                    <span
                      aria-hidden
                      className={cn(
                        'relative grid h-9 w-9 shrink-0 place-items-center border transition',
                        on ? 'border-2 border-ink' : 'border-ink/60',
                      )}
                      style={{
                        background: `linear-gradient(135deg, ${m.hue[0]}88, ${m.hue[1]}66)`,
                      }}
                    >
                      <MoodSymbol id={m.id} />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          't-display block whitespace-nowrap text-[1.15rem] lg:text-[1.35rem]',
                          on && 'text-accent',
                        )}
                      >
                        {m.label}
                      </span>
                      <span className="t-place hidden text-[14px] leading-tight text-dim lg:block">
                        {m.blurb}
                      </span>
                    </span>
                    {on && (
                      <span
                        aria-hidden
                        className="absolute -left-[3px] top-1/2 hidden h-3 w-3 -translate-y-1/2 rotate-45 bg-accent lg:block"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Frame>

        <div className="min-w-0">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="t-mono text-dim">Time you have (optional)</span>
              <input
                className="field"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g. 1h 45m"
              />
            </label>
            <Picker
              label="Language (optional)"
              value={lang}
              onChange={setLang}
              any="Any language"
              options={PINNED_LANGUAGES.map((l) => [l.code, l.name])}
            />
          </div>

          <div className="mt-8" aria-live="polite">
            {!mood ? (
              <EmptyNote title="Choose a mood">
                Twelve feelings on the left. Pick one and the films arrive here.
              </EmptyNote>
            ) : results.isLoading || !ready ? (
              <GridSkeleton />
            ) : results.isError ? (
              <ErrorNote error={results.error} onRetry={() => results.refetch()} />
            ) : movies.length === 0 ? (
              <EmptyNote title="Nothing fits">
                Drop the time limit or language and try again.
              </EmptyNote>
            ) : (
              <>
                <div className="mb-4 flex items-baseline gap-3">
                  <h2 className="t-display text-3xl">{mood.label}</h2>
                  <span className="t-place text-lg text-dim">
                    {movies.length} picks — {mood.blurb.toLowerCase()}
                  </span>
                </div>
                <PosterGrid movies={movies} />
              </>
            )}
          </div>
        </div>
      </div>
    </Room>
  );
}

/** Engraved legend symbols, one per mood. */
function MoodSymbol({ id }: { id: string }) {
  const line = {
    fill: 'none',
    stroke: 'rgb(var(--ink))',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const solid = { ...line, fill: 'rgb(var(--island))' };
  const draw: Record<string, JSX.Element> = {
    'feel-good': (
      <>
        <circle r={4.5} style={solid} />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={Math.cos(a) * 7}
              y1={Math.sin(a) * 7}
              x2={Math.cos(a) * 10}
              y2={Math.sin(a) * 10}
              style={line}
            />
          );
        })}
      </>
    ),
    'mind-bending': (
      <path
        d="M0 0 C 2 -1 2 -4 0 -4 C -4 -4 -5 1 -2 3 C 2 6 8 2 7 -3 C 6 -9 -3 -10 -7 -5 C -10 -1 -9 6 -4 9"
        style={line}
      />
    ),
    'make-me-cry': (
      <path d="M0 -9 C 4 -3 6 0 6 3 A6 6 0 0 1 -6 3 C -6 0 -4 -3 0 -9 Z" style={solid} />
    ),
    'edge-of-seat': <path d="M2 -10 L-5 1 L0 1 L-2 10 L5 -2 L0 -2 Z" style={solid} />,
    laugh: (
      <>
        <circle r={8} style={solid} />
        <path d="M-4 1 Q0 6 4 1" style={line} />
        <path d="M-4 -3 l1.5 -1.5 l1.5 1.5 M1 -3 l1.5 -1.5 l1.5 1.5" style={line} />
      </>
    ),
    romantic: (
      <path
        d="M0 8 C -10 0 -8 -8 -3 -8 C -1 -8 0 -6 0 -5 C 0 -6 1 -8 3 -8 C 8 -8 10 0 0 8 Z"
        style={solid}
      />
    ),
    scary: (
      <>
        <path
          d="M-7 1 C -8 -6 -4 -9 0 -9 C 4 -9 8 -6 7 1 C 6 4 4 4 4 7 L-4 7 C -4 4 -6 4 -7 1 Z"
          style={solid}
        />
        <circle cx={-3} cy={-1} r={1.8} style={{ fill: 'rgb(var(--ink))' }} />
        <circle cx={3} cy={-1} r={1.8} style={{ fill: 'rgb(var(--ink))' }} />
        <path d="M-2 7 L-2 4.5 M0 7 L0 4.5 M2 7 L2 4.5" style={line} />
      </>
    ),
    inspiring: (
      <path
        d="M0 -9 L2.6 -2.8 L9 -2.8 L3.8 1.2 L5.6 8 L0 4 L-5.6 8 L-3.8 1.2 L-9 -2.8 L-2.6 -2.8 Z"
        style={solid}
      />
    ),
    chill: (
      <>
        <path d="M-7 -1 L5 -1 L4 6 C 3 8 -5 8 -6 6 Z" style={solid} />
        <path d="M5 0 C 9 0 9 4 4.5 4" style={line} />
        <path d="M-3 -4 C -4 -6 -2 -7 -3 -9 M1 -4 C 0 -6 2 -7 1 -9" style={line} />
      </>
    ),
    epic: (
      <>
        <path d="M-10 7 L-3 -6 L1 0 L4 -4 L10 7 Z" style={solid} />
        <path
          d="M-2 -3 L0 7 M3 -1 L5 7"
          style={{ ...line, strokeWidth: 0.8, strokeOpacity: 0.6 }}
        />
      </>
    ),
    dark: <path d="M3 -8 A8 8 0 1 0 3 8 A6 6 0 1 1 3 -8 Z" style={solid} />,
    family: (
      <>
        <path d="M-8 -1 L0 -8 L8 -1" style={line} />
        <path d="M-6 -2 L-6 8 L6 8 L6 -2" style={solid} />
        <path d="M-1.5 8 L-1.5 3 L1.5 3 L1.5 8" style={line} />
      </>
    ),
  };
  return (
    <svg viewBox="-12 -12 24 24" className="h-6 w-6" aria-hidden>
      {draw[id] ?? <circle r={5} style={solid} />}
    </svg>
  );
}
