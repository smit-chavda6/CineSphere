'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Undo2 } from 'lucide-react';
import { fetchDiscover, fetchFeatures, fetchSeed } from '@/lib/recommend/pipeline';
import { featuresFromSummary, type MovieFeatures } from '@/lib/recommend/features';
import { buildProfile } from '@/lib/recommend/profile';
import { scoreAll } from '@/lib/recommend/score';
import { seriesKey, spreadFranchises } from '@/lib/recommend/diversify';
import { SIGNAL_WEIGHTS, type SwipeAction } from '@/lib/recommend/feed';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { GENRE_NAMES } from '@/config/genres';
import { useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';
import { blend } from '@/lib/focus';
import { Go, isTyping, useRoomActive } from '@/components/atlas/nav';
import { Pic, Room } from '@/components/ui/kit';
import { cn, yearOf } from '@/lib/utils';
import type { MovieSummary } from '@/types/tmdb';

const THRESHOLD = 110;
const LABELS: Record<SwipeAction, string> = {
  like: 'Liked',
  skip: 'Skipped',
  watch: 'Saved to watchlist',
  seen: 'Already seen',
};

export function Swipe() {
  const active = useRoomActive();
  const qc = useQueryClient();
  const recordSwipe = useLibrary((s) => s.recordSwipe);
  const undoSwipe = useLibrary((s) => s.undoSwipe);
  const [pool, setPool] = useState<MovieSummary[]>([]);
  const [history, setHistory] = useState<{ movie: MovieSummary; action: SwipeAction }[]>([]);
  const [features, setFeatures] = useState<Record<number, MovieFeatures>>({});
  const [announce, setAnnounce] = useState('');
  const [error, setError] = useState<string | null>(null);
  const page = useRef(Math.floor(Math.random() * 5) + 1);
  const known = useRef(new Set<number>());

  const addToPool = useCallback((movies: MovieSummary[]) => {
    const { seen, notInterested } = useLibrary.getState();
    const fresh = movies.filter(
      (m) => m.poster_path && !known.current.has(m.id) && !seen[m.id] && !notInterested[m.id],
    );
    fresh.forEach((m) => known.current.add(m.id));
    setPool((p) => [...p, ...fresh]);
  }, []);

  // Each refill draws worldwide and made-in-region films and blends them by the viewer's choice.
  const localPage = useRef(Math.floor(Math.random() * 3) + 1);
  const refill = useCallback(async () => {
    const { focus } = useUi.getState();
    const { region } = useLibrary.getState();
    try {
      const [world, local] = await Promise.all([
        focus === 'local'
          ? null
          : fetchDiscover(qc, {
              sort_by: 'popularity.desc',
              'vote_count.gte': '800',
              'vote_average.gte': '6.5',
              page: page.current++,
            }),
        focus === 'world'
          ? null
          : fetchDiscover(qc, {
              with_origin_country: region,
              sort_by: 'popularity.desc',
              'vote_count.gte': '80',
              'vote_average.gte': '6.3',
              page: localPage.current++,
            }).catch(() => null),
      ]);
      addToPool(blend(local?.results ?? [], world?.results ?? [], focus));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [qc, addToPool]);

  useEffect(() => {
    void refill();
    void refill();
  }, [refill]);

  const profile = useMemo(
    () =>
      buildProfile(
        history
          .map((h) => ({
            features: features[h.movie.id] ?? featuresFromSummary(h.movie),
            weight: SIGNAL_WEIGHTS.swipe[h.action],
          }))
          .filter((s) => s.weight !== 0),
      ),
    [history, features],
  );
  // Franchise key: TMDB collection id when we have the film's details, else a title fingerprint.
  const franchiseOf = useCallback(
    (m: MovieSummary) => {
      const c = features[m.id]?.collectionId;
      return c ? `c${c}` : seriesKey(m.title);
    },
    [features],
  );

  // Re-rank by taste after every swipe, then spread franchises out so one like
  // doesn't turn the deck into a run of sequels.
  const ordered = useMemo(() => {
    const ranked = history.length
      ? scoreAll(profile, pool.map(featuresFromSummary)).map(
          (s) => pool.find((p) => p.id === s.features.id)!,
        )
      : pool;
    return spreadFranchises(
      ranked,
      franchiseOf,
      history.slice(-8).map((h) => franchiseOf(h.movie)),
    );
  }, [pool, profile, history, franchiseOf]);

  // Prefetch details for the next few cards: faster swipes, and real collection ids for spreading.
  useEffect(() => {
    ordered.slice(0, 5).forEach((m) => {
      if (features[m.id]) return;
      fetchFeatures(qc, m.id)
        .then((f) => setFeatures((all) => (all[m.id] ? all : { ...all, [m.id]: f })))
        .catch(() => undefined);
    });
  }, [ordered, features, qc]);

  useEffect(() => {
    if (pool.length < 6) void refill();
  }, [pool.length, refill]);

  // Pin the visible card so background re-ranking never swaps it out from under you.
  const [pinned, setPinned] = useState<number | null>(null);
  useEffect(() => {
    if (!ordered.length) return;
    if (pinned === null || !pool.some((p) => p.id === pinned)) setPinned(ordered[0].id);
  }, [ordered, pinned, pool]);
  const deck = useMemo(() => {
    const top = pinned !== null ? ordered.find((m) => m.id === pinned) : undefined;
    return top ? [top, ...ordered.filter((m) => m.id !== pinned)] : ordered;
  }, [ordered, pinned]);

  const current = deck[0];
  const next = deck[1];

  const swipe = useCallback(
    async (action: SwipeAction) => {
      if (!current) return;
      recordSwipe(current, action);
      setHistory((h) => [...h, { movie: current, action }]);
      setPool((p) => p.filter((m) => m.id !== current.id));
      setPinned(null);
      setAnnounce(`${LABELS[action]}: ${current.title}`);
      try {
        const f = await fetchFeatures(qc, current.id);
        setFeatures((all) => ({ ...all, [current.id]: f }));
        if (action === 'like' || action === 'watch') {
          const seed = await fetchSeed(qc, current.id);
          addToPool([
            ...(seed.recommendations?.results ?? []).slice(0, 8),
            ...(seed.similar?.results ?? []).slice(0, 4),
          ]);
        }
      } catch {
        /* the deck still works on summary data */
      }
    },
    [current, recordSwipe, qc, addToPool],
  );

  const undo = useCallback(() => {
    const last = history.at(-1);
    if (!last) return;
    undoSwipe();
    setHistory((h) => h.slice(0, -1));
    setPool((p) => [last.movie, ...p.filter((m) => m.id !== last.movie.id)]);
    setPinned(last.movie.id);
    setAnnounce(`Undid: ${last.movie.title}`);
  }, [history, undoSwipe]);

  // Arrow keys only steer the deck while this island is the one on screen.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.shiftKey || e.altKey) return;
      const map: Record<string, SwipeAction> = {
        ArrowRight: 'like',
        ArrowLeft: 'skip',
        ArrowUp: 'watch',
        ArrowDown: 'seen',
      };
      if (map[e.key] && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        void swipe(map[e.key]);
      } else if ((e.key === 'z' && (e.ctrlKey || e.metaKey)) || e.key === 'Backspace') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, swipe, undo]);

  const likes = history.filter((h) => h.action === 'like' || h.action === 'watch').length;

  return (
    <Room
      mark="Swipe · a deck that learns"
      title="Yes or no?"
      lede="Right to like, left to skip, up to save, down if you have seen it. Every card re-ranks the deck."
    >
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr]">
        <div className="order-3 lg:order-1">
          <div className="grid max-w-xs grid-cols-2 gap-x-6">
            <div className="border-t-2 border-ink py-3">
              <p className="t-display text-6xl tabular-nums">{history.length}</p>
              <p className="t-mono mt-1 text-dim">Swiped</p>
            </div>
            <div className="border-t-2 border-accent py-3">
              <p className="t-display text-6xl tabular-nums text-accent">{likes}</p>
              <p className="t-mono mt-1 text-dim">Liked</p>
            </div>
          </div>
          <p className="t-place mt-4 max-w-xs text-xl leading-snug text-dim">
            {likes
              ? 'The deck is re-ranking itself around what you like.'
              : 'Every swipe teaches the deck your taste.'}
          </p>
          {current && (
            <Go
              href={`/movie/${current.id}`}
              className="t-mono mt-5 inline-block text-accent underline-offset-4 hover:underline"
            >
              Open this film first →
            </Go>
          )}
        </div>

        <div className="order-1 mx-auto w-[min(66vw,330px,31vh)] lg:order-2 lg:w-[min(78vw,330px)]">
          <div className="relative aspect-[2/3]">
            {error && !current && (
              <p className="t-place absolute inset-0 grid place-items-center text-center text-xl">
                {error}
              </p>
            )}
            {!current && !error && <div className="skeleton absolute inset-0" />}
            {next && (
              <div
                className="absolute inset-0 translate-x-3 translate-y-3 overflow-hidden rounded-[5px] border border-ink opacity-60"
                aria-hidden
              >
                <Pic path={next.poster_path} kind="poster" alt="" sizes="330px" />
              </div>
            )}
            <AnimatePresence>
              {current && <SwipeCard key={current.id} movie={current} onSwipe={swipe} />}
            </AnimatePresence>
          </div>
        </div>

        <div className="order-2 grid grid-cols-5 gap-1.5 sm:gap-2 lg:order-3 lg:grid-cols-1 lg:justify-self-end">
          <Action
            label="Skip"
            hint="←"
            onClick={() => swipe('skip')}
            icon={<ArrowLeft className="h-3.5 w-3.5" />}
          />
          <Action
            label="Like"
            hint="→"
            onClick={() => swipe('like')}
            icon={<ArrowRight className="h-3.5 w-3.5" />}
            accent
          />
          <Action
            label="Watchlist"
            hint="↑"
            onClick={() => swipe('watch')}
            icon={<ArrowUp className="h-3.5 w-3.5" />}
          />
          <Action
            label="Seen it"
            hint="↓"
            onClick={() => swipe('seen')}
            icon={<ArrowDown className="h-3.5 w-3.5" />}
          />
          <Action
            label="Undo"
            hint="⌫"
            onClick={undo}
            icon={<Undo2 className="h-3.5 w-3.5" />}
            disabled={!history.length}
          />
        </div>
        <p aria-live="polite" className="sr-only">
          {announce}
        </p>
      </div>
    </Room>
  );
}

function Action({
  label,
  hint,
  onClick,
  icon,
  accent,
  disabled,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  icon: ReactNode;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label} (${hint})`}
      className={cn(accent ? 'btn-solid' : 'btn', '!px-2 sm:!justify-between sm:!px-4 lg:w-48')}
    >
      <span className="flex items-center gap-2">
        {icon} <span className="hidden sm:inline">{label}</span>
      </span>
      <kbd className="hidden opacity-60 sm:inline">{hint}</kbd>
    </button>
  );
}

function SwipeCard({ movie, onSwipe }: { movie: MovieSummary; onSwipe: (a: SwipeAction) => void }) {
  const reduced = usePrefersReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const like = useTransform(x, [20, THRESHOLD], [0, 1]);
  const nope = useTransform(x, [-THRESHOLD, -20], [1, 0]);
  const [exit, setExit] = useState({ x: 0, y: 0 });
  const year = yearOf(movie.release_date);

  const fling = (a: SwipeAction, ex: number, ey: number) => {
    setExit({ x: ex, y: ey });
    onSwipe(a);
  };
  const onDragEnd = (_: unknown, { offset, velocity }: PanInfo) => {
    const dx = offset.x + velocity.x * 0.1;
    const dy = offset.y + velocity.y * 0.1;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > THRESHOLD) fling('like', 600, 0);
      else if (dx < -THRESHOLD) fling('skip', -600, 0);
    } else if (dy < -THRESHOLD) fling('watch', 0, -700);
    else if (dy > THRESHOLD) fling('seen', 0, 700);
  };

  return (
    <motion.div
      data-theme="night"
      className="absolute inset-0 cursor-grab touch-none overflow-hidden rounded-[5px] border border-black bg-paper text-ink shadow-[5px_5px_0_rgb(0_0_0/0.85)] active:cursor-grabbing"
      style={{ x, y, rotate }}
      drag
      dragSnapToOrigin
      dragElastic={0.7}
      onDragEnd={onDragEnd}
      initial={reduced ? false : { scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={
        reduced
          ? { opacity: 0 }
          : { x: exit.x || 500, y: exit.y, opacity: 0, transition: { duration: 0.35 } }
      }
      role="group"
      aria-roledescription="swipe card"
      aria-label={`${movie.title} (${year ?? 'TBA'})`}
    >
      <Pic
        path={movie.poster_path}
        kind="poster"
        alt={`Poster of ${movie.title} (${year ?? 'TBA'})`}
        sizes="330px"
        priority
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-paper via-paper/75 to-transparent p-4 pt-20">
        <p className="font-mono text-[10.5px] uppercase tracking-wider text-ink/75">
          {year} · ★ {movie.vote_average.toFixed(1)} ·{' '}
          {movie.genre_ids
            .slice(0, 2)
            .map((g) => GENRE_NAMES[g])
            .filter(Boolean)
            .join(' / ')}
        </p>
        <h2 className="t-display mt-1.5 text-3xl">{movie.title}</h2>
        <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-ink/80">{movie.overview}</p>
      </div>
      <motion.span
        style={{ opacity: like }}
        className="t-display absolute left-4 top-4 -rotate-12 border-4 border-accent px-2 py-1 text-4xl text-accent"
      >
        Yes
      </motion.span>
      <motion.span
        style={{ opacity: nope }}
        className="t-display absolute right-4 top-4 rotate-12 border-4 border-ink px-2 py-1 text-4xl text-ink"
      >
        Nope
      </motion.span>
    </motion.div>
  );
}
