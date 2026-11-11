import { decadeOf, type MovieFeatures } from './features';

/** A weighted signal with the seed titles that produced it (used for "why" text). */
export interface WeightedEntry {
  w: number;
  name: string;
  from: string[];
}

/**
 * A taste profile is a bag of weighted features. Positive weight = liked,
 * negative = disliked. Profiles are plain JSON so they can be stored and tested.
 */
export interface TasteProfile {
  genres: Record<number, number>;
  keywords: Record<number, WeightedEntry>;
  directors: Record<number, WeightedEntry>;
  cast: Record<number, WeightedEntry>;
  decades: Record<number, number>;
  languages: Record<string, number>;
  seedIds: number[];
  totalWeight: number;
}

export interface Seed {
  features: MovieFeatures;
  /** Defaults to 1. Negative values push the profile away from this movie. */
  weight?: number;
}

export const emptyProfile = (): TasteProfile => ({
  genres: {},
  keywords: {},
  directors: {},
  cast: {},
  decades: {},
  languages: {},
  seedIds: [],
  totalWeight: 0,
});

function bump(
  bucket: Record<number, WeightedEntry>,
  id: number,
  name: string,
  w: number,
  title: string,
) {
  const cur = bucket[id] ?? { w: 0, name, from: [] };
  const from = w > 0 && !cur.from.includes(title) ? [...cur.from, title] : cur.from;
  bucket[id] = { w: cur.w + w, name, from };
}

/** Returns a new profile with `f` folded in at `weight`. Does not mutate the input. */
export function addToProfile(p: TasteProfile, f: MovieFeatures, weight = 1): TasteProfile {
  const next: TasteProfile = {
    genres: { ...p.genres },
    keywords: { ...p.keywords },
    directors: { ...p.directors },
    cast: { ...p.cast },
    decades: { ...p.decades },
    languages: { ...p.languages },
    seedIds: p.seedIds.slice(),
    totalWeight: p.totalWeight + Math.abs(weight),
  };
  for (const g of f.genres) next.genres[g] = (next.genres[g] ?? 0) + weight;
  for (const k of f.keywords) bump(next.keywords, k.id, k.name, weight, f.title);
  for (const d of f.directors) bump(next.directors, d.id, d.name, weight, f.title);
  // Top-billed actors count more than the fifth name on the poster.
  f.cast.forEach((c, i) => bump(next.cast, c.id, c.name, weight * (1 - i * 0.12), f.title));
  if (f.year) {
    const dec = decadeOf(f.year);
    next.decades[dec] = (next.decades[dec] ?? 0) + weight;
  }
  if (f.language) next.languages[f.language] = (next.languages[f.language] ?? 0) + weight;
  if (weight > 0 && !next.seedIds.includes(f.id)) next.seedIds.push(f.id);
  return next;
}

export function buildProfile(seeds: Seed[]): TasteProfile {
  return seeds.reduce((p, s) => addToProfile(p, s.features, s.weight ?? 1), emptyProfile());
}

const maxAbs = (values: number[]) => values.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;

function scaleNum<K extends string | number>(rec: Record<K, number>): Record<K, number> {
  const m = maxAbs(Object.values(rec) as number[]);
  const out = {} as Record<K, number>;
  for (const k of Object.keys(rec) as K[]) out[k] = rec[k] / m;
  return out;
}

function scaleEntries(rec: Record<number, WeightedEntry>): Record<number, WeightedEntry> {
  const m = maxAbs(Object.values(rec).map((e) => e.w));
  const out: Record<number, WeightedEntry> = {};
  for (const [k, e] of Object.entries(rec)) out[Number(k)] = { ...e, w: e.w / m };
  return out;
}

/**
 * Scales every dimension so its strongest signal is ±1. This keeps a profile built
 * from 3 movies comparable to one built from 300.
 */
export function normalizeProfile(p: TasteProfile): TasteProfile {
  return {
    ...p,
    genres: scaleNum(p.genres),
    keywords: scaleEntries(p.keywords),
    directors: scaleEntries(p.directors),
    cast: scaleEntries(p.cast),
    decades: scaleNum(p.decades),
    languages: scaleNum(p.languages),
  };
}

/** Highest-weighted positive entries of a numeric or entry bucket. */
export function topIds(
  rec: Record<number, number> | Record<number, WeightedEntry>,
  n: number,
): number[] {
  return Object.entries(rec)
    .map(([id, v]) => [Number(id), typeof v === 'number' ? v : v.w] as const)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id]) => id);
}

export function topLanguage(p: TasteProfile): { code: string; share: number } | null {
  const entries = Object.entries(p.languages).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (!total) return null;
  const [code, w] = entries.sort((a, b) => b[1] - a[1])[0];
  return { code, share: w / total };
}
