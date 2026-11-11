'use client';

import { useRef, useState } from 'react';
import { useFocus } from '@/lib/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Loader2 } from 'lucide-react';
import { fetchSeed, recommend } from '@/lib/recommend/pipeline';
import { featuresFromDetails } from '@/lib/recommend/features';
import { buildProfile } from '@/lib/recommend/profile';
import { excludedIds, useLibrary } from '@/store/library';
import { ErrorNote, GridSkeleton, Room } from '@/components/ui/kit';
import { MoviePicker, ScoredGrid, featureToCard, type PickedMovie } from '@/components/ui/Poster';

export function Blender() {
  const qc = useQueryClient();
  const [picks, setPicks] = useState<PickedMovie[]>([]);
  const local = useRef(useFocus());
  local.current = useFocus();
  const run = useMutation({
    mutationFn: async (selected: PickedMovie[]) => {
      const seeds = await Promise.all(selected.map((p) => fetchSeed(qc, p.id)));
      const profile = buildProfile(seeds.map((s) => ({ features: featuresFromDetails(s) })));
      const exclude = excludedIds(useLibrary.getState());
      selected.forEach((p) => exclude.add(p.id));
      const { region, focus } = local.current;
      return recommend(qc, { profile, seeds, exclude, limit: 30, local: { region, focus } });
    },
  });

  return (
    <Room
      mark="Blender · because you liked…"
      title="Blend your taste"
      lede="Name three to ten films you love — or pour in the ones in your pocket — and get what sits between them."
    >
      <div className="max-w-4xl">
        <MoviePicker value={picks} onChange={setPicks} max={10} label="Type a film you love…" />
        <button
          type="button"
          className="btn-solid mt-6"
          disabled={picks.length < 3 || run.isPending}
          onClick={() => run.mutate(picks)}
        >
          {run.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          )}
          {picks.length < 3 ? `Pick ${3 - picks.length} more` : 'Blend my taste'}
        </button>
      </div>
      <div className="mt-12" aria-live="polite">
        {run.isPending && (
          <>
            <p className="t-place mb-6 animate-pulse text-xl text-dim">
              Blending — reading genres, themes, directors and cast…
            </p>
            <GridSkeleton count={10} />
          </>
        )}
        {run.isError && <ErrorNote error={run.error} onRetry={() => run.mutate(picks)} />}
        {run.data && !run.isPending && (
          <>
            <div className="mb-5 flex flex-wrap items-baseline gap-3">
              <h2 className="t-display text-4xl">Your blend</h2>
              <span className="t-place text-lg text-dim">
                because you liked {picks[0]?.title}
                {picks.length > 1 ? ` & ${picks.length - 1} more` : ''}
              </span>
            </div>
            <ScoredGrid
              items={run.data.map((s) => ({
                movie: featureToCard(s.features),
                reasons: s.reasons,
              }))}
            />
          </>
        )}
      </div>
    </Room>
  );
}
