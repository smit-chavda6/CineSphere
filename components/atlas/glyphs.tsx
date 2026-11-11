'use client';

import { coastPath, terrain, type Glyph } from './coast';

/**
 * Engraved map symbols, drawn in ink with hairline strokes. Sizes are in the
 * caller's SVG units; `vector-effect` keeps strokes crisp at any zoom.
 */

const INK = 'rgb(var(--ink) / 0.78)';
const ink = (w = 1.6, o = 0.9) => ({
  fill: 'none',
  stroke: `rgb(var(--ink) / ${o})`,
  strokeWidth: w,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  vectorEffect: 'non-scaling-stroke' as const,
});

export function Mountain({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M-30 14 L-6 -22 L4 -8 L12 -18 L32 14"
        style={{ ...ink(1.4), fill: 'rgb(var(--island))' }}
      />
      {/* hachure on the shaded slope */}
      <path
        d="M-4 -16 L4 12 M0 -10 L8 12 M-8 -10 L-2 12 M14 -12 L20 12 M10 -8 L14 12"
        style={ink(0.8, 0.5)}
      />
    </g>
  );
}

export function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 14 L0 2" style={ink(1.2)} />
      <path
        d="M-10 4 C -14 -8 -4 -18 0 -18 C 4 -18 14 -8 10 4 Z"
        style={{ ...ink(1.2), fill: 'rgb(var(--island))' }}
      />
      <path d="M2 -12 C 6 -8 7 -3 6 1" style={ink(0.8, 0.5)} />
    </g>
  );
}

export function Hill({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-26 10 C -16 -12 16 -12 26 10" style={ink(1.3)} />
      <path d="M6 -4 L10 8 M12 -1 L15 9 M0 -6 L3 8" style={ink(0.8, 0.45)} />
    </g>
  );
}

export function Wave({ x, y, s = 1, o = 0.45 }: { x: number; y: number; s?: number; o?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-24 0 q 6 -7 12 0 t 12 0 t 12 0 t 12 0" style={ink(1.1, o)} />
      <path d="M-14 9 q 6 -7 12 0 t 12 0" style={ink(1, o * 0.7)} />
    </g>
  );
}

/** A small three-masted ship under sail, as on old sea charts. */
export function Ship({
  x,
  y,
  s = 1,
  flip = false,
}: {
  x: number;
  y: number;
  s?: number;
  flip?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M-34 6 L34 6 L24 18 L-26 18 Z" style={{ ...ink(1.4), fill: 'rgb(var(--island))' }} />
      <path d="M-14 6 L-14 -34 M6 6 L6 -42 M22 6 L22 -26" style={ink(1.2)} />
      <path
        d="M-26 -6 C -20 -16 -20 -26 -26 -32 L-4 -32 C -8 -24 -8 -14 -4 -6 Z"
        style={{ ...ink(1.1), fill: 'rgb(var(--island))' }}
      />
      <path
        d="M-6 -6 C 0 -18 0 -30 -6 -40 L18 -40 C 14 -30 14 -18 18 -6 Z"
        style={{ ...ink(1.1), fill: 'rgb(var(--island))' }}
      />
      <path
        d="M14 -8 C 18 -14 18 -20 14 -24 L30 -24 C 28 -18 28 -12 30 -8 Z"
        style={{ ...ink(1.1), fill: 'rgb(var(--island))' }}
      />
      <path d="M6 -42 L16 -46 L6 -48" style={{ ...ink(1), fill: 'rgb(var(--accent))' }} />
      <path d="M-40 22 q 8 -6 16 0 t 16 0 t 16 0 t 16 0 t 16 0" style={ink(1, 0.4)} />
    </g>
  );
}

export function GlyphAt({ g }: { g: Glyph }) {
  if (g.kind === 'mountain') return <Mountain x={g.x} y={g.y} s={g.s} />;
  if (g.kind === 'tree') return <Tree x={g.x} y={g.y} s={g.s} />;
  return <Hill x={g.x} y={g.y} s={g.s} />;
}

/**
 * One island drawn as an engraving: ripple lines in the water, the land, a
 * stippled coastal band, and a scatter of hills and trees.
 */
export function IslandArt({
  w,
  h,
  seed,
  glyphScale = 1,
  terrainCount = 9,
  inset = 0.08,
}: {
  w: number;
  h: number;
  seed: number;
  glyphScale?: number;
  terrainCount?: number;
  inset?: number;
}) {
  const d = coastPath({
    w,
    h,
    inset: Math.min(w, h) * inset,
    amp: Math.min(w, h) * 0.07,
    seed,
    exp: 2.3,
  });
  const clip = `isle-${seed}`;
  const cx = w / 2;
  const cy = h / 2;
  const ripple = (k: number) => `translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="absolute inset-0 h-full w-full overflow-visible"
      aria-hidden
    >
      <defs>
        <clipPath id={clip}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} transform={ripple(1.13)} style={ink(1, 0.16)} />
      <path d={d} transform={ripple(1.08)} style={ink(1, 0.26)} />
      <path d={d} transform={ripple(1.035)} style={ink(1.1, 0.4)} />
      <path
        d={d}
        className="isle-land"
        style={{ fill: 'rgb(var(--island))', transition: 'fill .25s' }}
      />
      {/* coastal shading and stipple, kept inside the land */}
      <g clipPath={`url(#${clip})`}>
        <path
          d={d}
          style={{
            fill: 'none',
            stroke: 'rgb(var(--gold) / 0.35)',
            strokeWidth: Math.min(w, h) * 0.09,
          }}
        />
        <path
          d={d}
          style={{
            fill: 'none',
            stroke: INK,
            strokeOpacity: 0.32,
            strokeWidth: Math.min(w, h) * 0.035,
            strokeDasharray: '1.5 7',
            strokeLinecap: 'round',
          }}
        />
      </g>
      <path d={d} className="isle-coast" style={{ ...ink(2, 0.85), transition: 'stroke .25s' }} />
      {terrain(w, h, seed, terrainCount).map((g, i) => (
        <GlyphAt key={i} g={{ ...g, s: g.s * glyphScale }} />
      ))}
    </svg>
  );
}
