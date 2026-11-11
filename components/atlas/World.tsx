'use client';

import { useMemo, type CSSProperties } from 'react';
import { motion, useMotionTemplate, useTransform, type MotionValue } from 'framer-motion';
import { rng, seedOf } from './coast';
import { IslandArt, Ship, Wave } from './glyphs';
import { TerraIncognita } from './TerraIncognita';
import { Go } from './nav';
import { CELL, ISLAND, STATIONS, type ChartLayout, type StationId } from './stations';
import { cn } from '@/lib/utils';

interface Props {
  /** Screen-space translation and zoom of the chart, driven by the camera. */
  x: MotionValue<number>;
  y: MotionValue<number>;
  zoom: MotionValue<number>;
  map: ChartLayout;
  station: StationId;
  /** True while travelling or looking at the whole chart: labels on, islands clickable. */
  far: boolean;
  hot: StationId | null;
  ready: boolean;
}

const GRID = 400;

/**
 * The chart: a tinted sea with a faint graticule, waves and ships, and one
 * engraved island per place. It is the backdrop of the whole site.
 */
export function World({ x, y, zoom, map, station, far, hot, ready }: Props) {
  // The graticule is drawn in screen space so its lines stay one pixel wide at any zoom.
  const gridSize = useTransform(zoom, (z) => `${GRID * z}px ${GRID * z}px`);
  const gridPos = useMotionTemplate`${x}px ${y}px`;
  const here = map.at[station];

  // Waves sit where four cells meet (open water); ships ride two of the routes.
  const sea = useMemo(() => {
    const r = rng(map.cols * 31 + map.rows);
    const waves: { x: number; y: number; s: number }[] = [];
    for (let c = 0; c <= map.cols; c++) {
      for (let row = 0; row <= map.rows; row++) {
        const wx = c * CELL.w + (r() - 0.5) * 160;
        const wy = row * CELL.h + (r() - 0.5) * 120;
        if (Math.hypot(wx - map.cartouche.x, wy - map.cartouche.y) < 700) continue;
        waves.push({ x: wx, y: wy, s: 3.4 + r() * 1.6 });
      }
    }
    const ships = [map.routes[1], map.routes[Math.floor(map.routes.length * 0.6)]]
      .filter(Boolean)
      .map(([a, b], i) => ({
        x: (map.at[a].x + map.at[b].x) / 2,
        y: (map.at[a].y + map.at[b].y) / 2 + 40,
        flip: i % 2 === 1,
      }));
    return { waves, ships };
  }, [map]);

  // Two named seas between the rows of islands.
  const seaNames = [
    { y: CELL.h, text: 'Mare Cinematicum' },
    { y: (map.rows - 1) * CELL.h, text: 'Oceanus Fabularum' },
  ];

  return (
    <div
      className={cn(
        'absolute inset-0 transition-opacity duration-700',
        !ready ? 'opacity-0' : far ? 'opacity-100' : 'opacity-0',
      )}
      aria-hidden={!far}
    >
      <motion.div
        className="sea absolute inset-0"
        style={{ backgroundSize: gridSize, backgroundPosition: gridPos }}
      />
      <motion.div
        className="absolute left-0 top-0"
        style={
          {
            x,
            y,
            scale: zoom,
            originX: 0,
            originY: 0,
            width: map.w,
            height: map.h,
            '--z': zoom,
          } as unknown as CSSProperties
        }
      >
        <svg
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
          width={map.w}
          height={map.h}
          aria-hidden
        >
          {seaNames.map((n) => (
            <text
              key={n.text}
              x={map.w / 2}
              y={n.y + 30}
              textAnchor="middle"
              className="font-serif italic"
              style={{ fill: 'rgb(var(--ink) / 0.38)', fontSize: 96, letterSpacing: '0.6em' }}
            >
              {n.text}
            </text>
          ))}
          {map.routes.map(([a, b]) => (
            <line
              key={`${a}-${b}`}
              className="route"
              x1={map.at[a].x}
              y1={map.at[a].y}
              x2={map.at[b].x}
              y2={map.at[b].y}
              strokeDasharray="4 34"
              strokeLinecap="round"
            />
          ))}
          {sea.waves.map((w, i) => (
            <Wave key={i} x={w.x} y={w.y} s={w.s} />
          ))}
          {sea.ships.map((s, i) => (
            <Ship key={i} x={s.x} y={s.y} s={4.2} flip={s.flip} />
          ))}
        </svg>

        <TerraIncognita x={map.cartouche.x} y={map.cartouche.y} far={far} />

        {STATIONS.map((s) => {
          const p = map.at[s.id];
          const current = s.id === station;
          return (
            <Go
              key={s.id}
              href={s.path}
              tabIndex={far ? 0 : -1}
              data-hot={hot === s.id}
              aria-label={`${s.name} — ${s.place}`}
              className={cn('isle group absolute block', !far && 'pointer-events-none')}
              style={{
                left: p.x - ISLAND.w / 2,
                top: p.y - ISLAND.h / 2,
                width: ISLAND.w,
                height: ISLAND.h,
              }}
            >
              <IslandArt
                w={ISLAND.w}
                h={ISLAND.h}
                seed={seedOf(s.id)}
                glyphScale={3.4}
                terrainCount={8}
                inset={0.06}
              />
              <span
                className={cn(
                  'absolute inset-0 flex flex-col items-center justify-center text-center transition-opacity duration-500',
                  far ? 'opacity-100' : 'opacity-0',
                )}
              >
                <span className="t-mono text-[44px] text-accent">{p.ref}</span>
                <span className="t-display mt-2 text-[150px] text-ink group-hover:text-accent">
                  {s.name}
                </span>
                <span className="t-place mt-3 text-[60px] text-dim">{s.place}</span>
              </span>
              {current && (
                <span
                  className={cn(
                    'absolute left-[20%] top-[22%] transition-opacity duration-500',
                    far ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  <span className="relative block h-[56px] w-[56px]">
                    <span
                      className="absolute inset-0 rounded-full bg-accent"
                      style={{ animation: 'beacon 1.8s ease-out infinite' }}
                    />
                    <span className="absolute inset-0 rounded-full border-[6px] border-island bg-accent" />
                  </span>
                </span>
              )}
            </Go>
          );
        })}

        <p
          className="t-place pointer-events-none absolute text-[58px] text-dim"
          style={{
            left: here.x - ISLAND.w / 2,
            top: here.y + ISLAND.h / 2 + 40,
            width: ISLAND.w,
            textAlign: 'center',
            opacity: far ? 1 : 0,
            transition: 'opacity .5s',
          }}
        >
          you are here
        </p>
      </motion.div>
    </div>
  );
}
