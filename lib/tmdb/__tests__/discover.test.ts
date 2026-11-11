import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  activeChips,
  decodeEntities,
  encodeEntities,
  filtersFromSearchParams,
  filtersToSearchParams,
  filtersToTmdbParams,
  type DiscoverFilters,
} from '../discover';

const today = new Date('2026-11-08T12:00:00');
const f = (over: Partial<DiscoverFilters>): DiscoverFilters => ({ ...DEFAULT_FILTERS, ...over });

describe('URL round-trip', () => {
  it('serialises only non-default values', () => {
    expect(filtersToSearchParams(DEFAULT_FILTERS).toString()).toBe('');
  });

  it('round-trips a complex filter set', () => {
    const filters = f({
      genres: [28, 878],
      genreMode: 'and',
      excludeGenres: [27],
      yearFrom: 1990,
      yearTo: 1999,
      ratingMin: 7,
      minVotes: 500,
      language: 'hi',
      cast: [{ id: 6193, name: 'Leonardo DiCaprio' }],
      keywords: [{ id: 4379, name: 'time travel' }],
      monetization: ['flatrate', 'free'],
      status: 'released',
      sort: 'rating',
      hideSeen: true,
    });
    const back = filtersFromSearchParams(filtersToSearchParams(filters), today);
    expect(back).toEqual(filters);
  });

  it('ignores junk values', () => {
    const back = filtersFromSearchParams(
      new URLSearchParams('g=abc,28&sort=nope&lang=HINDI&yf=1700&mon=crypto'),
      today,
    );
    expect(back.genres).toEqual([28]);
    expect(back.sort).toBe('popularity');
    expect(back.language).toBeNull();
    expect(back.yearFrom).toBe(1900);
    expect(back.monetization).toEqual([]);
  });

  it('entity encoding survives colons and pipes in names', () => {
    const list = [{ id: 1, name: 'Mission: Impossible|Fallout' }];
    expect(decodeEntities(encodeEntities(list))).toEqual([
      { id: 1, name: 'Mission: Impossible/Fallout' },
    ]);
  });
});

describe('filtersToTmdbParams', () => {
  it('uses AND/OR separators for genres', () => {
    expect(filtersToTmdbParams(f({ genres: [28, 12] }), { region: 'IN', today }).with_genres).toBe(
      '28|12',
    );
    expect(
      filtersToTmdbParams(f({ genres: [28, 12], genreMode: 'and' }), { region: 'IN', today })
        .with_genres,
    ).toBe('28,12');
  });

  it('maps years and clamps "released" to today', () => {
    const p = filtersToTmdbParams(f({ yearFrom: 2020, yearTo: 2028, status: 'released' }), {
      region: 'IN',
      today,
    });
    expect(p['primary_release_date.gte']).toBe('2020-01-01');
    expect(p['primary_release_date.lte']).toBe('2026-11-08');
  });

  it('drops the vote floor for upcoming films', () => {
    const p = filtersToTmdbParams(f({ status: 'upcoming' }), { region: 'IN', today });
    expect(p['vote_count.gte']).toBeUndefined();
    expect(p['primary_release_date.gte']).toBe('2026-11-09');
  });

  it('adds watch region for providers and certification country for certs', () => {
    const p = filtersToTmdbParams(
      f({
        providers: [{ id: 8, name: 'Netflix' }],
        monetization: ['flatrate'],
        certification: 'UA 13+',
      }),
      { region: 'IN', today },
    );
    expect(p.watch_region).toBe('IN');
    expect(p.with_watch_providers).toBe('8');
    expect(p.with_watch_monetization_types).toBe('flatrate');
    expect(p.certification_country).toBe('IN');
    expect(p.certification).toBe('UA 13+');
  });

  it('never includes adult content', () => {
    expect(filtersToTmdbParams(DEFAULT_FILTERS, { region: 'IN', today }).include_adult).toBe(
      'false',
    );
  });
});

describe('activeChips', () => {
  it('produces removable chips', () => {
    const filters = f({ genres: [28], language: 'ta' });
    const chips = activeChips(filters, { genre: () => 'Action', language: () => 'Tamil' });
    expect(chips.map((c) => c.label)).toEqual(['Action', 'Tamil']);
    expect(chips[0].remove(filters).genres).toEqual([]);
  });
});
