/**
 * Hand-drawn coastlines. Every island and every landed page is outlined by an
 * irregular, seeded shoreline so the site reads as an engraved map rather than
 * boxes and ovals. Pure functions: the same seed always draws the same coast.
 */

/** Small seeded PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedOf(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

type Pt = [number, number];

interface CoastOptions {
  /** Box the coast is drawn in. */
  w: number;
  h: number;
  /** Distance from the box edge to the mean shoreline. */
  inset: number;
  /** How far bays and headlands swing in or out (px). */
  amp: number;
  seed: number;
  /** Squareness: 2 = ellipse, higher = closer to the box. */
  exp?: number;
  points?: number;
}

/** Points of a closed, wobbly shoreline around the centre of the box. */
export function coastPoints({
  w,
  h,
  inset,
  amp,
  seed,
  exp = 2.4,
  points = 140,
}: CoastOptions): Pt[] {
  const r = rng(seed);
  // A few layered waves give large bays plus small inlets.
  const waves = [
    { f: 2 + Math.floor(r() * 2), a: 1, p: r() * 6.28 },
    { f: 5 + Math.floor(r() * 3), a: 0.55, p: r() * 6.28 },
    { f: 11 + Math.floor(r() * 5), a: 0.28, p: r() * 6.28 },
    { f: 23 + Math.floor(r() * 7), a: 0.14, p: r() * 6.28 },
  ];
  const norm = waves.reduce((s, v) => s + v.a, 0);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - inset;
  const ry = h / 2 - inset;
  const out: Pt[] = [];
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    // Superellipse: |x/rx|^e + |y/ry|^e = 1
    const sx = Math.sign(c) * Math.pow(Math.abs(c), 2 / exp);
    const sy = Math.sign(s) * Math.pow(Math.abs(s), 2 / exp);
    const n = waves.reduce((acc, v) => acc + v.a * Math.sin(v.f * t + v.p), 0) / norm;
    const jitter = (r() - 0.5) * 0.18;
    const d = amp * (n + jitter);
    // Push along the outward normal of the box (approximated by the direction from centre).
    const px = cx + sx * rx;
    const py = cy + sy * ry;
    const len = Math.hypot(px - cx, py - cy) || 1;
    out.push([px + ((px - cx) / len) * d, py + ((py - cy) / len) * d]);
  }
  return out;
}

/** Smooth closed path through the points (Catmull–Rom → cubic Bézier). */
export function smoothPath(p: Pt[]): string {
  const n = p.length;
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n];
    const p1 = p[i];
    const p2 = p[(i + 1) % n];
    const p3 = p[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}

export const coastPath = (o: CoastOptions) => smoothPath(coastPoints(o));

/** Little map glyphs (mountains, trees) scattered in a ring just inside the coast. */
export interface Glyph {
  kind: 'mountain' | 'tree' | 'hill';
  x: number;
  y: number;
  s: number;
}

export function terrain(w: number, h: number, seed: number, count = 9): Glyph[] {
  const r = rng(seed ^ 0x9e3779b9);
  const out: Glyph[] = [];
  for (let i = 0; i < count * 4 && out.length < count; i++) {
    const t = r() * Math.PI * 2;
    // Keep away from the centre band where the island's name sits.
    const k = 0.7 + r() * 0.13;
    const x = w / 2 + Math.cos(t) * (w / 2) * k;
    const y = h / 2 + Math.sin(t) * (h / 2) * k;
    if (Math.abs(y - h / 2) < h * 0.22 && Math.abs(x - w / 2) < w * 0.36) continue;
    const roll = r();
    // Rounded: the server and the browser must print identical numbers (hydration).
    const round = (v: number) => Math.round(v * 10) / 10;
    out.push({
      kind: roll < 0.45 ? 'mountain' : roll < 0.8 ? 'tree' : 'hill',
      x: round(x),
      y: round(y),
      s: round(0.8 + r() * 0.5),
    });
  }
  return out;
}
