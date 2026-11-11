'use client';

import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  AnimatePresence,
  animate,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
} from 'framer-motion';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { SITE } from '@/config/site';
import { useUi } from '@/store/ui';
import { EdgePeeks, KeysHelp, Legend, Navigator, TopBar } from './Chrome';
import { Shore, shoreGeometry } from './Shore';
import { RoomActive, go, isTyping, parseRoute, trackPointer } from './nav';
import { Spyglass } from './Spyglass';
import { ISLAND, STATION, chartLayout, type Direction, type StationId } from './stations';
import { World } from './World';

const loading = () => (
  <div className="absolute inset-0 grid place-items-center">
    <span className="t-mono animate-pulse text-dim">Dropping anchor…</span>
  </div>
);

/** Each place is its own chunk, loaded the first time you land there. */
const ROOMS: Record<StationId, ComponentType> = {
  tonight: dynamic(() => import('@/components/rooms/Tonight').then((m) => m.Tonight), { loading }),
  moods: dynamic(() => import('@/components/rooms/Moods').then((m) => m.Moods), { loading }),
  archive: dynamic(() => import('@/components/rooms/Archive').then((m) => m.Archive), { loading }),
  timefit: dynamic(() => import('@/components/rooms/Archive').then((m) => m.TimeFit), { loading }),
  foryou: dynamic(() => import('@/components/rooms/ForYou').then((m) => m.ForYou), { loading }),
  blender: dynamic(() => import('@/components/rooms/Blender').then((m) => m.Blender), { loading }),
  swipe: dynamic(() => import('@/components/rooms/Swipe').then((m) => m.Swipe), { loading }),
  together: dynamic(() => import('@/components/rooms/Together').then((m) => m.Together), {
    loading,
  }),
  gems: dynamic(() => import('@/components/rooms/Gems').then((m) => m.Gems), { loading }),
  decades: dynamic(() => import('@/components/rooms/TimeMachine').then((m) => m.TimeMachine), {
    loading,
  }),
  dice: dynamic(() => import('@/components/rooms/Dice').then((m) => m.Dice), { loading }),
  marathon: dynamic(() => import('@/components/rooms/Marathon').then((m) => m.Marathon), {
    loading,
  }),
  calendar: dynamic(() => import('@/components/rooms/Calendar').then((m) => m.Calendar), {
    loading,
  }),
  shelf: dynamic(() => import('@/components/rooms/Shelf').then((m) => m.Shelf), { loading }),
};

const Capsule = dynamic(() => import('@/components/capsule/Capsule').then((m) => m.Capsule));

export interface TrailStop {
  href: string;
  label: string;
}

function useViewport() {
  const [vp, setVp] = useState({ w: 1440, h: 900, ready: false });
  useEffect(() => {
    const read = () => setVp({ w: window.innerWidth, h: window.innerHeight, ready: true });
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return vp;
}

const EASE = [0.65, 0, 0.35, 1] as const;

/**
 * The shell. One fixed stage holding a chart of places; a camera flies between
 * them, the place you land on fades in over its island, and films open on top
 * like an iris. Nothing here ever unloads: the URL changes, the stage stays.
 */
export function Atlas() {
  const pathname = usePathname() ?? '/';
  const params = useSearchParams();
  const qs = params?.toString() ?? '';
  const route = useMemo(() => parseRoute(pathname), [pathname]);
  const reduced = usePrefersReducedMotion();
  const vp = useViewport();
  const searchOpen = useUi((s) => s.searchOpen);

  const tall = vp.w < 760 || vp.w < vp.h * 0.8;
  const map = useMemo(() => chartLayout(tall), [tall]);

  /* ---------- where we are ---------- */
  const [station, setStation] = useState<StationId>(route.station ?? 'tonight');
  const [visited, setVisited] = useState<StationId[]>([route.station ?? 'tonight']);
  /** Full URL of the place underneath, so closing a film returns to it with its filters intact. */
  const stationHref = useRef(route.station ? pathname + (qs ? `?${qs}` : '') : '/');
  const overview = route.overview;
  const entity = route.entity;

  useEffect(() => {
    const id = route.station;
    if (!id) return;
    stationHref.current = pathname + (qs ? `?${qs}` : '');
    setStation(id);
    setVisited((v) => (v.includes(id) ? v : [...v, id]));
  }, [route.station, pathname, qs]);

  useEffect(() => {
    if (route.search) useUi.getState().openSearch(new URLSearchParams(qs).get('q') ?? '');
  }, [route.search, qs]);

  /* ---------- the trail of films / people opened in this dive ---------- */
  const entityHref = entity ? `/${entity.kind}/${entity.id}` : null;
  const [trail, setTrail] = useState<TrailStop[]>([]);
  useEffect(() => {
    setTrail((t) => {
      if (!entityHref) return t.length ? [] : t;
      const i = t.findIndex((s) => s.href === entityHref);
      return i >= 0 ? t.slice(0, i + 1) : [...t, { href: entityHref, label: '…' }];
    });
  }, [entityHref]);
  const nameStop = useCallback((href: string, label: string) => {
    setTrail((t) =>
      t.some((s) => s.href === href && s.label !== label)
        ? t.map((s) => (s.href === href ? { ...s, label } : s))
        : t,
    );
  }, []);

  /* ---------- camera ---------- */
  const cx = useMotionValue(map.w / 2);
  const cy = useMotionValue(map.h / 2);
  const zoom = useMotionValue(0.15);
  const ax = useMotionValue(720);
  const ay = useMotionValue(450);
  const x = useTransform(() => ax.get() - cx.get() * zoom.get());
  const y = useTransform(() => ay.get() - cy.get() * zoom.get());

  const [landed, setLanded] = useState(false);
  const flights = useRef<AnimationPlaybackControls[]>([]);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!vp.ready) return;
    const wide = vp.w >= 1024;
    const frame = { l: wide ? 284 : 22, r: 22, t: 88, b: wide ? 104 : 144 };
    const zOver = Math.min((vp.w - frame.l - frame.r) / map.w, (vp.h - frame.t - frame.b) / map.h);
    const zLand = Math.max(vp.w / (ISLAND.w * 0.8), vp.h / (ISLAND.h * 0.8));
    const to = overview
      ? {
          cx: map.w / 2,
          cy: map.h / 2,
          zoom: zOver,
          ax: frame.l + (vp.w - frame.l - frame.r) / 2,
          ay: frame.t + (vp.h - frame.t - frame.b) / 2,
        }
      : { cx: map.at[station].x, cy: map.at[station].y, zoom: zLand, ax: vp.w / 2, ay: vp.h / 2 };

    const key = `${overview}:${station}:${tall}`;
    const before = lastKey.current;
    lastKey.current = key;
    flights.current.forEach((f) => f.stop());
    flights.current = [];

    const jump = () => {
      cx.set(to.cx);
      cy.set(to.cy);
      zoom.set(to.zoom);
      ax.set(to.ax);
      ay.set(to.ay);
      setLanded(true);
    };
    // Same destination (a resize) or reduced motion: no flight.
    if (before === key || reduced) {
      jump();
      return;
    }

    const first = before === null;
    if (first) {
      // Open on the whole chart, then sail in.
      cx.set(map.w / 2);
      cy.set(map.h / 2);
      zoom.set(zOver * 0.92);
      ax.set(vp.w / 2);
      ay.set(vp.h / 2);
    }
    setLanded(false);
    const from = zoom.get();
    const dist = Math.hypot(to.cx - cx.get(), to.cy - cy.get());
    const duration = first ? 1.5 : Math.min(1.45, 0.8 + dist / 6500);
    // Between two places the camera pulls back mid-flight, so you see the sea you cross.
    const dip =
      !first && from > zLand * 0.6 && to.zoom > zLand * 0.6 && dist > 200
        ? Math.max(zOver * 1.6, zLand * 0.36)
        : null;
    const opts = { duration, ease: EASE };
    flights.current = [
      animate(cx, to.cx, opts),
      animate(cy, to.cy, opts),
      animate(ax, to.ax, opts),
      animate(ay, to.ay, opts),
      animate(
        zoom,
        dip ? [from, dip, to.zoom] : to.zoom,
        dip ? { duration, ease: 'easeInOut', times: [0, 0.48, 1] } : opts,
      ),
    ];
    let done = false;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        if (cancelled) return;
        done = true;
        setLanded(true);
      },
      duration * 1000 + 30,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
      // Interrupted mid-flight: forget this destination so the next run starts a fresh flight.
      if (!done) lastKey.current = before;
    };
    // Motion values are stable; the camera reacts to the destination and the viewport only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, station, tall, vp.w, vp.h, vp.ready, reduced, map]);

  const show = landed && !overview;
  /** The coast of the place you stand on; the page is clipped to it. */
  const shore = useMemo(() => shoreGeometry(vp.w, vp.h, station), [vp.w, vp.h, station]);

  /* ---------- actions ---------- */
  const toggleChart = useCallback(
    () => go(parseRoute(window.location.pathname).overview ? stationHref.current : '/atlas'),
    [],
  );
  const closeEntity = useCallback(() => go(stationHref.current), []);
  const closeSearch = useCallback(() => {
    useUi.getState().closeSearch();
    if (parseRoute(window.location.pathname).search) go(stationHref.current, { replace: true });
  }, []);

  /* ---------- keyboard ---------- */
  const [help, setHelp] = useState(false);
  const helpRef = useRef(help);
  helpRef.current = help;

  // A dropdown keeps the keyboard after you pick from it (arrows would keep changing it), so let go.
  useEffect(() => {
    const onChange = (e: Event) => {
      if (e.target instanceof HTMLSelectElement) e.target.blur();
    };
    document.addEventListener('change', onChange, true);
    return () => document.removeEventListener('change', onChange, true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const typing = isTyping(e.target);
      // '?' (Shift + /) lists the keys; check it before '/' opens search.
      if ((e.key === '?' || (e.key === '/' && e.shiftKey)) && !typing) {
        e.preventDefault();
        setHelp((h) => !h);
        return;
      }
      if ((e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        useUi.getState().openSearch();
        return;
      }
      // Esc inside a text box or dropdown first lets go of it, so the shortcuts work again.
      if (e.key === 'Escape' && typing) {
        (e.target as HTMLElement).blur();
        return;
      }
      if (useUi.getState().searchOpen) return;
      const r = parseRoute(window.location.pathname);
      if (e.key === 'Escape') {
        if (helpRef.current) setHelp(false);
        else if (r.entity) closeEntity();
        else if (r.overview) go(stationHref.current);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        // From a film, person or franchise, M goes straight to the whole chart.
        if (r.entity) go('/atlas');
        else toggleChart();
        return;
      }
      if (r.entity) return;
      const dirs: Record<string, Direction> = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
      };
      if (e.shiftKey && dirs[e.key] && !r.overview && r.station) {
        const next = map.neighbour(r.station, dirs[e.key]);
        if (next) {
          e.preventDefault();
          go(next.path);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [map, closeEntity, toggleChart]);

  /* ---------- document title (navigation never reloads the document) ---------- */
  const last = trail[trail.length - 1];
  useEffect(() => {
    if (entity) {
      if (last && last.label !== '…') document.title = `${last.label} — ${SITE.name}`;
    } else if (overview) document.title = `The chart — ${SITE.name}`;
    else
      document.title =
        station === 'tonight'
          ? `${SITE.name} — ${SITE.tagline}`
          : `${STATION[station].name} — ${SITE.name}`;
  }, [entity, overview, station, last]);

  const [hot, setHot] = useState<StationId | null>(null);

  return (
    <div
      className="parchment fixed inset-0 overflow-hidden text-ink"
      onPointerDownCapture={trackPointer}
    >
      <World
        x={x}
        y={y}
        zoom={zoom}
        map={map}
        station={station}
        far={!show}
        hot={overview ? hot : null}
        ready={vp.ready}
      />
      <Shore art={shore} show={show && vp.ready} />

      <main
        id="main"
        className="absolute inset-0"
        aria-hidden={entity ? true : undefined}
        style={{
          pointerEvents: show ? undefined : 'none',
          clipPath: show ? `path('${shore.land}')` : undefined,
        }}
      >
        {visited.map((id) => {
          const Place = ROOMS[id];
          const on = show && id === station;
          return (
            <div key={id} className={on ? 'room-in absolute inset-0' : 'hidden'}>
              <RoomActive.Provider value={on && !entity && !searchOpen}>
                <Place />
              </RoomActive.Provider>
            </div>
          );
        })}
      </main>

      <TopBar onHelp={() => setHelp((h) => !h)} />
      {show && <EdgePeeks map={map} station={station} />}
      {overview && landed && (
        <Legend map={map} station={station} unknown={route.unknown} onHot={setHot} />
      )}
      <Navigator map={map} station={station} overview={overview} onToggleChart={toggleChart} />

      <AnimatePresence>
        {entity && (
          <Capsule
            key="capsule"
            kind={entity.kind}
            id={entity.id}
            trail={trail}
            onName={nameStop}
            onClose={closeEntity}
            reduced={reduced}
          />
        )}
      </AnimatePresence>
      <Spyglass onClose={closeSearch} />
      <KeysHelp open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
