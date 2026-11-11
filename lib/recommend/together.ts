import type { MovieFeatures } from './features';
import { normalizeProfile, type TasteProfile } from './profile';
import { scoreNormalized, type ScoreOptions } from './score';

export interface GroupMember {
  name: string;
  profile: TasteProfile;
}

export interface GroupResult {
  features: MovieFeatures;
  combined: number;
  perPerson: { name: string; percent: number }[];
  reasons: string[];
}

/** Maps a raw score (typically −0.3…0.9) onto a friendly 0–100 match percentage. */
export function matchPercent(score: number): number {
  return Math.round(100 / (1 + Math.exp(-(score - 0.32) * 7)));
}

/**
 * Ranks candidates for a group. The combined score blends the average with the
 * least-happy member ("least misery"), so one person's favourite cannot win if
 * someone else would hate it. Candidates everyone rates ≥ `floor`% are preferred.
 */
export function rankForGroup(
  members: GroupMember[],
  candidates: MovieFeatures[],
  { floor = 40, limit = 30, ...opts }: ScoreOptions & { floor?: number; limit?: number } = {},
): GroupResult[] {
  if (!members.length) return [];
  const profiles = members.map((m) => normalizeProfile(m.profile));
  const results = candidates.map((c) => {
    const scored = profiles.map((p) => scoreNormalized(p, c, opts));
    const scores = scored.map((s) => s.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const reasons = Array.from(new Set(scored.flatMap((s) => s.reasons))).slice(0, 3);
    return {
      features: c,
      combined: 0.5 * mean + 0.5 * min,
      perPerson: members.map((m, i) => ({ name: m.name, percent: matchPercent(scores[i]) })),
      reasons,
    };
  });
  const everyoneHappy = (r: GroupResult) => r.perPerson.every((p) => p.percent >= floor);
  return results
    .sort((a, b) => Number(everyoneHappy(b)) - Number(everyoneHappy(a)) || b.combined - a.combined)
    .slice(0, limit);
}
