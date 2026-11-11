'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Check, Dice5, Plus, SlidersHorizontal } from 'lucide-react';
import { filtersFromSearchParams, filtersToTmdbParams } from '@/lib/tmdb/discover';
import { fetchDiscover } from '@/lib/recommend/pipeline';
import { pickUnseen, randomPage } from '@/lib/recommend/surprise';
import { GENRE_NAMES } from '@/config/genres';
import { useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';
import { useSession } from '@/store/session';
import { Go } from '@/components/atlas/nav';
import { ErrorNote, Pic, Room } from '@/components/ui/kit';
import { cn, yearOf } from '@/lib/utils';
import type { MovieSummary } from '@/types/tmdb';

const PATH = '/recommend/surprise';

export function Dice() {
  const qc = useQueryClient();
  const pathname = usePathname();
  const sp = useSearchParams();
  // Filters arrive in the query string (from the Archive); remember them while a film is open on top.
  const live = pathname === PATH ? (sp?.toString() ?? '') : null;
  const [spString, setSpString] = useState(live ?? '');
  useEffect(() => {
    if (live !== null) setSpString(live);
  }, [live]);

  const region = useLibrary((s) => s.region);
  const toggleWatchlist = useLibrary((s) => s.toggleWatchlist);
  const watchlist = useLibrary((s) => s.watchlist);
  const markSurprise = useSession((s) => s.markSurprise);

  // Each roll is its own query (keyed by a counter), so it survives React's development double-mount.
  const [rollId, setRollId] = useState(0);
  const focus = useUi((s) => s.focus);

  const params = useMemo(() => {
    const p: Record<string, string> = filtersToTmdbParams(
      filtersFromSearchParams(new URLSearchParams(spString)),
      { region },
    );
    if (spString) return p;
    Object.assign(p, { 'vote_average.gte': '6.8', 'vote_count.gte': '500' });
    // With no filters set, roll films from the viewer's region: always, or three rolls in four.
    const local = focus === 'local' || (focus === 'mostly' && rollId % 4 !== 3);
    if (local) Object.assign(p, { with_origin_country: region, 'vote_count.gte': '60' });
    return p;
  }, [spString, region, focus, rollId]);
  const roll = useQuery({
    queryKey: ['surprise', params, rollId],
    staleTime: Infinity,
    gcTime: 60_000,
    retry: 1,
    queryFn: async (): Promise<MovieSummary | null> => {
      const { seen, notInterested } = useLibrary.getState();
      const exclude = new Set<number>([
        ...useSession.getState().surpriseShown,
        ...Object.keys(seen).map(Number),
        ...Object.keys(notInterested).map(Number),
      ]);
      const first = await fetchDiscover(qc, params);
      if (!first.total_results) return null;
      for (let i = 0; i < 6; i++) {
        const page = randomPage(first.total_pages);
        const data = page === 1 ? first : await fetchDiscover(qc, { ...params, page });
        const pick = pickUnseen(data.results, exclude);
        if (pick) {
          markSurprise(pick.id);
          return pick;
        }
      }
      return null;
    },
  });
  const rollAgain = () => setRollId((n) => n + 1);
  const busy = roll.isFetching;
  const m = roll.data;
  const year = m ? yearOf(m.release_date) : null;
  const saved = m ? Boolean(watchlist[m.id]) : false;

  return (
    <Room
      mark="Dice · let fate pick"
      title="Tonight you watch…"
      lede={
        spString
          ? 'One random film from the filters you set in the Archive.'
          : 'One random, well-liked film. Never the same one twice in a session.'
      }
      actions={
        <>
          <button type="button" className="btn-solid" onClick={rollAgain} disabled={busy}>
            <Dice5 className={cn('h-4 w-4', busy && 'animate-spin')} aria-hidden />{' '}
            {m ? 'Roll again' : 'Roll'}
          </button>
          <Go href={`/discover${spString ? `?${spString}` : ''}`} className="btn">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />{' '}
            {spString ? 'Change filters' : 'Narrow it down'}
          </Go>
        </>
      }
    >
      {roll.isError && <ErrorNote error={roll.error} onRetry={rollAgain} />}
      {roll.isSuccess && !m && (
        <ErrorNote message="You’ve seen every surprise these filters hold this session. Loosen the filters for more." />
      )}

      <div aria-live="polite">
        <AnimatePresence mode="wait">
          {m && (
            <motion.article
              key={m.id}
              data-theme="night"
              initial={{ opacity: 0, rotateX: -70, y: 30 }}
              animate={{ opacity: 1, rotateX: 0, y: 0 }}
              exit={{ opacity: 0, rotateX: 60, y: -20 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformPerspective: 1400, transformOrigin: '50% 100%' }}
              className="relative overflow-hidden rounded-[6px] border border-black bg-paper text-ink shadow-[6px_6px_0_rgb(0_0_0/0.85)]"
            >
              <div className="absolute inset-0">
                <Pic
                  path={m.backdrop_path}
                  kind="backdrop"
                  alt=""
                  sizes="100vw"
                  className="opacity-50"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/75 to-paper/10" />
              </div>
              <div className="relative grid min-h-[min(58vh,560px)] items-end gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_240px]">
                <div>
                  <p className="t-mono text-accent">
                    {year ?? 'TBA'} · ★ {m.vote_average.toFixed(1)} ·{' '}
                    {m.genre_ids
                      .map((g) => GENRE_NAMES[g])
                      .filter(Boolean)
                      .slice(0, 3)
                      .join(' / ')}
                  </p>
                  <h2 className="t-display mt-4 max-w-[14ch] text-balance text-[clamp(2.6rem,7vw,6.5rem)]">
                    {m.title}
                  </h2>
                  <p className="mt-5 line-clamp-4 max-w-2xl text-[16px] leading-relaxed text-ink/85">
                    {m.overview || 'No synopsis yet.'}
                  </p>
                  <div className="mt-7 flex flex-wrap gap-2.5">
                    <Go href={`/movie/${m.id}`} className="btn-solid">
                      Open the film <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </Go>
                    <button
                      type="button"
                      className={cn('btn', saved && 'btn-on')}
                      aria-pressed={saved}
                      onClick={() => toggleWatchlist(m)}
                    >
                      {saved ? (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {saved ? 'On your watchlist' : 'Add to watchlist'}
                    </button>
                  </div>
                </div>
                <div className="relative hidden aspect-[2/3] overflow-hidden rounded-[3px] border border-ink/40 lg:block">
                  <Pic
                    path={m.poster_path}
                    kind="poster"
                    alt={`Poster of ${m.title} (${year ?? 'TBA'})`}
                    sizes="240px"
                    priority
                    title={m.title}
                  />
                </div>
              </div>
            </motion.article>
          )}
        </AnimatePresence>
        {busy && !m && <div className="skeleton h-[min(58vh,560px)]" />}
      </div>
    </Room>
  );
}
