import type { Entity } from '@/types/app';
import { addDays, isoDate } from '@/lib/utils';

/**
 * Discover filter model. Pure and framework-free so it can be shared by the URL
 * (shareable state), the browser query and unit tests.
 */

export type SortKey = 'popularity' | 'rating' | 'votes' | 'newest' | 'oldest' | 'revenue' | 'title';
export type ReleaseStatus = 'released' | 'upcoming' | 'theatres';
export type Monetization = 'flatrate' | 'free' | 'ads' | 'rent' | 'buy';

export const SORT_OPTIONS: { key: SortKey; label: string; tmdb: string }[] = [
  { key: 'popularity', label: 'Most popular', tmdb: 'popularity.desc' },
  { key: 'rating', label: 'Highest rated', tmdb: 'vote_average.desc' },
  { key: 'votes', label: 'Most voted', tmdb: 'vote_count.desc' },
  { key: 'newest', label: 'Newest first', tmdb: 'primary_release_date.desc' },
  { key: 'oldest', label: 'Oldest first', tmdb: 'primary_release_date.asc' },
  { key: 'revenue', label: 'Highest revenue', tmdb: 'revenue.desc' },
  { key: 'title', label: 'Title A–Z', tmdb: 'title.asc' },
];

export const MONETIZATION_OPTIONS: { key: Monetization; label: string }[] = [
  { key: 'flatrate', label: 'Subscription' },
  { key: 'free', label: 'Free' },
  { key: 'ads', label: 'With ads' },
  { key: 'rent', label: 'Rent' },
  { key: 'buy', label: 'Buy' },
];

export const STATUS_OPTIONS: { key: ReleaseStatus; label: string }[] = [
  { key: 'released', label: 'Released' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'theatres', label: 'In theatres' },
];

export const VOTE_PRESETS = [0, 50, 100, 500, 5000];

export const RUNTIME_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: '< 90 min', min: null, max: 89 },
  { label: '90–120', min: 90, max: 120 },
  { label: '120–150', min: 120, max: 150 },
  { label: '150+', min: 150, max: null },
];

export const MIN_YEAR = 1900;
export const maxYear = (now = new Date()) => now.getFullYear() + 2;

export interface DiscoverFilters {
  genres: number[];
  genreMode: 'and' | 'or';
  excludeGenres: number[];
  yearFrom: number | null;
  yearTo: number | null;
  ratingMin: number | null;
  ratingMax: number | null;
  minVotes: number;
  runtimeMin: number | null;
  runtimeMax: number | null;
  language: string | null;
  country: string | null;
  providers: Entity[];
  monetization: Monetization[];
  certification: string | null;
  cast: Entity[];
  crew: Entity[];
  keywords: Entity[];
  excludeKeywords: Entity[];
  companies: Entity[];
  status: ReleaseStatus | null;
  sort: SortKey;
  hideSeen: boolean;
}

export const DEFAULT_FILTERS: DiscoverFilters = {
  genres: [],
  genreMode: 'or',
  excludeGenres: [],
  yearFrom: null,
  yearTo: null,
  ratingMin: null,
  ratingMax: null,
  minVotes: 100,
  runtimeMin: null,
  runtimeMax: null,
  language: null,
  country: null,
  providers: [],
  monetization: [],
  certification: null,
  cast: [],
  crew: [],
  keywords: [],
  excludeKeywords: [],
  companies: [],
  status: null,
  sort: 'popularity',
  hideSeen: false,
};

// ---------- URL encoding ----------

const numList = (v: string | null) =>
  (v ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

const num = (v: string | null, min: number, max: number): number | null => {
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
};

/** Entities are encoded as `id:name|id:name` so chips can show names without refetching. */
export function encodeEntities(list: Entity[]): string {
  return list.map((e) => `${e.id}:${e.name.replace(/[|]/g, '/')}`).join('|');
}

export function decodeEntities(v: string | null): Entity[] {
  if (!v) return [];
  return v
    .split('|')
    .map((part) => {
      const i = part.indexOf(':');
      const id = Number(i === -1 ? part : part.slice(0, i));
      const name = i === -1 ? `#${id}` : part.slice(i + 1);
      return { id, name };
    })
    .filter((e) => Number.isInteger(e.id) && e.id > 0);
}

const SORT_KEYS = new Set(SORT_OPTIONS.map((s) => s.key));
const STATUS_KEYS = new Set(STATUS_OPTIONS.map((s) => s.key));
const MONETIZATION_KEYS = new Set(MONETIZATION_OPTIONS.map((m) => m.key));

export function filtersFromSearchParams(sp: URLSearchParams, now = new Date()): DiscoverFilters {
  const sort = sp.get('sort') as SortKey | null;
  const status = sp.get('status') as ReleaseStatus | null;
  const votes = num(sp.get('votes'), 0, 100000);
  const lang = sp.get('lang');
  const country = sp.get('country');
  return {
    genres: numList(sp.get('g')),
    genreMode: sp.get('gm') === 'and' ? 'and' : 'or',
    excludeGenres: numList(sp.get('xg')),
    yearFrom: num(sp.get('yf'), MIN_YEAR, maxYear(now)),
    yearTo: num(sp.get('yt'), MIN_YEAR, maxYear(now)),
    ratingMin: num(sp.get('rmin'), 0, 10),
    ratingMax: num(sp.get('rmax'), 0, 10),
    minVotes: votes ?? DEFAULT_FILTERS.minVotes,
    runtimeMin: num(sp.get('rtmin'), 0, 600),
    runtimeMax: num(sp.get('rtmax'), 0, 600),
    language: lang && /^[a-z]{2}$/.test(lang) ? lang : null,
    country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    providers: decodeEntities(sp.get('prov')),
    monetization: (sp.get('mon') ?? '')
      .split(',')
      .filter((m): m is Monetization => MONETIZATION_KEYS.has(m as Monetization)),
    certification: sp.get('cert') || null,
    cast: decodeEntities(sp.get('cast')),
    crew: decodeEntities(sp.get('crew')),
    keywords: decodeEntities(sp.get('kw')),
    excludeKeywords: decodeEntities(sp.get('xkw')),
    companies: decodeEntities(sp.get('co')),
    status: status && STATUS_KEYS.has(status) ? status : null,
    sort: sort && SORT_KEYS.has(sort) ? sort : DEFAULT_FILTERS.sort,
    hideSeen: sp.get('hide') === '1',
  };
}

/** Serialises filters, omitting anything equal to the default for short URLs. */
export function filtersToSearchParams(f: DiscoverFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.genres.length) sp.set('g', f.genres.join(','));
  if (f.genres.length > 1 && f.genreMode === 'and') sp.set('gm', 'and');
  if (f.excludeGenres.length) sp.set('xg', f.excludeGenres.join(','));
  if (f.yearFrom !== null) sp.set('yf', String(f.yearFrom));
  if (f.yearTo !== null) sp.set('yt', String(f.yearTo));
  if (f.ratingMin !== null) sp.set('rmin', String(f.ratingMin));
  if (f.ratingMax !== null) sp.set('rmax', String(f.ratingMax));
  if (f.minVotes !== DEFAULT_FILTERS.minVotes) sp.set('votes', String(f.minVotes));
  if (f.runtimeMin !== null) sp.set('rtmin', String(f.runtimeMin));
  if (f.runtimeMax !== null) sp.set('rtmax', String(f.runtimeMax));
  if (f.language) sp.set('lang', f.language);
  if (f.country) sp.set('country', f.country);
  if (f.providers.length) sp.set('prov', encodeEntities(f.providers));
  if (f.monetization.length) sp.set('mon', f.monetization.join(','));
  if (f.certification) sp.set('cert', f.certification);
  if (f.cast.length) sp.set('cast', encodeEntities(f.cast));
  if (f.crew.length) sp.set('crew', encodeEntities(f.crew));
  if (f.keywords.length) sp.set('kw', encodeEntities(f.keywords));
  if (f.excludeKeywords.length) sp.set('xkw', encodeEntities(f.excludeKeywords));
  if (f.companies.length) sp.set('co', encodeEntities(f.companies));
  if (f.status) sp.set('status', f.status);
  if (f.sort !== DEFAULT_FILTERS.sort) sp.set('sort', f.sort);
  if (f.hideSeen) sp.set('hide', '1');
  return sp;
}

// ---------- TMDB query building ----------

const maxDate = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);
const minDate = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);

/** Maps the filter model onto TMDB /discover/movie query parameters. */
export function filtersToTmdbParams(
  f: DiscoverFilters,
  { region, today = new Date() }: { region: string; today?: Date },
): Record<string, string> {
  const p: Record<string, string> = {
    sort_by: SORT_OPTIONS.find((s) => s.key === f.sort)?.tmdb ?? 'popularity.desc',
    include_adult: 'false',
  };

  // Upcoming films have no votes yet, so a vote floor would hide all of them.
  if (f.status !== 'upcoming' && f.minVotes > 0) p['vote_count.gte'] = String(f.minVotes);

  if (f.genres.length) p.with_genres = f.genres.join(f.genreMode === 'and' ? ',' : '|');
  if (f.excludeGenres.length) p.without_genres = f.excludeGenres.join(',');

  let gte: string | null = f.yearFrom !== null ? `${f.yearFrom}-01-01` : null;
  let lte: string | null = f.yearTo !== null ? `${f.yearTo}-12-31` : null;
  const todayIso = isoDate(today);
  if (f.status === 'released') lte = minDate(lte, todayIso);
  if (f.status === 'upcoming') gte = maxDate(gte, isoDate(addDays(today, 1)));
  if (f.status === 'theatres') {
    p.region = region;
    p.with_release_type = '2|3';
    p['release_date.gte'] = isoDate(addDays(today, -42));
    p['release_date.lte'] = todayIso;
  }
  if (gte) p['primary_release_date.gte'] = gte;
  if (lte) p['primary_release_date.lte'] = lte;

  if (f.ratingMin !== null) p['vote_average.gte'] = String(f.ratingMin);
  if (f.ratingMax !== null) p['vote_average.lte'] = String(f.ratingMax);
  if (f.runtimeMin !== null) p['with_runtime.gte'] = String(f.runtimeMin);
  if (f.runtimeMax !== null) p['with_runtime.lte'] = String(f.runtimeMax);
  if (f.language) p.with_original_language = f.language;
  if (f.country) p.with_origin_country = f.country;

  if (f.providers.length || f.monetization.length) {
    p.watch_region = region;
    if (f.providers.length) p.with_watch_providers = f.providers.map((x) => x.id).join('|');
    if (f.monetization.length) p.with_watch_monetization_types = f.monetization.join('|');
  }
  if (f.certification) {
    p.certification_country = region;
    p.certification = f.certification;
  }
  if (f.cast.length) p.with_cast = f.cast.map((x) => x.id).join(',');
  if (f.crew.length) p.with_crew = f.crew.map((x) => x.id).join(',');
  if (f.keywords.length) p.with_keywords = f.keywords.map((x) => x.id).join('|');
  if (f.excludeKeywords.length) p.without_keywords = f.excludeKeywords.map((x) => x.id).join(',');
  if (f.companies.length) p.with_companies = f.companies.map((x) => x.id).join('|');
  return p;
}

// ---------- Active filter chips ----------

export interface FilterChip {
  key: string;
  label: string;
  remove: (f: DiscoverFilters) => DiscoverFilters;
}

const without = <T extends { id: number }>(list: T[], id: number) =>
  list.filter((x) => x.id !== id);

export function activeChips(
  f: DiscoverFilters,
  names: { genre: (id: number) => string; language: (code: string) => string },
): FilterChip[] {
  const chips: FilterChip[] = [];
  f.genres.forEach((id) =>
    chips.push({
      key: `g${id}`,
      label: names.genre(id),
      remove: (x) => ({ ...x, genres: x.genres.filter((g) => g !== id) }),
    }),
  );
  f.excludeGenres.forEach((id) =>
    chips.push({
      key: `xg${id}`,
      label: `Not ${names.genre(id)}`,
      remove: (x) => ({ ...x, excludeGenres: x.excludeGenres.filter((g) => g !== id) }),
    }),
  );
  if (f.yearFrom !== null || f.yearTo !== null)
    chips.push({
      key: 'years',
      label: `${f.yearFrom ?? MIN_YEAR}–${f.yearTo ?? 'now'}`,
      remove: (x) => ({ ...x, yearFrom: null, yearTo: null }),
    });
  if (f.ratingMin !== null || f.ratingMax !== null)
    chips.push({
      key: 'rating',
      label: `★ ${f.ratingMin ?? 0}–${f.ratingMax ?? 10}`,
      remove: (x) => ({ ...x, ratingMin: null, ratingMax: null }),
    });
  if (f.minVotes !== DEFAULT_FILTERS.minVotes)
    chips.push({
      key: 'votes',
      label: f.minVotes ? `${f.minVotes}+ votes` : 'Any votes',
      remove: (x) => ({ ...x, minVotes: DEFAULT_FILTERS.minVotes }),
    });
  if (f.runtimeMin !== null || f.runtimeMax !== null)
    chips.push({
      key: 'runtime',
      label: `${f.runtimeMin ?? 0}–${f.runtimeMax ?? '∞'} min`,
      remove: (x) => ({ ...x, runtimeMin: null, runtimeMax: null }),
    });
  if (f.language)
    chips.push({
      key: 'lang',
      label: names.language(f.language),
      remove: (x) => ({ ...x, language: null }),
    });
  if (f.country)
    chips.push({
      key: 'country',
      label: `From ${f.country}`,
      remove: (x) => ({ ...x, country: null }),
    });
  f.providers.forEach((p) =>
    chips.push({
      key: `prov${p.id}`,
      label: p.name,
      remove: (x) => ({ ...x, providers: without(x.providers, p.id) }),
    }),
  );
  f.monetization.forEach((m) =>
    chips.push({
      key: `mon${m}`,
      label: MONETIZATION_OPTIONS.find((o) => o.key === m)?.label ?? m,
      remove: (x) => ({ ...x, monetization: x.monetization.filter((y) => y !== m) }),
    }),
  );
  if (f.certification)
    chips.push({
      key: 'cert',
      label: `Rated ${f.certification}`,
      remove: (x) => ({ ...x, certification: null }),
    });
  const entityChips = (
    field: 'cast' | 'crew' | 'keywords' | 'excludeKeywords' | 'companies',
    prefix: string,
  ) =>
    f[field].forEach((e) =>
      chips.push({
        key: `${field}${e.id}`,
        label: `${prefix}${e.name}`,
        remove: (x) => ({ ...x, [field]: without(x[field], e.id) }),
      }),
    );
  entityChips('cast', '');
  entityChips('crew', 'By ');
  entityChips('keywords', '#');
  entityChips('excludeKeywords', 'Not #');
  entityChips('companies', '');
  if (f.status)
    chips.push({
      key: 'status',
      label: STATUS_OPTIONS.find((s) => s.key === f.status)?.label ?? f.status,
      remove: (x) => ({ ...x, status: null }),
    });
  if (f.hideSeen)
    chips.push({ key: 'hide', label: 'Hiding seen', remove: (x) => ({ ...x, hideSeen: false }) });
  return chips;
}
