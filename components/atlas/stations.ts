/**
 * The chart. Every part of CineSphere is a place on one map; this file is the
 * single registry of those places, where they sit, and which URL belongs to each.
 */

export type StationId =
  | 'tonight'
  | 'moods'
  | 'archive'
  | 'foryou'
  | 'blender'
  | 'swipe'
  | 'together'
  | 'timefit'
  | 'gems'
  | 'decades'
  | 'dice'
  | 'marathon'
  | 'calendar'
  | 'shelf';

export interface Station {
  id: StationId;
  /** Short name printed on the chart. */
  name: string;
  /** Italic line under the name. */
  place: string;
  path: string;
  /** Grid cell [column, row] on a wide chart and on a tall (phone) chart. */
  wide: [number, number];
  tall: [number, number];
  /** Small offset so the islands do not sit on a perfect grid. */
  jitter: [number, number];
  /** Organic outline (CSS border-radius). */
  shape: string;
}

export const STATIONS: Station[] = [
  {
    id: 'decades',
    name: 'Time Machine',
    place: 'the best of any decade',
    path: '/recommend/decades',
    wide: [0, 0],
    tall: [0, 4],
    jitter: [40, 30],
    shape: '58% 42% 47% 53% / 46% 55% 45% 54%',
  },
  {
    id: 'moods',
    name: 'Moods',
    place: 'pick a feeling',
    path: '/recommend/mood',
    wide: [1, 0],
    tall: [0, 0],
    jitter: [-30, -40],
    shape: '44% 56% 60% 40% / 58% 44% 56% 42%',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    place: 'what is releasing next',
    path: '/recommend/upcoming',
    wide: [2, 0],
    tall: [1, 0],
    jitter: [20, 50],
    shape: '50% 50% 42% 58% / 44% 60% 40% 56%',
  },
  {
    id: 'gems',
    name: 'Hidden Gems',
    place: 'loved, barely seen',
    path: '/recommend/hidden-gems',
    wide: [3, 0],
    tall: [2, 0],
    jitter: [-50, -20],
    shape: '62% 38% 52% 48% / 50% 48% 52% 50%',
  },
  {
    id: 'marathon',
    name: 'Marathons',
    place: 'franchises in order',
    path: '/recommend/marathon',
    wide: [4, 0],
    tall: [1, 4],
    jitter: [10, 40],
    shape: '46% 54% 44% 56% / 60% 42% 58% 40%',
  },
  {
    id: 'foryou',
    name: 'For You',
    place: 'built from your taste',
    path: '/recommend/for-you',
    wide: [0, 1],
    tall: [0, 2],
    jitter: [-20, 20],
    shape: '52% 48% 62% 38% / 44% 52% 48% 56%',
  },
  {
    id: 'swipe',
    name: 'Swipe',
    place: 'a deck that learns',
    path: '/recommend/swipe',
    wide: [1, 1],
    tall: [0, 1],
    jitter: [50, -30],
    shape: '40% 60% 50% 50% / 54% 46% 54% 46%',
  },
  {
    id: 'tonight',
    name: 'Tonight',
    place: 'home harbour',
    path: '/',
    wide: [2, 1],
    tall: [1, 1],
    jitter: [0, 0],
    shape: '54% 46% 48% 52% / 50% 54% 46% 50%',
  },
  {
    id: 'archive',
    name: 'Archive',
    place: 'every film, every filter',
    path: '/discover',
    wide: [3, 1],
    tall: [2, 1],
    jitter: [-40, 40],
    shape: '48% 52% 40% 60% / 56% 44% 56% 44%',
  },
  {
    id: 'timefit',
    name: 'Time Fit',
    place: 'only what fits your evening',
    path: '/recommend/time-fit',
    wide: [4, 1],
    tall: [2, 2],
    jitter: [30, -20],
    shape: '60% 40% 56% 44% / 42% 58% 42% 58%',
  },
  {
    id: 'shelf',
    name: 'Shelf',
    place: 'your library',
    path: '/library',
    wide: [0, 2],
    tall: [0, 3],
    jitter: [30, -40],
    shape: '45% 55% 55% 45% / 60% 40% 60% 40%',
  },
  {
    id: 'blender',
    name: 'Blender',
    place: 'mix three favourites',
    path: '/recommend/taste',
    wide: [1, 2],
    tall: [1, 3],
    jitter: [-40, 10],
    shape: '56% 44% 42% 58% / 48% 56% 44% 52%',
  },
  {
    id: 'dice',
    name: 'Dice',
    place: 'let fate pick',
    path: '/recommend/surprise',
    wide: [2, 2],
    tall: [1, 2],
    jitter: [40, 30],
    shape: '42% 58% 58% 42% / 52% 42% 58% 48%',
  },
  {
    id: 'together',
    name: 'Together',
    place: 'one film, everyone happy',
    path: '/recommend/together',
    wide: [3, 2],
    tall: [2, 3],
    jitter: [-10, -30],
    shape: '52% 48% 46% 54% / 40% 58% 42% 60%',
  },
];

export const STATION: Record<StationId, Station> = Object.fromEntries(
  STATIONS.map((s) => [s.id, s]),
) as Record<StationId, Station>;

/** World units. One grid cell holds one island with open sea around it. */
export const CELL = { w: 1600, h: 1100 };
export const ISLAND = { w: 1120, h: 760 };

export type Direction = 'left' | 'right' | 'up' | 'down';

export interface ChartLayout {
  cols: number;
  rows: number;
  w: number;
  h: number;
  /** Island centre in world units, plus its grid reference (e.g. "C2"). */
  at: Record<StationId, { x: number; y: number; col: number; row: number; ref: string }>;
  /** The free cell that holds Terra Incognita (the unexplored island). */
  cartouche: { x: number; y: number };
  neighbour: (id: StationId, dir: Direction) => Station | null;
  /** Pairs of adjacent stations, for drawing sea routes. */
  routes: [StationId, StationId][];
}

const STEP: Record<Direction, [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

export function chartLayout(tall: boolean): ChartLayout {
  const cols = tall ? 3 : 5;
  const rows = tall ? 5 : 3;
  const cell = (s: Station) => (tall ? s.tall : s.wide);
  const at = {} as ChartLayout['at'];
  const byCell = new Map<string, Station>();
  for (const s of STATIONS) {
    const [col, row] = cell(s);
    byCell.set(`${col},${row}`, s);
    at[s.id] = {
      col,
      row,
      x: col * CELL.w + CELL.w / 2 + s.jitter[0],
      y: row * CELL.h + CELL.h / 2 + s.jitter[1],
      ref: `${'ABCDE'[col]}${row + 1}`,
    };
  }
  const routes: [StationId, StationId][] = [];
  for (const s of STATIONS) {
    const [col, row] = cell(s);
    const right = byCell.get(`${col + 1},${row}`);
    const down = byCell.get(`${col},${row + 1}`);
    if (right) routes.push([s.id, right.id]);
    if (down) routes.push([s.id, down.id]);
  }
  return {
    cols,
    rows,
    w: cols * CELL.w,
    h: rows * CELL.h,
    at,
    cartouche: { x: (cols - 1) * CELL.w + CELL.w / 2, y: (rows - 1) * CELL.h + CELL.h / 2 },
    neighbour: (id, dir) => {
      const [col, row] = cell(STATION[id]);
      return byCell.get(`${col + STEP[dir][0]},${row + STEP[dir][1]}`) ?? null;
    },
    routes,
  };
}
