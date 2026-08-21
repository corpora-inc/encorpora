/**
 * Pattern generation: the fixed shapes.
 *
 * A bar is a grid of `cells` equal slices — which is exactly what a denominator
 * is. `cells: 8` means the bar is cut into eighths, the floor is ruled into 8
 * segments, and the notes land on the cuts. When the player answers a gate with
 * `1/8`, the world re-rules itself into 8 and they PLAY the answer they gave.
 *
 * The ORDINARY bar — the one the player spends almost every second inside —
 * lives in `groove.ts`, because it is no longer a pure function of the bar
 * index: it evolves. What is left here is the three shapes that are fixed by
 * what they mean, plus the mapping from an answer to a subdivision.
 */

import { laneOf } from "./groove.ts";

export type Lane = 0 | 1 | 2;

export type ChartNote = {
  /** position within the bar, in beats (0..4) */
  beat: number;
  lane: Lane;
  accent: boolean;
  /** which slice of the bar this note sits on, and how many slices there are */
  cell: number;
  cells: number;
};

/** Denominators that are also playable subdivisions of a 4/4 bar. */
export const MUSICAL_CELLS = [2, 3, 4, 6, 8, 12, 16] as const;

export type Subdivision = { cells: number; accentEvery: number };

/**
 * Map a host answer onto a playable subdivision, or null when the answer is not
 * a rhythm (e.g. `37`). Null is normal and the conductor has a generic payoff
 * for it — the game must never be crippled to force the elegant case.
 */
export function subdivisionFor(answer: string): Subdivision | null {
  const t = answer.trim();
  const whole = /^(\d+)$/.exec(t);
  if (whole) {
    const n = Number(whole[1]);
    if ((MUSICAL_CELLS as readonly number[]).includes(n)) {
      return { cells: n, accentEvery: n >= 8 ? 4 : n >= 6 ? 3 : 2 };
    }
    return null;
  }
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (frac) {
    const n = Number(frac[1]);
    const d = Number(frac[2]);
    if (d === 1) return null;
    if (!(MUSICAL_CELLS as readonly number[]).includes(d)) return null;
    // 3/8 accents every 3rd of 8 — the tresillo. 1/8 just accents the beats.
    const accentEvery = n > 1 && n < d ? n : d >= 8 ? 4 : d >= 6 ? 3 : 2;
    return { cells: d, accentEvery };
  }
  return null;
}

function rngFor(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The payoff bar: the answer, played in full.
 *
 * Every slice is struck, because the point of the bar is that the denominator
 * the child just answered with is the thing under their hands. Lane assignment
 * comes from `groove.ts` so the payoff and the groove agree about which lane a
 * slice belongs to — they disagreed once, and a payoff that moves the kick to a
 * lane the player has not been using is a payoff they fumble.
 */
export function showcaseBar(cells: number, accentEvery: number, out: ChartNote[]): ChartNote[] {
  out.length = 0;
  const n = Math.max(2, Math.round(cells));
  const every = Math.max(1, Math.min(Math.round(accentEvery), n));
  for (let i = 0; i < n; i++) {
    out.push({ beat: (i * 4) / n, lane: laneOf(i, n), accent: i % every === 0, cell: i, cells: n });
  }
  return out;
}

/**
 * The showpiece: three against four, performed with two hands.
 *
 * Lanes 0 and 1 hold a four-grid while lane 2 rides a three-grid. The two
 * agree only on beat 1 — which is the common denominator, made audible. This
 * is the same fact as `lcm(3,4) = 12`, except the child solves it with their
 * hands and hears it resolve.
 */
export function polyBar(bar: number, out: ChartNote[]): ChartNote[] {
  out.length = 0;
  const rnd = rngFor(bar * 1013904223 + 77);
  for (let i = 0; i < 4; i++) {
    out.push({
      beat: i,
      lane: i % 2 === 0 ? 0 : 1,
      accent: i === 0,
      cell: i * 3,
      cells: 12,
    });
  }
  for (let i = 0; i < 3; i++) {
    if (i > 0 && rnd() < 0.08) continue;
    out.push({
      beat: (i * 4) / 3,
      lane: 2,
      accent: i === 0,
      cell: i * 4,
      cells: 12,
    });
  }
  out.sort((a, b) => a.beat - b.beat);
  return out;
}

/**
 * A near-empty bar: the inhale before a gate, so the question can be read.
 *
 * Two notes, always — the density is the point and `phase` may not touch it.
 * What `phase` moves is WHERE the second one falls, and that matters for a
 * reason beyond taste: the inhale used to be byte-identical every single time,
 * and a cycle carries three or four of them, so a long run was full of
 * verbatim-repeating phrases even when the groove itself was evolving. Both
 * notes also used to land in lane 0, which meant the sparsest bar in the game
 * — the one a beginner has the most time to look at — taught them nothing
 * about the other two lanes.
 */
export function inhaleBar(phase: number, out: ChartNote[]): ChartNote[] {
  out.length = 0;
  out.push({ beat: 0, lane: 0, accent: true, cell: 0, cells: 4 });
  const second = [2, 3, 2, 1][((phase % 4) + 4) % 4]!;
  out.push({ beat: second, lane: laneOf(second, 4), accent: false, cell: second, cells: 4 });
  return out;
}
