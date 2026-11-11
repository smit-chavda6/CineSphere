import type { MovieFeatures } from './features';
import type { ScoredMovie } from './score';

const jaccard = (a: number[], b: number[]) => {
  if (!a.length && !b.length) return 0;
  const sb = new Set(b);
  const inter = a.filter((x) => sb.has(x)).length;
  return inter / (a.length + b.length - inter);
};

/** 0..1 similarity between two movies, used to penalise near-duplicates. */
export function similarity(a: MovieFeatures, b: MovieFeatures): number {
  let s = 0.5 * jaccard(a.genres, b.genres);
  if (a.collectionId && a.collectionId === b.collectionId) s += 0.35;
  const dirs = new Set(a.directors.map((d) => d.id));
  if (b.directors.some((d) => dirs.has(d.id))) s += 0.15;
  if (a.year && b.year && Math.abs(a.year - b.year) <= 2) s += 0.05;
  return Math.min(1, s);
}

/**
 * Cheap franchise fingerprint from a title, for when collection ids are unknown
 * (list results don't include them): "Harry Potter and the Goblet of Fire" → "harry potter and",
 * "Avengers: Endgame" → "avengers", "The Dark Knight Rises" → "the dark knight".
 */
export function seriesKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[:\-–—(].*$/, '')
    .replace(/\b(part|chapter|vol\.?|volume)\b.*$/, '')
    .replace(/\s+\d+\s*$/, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ');
}

/**
 * Re-orders an already-ranked list so the same franchise never appears within `gap`
 * cards of itself, counting the cards just seen (`recentKeys`) as the ones before it.
 * `keyOf` returns a franchise key (a TMDB collection id when known, else `seriesKey`).
 */
export function spreadFranchises<T>(
  ranked: T[],
  keyOf: (item: T) => string,
  recentKeys: string[] = [],
  { gap = 4, recentPenalty = 8 }: { gap?: number; recentPenalty?: number } = {},
): T[] {
  const recent = new Set(recentKeys);
  const keyed = ranked.map((item, i) => {
    const key = keyOf(item);
    return { item, key, rank: i + (recent.has(key) ? recentPenalty : 0) };
  });
  keyed.sort((a, b) => a.rank - b.rank);
  const out: typeof keyed = [];
  const pool = keyed.slice();
  const seenBefore = recentKeys.slice(-gap);
  while (pool.length) {
    const lastKeys = new Set([...seenBefore, ...out.map((x) => x.key)].slice(-gap));
    const idx = pool.findIndex((x) => !lastKeys.has(x.key));
    out.push(pool.splice(idx === -1 ? 0 : idx, 1)[0]);
  }
  return out.map((x) => x.item);
}

/**
 * Greedy Maximal-Marginal-Relevance ranking: each pick maximises
 * `score − penalty × max-similarity-to-already-picked`, and exact duplicates are dropped.
 */
export function rankWithDiversity(
  items: ScoredMovie[],
  { limit = 40, penalty = 0.12 }: { limit?: number; penalty?: number } = {},
): ScoredMovie[] {
  const seen = new Set<number>();
  const pool = items.filter((i) =>
    seen.has(i.features.id) ? false : (seen.add(i.features.id), true),
  );
  const picked: ScoredMovie[] = [];
  while (picked.length < limit && pool.length) {
    let bestIdx = 0;
    let best = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const maxSim = picked.reduce(
        (m, p) => Math.max(m, similarity(pool[i].features, p.features)),
        0,
      );
      const mmr = pool[i].score - penalty * maxSim;
      if (mmr > best) {
        best = mmr;
        bestIdx = i;
      }
    }
    picked.push(pool.splice(bestIdx, 1)[0]);
  }
  return picked;
}
