/**
 * Local cinema first. TMDB's "popular" and "trending" lists are dominated by
 * Hollywood, so on their own they ignore where the viewer lives. Every place
 * that suggests films runs a second, local query (films whose origin country is
 * the viewer's region) and blends the two the way a local movie site would.
 */

export type Focus = 'mostly' | 'local' | 'world';

export const FOCUS_OPTIONS: { value: Focus; label: (region: string) => string }[] = [
  { value: 'mostly', label: (r) => `Mostly from ${r}` },
  { value: 'local', label: (r) => `Only from ${r}` },
  { value: 'world', label: () => 'Worldwide' },
];

type Params = Record<string, string | number>;

/** The same query, limited to films made in the region. Local films get fewer votes on TMDB, so vote floors are relaxed. */
export function localize(params: Params, region: string, voteScale = 0.2): Params {
  const p: Params = { ...params, with_origin_country: region };
  for (const key of ['vote_count.gte', 'vote_count.lte']) {
    const v = Number(p[key]);
    if (!Number.isFinite(v) || !v) continue;
    p[key] =
      key === 'vote_count.gte'
        ? Math.max(15, Math.round(v * voteScale))
        : Math.max(150, Math.round(v * voteScale));
  }
  return p;
}

/** True when a query already pins the country or language itself; then the viewer's choice wins. */
export const pinned = (params: Params) =>
  Boolean(params.with_origin_country || params.with_original_language);

/**
 * Blends a local list into a worldwide one: three local films for every
 * worldwide one in "mostly", local only in "local", untouched in "world".
 * Duplicates are dropped, and if one side runs out the other fills in.
 */
export function blend<T extends { id: number }>(local: T[], world: T[], focus: Focus): T[] {
  if (focus === 'world') return world;
  if (focus === 'local') return dedupe(local);
  const out: T[] = [];
  const seen = new Set<number>();
  const push = (m: T | undefined) => {
    if (m && !seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
  };
  let i = 0;
  let j = 0;
  while (i < local.length || j < world.length) {
    for (let k = 0; k < 3 && i < local.length; k++) push(local[i++]);
    if (j < world.length) push(world[j++]);
    if (i >= local.length) while (j < world.length) push(world[j++]);
  }
  return out;
}

const dedupe = <T extends { id: number }>(list: T[]) =>
  Array.from(new Map(list.map((m) => [m.id, m])).values());
