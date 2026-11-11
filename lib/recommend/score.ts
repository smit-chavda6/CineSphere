import { GENRE_NAMES } from '@/config/genres';
import { decadeOf, type MovieFeatures } from './features';
import { normalizeProfile, type TasteProfile, type WeightedEntry } from './profile';

export interface Weights {
  genre: number;
  keyword: number;
  director: number;
  cast: number;
  decade: number;
  language: number;
  quality: number;
  votes: number;
  source: number;
}

/** Feature weights. The first eight sum to 1; `source` is a bonus on top. */
export const DEFAULT_WEIGHTS: Weights = {
  genre: 0.26,
  keyword: 0.22,
  director: 0.12,
  cast: 0.08,
  decade: 0.05,
  language: 0.09,
  quality: 0.12,
  votes: 0.06,
  source: 0.1,
};

export interface ScoreOptions {
  /** How many seed movies' TMDB recommendations/similar lists contained this id. */
  sourceHits?: Record<number, number>;
  weights?: Partial<Weights>;
}

export interface ScoredMovie {
  features: MovieFeatures;
  score: number;
  reasons: string[];
  breakdown: Record<keyof Weights, number>;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Saturating curve: many weak matches approach, but never exceed, ±1. */
const saturate = (s: number, k = 1.2) => Math.sign(s) * (1 - Math.exp(-Math.abs(s) * k));

/** Bayesian-average rating so a 9.0 from 12 votes does not beat an 8.4 from 20k votes. */
export function bayesianRating(avg: number, votes: number, prior = 6.4, m = 150): number {
  return (votes / (votes + m)) * avg + (m / (votes + m)) * prior;
}

function shared(bucket: Record<number, WeightedEntry>, list: { id: number }[]) {
  return list
    .map((x) => bucket[x.id])
    .filter((e): e is WeightedEntry => Boolean(e) && e.w !== 0)
    .sort((a, b) => b.w - a.w);
}

/** Scores a candidate against an already-normalised profile. Pure. */
export function scoreNormalized(
  np: TasteProfile,
  f: MovieFeatures,
  opts: ScoreOptions = {},
): ScoredMovie {
  const W = { ...DEFAULT_WEIGHTS, ...opts.weights };

  const gVals = f.genres.map((g) => np.genres[g] ?? 0);
  const genre = gVals.length
    ? clamp(
        0.5 * (gVals.reduce((a, b) => a + b, 0) / gVals.length) + 0.5 * Math.max(...gVals),
        -1,
        1,
      )
    : 0;

  const kws = shared(np.keywords, f.keywords);
  const keyword = saturate(kws.reduce((s, e) => s + e.w, 0));

  const dirs = shared(np.directors, f.directors);
  const director = clamp(
    dirs.reduce((s, e) => s + e.w, 0),
    -1,
    1,
  );

  const cast = shared(np.cast, f.cast);
  const castScore = saturate(
    cast.reduce((s, e) => s + e.w, 0),
    0.9,
  );

  const decade = f.year ? (np.decades[decadeOf(f.year)] ?? 0) : 0;
  const language = f.language ? (np.languages[f.language] ?? 0) : 0;

  const bayes = bayesianRating(f.voteAverage, f.voteCount);
  const quality = clamp((bayes - 5) / 3.5, 0, 1);
  const votes = clamp(Math.log10(f.voteCount + 1) / 4.5, 0, 1);

  const hits = opts.sourceHits?.[f.id] ?? 0;
  const source = 1 - Math.exp(-0.6 * hits);

  const breakdown = {
    genre,
    keyword,
    director,
    cast: castScore,
    decade,
    language,
    quality,
    votes,
    source,
  };
  const score =
    W.genre * genre +
    W.keyword * keyword +
    W.director * director +
    W.cast * castScore +
    W.decade * decade +
    W.language * language +
    W.quality * quality +
    W.votes * votes +
    W.source * source;

  // ---- Human-readable reasons, strongest first ----
  const reasons: string[] = [];
  const topDir = dirs.find((d) => d.w > 0);
  if (topDir) {
    reasons.push(
      topDir.from.length
        ? `Same director as ${topDir.from[0]} (${topDir.name})`
        : `Directed by ${topDir.name}, a favourite of yours`,
    );
  }
  const posKws = kws.filter((k) => k.w > 0).slice(0, 2);
  if (posKws.length) {
    const names = posKws.map((k) => `'${k.name}'`).join(' and ');
    const src = posKws[0].from[0];
    reasons.push(
      `Shares ${names} ${posKws.length > 1 ? 'keywords' : 'keyword'}${src ? ` with ${src}` : ''}`,
    );
  }
  const topCast = cast.find((c) => c.w > 0);
  if (topCast) {
    reasons.push(
      topCast.from.length
        ? `Stars ${topCast.name}, also in ${topCast.from[0]}`
        : `Stars ${topCast.name}`,
    );
  }
  if (hits >= 2) reasons.push(`TMDB recommends it for ${hits} of your picks`);
  if (reasons.length < 2 && genre > 0.4) {
    const names = f.genres
      .filter((g) => (np.genres[g] ?? 0) > 0.4)
      .slice(0, 2)
      .map((g) => GENRE_NAMES[g])
      .filter(Boolean);
    if (names.length) reasons.push(`Matches your taste for ${names.join(' & ')}`);
  }
  if (bayes >= 7.6 && f.voteCount >= 500) {
    reasons.push(
      `Loved by audiences — ${f.voteAverage.toFixed(1)}★ from ${f.voteCount.toLocaleString('en-US')} votes`,
    );
  }
  if (!reasons.length && hits === 1) reasons.push('Recommended by TMDB for one of your picks');

  return { features: f, score, reasons: reasons.slice(0, 3), breakdown };
}

/** Convenience: normalise the profile once, then score every candidate. */
export function scoreAll(
  profile: TasteProfile,
  candidates: MovieFeatures[],
  opts: ScoreOptions = {},
): ScoredMovie[] {
  const np = normalizeProfile(profile);
  return candidates.map((c) => scoreNormalized(np, c, opts)).sort((a, b) => b.score - a.score);
}
