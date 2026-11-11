'use client';

import { useRef, useState } from 'react';
import { useFocus } from '@/lib/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Users, X } from 'lucide-react';
import { fetchFeatures, fetchSeed, gatherCandidates } from '@/lib/recommend/pipeline';
import { featuresFromDetails, featuresFromSummary } from '@/lib/recommend/features';
import { buildProfile } from '@/lib/recommend/profile';
import { scoreAll } from '@/lib/recommend/score';
import { rankForGroup } from '@/lib/recommend/together';
import { excludedIds, useLibrary } from '@/store/library';
import { ErrorNote, GridSkeleton, Room } from '@/components/ui/kit';
import { MoviePicker, ScoredGrid, featureToCard, type PickedMovie } from '@/components/ui/Poster';
import { mapLimit } from '@/lib/utils';

interface Person {
  name: string;
  picks: PickedMovie[];
}
const MIN = 3;

export function Together() {
  const qc = useQueryClient();
  const [people, setPeople] = useState<Person[]>([
    { name: 'Person 1', picks: [] },
    { name: 'Person 2', picks: [] },
  ]);
  const local = useRef(useFocus());
  local.current = useFocus();
  const ready = people.length >= 2 && people.every((p) => p.picks.length >= MIN && p.name.trim());

  const run = useMutation({
    mutationFn: async (group: Person[]) => {
      const seedsPer = await Promise.all(
        group.map((p) => Promise.all(p.picks.map((m) => fetchSeed(qc, m.id)))),
      );
      const members = group.map((p, i) => ({
        name: p.name.trim(),
        profile: buildProfile(seedsPer[i].map((s) => ({ features: featuresFromDetails(s) }))),
      }));
      const all = seedsPer.flat();
      const combined = buildProfile(all.map((s) => ({ features: featuresFromDetails(s) })));
      const exclude = excludedIds(useLibrary.getState());
      all.forEach((s) => exclude.add(s.id));
      const { region, focus } = local.current;
      const found = await gatherCandidates(qc, {
        profile: combined,
        seeds: all,
        exclude,
        local: { region, focus },
      });
      const { hits } = found;
      const movies =
        focus === 'local'
          ? found.movies.filter((m) => found.isLocal(m.id, m.original_language))
          : found.movies;
      const prelim = scoreAll(combined, movies.map(featuresFromSummary), {
        sourceHits: hits,
      }).slice(0, 36);
      const enriched = await mapLimit(prelim, 12, (s) => fetchFeatures(qc, s.features.id));
      return rankForGroup(
        members,
        prelim.map((s, i) => enriched[i] ?? s.features),
        { sourceHits: hits, limit: 30 },
      );
    },
  });
  const update = (i: number, patch: Partial<Person>) =>
    setPeople((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <Room
      mark="Together · one film, everyone happy"
      title="Find common ground"
      lede="Two to six people, at least three favourites each. The film that wins is the one nobody would hate."
    >
      <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
        {people.map((p, i) => (
          <fieldset key={i} className="panel min-w-0 p-5">
            <legend className="sr-only">Person {i + 1}</legend>
            <div className="mb-4 flex items-center gap-3">
              <span className="t-mono text-accent">{String(i + 1).padStart(2, '0')}</span>
              <label className="min-w-0 flex-1">
                <span className="sr-only">Name of person {i + 1}</span>
                <input
                  className="t-display w-full bg-transparent text-3xl text-ink focus:text-accent focus:outline-none"
                  value={p.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  maxLength={18}
                />
              </label>
              {people.length > 2 && (
                <button
                  type="button"
                  className="icon-btn h-8 w-8"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => setPeople((ps) => ps.filter((_, j) => j !== i))}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <MoviePicker
              value={p.picks}
              onChange={(picks) => update(i, { picks })}
              max={8}
              label={`${p.name || 'Their'}’s favourites…`}
            />
          </fieldset>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {people.length < 6 && (
          <button
            type="button"
            className="btn"
            onClick={() =>
              setPeople((ps) => [...ps, { name: `Person ${ps.length + 1}`, picks: [] }])
            }
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add a person
          </button>
        )}
        <button
          type="button"
          className="btn-solid"
          disabled={!ready || run.isPending}
          onClick={() => run.mutate(people)}
        >
          {run.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Users className="h-3.5 w-3.5" aria-hidden />
          )}{' '}
          Find our film
        </button>
        {!ready && <p className="text-sm text-dim">Everyone needs at least {MIN} picks.</p>}
      </div>
      <div className="mt-12" aria-live="polite">
        {run.isPending && (
          <>
            <p className="t-place mb-6 animate-pulse text-xl text-dim">
              Reading everyone’s taste and finding common ground — a few seconds…
            </p>
            <GridSkeleton count={10} />
          </>
        )}
        {run.isError && <ErrorNote error={run.error} onRetry={() => run.mutate(people)} />}
        {run.data && !run.isPending && (
          <>
            <div className="mb-5 flex flex-wrap items-baseline gap-3">
              <h2 className="t-display text-4xl">Common ground</h2>
              <span className="t-place text-lg text-dim">films you’ll all enjoy</span>
            </div>
            <ScoredGrid
              items={run.data.map((r) => ({
                movie: featureToCard(r.features),
                reasons: r.reasons,
                perPerson: r.perPerson,
              }))}
              allowDismiss={false}
            />
          </>
        )}
      </div>
    </Room>
  );
}
