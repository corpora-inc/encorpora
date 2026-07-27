/**
 * Pattern generation.
 *
 * A bar is a grid of `cells` equal slices — which is exactly what a denominator
 * is. `cells: 8` means the bar is cut into eighths, the floor is ruled into 8
 * segments, and the notes land on the cuts. When the player answers a gate with
 * `1/8`, the world re-rules itself into 8 and they PLAY the answer they gave.
 *
 * Lane assignment follows metric weight rather than chance, because a random
 * sprinkle of notes does not feel like a groove and a child can tell.
 */

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

/** Lane by metric weight: downbeats are low, backbeats are mid, the rest ride. */
function laneFor(cell: number, cells: number): Lane {
  const beat = (cell * 4) / cells;
  const onBeat = Math.abs(beat - Math.round(beat)) < 1e-9;
  if (cells === 2 || cells % 4 === 0) {
    if (onBeat) {
      const b = Math.round(beat) % 4;
      return b === 0 || b === 2 ? 0 : 1;
    }
    return 2;
  }
  // 3, 6, 12: a cyclic three-feel. Every third cell is the anchor.
  const m = cell % 3;
  return m === 0 ? 0 : m === 1 ? 2 : 1;
}

export type BarSpec = {
  bar: number;
  cells: number;
  accentEvery: number;
  /** 0..1, how much of the grid is filled beyond the structural notes */
  density: number;
  difficulty: number;
  /** true for the payoff bars right after a correct gate */
  showcase: boolean;
};

/**
 * One bar of groove. Structural notes (bar start, backbeats) are always
 * present; everything else is filled by density so the pattern breathes.
 */
export function grooveBar(spec: BarSpec, out: ChartNote[]): ChartNote[] {
  out.length = 0;
  const { bar, cells, accentEvery, density, difficulty, showcase } = spec;
  const rnd = rngFor(bar * 2654435761 + cells * 40503);

  for (let i = 0; i < cells; i++) {
    const beat = (i * 4) / cells;
    const lane = laneFor(i, cells);
    const accent = i % accentEvery === 0;

    let keep: boolean;
    if (i === 0) {
      keep = true; // the bar always announces itself
    } else if (showcase) {
      keep = true; // the payoff plays the answer in full, every slice
    } else if (lane === 1) {
      keep = true; // never drop a backbeat; it is the spine of the groove
    } else if (lane === 0) {
      keep = rnd() < 0.72 + density * 0.28;
    } else {
      keep = rnd() < density;
    }
    if (keep) out.push({ beat, lane, accent, cell: i, cells });
  }

  // Syncopation: from difficulty 5, occasionally pull a note off the grid into
  // the slot just before a backbeat. This is what stops long runs feeling like
  // a metronome.
  if (!showcase && difficulty >= 5 && cells >= 8 && rnd() < 0.35) {
    const target = Math.round((cells * 3) / 4); // beat 3
    const idx = out.findIndex((n) => n.cell === target);
    if (idx >= 0 && target - 1 > 0 && !out.some((n) => n.cell === target - 1)) {
      const n = out[idx]!;
      n.cell = target - 1;
      n.beat = ((target - 1) * 4) / cells;
      n.accent = true;
    }
  }

  out.sort((a, b) => a.beat - b.beat);
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

/** A near-empty bar: the inhale before a gate, so the question can be read. */
export function inhaleBar(out: ChartNote[]): ChartNote[] {
  out.length = 0;
  out.push({ beat: 0, lane: 0, accent: true, cell: 0, cells: 4 });
  out.push({ beat: 2, lane: 0, accent: false, cell: 2, cells: 4 });
  return out;
}
