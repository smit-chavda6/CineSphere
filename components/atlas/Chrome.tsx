'use client';

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Map as MapIcon,
  Moon,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { REGIONS, regionName } from '@/config/regions';
import { FOCUS_OPTIONS, type Focus } from '@/lib/focus';
import { useLibrary } from '@/store/library';
import { useUi } from '@/store/ui';
import { Go } from './nav';
import { Pocket } from './Pocket';
import { Settings } from './Settings';
import { STATION, STATIONS, type ChartLayout, type Direction, type StationId } from './stations';
import { Frame } from '@/components/ui/kit';
import { cn } from '@/lib/utils';

function Globe() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.5" />
      <ellipse cx="12" cy="12" rx="4.2" ry="9.5" />
      <path d="M2.5 12h19M4.2 7h15.6M4.2 17h15.6" />
      <circle cx="17.2" cy="7" r="2.3" fill="rgb(var(--accent))" stroke="none" />
    </svg>
  );
}

/** Wordmark, search, pocket, region and chart theme. */
export function TopBar({ onHelp }: { onHelp: () => void }) {
  const openSearch = useUi((s) => s.openSearch);
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const region = useLibrary((s) => s.region);
  const setRegion = useLibrary((s) => s.setRegion);
  const focus = useUi((s) => s.focus);
  const setFocus = useUi((s) => s.setFocus);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-[18px] sm:p-[20px]">
      <Go
        href="/"
        className="hud pointer-events-auto flex h-11 items-center gap-2.5 px-3 shadow-print-sm"
        aria-label="CineSphere — sail home to Tonight"
      >
        <Globe />
        <span className="t-display hidden text-[23px] leading-none min-[420px]:inline">
          Cine<span className="text-accent">Sphere</span>
        </span>
        <span className="t-mono hidden border-l border-ink/25 pl-2.5 text-dim lg:inline">
          Atlas of cinema
        </span>
      </Go>

      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => openSearch()}
          className="hud t-mono flex h-11 items-center gap-2 px-3 shadow-print-sm transition hover:border-ink"
          aria-label="Open the spyglass (search)"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="hidden md:inline">Spyglass</span>
          <kbd className="hidden rounded-[2px] border border-ink/30 px-1 text-[10px] text-dim md:inline">
            /
          </kbd>
        </button>
        <Pocket />
        <button
          type="button"
          onClick={onHelp}
          className="hud t-mono hidden h-11 w-11 place-items-center transition hover:border-ink md:grid"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          ?
        </button>
        <Settings />
        <div className="hidden items-center gap-2 lg:flex">
          <label className="hud flex h-11 items-center shadow-print-sm">
            <span className="sr-only">Region for cinemas and streaming</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="t-mono h-full cursor-pointer bg-transparent px-2 focus:outline-none"
              title="Region for cinemas, releases and streaming"
            >
              {REGIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} · {r.name}
                </option>
              ))}
            </select>
            {/* How strongly suggestions favour films made in this region. */}
            <span className="h-6 w-px bg-ink/30" aria-hidden />
            <span className="sr-only">Which films to suggest</span>
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value as Focus)}
              className="t-mono h-full cursor-pointer bg-transparent px-2 focus:outline-none"
              title="Which films to suggest across the site"
            >
              {FOCUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label(regionName(region))}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setTheme(theme === 'night' ? 'day' : 'night')}
            className="hud grid h-11 w-11 place-items-center shadow-print-sm transition hover:border-ink"
            aria-label={theme === 'night' ? 'Switch to the day chart' : 'Switch to the night chart'}
            title={theme === 'night' ? 'Day chart' : 'Night chart'}
          >
            {theme === 'night' ? (
              <Sun className="h-4 w-4" aria-hidden />
            ) : (
              <Moon className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

const ARROWS: Record<Direction, typeof ArrowUp> = {
  left: ArrowLeft,
  right: ArrowRight,
  up: ArrowUp,
  down: ArrowDown,
};
const DIR_WORD: Record<Direction, string> = {
  left: 'West',
  right: 'East',
  up: 'North',
  down: 'South',
};

/** The bottom control: open the chart, see where you are, sail to a neighbouring place. */
export function Navigator({
  map,
  station,
  overview,
  onToggleChart,
}: {
  map: ChartLayout;
  station: StationId;
  overview: boolean;
  onToggleChart: () => void;
}) {
  const here = STATION[station];
  const arrow = (dir: Direction) => {
    const to = map.neighbour(station, dir);
    const Icon = ARROWS[dir];
    const cls = 'grid w-9 place-items-center border-l border-ink/20 transition sm:w-10';
    if (!to) {
      return (
        <span key={dir} className={cn(cls, 'text-ink/20')} aria-hidden>
          <Icon className="h-4 w-4" />
        </span>
      );
    }
    return (
      <Go
        key={dir}
        href={to.path}
        className={cn(cls, 'hover:bg-ink hover:text-paper')}
        aria-label={`${DIR_WORD[dir]} to ${to.name}`}
        title={`${DIR_WORD[dir]}: ${to.name} (Shift + arrow)`}
      >
        <Icon className="h-4 w-4" />
      </Go>
    );
  };

  return (
    <nav
      aria-label="Chart navigation"
      className="absolute bottom-[20px] left-1/2 z-30 -translate-x-1/2"
    >
      <div className="hud flex h-12 items-stretch overflow-hidden shadow-print">
        <button
          type="button"
          onClick={onToggleChart}
          aria-pressed={overview}
          className={cn(
            't-mono flex items-center gap-2 px-3.5 transition hover:bg-ink hover:text-paper',
            overview && 'bg-ink text-paper',
          )}
          title="Open or close the whole chart (M)"
        >
          {overview ? (
            <X className="h-4 w-4" aria-hidden />
          ) : (
            <MapIcon className="h-4 w-4" aria-hidden />
          )}
          <span className={overview ? undefined : 'hidden min-[400px]:inline'}>
            {overview ? 'Close chart' : 'Chart'}
          </span>
          <kbd
            className={cn(
              'hidden rounded-[2px] border px-1 text-[10px] sm:inline',
              overview ? 'border-paper/40' : 'border-ink/30 text-dim',
            )}
          >
            M
          </kbd>
        </button>
        {!overview && (
          <>
            {arrow('left')}
            {arrow('up')}
            <div
              className="flex min-w-[6.5rem] flex-col items-center justify-center border-l border-ink/20 px-3 sm:min-w-[8.5rem]"
              aria-live="polite"
            >
              <span className="whitespace-nowrap font-mono text-[9.5px] tracking-[0.14em] text-accent">
                {map.at[station].ref}
                <span className="hidden sm:inline"> · YOU ARE AT</span>
              </span>
              <span className="t-display whitespace-nowrap text-[19px] leading-none">
                {here.name}
              </span>
            </div>
            {arrow('down')}
            {arrow('right')}
          </>
        )}
      </div>
    </nav>
  );
}

/** Tabs on the left and right screen edges naming the next island over. */
export function EdgePeeks({ map, station }: { map: ChartLayout; station: StationId }) {
  const left = map.neighbour(station, 'left');
  const right = map.neighbour(station, 'right');
  const tab =
    'hud vertical t-mono absolute top-1/2 z-20 hidden -translate-y-1/2 items-center gap-2 px-1.5 py-4 text-dim transition hover:bg-ink hover:text-paper lg:flex';
  return (
    <>
      {left && (
        <Go
          href={left.path}
          className={cn(tab, 'left-[13px] rotate-180')}
          aria-label={`West to ${left.name}`}
        >
          <span className="text-accent">W</span>
          <span>{left.name}</span>
        </Go>
      )}
      {right && (
        <Go
          href={right.path}
          className={cn(tab, 'right-[13px]')}
          aria-label={`East to ${right.name}`}
        >
          <span className="text-accent">E</span>
          <span>{right.name}</span>
        </Go>
      )}
    </>
  );
}

/** The chart's index: every place as a plain link (also the keyboard and small-screen way in). */
export function Legend({
  map,
  station,
  unknown,
  onHot,
}: {
  map: ChartLayout;
  station: StationId;
  unknown: boolean;
  onHot: (id: StationId | null) => void;
}) {
  return (
    <aside
      aria-label="All places"
      className="fade-in absolute inset-x-0 bottom-[5.25rem] z-20 lg:inset-x-auto lg:bottom-24 lg:left-6 lg:top-[5.25rem] lg:w-[14.5rem]"
    >
      <Frame className="hidden h-full shadow-print-sm lg:block" inner="flex flex-col p-4">
        <p className="t-mono text-accent">{unknown ? 'Off the chart' : 'The chart'}</p>
        <p className="t-display mt-2 text-4xl">
          {unknown ? 'Uncharted waters' : 'Fourteen places'}
        </p>
        <p className="t-place mt-2 text-[17px] leading-snug text-dim">
          {unknown
            ? 'That address is not on the map. Pick an island to sail to.'
            : 'One map instead of pages. Click an island to sail there.'}
        </p>
        <ul className="-mx-2 mt-4 flex-1 overflow-y-auto" onMouseLeave={() => onHot(null)}>
          {STATIONS.map((s) => (
            <li key={s.id}>
              <Go
                href={s.path}
                onMouseEnter={() => onHot(s.id)}
                onFocus={() => onHot(s.id)}
                className={cn(
                  'flex items-baseline gap-3 rounded-[3px] px-2 py-[5px] transition hover:bg-ink hover:text-paper',
                  s.id === station && 'text-accent',
                )}
              >
                <span className="w-6 font-mono text-[10.5px] opacity-70">{map.at[s.id].ref}</span>
                <span className="text-[14.5px] font-medium">{s.name}</span>
              </Go>
            </li>
          ))}
        </ul>
      </Frame>
      <ul className="no-scrollbar flex gap-2 overflow-x-auto px-3 lg:hidden">
        {STATIONS.map((s) => (
          <li key={s.id} className="shrink-0">
            <Go
              href={s.path}
              className={cn(
                'hud t-mono flex h-9 items-center gap-2 px-3',
                s.id === station && 'border-accent text-accent',
              )}
            >
              <span className="opacity-60">{map.at[s.id].ref}</span>
              {s.name}
            </Go>
          </li>
        ))}
      </ul>
    </aside>
  );
}

const KEYS: [string, string[]][] = [
  ['Anywhere', []],
  ['Search the archive', ['/', 'Ctrl K']],
  ['Open or close the whole chart', ['M']],
  ['Sail to the next island', ['Shift ←', 'Shift →', 'Shift ↑', 'Shift ↓']],
  ['Close a film, the chart or this list', ['Esc']],
  ['Let go of a text box or dropdown', ['Esc']],
  ['Show these keys', ['?']],
  ['Tonight', []],
  ['Previous or next film', ['←', '→']],
  ['Previous or next channel', ['↑', '↓']],
  ['Open the film under the needle', ['Enter']],
  ['Film, person or franchise', []],
  ['Jump to a chapter', ['1', '2', '3', '4', '5']],
  ['Previous or next chapter', ['←', '→']],
  ['Step back along your trail', ['Backspace']],
  ['Swipe', []],
  ['Skip · like · save · seen', ['←', '→', '↑', '↓']],
  ['Undo the last swipe', ['Backspace']],
];

/** The list of keyboard shortcuts, framed like a map's legend. */
export function KeysHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      className="fade-in absolute inset-0 z-[85] grid place-items-center bg-ink/30 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg"
      >
        <Frame inner="max-h-[80vh] overflow-y-auto px-6 py-5" className="shadow-print">
          <div className="flex items-baseline justify-between gap-4">
            <p className="t-display text-3xl">Keys to the chart</p>
            <button type="button" onClick={onClose} className="t-mono text-dim hover:text-accent">
              Close · Esc
            </button>
          </div>
          <dl className="mt-3">
            {KEYS.map(([what, keys]) =>
              keys.length === 0 ? (
                <dt key={what} className="t-mono mt-4 border-b border-ink/30 pb-1 text-accent">
                  {what}
                </dt>
              ) : (
                <div
                  key={what}
                  className="flex items-center justify-between gap-4 border-b border-dotted border-ink/25 py-1.5"
                >
                  <dt className="text-[15px]">{what}</dt>
                  <dd className="flex shrink-0 flex-wrap justify-end gap-1">
                    {keys.map((k) => (
                      <kbd
                        key={k}
                        className="min-w-[1.6rem] border border-ink/50 bg-island px-1.5 text-center font-mono text-[12px] shadow-[1px_1px_0_rgb(var(--ink)/0.5)]"
                      >
                        {k}
                      </kbd>
                    ))}
                  </dd>
                </div>
              ),
            )}
          </dl>
        </Frame>
      </div>
    </div>
  );
}
