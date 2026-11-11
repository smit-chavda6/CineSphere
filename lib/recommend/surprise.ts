/** TMDB never serves pages beyond 500. */
export const TMDB_MAX_PAGE = 500;

export function randomPage(totalPages: number, rng: () => number = Math.random): number {
  const max = Math.max(1, Math.min(totalPages, TMDB_MAX_PAGE));
  return 1 + Math.floor(rng() * max);
}

/** Random item whose id is not in `exclude`, or null if all are excluded. */
export function pickUnseen<T extends { id: number }>(
  items: T[],
  exclude: Set<number>,
  rng: () => number = Math.random,
): T | null {
  const pool = items.filter((i) => !exclude.has(i.id));
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}
