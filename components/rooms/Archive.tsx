'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Dice5, Minus, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { api } from '@/lib/tmdb/browser';
import {
  useCertifications,
  useCountries,
  useDebounced,
  useInView,
  useLanguages,
  useProviders,
} from '@/lib/hooks';
import {
  DEFAULT_FILTERS,
  MIN_YEAR,
  MONETIZATION_OPTIONS,
  RUNTIME_PRESETS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  VOTE_PRESETS,
  activeChips,
  filtersFromSearchParams,
  filtersToSearchParams,
  filtersToTmdbParams,
  maxYear,
  type DiscoverFilters,
  type SortKey,
} from '@/lib/tmdb/discover';
import { formatRuntime, parseDuration } from '@/lib/recommend/time';
import { TMDB_MAX_PAGE } from '@/lib/recommend/surprise';
import { GENRES, GENRE_NAMES } from '@/config/genres';
import { PINNED_LANGUAGES, languageName, otherLanguages } from '@/config/languages';
import { INDIA_CERTIFICATIONS } from '@/config/regions';
import { useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';
import { blendedDiscover } from '@/lib/queries';
import { Go, go } from '@/components/atlas/nav';
import {
  EmptyNote,
  ErrorNote,
  GridSkeleton,
  Pic,
  RangeSlider,
  Room,
  Sheet,
} from '@/components/ui/kit';
import { PosterGrid } from '@/components/ui/Poster';
import { cn } from '@/lib/utils';
import type { Entity } from '@/types/app';
import type { MovieSummary, Paginated } from '@/types/tmdb';

export const Archive = () => <DiscoverRoom mode="discover" />;
export const TimeFit = () => <DiscoverRoom mode="timefit" />;

function DiscoverRoom({ mode }: { mode: 'discover' | 'timefit' }) {
  const path = mode === 'timefit' ? '/recommend/time-fit' : '/discover';
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Only read the query string while this place owns the address bar.
  const spString = pathname === path ? (searchParams?.toString() ?? '') : null;
  const region = useLibrary((s) => s.region);
  const focus = useUi((s) => s.focus);
  const seen = useLibrary((s) => s.seen);
  const langs = useLanguages();

  const [filters, setFilters] = useState<DiscoverFilters>(() =>
    filtersFromSearchParams(new URLSearchParams(spString ?? '')),
  );
  const [time, setTime] = useState(() => new URLSearchParams(spString ?? '').get('t') ?? '');
  const [sheet, setSheet] = useState(false);
  const debounced = useDebounced(filters, 300);
  const debouncedTime = useDebounced(time, 300);
  const lastWritten = useRef(spString ?? '');
  const wasHere = useRef(false);

  // URL → filters (links, back/forward, saved presets).
  useEffect(() => {
    if (spString === null) {
      wasHere.current = false;
      return;
    }
    const arriving = !wasHere.current;
    wasHere.current = true;
    if (spString === lastWritten.current) return;
    if (arriving && spString === '') {
      // Sailing back with a bare link: keep the filters you left here.
      go(`${path}?${lastWritten.current}`, { replace: true });
      return;
    }
    lastWritten.current = spString;
    setFilters(filtersFromSearchParams(new URLSearchParams(spString)));
    setTime(new URLSearchParams(spString).get('t') ?? '');
  }, [spString, path]);

  // Filters → URL, so any combination is a shareable link.
  useEffect(() => {
    if (window.location.pathname !== path) return;
    const sp = filtersToSearchParams(debounced);
    if (mode === 'timefit' && debouncedTime.trim()) sp.set('t', debouncedTime.trim());
    const qs = sp.toString();
    if (qs !== lastWritten.current) {
      lastWritten.current = qs;
      go(`${path}${qs ? `?${qs}` : ''}`, { replace: true });
    }
  }, [debounced, debouncedTime, mode, path]);

  const minutes = mode === 'timefit' ? parseDuration(debouncedTime) : null;
  const effective = useMemo<DiscoverFilters>(() => {
    if (mode !== 'timefit' || !minutes) return debounced;
    return {
      ...debounced,
      runtimeMax: Math.min(debounced.runtimeMax ?? Infinity, minutes),
      runtimeMin: debounced.runtimeMin ?? 40,
    };
  }, [debounced, minutes, mode]);
  const params = useMemo(() => filtersToTmdbParams(effective, { region }), [effective, region]);
  const enabled = mode !== 'timefit' || minutes !== null;

  const q = useInfiniteQuery({
    queryKey: ['discover-infinite', params, focus],
    enabled,
    initialPageParam: 1,
    // Unless a country or language filter is set, films from the viewer's region are blended in.
    queryFn: ({ pageParam, signal }) =>
      blendedDiscover(params, pageParam, { region, focus, voteScale: 0.3, signal }),
    getNextPageParam: (last) =>
      last.page < Math.min(last.total_pages, TMDB_MAX_PAGE) ? last.page + 1 : undefined,
  });
  const sentinel = useInView<HTMLDivElement>(() => {
    if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
  }, Boolean(q.hasNextPage));

  const patch = useCallback(
    (p: Partial<DiscoverFilters>) => setFilters((f) => ({ ...f, ...p })),
    [],
  );
  const results = useMemo(() => {
    const all = q.data?.pages.flatMap((p) => p.results) ?? [];
    const unique = Array.from(new Map(all.map((m) => [m.id, m])).values());
    return filters.hideSeen ? unique.filter((m) => !seen[m.id]) : unique;
  }, [q.data, filters.hideSeen, seen]);

  const chips = activeChips(filters, {
    genre: (id) => GENRE_NAMES[id] ?? `#${id}`,
    language: (c) => languageName(c, langs.data),
  });
  const total = q.data?.pages[0]?.total_results ?? 0;
  const panel = <FilterPanel filters={filters} onChange={patch} region={region} />;

  return (
    <Room
      mark={mode === 'timefit' ? 'Time Fit · only what fits' : 'Archive · every film, every filter'}
      title={mode === 'timefit' ? 'How long have you got?' : 'Find your film'}
      lede={
        mode === 'timefit'
          ? 'Type the time you have. Everything below ends before you run out of evening.'
          : 'Every change rewrites the address bar, so any combination can be bookmarked or sent to a friend.'
      }
    >
      <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-12">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="no-scrollbar sticky top-20 max-h-[calc(100vh-11rem)] overflow-y-auto pr-1">
            {panel}
          </div>
        </aside>

        <div className="min-w-0">
          {mode === 'timefit' && (
            <div className="mb-8">
              <label htmlFor="time-input" className="t-mono text-dim">
                Time available
              </label>
              <input
                id="time-input"
                className="big-input mt-1 text-[clamp(2.6rem,8vw,6rem)]"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="1h 40m"
                autoComplete="off"
              />
              <p className="mt-2 text-sm text-dim" aria-live="polite">
                {minutes ? (
                  <>
                    Every film below runs{' '}
                    <strong className="text-ink">{formatRuntime(minutes)}</strong> or less.
                  </>
                ) : time.trim() ? (
                  'Try “1h 40m”, “95 min” or “2:15”.'
                ) : (
                  'Type a duration to begin.'
                )}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            <p className="mr-auto flex items-baseline gap-2" aria-live="polite">
              <span className="t-display text-4xl tabular-nums sm:text-5xl">
                {enabled && !q.isLoading ? total.toLocaleString('en-US') : '—'}
              </span>
              <span className="t-place text-xl text-dim">films</span>
            </p>
            <button
              type="button"
              className="btn lg:hidden"
              onClick={() => setSheet(true)}
              aria-haspopup="dialog"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Filters
              {chips.length ? ` · ${chips.length}` : ''}
            </button>
            <label>
              <span className="sr-only">Sort by</span>
              <select
                className="btn cursor-pointer appearance-none pr-4 hover:bg-island/70 hover:text-ink"
                value={filters.sort}
                onChange={(e) => patch({ sort: e.target.value as SortKey })}
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <Go
              href={`/recommend/surprise?${filtersToSearchParams(effective).toString()}`}
              className="btn"
            >
              <Dice5 className="h-3.5 w-3.5" aria-hidden /> Roll the dice
            </Go>
          </div>

          {chips.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Active filters">
              {chips.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    className="chip chip-on pr-2 text-xs"
                    onClick={() => setFilters((f) => c.remove(f))}
                    aria-label={`Remove filter ${c.label}`}
                  >
                    {c.label} <X className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="chip border-accent text-xs text-accent"
                  onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                >
                  Clear all
                </button>
              </li>
            </ul>
          )}

          <div className="mt-7">
            {!enabled ? null : q.isLoading ? (
              <GridSkeleton />
            ) : q.isError ? (
              <ErrorNote error={q.error} onRetry={() => q.refetch()} />
            ) : results.length === 0 ? (
              <EmptyNote title="Nothing matches">Loosen a filter or widen the years.</EmptyNote>
            ) : (
              <>
                <PosterGrid movies={results} />
                <div ref={sentinel} className="mt-10 flex justify-center">
                  {q.hasNextPage ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={q.isFetchingNextPage}
                      onClick={() => q.fetchNextPage()}
                    >
                      {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
                    </button>
                  ) : (
                    <p className="t-place text-lg text-dim">— the edge of the map —</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filters">
        {panel}
        <button type="button" className="btn-solid mt-6 w-full" onClick={() => setSheet(false)}>
          Show {total.toLocaleString('en-US')} films
        </button>
      </Sheet>
    </Room>
  );
}

/* ---------------------------------------------------------------- Filters */

function Section({
  title,
  children,
  open = true,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="group border-b border-ink/20">
      <summary className="flex min-h-[46px] cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="t-mono flex-1">{title}</span>
        <Plus className="h-3.5 w-3.5 text-dim group-open:hidden" aria-hidden />
        <Minus className="hidden h-3.5 w-3.5 text-dim group-open:block" aria-hidden />
      </summary>
      <div className="space-y-4 pb-5">{children}</div>
    </details>
  );
}

const DECADES = Array.from({ length: 11 }, (_, i) => 1920 + i * 10);

function FilterPanel({
  filters,
  onChange,
  region,
}: {
  filters: DiscoverFilters;
  onChange: (p: Partial<DiscoverFilters>) => void;
  region: string;
}) {
  const f = filters;
  const top = maxYear();
  const langs = useLanguages();
  const countries = useCountries();
  const providers = useProviders(region);
  const certs = useCertifications(region);
  const saved = useLibrary((s) => s.savedFilters);
  const saveFilter = useLibrary((s) => s.saveFilter);
  const deleteFilter = useLibrary((s) => s.deleteFilter);
  const [presetName, setPresetName] = useState('');

  const cycleGenre = (id: number) => {
    if (f.genres.includes(id))
      onChange({
        genres: f.genres.filter((g) => g !== id),
        excludeGenres: [...f.excludeGenres, id],
      });
    else if (f.excludeGenres.includes(id))
      onChange({ excludeGenres: f.excludeGenres.filter((g) => g !== id) });
    else onChange({ genres: [...f.genres, id] });
  };
  const certList = certs.data?.length
    ? certs.data.map((c) => c.certification)
    : region === 'IN'
      ? INDIA_CERTIFICATIONS
      : [];
  const providerList = (providers.data?.results ?? [])
    .slice()
    .sort(
      (a, b) =>
        (a.display_priorities?.[region] ?? a.display_priority) -
        (b.display_priorities?.[region] ?? b.display_priority),
    )
    .slice(0, 24);

  return (
    <div className="border-t border-ink/20">
      <Section title="Genres">
        <p className="text-xs text-dim">Tap once to include · twice to exclude · again to clear</p>
        <div className="flex flex-wrap gap-1.5">
          {GENRES.map((g) => {
            const state = f.genres.includes(g.id)
              ? 'on'
              : f.excludeGenres.includes(g.id)
                ? 'off'
                : null;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => cycleGenre(g.id)}
                aria-label={`${g.name}: ${state === 'on' ? 'included' : state === 'off' ? 'excluded' : 'any'}`}
                className={cn('chip', state === 'on' && 'chip-on', state === 'off' && 'chip-off')}
              >
                {g.name}
              </button>
            );
          })}
        </div>
        {f.genres.length > 1 && (
          <div role="group" aria-label="Match included genres" className="flex gap-1.5">
            {(['or', 'and'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={f.genreMode === m}
                onClick={() => onChange({ genreMode: m })}
                className="chip text-xs"
              >
                {m === 'or' ? 'Any of these' : 'All of these'}
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title="Release">
        <RangeSlider
          label="Years"
          min={MIN_YEAR}
          max={top}
          value={[f.yearFrom ?? MIN_YEAR, f.yearTo ?? top]}
          onChange={([a, b]) =>
            onChange({ yearFrom: a === MIN_YEAR ? null : a, yearTo: b === top ? null : b })
          }
        />
        <div className="flex flex-wrap gap-1.5">
          {DECADES.map((d) => {
            const on = f.yearFrom === d && f.yearTo === d + 9;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                className="chip px-2.5 text-xs"
                onClick={() =>
                  onChange(on ? { yearFrom: null, yearTo: null } : { yearFrom: d, yearTo: d + 9 })
                }
              >
                {d}s
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={f.status === s.key}
              className="chip text-xs"
              onClick={() => onChange({ status: f.status === s.key ? null : s.key })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Rating & votes">
        <RangeSlider
          label="TMDB rating"
          min={0}
          max={10}
          step={0.5}
          value={[f.ratingMin ?? 0, f.ratingMax ?? 10]}
          onChange={([a, b]) =>
            onChange({ ratingMin: a === 0 ? null : a, ratingMax: b === 10 ? null : b })
          }
          format={(n) => n.toFixed(1)}
        />
        <div>
          <p className="mb-2 text-[13px] text-dim">Minimum votes</p>
          <div className="flex flex-wrap gap-1.5">
            {VOTE_PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={f.minVotes === v}
                className="chip text-xs"
                onClick={() => onChange({ minVotes: v })}
              >
                {v === 0 ? 'Any' : `${v.toLocaleString('en-US')}+`}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Runtime">
        <div className="flex flex-wrap gap-1.5">
          {RUNTIME_PRESETS.map((p) => {
            const on = f.runtimeMin === p.min && f.runtimeMax === p.max;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={on}
                className="chip text-xs"
                onClick={() =>
                  onChange(
                    on
                      ? { runtimeMin: null, runtimeMax: null }
                      : { runtimeMin: p.min, runtimeMax: p.max },
                  )
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <RangeSlider
          label="Minutes"
          min={0}
          max={300}
          step={5}
          value={[f.runtimeMin ?? 0, f.runtimeMax ?? 300]}
          onChange={([a, b]) =>
            onChange({ runtimeMin: a === 0 ? null : a, runtimeMax: b === 300 ? null : b })
          }
          format={(n) => (n === 300 ? '300+' : `${n}`)}
        />
      </Section>

      <Section title="Language & country">
        <label className="block">
          <span className="text-[13px] text-dim">Original language</span>
          <select
            className="field"
            value={f.language ?? ''}
            onChange={(e) => onChange({ language: e.target.value || null })}
          >
            <option value="">Any language</option>
            <optgroup label="Popular">
              {PINNED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </optgroup>
            {langs.data && (
              <optgroup label="All languages">
                {otherLanguages(langs.data).map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label className="block">
          <span className="text-[13px] text-dim">Production country</span>
          <select
            className="field"
            value={f.country ?? ''}
            onChange={(e) => onChange({ country: e.target.value || null })}
          >
            <option value="">Any country</option>
            {(countries.data ?? [])
              .slice()
              .sort((a, b) => a.english_name.localeCompare(b.english_name))
              .map((c) => (
                <option key={c.iso_3166_1} value={c.iso_3166_1}>
                  {c.english_name}
                </option>
              ))}
          </select>
        </label>
      </Section>

      <Section title={`Streaming in ${region}`} open={false}>
        <div className="grid grid-cols-6 gap-2">
          {providerList.map((p) => {
            const on = f.providers.some((x) => x.id === p.provider_id);
            return (
              <button
                key={p.provider_id}
                type="button"
                aria-pressed={on}
                aria-label={p.provider_name}
                title={p.provider_name}
                onClick={() =>
                  onChange({
                    providers: on
                      ? f.providers.filter((x) => x.id !== p.provider_id)
                      : [...f.providers, { id: p.provider_id, name: p.provider_name }],
                  })
                }
                className={cn(
                  'overflow-hidden rounded-[4px] outline outline-2 outline-offset-2 transition',
                  on
                    ? 'outline-accent'
                    : 'opacity-60 outline-transparent grayscale hover:opacity-100 hover:grayscale-0',
                )}
              >
                <Pic
                  path={p.logo_path}
                  kind="logo"
                  alt=""
                  fill={false}
                  width={44}
                  height={44}
                  className="h-full w-full"
                />
              </button>
            );
          })}
        </div>
        {providers.isLoading && <p className="text-xs text-dim">Loading services…</p>}
        <div className="flex flex-wrap gap-1.5">
          {MONETIZATION_OPTIONS.map((m) => {
            const on = f.monetization.includes(m.key);
            return (
              <button
                key={m.key}
                type="button"
                aria-pressed={on}
                className="chip text-xs"
                onClick={() =>
                  onChange({
                    monetization: on
                      ? f.monetization.filter((x) => x !== m.key)
                      : [...f.monetization, m.key],
                  })
                }
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </Section>

      {certList.length > 0 && (
        <Section title={`Certification · ${region}`} open={false}>
          <div className="flex flex-wrap gap-1.5">
            {certList.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={f.certification === c}
                className="chip text-xs"
                onClick={() => onChange({ certification: f.certification === c ? null : c })}
              >
                {c}
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title="People, themes & studios" open={false}>
        <EntityAutocomplete
          kind="person"
          label="Cast"
          value={f.cast}
          onChange={(cast) => onChange({ cast })}
          placeholder="e.g. Shah Rukh Khan"
        />
        <EntityAutocomplete
          kind="person"
          label="Director / crew"
          value={f.crew}
          onChange={(crew) => onChange({ crew })}
          placeholder="e.g. Satyajit Ray"
          preferDepartment="Directing"
        />
        <EntityAutocomplete
          kind="keyword"
          label="Themes (any of)"
          value={f.keywords}
          onChange={(keywords) => onChange({ keywords })}
        />
        <EntityAutocomplete
          kind="keyword"
          label="Exclude themes"
          value={f.excludeKeywords}
          onChange={(excludeKeywords) => onChange({ excludeKeywords })}
          tone="off"
        />
        <EntityAutocomplete
          kind="company"
          label="Production company"
          value={f.companies}
          onChange={(companies) => onChange({ companies })}
        />
      </Section>

      <Section title="Personal">
        <label className="flex min-h-[40px] cursor-pointer items-center justify-between gap-3 text-sm">
          Hide films I’ve already seen
          <input
            type="checkbox"
            className="h-5 w-5 accent-[rgb(var(--accent))]"
            checked={f.hideSeen}
            onChange={(e) => onChange({ hideSeen: e.target.checked })}
          />
        </label>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveFilter(presetName || 'My filter', filtersToSearchParams(f).toString());
            setPresetName('');
          }}
        >
          <label className="flex-1">
            <span className="sr-only">Name for this filter set</span>
            <input
              className="field"
              placeholder="Save these filters as…"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-sm shrink-0">
            Save
          </button>
        </form>
        {saved.length > 0 && (
          <div>
            <p className="t-mono mb-1 text-dim">Saved filters</p>
            <ul>
              {saved.map((s) => (
                <li key={s.id} className="flex items-center gap-2 border-t border-ink/15">
                  <Go
                    href={`/discover?${s.query}`}
                    className="flex-1 truncate py-2 text-sm hover:text-accent"
                  >
                    {s.name}
                  </Go>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center text-dim hover:text-danger"
                    aria-label={`Delete ${s.name}`}
                    onClick={() => deleteFilter(s.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          className="t-mono text-dim underline-offset-4 hover:text-accent hover:underline"
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
        >
          Reset every filter
        </button>
      </Section>
    </div>
  );
}

/* ---------------------------------------------------------------- Autocomplete */

interface Hit {
  id: number;
  name: string;
  known_for_department?: string;
  origin_country?: string;
}

/** Search-as-you-type multi-select for people, keywords or companies. */
function EntityAutocomplete({
  kind,
  label,
  value,
  onChange,
  placeholder,
  preferDepartment,
  tone = 'on',
}: {
  kind: 'person' | 'keyword' | 'company';
  label: string;
  value: Entity[];
  onChange: (v: Entity[]) => void;
  placeholder?: string;
  preferDepartment?: string;
  tone?: 'on' | 'off';
}) {
  const id = useId();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const query = useDebounced(q.trim(), 300);
  const { data, isFetching } = useQuery({
    queryKey: ['entity', kind, query],
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 10,
    queryFn: ({ signal }) => api<Paginated<Hit>>(`search/${kind}`, { query }, signal),
  });

  let hits = (data?.results ?? []).filter((h) => !value.some((v) => v.id === h.id));
  if (preferDepartment)
    hits = hits
      .slice()
      .sort(
        (a, b) =>
          Number(b.known_for_department === preferDepartment) -
          Number(a.known_for_department === preferDepartment),
      );
  hits = hits.slice(0, 8);
  const open = focused && query.length >= 2 && (hits.length > 0 || isFetching);

  const add = (h: Hit) => {
    onChange([...value, { id: h.id, name: h.name }]);
    setQ('');
    setActive(0);
  };

  return (
    <div>
      <label htmlFor={id} className="block text-[13px] text-dim">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open && hits[active] ? `${id}-${active}` : undefined}
          autoComplete="off"
          className="field"
          placeholder={placeholder ?? 'Type to search…'}
          value={q}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(hits.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter' && hits[active]) {
              e.preventDefault();
              add(hits[active]);
            } else if (e.key === 'Escape' && q) {
              e.stopPropagation();
              setQ('');
            }
          }}
        />
        {open && (
          <ul
            id={`${id}-list`}
            role="listbox"
            className="panel absolute inset-x-0 top-[calc(100%+4px)] z-40 max-h-60 overflow-y-auto p-1 shadow-print-sm"
          >
            {isFetching && !hits.length && (
              <li className="px-3 py-2 text-sm text-dim">Searching…</li>
            )}
            {hits.map((h, i) => (
              <li
                key={h.id}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => add(h)}
                className={cn(
                  'flex cursor-pointer items-baseline justify-between gap-3 rounded-[3px] px-2.5 py-1.5 text-sm',
                  i === active && 'bg-ink text-paper',
                )}
              >
                {h.name}
                {(h.known_for_department || h.origin_country) && (
                  <span className="font-mono text-[10px] opacity-70">
                    {h.known_for_department ?? h.origin_country}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {value.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li
              key={v.id}
              className={cn(
                'chip cursor-default pr-1 text-xs',
                tone === 'on' ? 'chip-on' : 'chip-off',
              )}
            >
              {v.name}
              <button
                type="button"
                aria-label={`Remove ${v.name}`}
                onClick={() => onChange(value.filter((x) => x.id !== v.id))}
                className="grid h-5 w-5 place-items-center rounded-full hover:bg-paper/20"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
