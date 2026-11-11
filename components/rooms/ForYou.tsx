'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useLibrary } from '@/store/library';
import { useFocus } from '@/lib/hooks';
import { librarySignals, selectSeeds } from '@/lib/recommend/feed';
import { fetchFeatures, fetchSeed, recommend } from '@/lib/recommend/pipeline';
import { featuresFromDetails } from '@/lib/recommend/features';
import { buildProfile } from '@/lib/recommend/profile';
import { Go } from '@/components/atlas/nav';
import { EmptyNote, ErrorNote, GridSkeleton, Room } from '@/components/ui/kit';
import { ScoredGrid, featureToCard } from '@/components/ui/Poster';
import type { MovieDetails } from '@/types/tmdb';

export function ForYou() {
  const qc = useQueryClient();
  const lib = useLibrary();
  const { region, focus } = useFocus();
  const [round, setRound] = useState(0);
  const shown = useRef(new Set<number>());

  const signals = useMemo(
    () =>
      librarySignals({
        watchlist: Object.entries(lib.watchlist).map(([id, v]) => ({
          id: Number(id),
          at: v.addedAt,
        })),
        seen: Object.entries(lib.seen).map(([id, v]) => ({ id: Number(id), at: v.at })),
        ratings: Object.entries(lib.ratings).map(([id, v]) => ({
          id: Number(id),
          stars: v.stars,
          at: v.at,
        })),
        notInterested: Object.entries(lib.notInterested).map(([id, v]) => ({
          id: Number(id),
          at: v.at,
        })),
        swipes: lib.swipes,
      }),
    [lib.watchlist, lib.seen, lib.ratings, lib.notInterested, lib.swipes],
  );
  const seeds = useMemo(() => selectSeeds(signals), [signals]);
  const signature = seeds.map((s) => `${s.id}:${s.weight.toFixed(2)}`).join(',');
  const positives = seeds.filter((s) => s.weight > 0);
  const negatives = seeds.filter((s) => s.weight < 0);

  const q = useQuery({
    queryKey: ['for-you', signature, round, region, focus],
    enabled: lib.hydrated && positives.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const seedDetails = (
        await Promise.all(positives.map((s) => fetchSeed(qc, s.id).catch(() => null)))
      ).filter((d): d is MovieDetails => d !== null);
      const neg = (
        await Promise.all(negatives.map((s) => fetchFeatures(qc, s.id).catch(() => null)))
      ).filter((f): f is NonNullable<typeof f> => f !== null);
      const w = new Map(seeds.map((s) => [s.id, s.weight]));
      const profile = buildProfile([
        ...seedDetails.map((d) => ({ features: featuresFromDetails(d), weight: w.get(d.id) ?? 1 })),
        ...neg.map((f) => ({ features: f, weight: w.get(f.id) ?? -0.5 })),
      ]);
      const exclude = new Set<number>([
        ...signals.map((s) => s.id),
        ...Object.keys(lib.watchlist).map(Number),
        ...shown.current,
      ]);
      const results = await recommend(qc, {
        profile,
        seeds: seedDetails,
        exclude,
        limit: 30,
        local: { region, focus },
      });
      results.forEach((r) => shown.current.add(r.features.id));
      return results;
    },
  });

  return (
    <Room
      mark="For You · built from your taste"
      title="Your feed"
      lede={
        positives.length
          ? `Read from ${positives.length} films you like${negatives.length ? ` and ${negatives.length} you didn’t` : ''}. 4–5★ pull it closer; 1–2★ push it away.`
          : 'Watchlist, seen list, star ratings and swipes all teach it.'
      }
      actions={
        positives.length > 0 && (
          <button
            type="button"
            className="btn"
            onClick={() => setRound((r) => r + 1)}
            disabled={q.isFetching}
          >
            <RefreshCw
              className={q.isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
              aria-hidden
            />{' '}
            Fresh picks
          </button>
        )
      }
    >
      {!lib.hydrated ? (
        <GridSkeleton />
      ) : !positives.length ? (
        <EmptyNote title="Teach it your taste">
          Add a few films to your watchlist, rate ones you’ve seen, or spend two minutes on{' '}
          <Go className="text-accent underline underline-offset-4" href="/recommend/swipe">
            Swipe island
          </Go>
          . This feed builds itself from those signals.
        </EmptyNote>
      ) : q.isLoading ? (
        <GridSkeleton count={10} />
      ) : q.isError ? (
        <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyNote title="Out of fresh picks">
          Ask for fresh picks again, or add more signals to your shelf.
        </EmptyNote>
      ) : (
        <ScoredGrid
          items={q.data.map((s) => ({ movie: featureToCard(s.features), reasons: s.reasons }))}
        />
      )}
    </Room>
  );
}
