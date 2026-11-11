'use client';

import { coastPath, rng, seedOf } from './coast';
import { Wave } from './glyphs';
import { cn } from '@/lib/utils';

/**
 * The island you are standing on. When the camera lands, the place's page sits
 * on land: an irregular engraved coastline runs round the screen, with ripple
 * lines and open sea beyond it. Each place has its own coast.
 */
export type ShoreArt = ReturnType<typeof shoreGeometry>;

/** The coast for one place at one screen size. Pure, so the page can clip to the same line. */
export function shoreGeometry(w: number, h: number, place: string) {
  const small = w < 640;
  const seed = seedOf(place);
  const base = { w, h, amp: small ? 7 : 14, seed, exp: 14, points: Math.round((w + h) / 9) };
  const inset = small ? 15 : 30;
  const land = coastPath({ ...base, inset });
  // Same seed, smaller insets: ripples that follow the shore at an even distance.
  const ripples = [7, 14, 22].map((o) => coastPath({ ...base, inset: inset - o }));
  const r = rng(seed);
  const waves = small
    ? []
    : [
        { x: 18 + r() * 10, y: h * (0.3 + r() * 0.4) },
        { x: w - 22 - r() * 10, y: h * (0.25 + r() * 0.5) },
      ];
  return { land, ripples, waves, small, w, h };
}

export function Shore({ art, show }: { art: ShoreArt; show: boolean }) {
  const { w, h } = art;

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 transition-opacity duration-500',
        show ? 'opacity-100' : 'opacity-0',
      )}
    >
      {/* open sea with its graticule, then the land cut from parchment so the paper grain carries through */}
      <div className="sea absolute inset-0" style={{ backgroundSize: '120px 120px' }} />
      <div className="parchment absolute inset-0" style={{ clipPath: `path('${art.land}')` }} />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        <defs>
          <clipPath id="shore-land">
            <path d={art.land} />
          </clipPath>
        </defs>
        {art.ripples.map((d, i) => (
          <path
            key={i}
            d={d}
            style={{
              fill: 'none',
              stroke: 'rgb(var(--ink))',
              strokeOpacity: 0.34 - i * 0.1,
              strokeWidth: 1,
            }}
          />
        ))}
        <g clipPath="url(#shore-land)">
          {/* coastal shading, then a stippled band just inside the shore */}
          <path
            d={art.land}
            style={{
              fill: 'none',
              stroke: 'rgb(var(--gold) / 0.22)',
              strokeWidth: art.small ? 22 : 44,
            }}
          />
          <path
            d={art.land}
            style={{
              fill: 'none',
              stroke: 'rgb(var(--ink) / 0.3)',
              strokeWidth: art.small ? 8 : 16,
              strokeDasharray: '1.2 6',
              strokeLinecap: 'round',
            }}
          />
        </g>
        <path
          d={art.land}
          style={{
            fill: 'none',
            stroke: 'rgb(var(--ink) / 0.85)',
            strokeWidth: 1.6,
            strokeLinejoin: 'round',
          }}
        />
        {art.waves.map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y}) rotate(90)`}>
            <Wave x={0} y={0} s={0.55} o={0.5} />
          </g>
        ))}
      </svg>
    </div>
  );
}
