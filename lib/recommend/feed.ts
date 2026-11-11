export type SwipeAction = 'like' | 'skip' | 'watch' | 'seen';

export interface LibraryInput {
  watchlist: { id: number; at: number }[];
  seen: { id: number; at: number }[];
  ratings: { id: number; stars: number; at: number }[];
  notInterested: { id: number; at: number }[];
  swipes: { id: number; action: SwipeAction; at: number }[];
}

export interface Signal {
  id: number;
  weight: number;
  at: number;
}

/** Star ratings → profile weight. 4–5 are strong positives, 1–2 are negatives. */
export const RATING_WEIGHTS: Record<number, number> = { 5: 1.5, 4: 1, 3: 0.2, 2: -0.6, 1: -1 };

export const SIGNAL_WEIGHTS = {
  watchlist: 0.6,
  seen: 0.4,
  notInterested: -0.8,
  swipe: { like: 0.8, watch: 0.7, seen: 0.3, skip: -0.15 } as Record<SwipeAction, number>,
};

/**
 * Collapses everything we know about the user into one weight per movie.
 * An explicit star rating overrides the implicit "seen" signal; "not interested" always wins.
 */
export function librarySignals(lib: LibraryInput): Signal[] {
  const map = new Map<number, Signal>();
  const add = (id: number, w: number, at: number) => {
    const cur = map.get(id);
    map.set(id, { id, weight: (cur?.weight ?? 0) + w, at: Math.max(cur?.at ?? 0, at) });
  };
  const rated = new Set(lib.ratings.map((r) => r.id));

  lib.watchlist.forEach((x) => add(x.id, SIGNAL_WEIGHTS.watchlist, x.at));
  lib.seen.forEach((x) => {
    if (!rated.has(x.id)) add(x.id, SIGNAL_WEIGHTS.seen, x.at);
  });
  lib.ratings.forEach((r) => add(r.id, RATING_WEIGHTS[Math.round(r.stars)] ?? 0, r.at));
  lib.swipes.forEach((s) => add(s.id, SIGNAL_WEIGHTS.swipe[s.action], s.at));
  lib.notInterested.forEach((x) =>
    map.set(x.id, { id: x.id, weight: SIGNAL_WEIGHTS.notInterested, at: x.at }),
  );

  return Array.from(map.values()).filter((s) => s.weight !== 0);
}

/** Picks the strongest recent positives and negatives to seed a profile within a request budget. */
export function selectSeeds(signals: Signal[], maxPositive = 12, maxNegative = 6): Signal[] {
  const byStrength = (a: Signal, b: Signal) =>
    Math.abs(b.weight) - Math.abs(a.weight) || b.at - a.at;
  const pos = signals
    .filter((s) => s.weight > 0)
    .sort(byStrength)
    .slice(0, maxPositive);
  const neg = signals
    .filter((s) => s.weight < 0)
    .sort(byStrength)
    .slice(0, maxNegative);
  return [...pos, ...neg];
}
