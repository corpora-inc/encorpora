/**
 * THE GROOVE THAT KEEPS EVOLVING.
 *
 * The founder, on the failure state and on what should replace it:
 *
 *   "Not start over into the same tune that you get tired of - continue into
 *    further evolution adapting the difficulty. And we want to flex the
 *    continuous evolution and variability."
 *
 * What shipped could not do that. `grooveBar` was seeded from `bar * 2654435761
 * + cells * 40503` — deterministic in the bar index, which sounds like variety
 * and is not: `cells` only ever changed when a child answered a gate with a
 * musical denominator, so a measured four-minute run of an ordinary player
 * produced ONE distinct bar shape, `cells: 4`, two hundred and twenty-two times.
 * The top lane never received a single note, because at `cells: 4` every cell
 * lands on a beat and only off-beat cells were routed there.
 *
 * ## What this is
 *
 * A small mutable `Groove` — the subdivision, the accent period, a rotation
 * phase and a mutation seed — that the transport advances ONE STEP PER BAR. The
 * step is stochastic, small, and bounded: the world drifts rather than jumping,
 * so a bar always follows from the one before it, and two hundred bars later
 * you are somewhere you have not been.
 *
 * ## The one knob
 *
 * `intensity` is the shared `game-pacing` scalar, [0,1], and it drives the
 * subdivision AND the note count together. Both directions: a player who is
 * missing notes watches the world thin out and slow down, which is the founder's
 * "if you keep sucking and losing then it should just get easier/stay easy".
 *
 * ## The lane quota
 *
 * Notes are picked from the grid in METRIC WEIGHT order — a groove is not a
 * random sprinkle and a child can tell — but from the third note onwards the
 * pick is constrained so that every lane gets one. That is the fix for the
 * empty top third, and it is a rule rather than a tuning: a drummer's hi-hat is
 * the most CONSTANT voice in a beat, not the leftover after the kick and snare
 * have taken what they want.
 */

import type { ChartNote, Lane } from "./chart.ts";

/** Denominators that are also playable subdivisions of a 4/4 bar. */
export const CELL_LADDER = [2, 4, 8, 6, 12, 16] as const;

export type Groove = {
  /** how many equal slices the bar — and the floor — is ruled into */
  cells: number;
  /** every nth slice is accented */
  accentEvery: number;
  /** rotation of the mutation mask, in cells; drifts so a motif does not sit still */
  phase: number;
  /** advanced every bar; the only source of per-bar variation */
  seed: number;
  /** bars since `cells` last changed — a subdivision is given time to be heard */
  held: number;
};

export function newGroove(seed = 0x5eed1e): Groove {
  return { cells: 4, accentEvery: 2, phase: 0, seed: seed >>> 0, held: 0 };
}

/** xorshift-ish step. Mutates `g.seed` and returns a float in [0,1). */
function roll(g: Groove): number {
  let a = (g.seed + 0x6d2b79f5) >>> 0;
  g.seed = a;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * The deepest subdivision this intensity is allowed to reach.
 *
 * Never below FOUR, and that is a legibility constraint rather than a
 * difficulty one: a bar cut into halves has two slices, so it has room for two
 * notes, so it cannot put a note in each of the three lanes. Two of the three
 * lanes standing empty is what the top of the field looked like for the whole
 * opening of every run that ever shipped. `2` remains in the ladder because a
 * child can answer `1/2` and must then get to PLAY halves — `ruleInto` — but
 * the evolution never chooses it on its own.
 */
export const MIN_CELLS = 4;

export function cellCeiling(intensity: number): number {
  const i = intensity < 0 ? 0 : intensity > 1 ? 1 : intensity;
  // Index into the ladder rather than a raw number, so every rung is a
  // denominator a child can be asked about and can play.
  const rung = Math.min(CELL_LADDER.length - 1, Math.floor(i * CELL_LADDER.length));
  let ceil = MIN_CELLS;
  for (let k = 0; k <= rung; k++) ceil = Math.max(ceil, CELL_LADDER[k]!);
  return ceil;
}

/**
 * How many notes a bar of `cells` carries at this intensity.
 *
 * The floor is THREE, and that is the survivability number: three notes in a
 * 4/4 bar at 92 BPM is one note every 0.87 s, which is a half-time feel a
 * beginner can physically follow, and it is exactly enough to put one note in
 * each of the three lanes.
 *
 * A bar with fewer than three slices obviously cannot carry three notes, so the
 * clamp to `cells` is applied LAST. Written the other way round it returned
 * three notes for a two-slice bar, which the caller would then have had to
 * silently drop — the kind of quiet disagreement between a target and a grid
 * that is impossible to see from the outside.
 */
export function noteTarget(cells: number, intensity: number): number {
  const i = intensity < 0 ? 0 : intensity > 1 ? 1 : intensity;
  const full = Math.max(3, Math.round(cells * 0.82));
  const n = Math.round(3 + (full - 3) * i);
  return Math.min(Math.max(2, Math.round(cells)), Math.max(3, n));
}

/**
 * Metric weight of a slice: how much a drummer wants a note there.
 *
 * Downbeat first, then beat 3, then the backbeats, then the "and"s, then the
 * sixteenths. Ties are broken by the groove's live seed, which is what makes two
 * bars at the same intensity and the same subdivision different bars.
 */
export function metricWeight(cell: number, cells: number): number {
  const beat = (cell * 4) / cells;
  const near = (x: number): boolean => Math.abs(beat - x) < 1e-9;
  if (near(0)) return 100;
  if (near(2)) return 90;
  if (near(1) || near(3)) return 80;
  if (Math.abs(beat - Math.round(beat)) < 1e-9) return 70;
  if (Math.abs(beat * 2 - Math.round(beat * 2)) < 1e-9) return 55;
  if (Math.abs(beat * 3 - Math.round(beat * 3)) < 1e-9) return 45;
  return 35;
}

/**
 * Which lane a slice belongs to. Kick low, snare mid, everything off the pulse
 * rides the hat.
 *
 * This is the same metric-weight idea the shipped `laneFor` used, with one
 * change: a bar that has no off-beat slices at all (`cells: 2`, `cells: 4`) used
 * to leave lane 2 permanently empty, so the top third of the field was dead for
 * the entire opening of every run. Now the SECOND half of an on-beat-only bar
 * rides, which is a half-time feel rather than a hole.
 */
export function laneOf(cell: number, cells: number): Lane {
  // A THREE-FEEL grid — 3 and 6 slices — has only two slices that land on a
  // beat at all, and both of them are downbeat-family, so the on-beat rule
  // below leaves lane 1 permanently empty. `groove.test.ts` catches it: "a bar
  // of 6 slices can only ever reach lanes 0,2". Six is a rung the evolution
  // genuinely visits, so this is not a corner case. The cycle of three is what
  // a drummer plays over it, and it fills all three lanes by construction.
  if (cells % 3 === 0 && cells % 4 !== 0) {
    const m = cell % 3;
    return m === 0 ? 0 : m === 1 ? 2 : 1;
  }
  const beat = (cell * 4) / cells;
  const onBeat = Math.abs(beat - Math.round(beat)) < 1e-9;
  if (!onBeat) return 2;
  if (cells <= 2) return cell === 0 ? 0 : 1;
  if (cells <= 4) {
    // 0 -> kick, 1 -> snare, 2 -> kick, 3 -> ride
    const b = Math.round(beat) % 4;
    return b === 0 || b === 2 ? 0 : b === 1 ? 1 : 2;
  }
  const b = Math.round(beat) % 4;
  return b === 0 || b === 2 ? 0 : 1;
}

/**
 * One bar, chosen from the grid by weight with a lane quota.
 *
 * `out` is reused across bars — this runs on the planner's 22 ms timer and must
 * not allocate.
 */
export function grooveBar(g: Groove, intensity: number, out: ChartNote[]): ChartNote[] {
  out.length = 0;
  const cells = Math.max(2, Math.round(g.cells));
  const target = noteTarget(cells, intensity);

  // Score every slice once. The jitter is small enough that it only ever
  // reorders slices of the SAME weight class, so the groove stays a groove.
  const scored: { cell: number; score: number; lane: Lane }[] = [];
  for (let c = 0; c < cells; c++) {
    const rotated = (c + g.phase) % cells;
    const jitter = roll(g) * 9;
    scored.push({
      cell: c,
      score: metricWeight(rotated, cells) + jitter,
      lane: laneOf(c, cells),
    });
  }
  scored.sort((a, b) => b.score - a.score);

  const taken = new Set<number>();
  const push = (cell: number): void => {
    if (taken.has(cell)) return;
    taken.add(cell);
  };

  // The downbeat always announces the bar.
  push(0);
  for (const s of scored) {
    if (taken.size >= target) break;
    push(s.cell);
  }

  // Lane quota: from three notes up, no lane may be empty. The cheapest slice
  // that fixes it is swapped in for the weakest slice in an over-served lane.
  if (target >= 3) {
    for (let lane = 0 as Lane; lane < 3; lane = (lane + 1) as Lane) {
      const has = [...taken].some((c) => laneOf(c, cells) === lane);
      if (has) continue;
      const want = scored.find((s) => s.lane === lane && !taken.has(s.cell));
      if (!want) continue;
      // drop the weakest taken slice from whichever lane has the most, never
      // the downbeat
      let drop = -1;
      let dropScore = Infinity;
      const count = [0, 0, 0];
      for (const c of taken) count[laneOf(c, cells)]!++;
      for (const s of scored) {
        if (!taken.has(s.cell) || s.cell === 0) continue;
        if (count[s.lane]! <= 1) continue;
        if (s.score < dropScore) {
          dropScore = s.score;
          drop = s.cell;
        }
      }
      if (drop >= 0) taken.delete(drop);
      taken.add(want.cell);
    }
  }

  const accentEvery = Math.max(1, Math.round(g.accentEvery));
  for (const cell of [...taken].sort((a, b) => a - b)) {
    out.push({
      beat: (cell * 4) / cells,
      lane: laneOf(cell, cells),
      accent: cell % accentEvery === 0,
      cell,
      cells,
    });
  }
  return out;
}

/**
 * Advance the groove one bar.
 *
 * Three independent drifts, each one small:
 *
 *  - the ROTATION moves every few bars, which reshuffles which slices of a
 *    weight class are favoured and so changes the motif without changing its
 *    density or its subdivision;
 *  - the ACCENT PERIOD wanders between 2, 3 and 4, which is where a bar stops
 *    sounding like 4/4 and starts sounding like a tresillo;
 *  - the SUBDIVISION follows `intensity`, but only ever by one rung and only
 *    after the current one has been held for a few bars, so a child hears the
 *    denominator they are playing before it becomes another one.
 *
 * `intensity` is the only outside input, which is what makes this the mechanism
 * for "adjust and vary itself as you go on".
 */
export function evolve(g: Groove, intensity: number): void {
  g.held++;

  if (roll(g) < 0.34) g.phase = (g.phase + 1 + Math.floor(roll(g) * 2)) % Math.max(1, g.cells);

  if (roll(g) < 0.16) {
    const options = g.cells >= 8 ? [2, 3, 4] : g.cells >= 6 ? [2, 3] : [2, 4];
    g.accentEvery = options[Math.floor(roll(g) * options.length)] ?? 2;
  }

  const ceil = cellCeiling(intensity);
  // A world left ruled into halves by a `1/2` answer does not linger there:
  // two slices cannot fill three lanes. One bar of it is the payoff; more is a
  // hole in the top of the field.
  if (g.cells < MIN_CELLS && g.held >= 1) {
    g.cells = MIN_CELLS;
    g.held = 0;
    return;
  }
  if (g.held >= 4) {
    const at = CELL_LADDER.indexOf(g.cells as (typeof CELL_LADDER)[number]);
    const idx = at < 0 ? 1 : at;
    if (g.cells > ceil) {
      // Coming down is not made to wait. Relief is not earned.
      g.cells = Math.max(MIN_CELLS, CELL_LADDER[Math.max(0, idx - 1)]!);
      g.held = 0;
    } else if (g.cells < ceil && roll(g) < 0.5) {
      g.cells = CELL_LADDER[Math.min(CELL_LADDER.length - 1, idx + 1)]!;
      g.held = 0;
    }
  }
  if (g.accentEvery > g.cells) g.accentEvery = 2;
}

/** Re-rule the world into a denominator the child just answered with. */
export function ruleInto(g: Groove, cells: number, accentEvery: number, intensity: number): void {
  const ceil = cellCeiling(intensity);
  g.cells = Math.max(2, Math.min(cells, Math.max(ceil, 4)));
  g.accentEvery = Math.max(1, Math.min(accentEvery, g.cells));
  g.held = 0;
}

/** A stable name for one bar's shape, for tests that measure variety. */
export function barSignature(notes: readonly ChartNote[], cells: number): string {
  let s = `${cells}:`;
  for (const n of notes) s += `${n.cell}${n.accent ? "*" : ""}.`;
  return s;
}
