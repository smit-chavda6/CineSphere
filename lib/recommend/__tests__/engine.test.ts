import { describe, expect, it } from 'vitest';
import { rankWithDiversity, seriesKey, similarity, spreadFranchises } from '../diversify';
import { matchPercent, rankForGroup } from '../together';
import { formatRuntime, parseDuration } from '../time';
import { pickUnseen, randomPage } from '../surprise';
import { librarySignals, selectSeeds } from '../feed';
import { collectCandidates, profileDiscoverQueries } from '../candidates';
import { buildProfile } from '../profile';
import type { ScoredMovie } from '../score';
import { NOLAN, inception, movie } from './fixtures';
import type { MovieSummary } from '@/types/tmdb';

const scored = (score: number, over = {}): ScoredMovie => ({
  features: movie(over),
  score,
  reasons: [],
  breakdown: {} as ScoredMovie['breakdown'],
});

describe('rankWithDiversity', () => {
  it('drops duplicate ids', () => {
    const a = scored(0.9);
    expect(rankWithDiversity([a, a, a])).toHaveLength(1);
  });

  it('demotes a near-duplicate from the same collection', () => {
    const a = scored(0.9, { genres: [28], collectionId: 1 });
    const b = scored(0.85, { genres: [28], collectionId: 1 });
    const c = scored(0.8, { genres: [35] });
    const ranked = rankWithDiversity([a, b, c], { penalty: 0.3 });
    expect(ranked.map((r) => r.features.id)).toEqual([a.features.id, c.features.id, b.features.id]);
  });

  it('similarity is higher for same director + genres', () => {
    const x = movie({ genres: [28, 878], directors: [NOLAN] });
    const y = movie({ genres: [28, 878], directors: [NOLAN] });
    const z = movie({ genres: [35] });
    expect(similarity(x, y)).toBeGreaterThan(similarity(x, z));
  });
});

describe('franchise spreading', () => {
  it('fingerprints sequels to the same series key', () => {
    expect(seriesKey('Harry Potter and the Goblet of Fire')).toBe(
      seriesKey('Harry Potter and the Chamber of Secrets'),
    );
    expect(seriesKey('Avengers: Endgame')).toBe('avengers');
    expect(seriesKey('Toy Story 3')).toBe('toy story');
    expect(seriesKey('Inception')).not.toBe(seriesKey('Interstellar'));
  });

  it('never puts the same franchise back to back and demotes recently seen ones', () => {
    const titles = [
      'Harry Potter and the A',
      'Harry Potter and the B',
      'Harry Potter and the C',
      'Inception',
      'Up',
      'Heat',
    ];
    const out = spreadFranchises(titles, seriesKey, [seriesKey('Harry Potter and the Z')]);
    expect(out[0]).toBe('Inception');
    for (let i = 1; i < out.length; i++) {
      if (seriesKey(out[i]) === seriesKey(out[i - 1])) {
        // only allowed once no other franchise is left
        expect(out.slice(i).every((t) => seriesKey(t) === seriesKey(out[i]))).toBe(true);
      }
    }
    expect(out).toHaveLength(titles.length);
  });

  it('uses explicit franchise keys such as collection ids', () => {
    const films = [
      { t: 'Star Wars', c: 'c10' },
      { t: 'The Empire Strikes Back', c: 'c10' },
      { t: 'Return of the Jedi', c: 'c10' },
      { t: 'Heat', c: 'heat' },
    ];
    const out = spreadFranchises(films, (f) => f.c, ['c10']);
    expect(out[0].t).toBe('Heat');
  });

  it('keeps a just-swiped franchise away even when it dominates the top ranks', () => {
    const titles = [
      'Harry Potter and the A',
      'Harry Potter and the B',
      'Harry Potter and the C',
      'Harry Potter and the D',
      'Harry Potter and the E',
      'Harry Potter and the F',
      'Harry Potter and the G',
      'Harry Potter and the H',
      'Harry Potter and the I',
      'Gladiator',
    ];
    const out = spreadFranchises(titles, seriesKey, [seriesKey('Harry Potter and the Z')]);
    expect(out[0]).toBe('Gladiator');
  });
});

describe('rankForGroup', () => {
  it('prefers a movie everyone likes over one only a single person loves', () => {
    const scifiFan = buildProfile([{ features: movie({ genres: [878], language: 'en' }) }]);
    const comedyFan = buildProfile([{ features: movie({ genres: [35], language: 'en' }) }]);
    const both = movie({ title: 'Both', genres: [878, 35] });
    const onlyScifi = movie({ title: 'OnlyScifi', genres: [878] });
    const [top] = rankForGroup(
      [
        { name: 'A', profile: scifiFan },
        { name: 'B', profile: comedyFan },
      ],
      [onlyScifi, both],
    );
    expect(top.features.title).toBe('Both');
    expect(top.perPerson.map((p) => p.name)).toEqual(['A', 'B']);
  });

  it('matchPercent is monotonic and bounded', () => {
    expect(matchPercent(-1)).toBeGreaterThanOrEqual(0);
    expect(matchPercent(2)).toBeLessThanOrEqual(100);
    expect(matchPercent(0.6)).toBeGreaterThan(matchPercent(0.2));
  });
});

describe('parseDuration', () => {
  it.each([
    ['1h 40m', 100],
    ['1 hr 40 min', 100],
    ['100', 100],
    ['100m', 100],
    ['2h', 120],
    ['2.5 hours', 150],
    ['1:40', 100],
    ['2', 120],
    ['90 minutes', 90],
  ])('%s → %d', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it.each(['', 'abc', '0', '0h'])('rejects %j', (input) => {
    expect(parseDuration(input)).toBeNull();
  });

  it('formats runtimes', () => {
    expect(formatRuntime(100)).toBe('1h 40m');
    expect(formatRuntime(120)).toBe('2h');
    expect(formatRuntime(45)).toBe('45m');
    expect(formatRuntime(null)).toBe('—');
  });
});

describe('surprise', () => {
  it('caps random page at 500', () => {
    expect(randomPage(10000, () => 0.9999)).toBe(500);
    expect(randomPage(0, () => 0.5)).toBe(1);
  });
  it('never returns an excluded item', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    for (let i = 0; i < 20; i++) expect(pickUnseen(items, new Set([1, 2]))?.id).toBe(3);
    expect(pickUnseen(items, new Set([1, 2, 3]))).toBeNull();
  });
});

describe('librarySignals', () => {
  it('lets ratings override seen and not-interested override everything', () => {
    const s = librarySignals({
      watchlist: [{ id: 1, at: 1 }],
      seen: [
        { id: 2, at: 2 },
        { id: 3, at: 3 },
      ],
      ratings: [
        { id: 2, stars: 5, at: 4 },
        { id: 3, stars: 1, at: 5 },
      ],
      notInterested: [{ id: 1, at: 6 }],
      swipes: [],
    });
    const w = Object.fromEntries(s.map((x) => [x.id, x.weight]));
    expect(w[1]).toBe(-0.8);
    expect(w[2]).toBe(1.5);
    expect(w[3]).toBe(-1);
  });

  it('selectSeeds keeps the strongest positives and negatives', () => {
    const seeds = selectSeeds(
      [
        { id: 1, weight: 0.4, at: 1 },
        { id: 2, weight: 1.5, at: 1 },
        { id: 3, weight: -1, at: 1 },
      ],
      1,
      1,
    );
    expect(seeds.map((s) => s.id)).toEqual([2, 3]);
  });
});

describe('candidates', () => {
  const summary = (id: number): MovieSummary => ({
    id,
    title: `M${id}`,
    original_title: '',
    overview: '',
    poster_path: null,
    backdrop_path: null,
    release_date: '2020-01-01',
    vote_average: 7,
    vote_count: 100,
    popularity: 1,
    genre_ids: [],
    original_language: 'en',
  });

  it('counts hits and excludes seeds', () => {
    const pool = collectCandidates(
      [
        { list: [summary(1), summary(2)], counts: true },
        { list: [summary(2), summary(3)], counts: true },
        { list: [summary(4)], counts: false },
      ],
      new Set([3]),
    );
    expect([...pool.movies.keys()].sort()).toEqual([1, 2, 4]);
    expect(pool.hits).toEqual({ 1: 1, 2: 2 });
  });

  it('builds discover queries from the strongest profile signals', () => {
    const qs = profileDiscoverQueries(buildProfile([{ features: inception }]));
    expect(qs.some((q) => q.with_crew === String(NOLAN.id))).toBe(true);
    expect(qs.some((q) => q.with_genres)).toBe(true);
  });
});
