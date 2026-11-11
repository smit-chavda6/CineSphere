import { describe, expect, it } from 'vitest';
import { buildProfile } from '../profile';
import { bayesianRating, scoreAll } from '../score';
import { DICAPRIO, HEIST, NOLAN, TIME_TRAVEL, inception, interstellar, movie } from './fixtures';

const profile = buildProfile([{ features: inception }, { features: interstellar }]);

describe('scoreAll', () => {
  it('ranks a same-director sci-fi above an unrelated romcom', () => {
    const tenet = movie({
      title: 'Tenet',
      genres: [28, 878, 53],
      keywords: [TIME_TRAVEL],
      directors: [NOLAN],
      voteAverage: 7.2,
      voteCount: 9000,
    });
    const romcom = movie({
      title: 'Romcom',
      genres: [35, 10749],
      voteAverage: 7.2,
      voteCount: 9000,
    });
    const [first, second] = scoreAll(profile, [romcom, tenet]);
    expect(first.features.title).toBe('Tenet');
    expect(first.score).toBeGreaterThan(second.score);
  });

  it('explains why with director, keywords and cast', () => {
    const cand = movie({
      title: 'Heist Movie',
      genres: [28, 53],
      keywords: [HEIST],
      directors: [NOLAN],
      cast: [DICAPRIO],
    });
    const [r] = scoreAll(profile, [cand]);
    expect(r.reasons[0]).toBe('Same director as Inception (Christopher Nolan)');
    expect(r.reasons[1]).toContain("'heist'");
    expect(r.reasons[1]).toContain('with Inception');
    expect(r.reasons[2]).toBe('Stars Leonardo DiCaprio, also in Inception');
  });

  it('rewards appearing in several seed recommendation lists', () => {
    const a = movie({ genres: [99] });
    const b = { ...a, id: a.id + 1 };
    const [top] = scoreAll(profile, [a, b], { sourceHits: { [b.id]: 3 } });
    expect(top.features.id).toBe(b.id);
    expect(top.reasons).toContain('TMDB recommends it for 3 of your picks');
  });

  it('penalises features the user dislikes', () => {
    const negative = buildProfile([{ features: inception, weight: -1 }]);
    const [r] = scoreAll(negative, [movie({ genres: [878], directors: [NOLAN] })]);
    expect(r.breakdown.genre).toBeLessThan(0);
    expect(r.breakdown.director).toBeLessThan(0);
  });
});

describe('bayesianRating', () => {
  it('pulls low-vote ratings toward the prior', () => {
    expect(bayesianRating(9.5, 10)).toBeLessThan(bayesianRating(8.4, 20000));
  });
});
