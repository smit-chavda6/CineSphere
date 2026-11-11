'use client';

import { coastPath } from './coast';
import { Ship, Wave } from './glyphs';
import { Go } from './nav';
import { cn } from '@/lib/utils';

const W = 1120;
const H = 760;

/**
 * The free corner of the chart: an unexplored island, drawn the way old
 * cartographers drew land they had only glimpsed — a dashed, unfinished coast
 * and hatching. Sailing there rolls the Dice for a film you have never charted.
 */
export function TerraIncognita({ x, y, far }: { x: number; y: number; far: boolean }) {
  const d = coastPath({ w: W, h: H, inset: 90, amp: 60, seed: 1609, exp: 2.2 });
  return (
    <Go
      href="/recommend/surprise"
      tabIndex={far ? 0 : -1}
      aria-label="Terra Incognita — roll the Dice for a random film"
      className={cn('isle group absolute block', !far && 'pointer-events-none')}
      style={{ left: x - W / 2, top: y - H / 2, width: W, height: H }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden
      >
        <defs>
          <pattern
            id="terra-hatch"
            width="26"
            height="26"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-35)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="26"
              style={{ stroke: 'rgb(var(--ink) / 0.22)', strokeWidth: 3 }}
            />
          </pattern>
        </defs>
        {/* only part of the coast was ever sounded: a faint dotted ripple, a dashed shore */}
        <path
          d={d}
          transform={`translate(${W / 2} ${H / 2}) scale(1.08) translate(${-W / 2} ${-H / 2})`}
          style={{
            fill: 'none',
            stroke: 'rgb(var(--ink) / 0.25)',
            strokeWidth: 3,
            strokeDasharray: '2 22',
            strokeLinecap: 'round',
          }}
        />
        <path
          d={d}
          className="isle-land"
          style={{ fill: 'url(#terra-hatch)', transition: 'fill .25s' }}
        />
        <path
          d={d}
          className="isle-coast"
          style={{
            fill: 'none',
            stroke: 'rgb(var(--ink) / 0.7)',
            strokeWidth: 5,
            strokeDasharray: '34 22',
            strokeLinecap: 'round',
            transition: 'stroke .25s',
          }}
        />
        <Wave x={-40} y={H - 40} s={4} />
        <Wave x={W + 60} y={120} s={3.4} />
        <Ship x={-120} y={150} s={3.6} />
        {/* the ship's intended course */}
        <path
          d={`M ${-10} 190 C 120 260 180 300 260 330`}
          style={{
            fill: 'none',
            stroke: 'rgb(var(--accent) / 0.7)',
            strokeWidth: 5,
            strokeDasharray: '4 18',
            strokeLinecap: 'round',
          }}
        />
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex flex-col items-center justify-center text-center transition-opacity duration-500',
          far ? 'opacity-100' : 'opacity-0',
        )}
      >
        <span className="t-place text-[118px] leading-none text-ink group-hover:text-accent">
          Terra Incognita
        </span>
        <span className="t-mono mt-6 text-[40px] text-dim">
          films not yet charted · roll the dice
        </span>
      </span>
    </Go>
  );
}
