import { describe, expect, it } from 'vitest';
import {
  addToProfile,
  buildProfile,
  emptyProfile,
  normalizeProfile,
  topIds,
  topLanguage,
} from '../profile';
import { NOLAN, inception, interstellar, movie } from './fixtures';

describe('buildProfile', () => {
  it('accumulates genre, director and decade weights across seeds', () => {
    const p = buildProfile([{ features: inception }, { features: interstellar }]);
    expect(p.genres[878]).toBe(2);
    expect(p.genres[28]).toBe(1);
    expect(p.directors[NOLAN.id].w).toBe(2);
    expect(p.directors[NOLAN.id].from).toEqual(['Inception', 'Interstellar']);
    expect(p.decades[2010]).toBe(2);
    expect(p.seedIds).toEqual([inception.id, interstellar.id]);
  });

  it('applies negative weights without recording them as sources', () => {
    const p = buildProfile([{ features: inception, weight: -1 }]);
    expect(p.genres[878]).toBe(-1);
    expect(p.directors[NOLAN.id].from).toEqual([]);
    expect(p.seedIds).toEqual([]);
  });

  it('weights top-billed cast more than lower-billed cast', () => {
    const m = movie({
      cast: [
        { id: 1, name: 'Lead' },
        { id: 2, name: 'Second' },
      ],
    });
    const p = addToProfile(emptyProfile(), m, 1);
    expect(p.cast[1].w).toBeGreaterThan(p.cast[2].w);
  });

  it('does not mutate the input profile', () => {
    const base = emptyProfile();
    addToProfile(base, inception, 1);
    expect(base.genres).toEqual({});
  });
});

describe('normalizeProfile', () => {
  it('scales each dimension so the strongest signal is 1', () => {
    const p = normalizeProfile(buildProfile([{ features: inception }, { features: interstellar }]));
    expect(p.genres[878]).toBe(1);
    expect(p.genres[28]).toBe(0.5);
    expect(p.directors[NOLAN.id].w).toBe(1);
  });
});

describe('helpers', () => {
  it('topIds returns positive ids by weight', () => {
    expect(topIds({ 1: 3, 2: -5, 3: 1 }, 5)).toEqual([1, 3]);
  });
  it('topLanguage reports share of the dominant language', () => {
    const p = buildProfile([
      { features: movie({ language: 'hi' }) },
      { features: movie({ language: 'hi' }) },
      { features: movie({ language: 'en' }) },
    ]);
    expect(topLanguage(p)).toEqual({ code: 'hi', share: 2 / 3 });
  });
});
