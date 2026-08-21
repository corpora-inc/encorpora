/**
 * Wall generation.
 *
 * Every wall is mirror-symmetric about its vertical axis — the cut-out shape,
 * the colour banding, and (deliberately) *which tiles are guilty*. The values
 * differ left and right; only the guilt mirrors. So a child who spots that the
 * third tile in from the left pops learns for free that the third from the
 * right will too, and the wall reads as a designed rose window rather than
 * noise. Symmetry is both the art direction and one of the maths ideas.
 */
import { Rng, subSeed } from "../rng.ts";
import type { Face, Op } from "./rules.ts";
import { faceExpr, faceFrac, faceInt, guilty } from "./rules.ts";
import type { Rule } from "./rules.ts";
import { int, rat } from "./rational.ts";

export type TileKind = "glass" | "crystal" | "star";

/** Chips a masonry tile takes before it gives way. */
export const MASONRY_HP = 3;

/** A wall thinner than this does not read as a window before it is carved. */
const MIN_TILES = 26;

/**
 * The floor a carve may not take the wall below.
 *
 * The layout masks are chosen against `MIN_TILES` so there is something solid
 * to carve *from*; the carve is then allowed to open the window right down to
 * here. Twenty panes still reads as a rose and leaves plenty to break.
 */
const CARVE_FLOOR = 20;

/**
 * How far the window may drift sideways, as a fraction of one cell.
 *
 * Bounded by the stone frame rather than by the glass: `drawTracery` draws
 * `TRACERY_BLEED` units outside the tile grid on every side, so the number that
 * has to fit inside the wall margin is `MAX_SWAY_CELLS * cellW + TRACERY_BLEED`,
 * not the sway alone. At 0.42 the tiles stayed on screen and the frame did not.
 */
export const MAX_SWAY_CELLS = 0.26;

/** How far outside the tile grid the stone frame is drawn. See `drawTracery`. */
export const TRACERY_BLEED = 24;

export type Tile = {
  col: number;
  row: number;
  face: Face;
  guilty: boolean;
  kind: TileKind;
  /** Hits remaining. Masonry is Infinity-ish (never breaks); crystal starts at 2. */
  hp: number;
  colour: number;
  alive: boolean;
  /** Cosmetic: 0..1, decays. Set on a bounce so masonry visibly answers. */
  hit: number;
  /** Cosmetic: 0..1, set when the ball passes close and the tile is guilty. */
  warm: number;
  /**
   * Seconds left of a pane's fall into its cell.
   *
   * A re-glazed pane is `alive` from the instant it is scheduled — so the wave
   * cannot declare itself clear while one is still in the air — but it is not
   * *there* yet, so `tileAt` refuses to return it and nothing can collide with
   * it. Zero for every tile the wall was born with.
   */
  drop: number;
  /** Cosmetic: 0..1, decays. The flash of masonry catching light. */
  kindle: number;
};

export type Wave = {
  index: number;
  rule: Rule;
  cols: number;
  rows: number;
  tiles: Tile[];
  guiltyTotal: number;
  /** Virtual units per second the whole wall creeps toward the paddle. */
  descentRate: number;
  ballSpeed: number;
  layout: string;
  /** How many cells the carve took out of the layout mask. Reporting only. */
  carved: number;
  /** Share of this wall's panes that are targets — what re-glazing matches. */
  guiltyShare: number;
  /** Colour-band parameters, kept so a re-glazed pane joins the same design. */
  palette: number;
  bands: number;
};

const LAYOUTS = [
  "solid",
  "arch",
  "rose",
  "chevron",
  "columns",
  "checker",
  "stair",
  "frame",
  "lattice",
] as const;

/** Mirror-symmetric occupancy mask. */
function occupies(layout: string, c: number, r: number, cols: number, rows: number): boolean {
  const cx = (cols - 1) / 2;
  const dx = Math.abs(c - cx);
  const edge = cx;
  switch (layout) {
    case "solid":
      return true;
    case "arch": {
      // A semicircular vault: the top rows narrow toward the crown.
      const t = 1 - r / Math.max(1, rows - 1);
      const halfWidth = edge * Math.sqrt(Math.max(0, 1 - t * t * 0.92)) + 0.6;
      return dx <= halfWidth;
    }
    case "rose": {
      const cyr = (rows - 1) / 2;
      const dy = Math.abs(r - cyr);
      const d = dx / Math.max(0.5, edge) + dy / Math.max(0.5, cyr);
      return d <= 1.05;
    }
    case "chevron": {
      const band = Math.round(dx * 0.85);
      return (r + band) % 3 !== 2;
    }
    case "columns":
      return dx < 0.6 || Math.round(dx) % 2 === 1 || r === 0 || r === rows - 1;
    case "checker":
      return (c + r) % 2 === 0 || r % 4 === 0;
    case "stair": {
      const step = Math.floor(dx);
      return r >= step * 0.7 && r < rows - Math.floor(step * 0.35);
    }
    case "frame":
      return r === 0 || r === rows - 1 || dx > edge - 1.2 || r === Math.floor(rows / 2);
    case "lattice":
      return !(c % 3 === 1 && r % 2 === 1);
    default:
      return true;
  }
}

/**
 * The carve — the difference between nine walls and an unbounded supply.
 *
 * The nine layout masks are hand-written shapes, and nine shapes played at two
 * column counts is fourteen distinct openings in the entire game: measured over
 * four hundred seeds, wave one was *one* shape — a filled 9×4 rectangle, every
 * single run, for ever. The founder's word for it was "boring", and he was
 * describing a fact rather than a feeling.
 *
 * So the mask now only says what *kind* of window this is. The carve says which
 * one: one to three elliptical voids punched out of it, plus a scatter of single
 * missing panes, all at seeded positions. Every cut is made at a cell **and at
 * its mirror**, so the result is still a designed rose window — sparser, holed,
 * asymmetric top-to-bottom, and different every run — rather than a chewed edge.
 *
 * A cut that would take the wall below `CARVE_FLOOR` is rolled back whole, so
 * the floor is a guarantee and not a tendency.
 */
function carve(grid: boolean[][], cols: number, rows: number, rng: Rng): number {
  const half = Math.floor((cols - 1) / 2);
  const count = (): number => {
    let n = 0;
    for (const row of grid) for (const on of row) if (on) n++;
    return n;
  };
  const before = count();

  /** Apply `cut` to the half-grid and its mirror; roll back if it goes too far. */
  const attempt = (cut: (c: number, r: number) => boolean): void => {
    const snapshot = grid.map((row) => row.slice());
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= half; c++) {
        if (!cut(c, r)) continue;
        grid[r]![c] = false;
        grid[r]![cols - 1 - c] = false;
      }
    }
    if (count() >= CARVE_FLOOR) return;
    for (let r = 0; r < rows; r++) grid[r] = snapshot[r]!;
  };

  const voids = rng.int(1, 3);
  for (let v = 0; v < voids; v++) {
    const cc = rng.int(0, half);
    const cr = rng.int(0, rows - 1);
    const rx = 0.55 + rng.f() * 1.7;
    const ry = 0.45 + rng.f() * 1.25;
    attempt((c, r) => {
      const dx = (c - cc) / rx;
      const dy = (r - cr) / ry;
      return dx * dx + dy * dy <= 1;
    });
  }

  // Panes that were simply never fitted. One at a time, so each is rolled back
  // on its own and the scatter stops exactly at the floor.
  const speckle = rng.int(0, 5);
  for (let s = 0; s < speckle; s++) {
    const sc = rng.int(0, half);
    const sr = rng.int(0, rows - 1);
    if (!grid[sr]![sc]) continue;
    attempt((c, r) => c === sc && r === sr);
  }

  return before - count();
}

/** Colour index from a symmetric function so the wall reads as a design. */
export function colourAt(c: number, r: number, cols: number, palette: number, bands: number): number {
  const cx = (cols - 1) / 2;
  const dx = Math.abs(c - cx);
  const v = Math.round(dx * 0.9 + r * 0.6 + palette);
  return ((v % bands) + bands) % bands;
}

// ---------------------------------------------------------------------------
// Rule ladder
// ---------------------------------------------------------------------------

/**
 * Wave 1 is `× 2`. Everyone succeeds in five seconds and learns the grammar by
 * breaking something, which is the only tutorial this game has or needs.
 */
export function ruleForWave(index: number, rng: Rng): Rule {
  if (index === 0) return { kind: "multiple", target: int(2) };
  if (index === 1) return { kind: "multiple", target: int(5) };
  if (index === 2) return { kind: "equals", target: int(rng.int(9, 15)) };

  const stage = Math.min(6, Math.floor(index / 3));
  const bag: Rule[] = [];

  const mulTable = [3, 4, 6, 7, 8, 9, 11, 12];
  const mulHi = Math.min(mulTable.length, 3 + stage);
  bag.push({ kind: "multiple", target: int(mulTable[rng.int(0, mulHi - 1)]!) });
  bag.push({ kind: "multiple", target: int(mulTable[rng.int(0, mulHi - 1)]!) });

  const factorTargets = [12, 18, 20, 24, 30, 36, 48, 60, 72];
  bag.push({
    kind: "factor",
    target: int(factorTargets[rng.int(0, Math.min(factorTargets.length - 1, 2 + stage))]!),
  });

  bag.push({ kind: "equals", target: int(rng.int(10, 12 + stage * 8)) });

  if (stage >= 1) {
    const n = rng.int(2, 6) * 10 + rng.int(0, 9);
    bag.push(rng.chance(1, 2) ? { kind: "greater", target: int(n) } : { kind: "less", target: int(n) });
  }

  if (stage >= 2) {
    const halves: [number, number][] = [
      [1, 2],
      [1, 3],
      [2, 3],
      [1, 4],
      [3, 4],
      [1, 5],
      [2, 5],
      [1, 10],
    ];
    const [n, d] = rng.pick(halves);
    const percent = (n * 100) % d === 0 && rng.chance(1, 2);
    bag.push({ kind: "equals", target: rat(n, d), asPercent: percent });
  }

  return rng.pick(bag);
}

// ---------------------------------------------------------------------------
// Face generation
// ---------------------------------------------------------------------------

const OPS_EASY: Op[] = ["+", "−"];
const OPS_HARD: Op[] = ["+", "−", "×", "÷"];

/** An expression whose value is exactly `v`, or a bare integer. */
function exprFor(v: number, rng: Rng, hard: boolean): Face {
  if (v < 0) return faceInt(v);
  const ops = hard ? OPS_HARD : OPS_EASY;
  for (let attempt = 0; attempt < 8; attempt++) {
    const op = rng.pick(ops);
    if (op === "+") {
      if (v < 2) continue;
      const a = rng.int(1, v - 1);
      return faceExpr(a, "+", v - a);
    }
    if (op === "−") {
      const b = rng.int(1, Math.max(1, Math.min(19, 30 - Math.min(20, v))));
      return faceExpr(v + b, "−", b);
    }
    if (op === "×") {
      const divisors: number[] = [];
      for (let k = 2; k * k <= v; k++) if (v % k === 0) divisors.push(k);
      if (!divisors.length) continue;
      const a = rng.pick(divisors);
      return faceExpr(a, "×", v / a);
    }
    const b = rng.int(2, 9);
    if (v * b > 144) continue;
    return faceExpr(v * b, "÷", b);
  }
  return faceInt(v);
}

/**
 * Generate a face for one cell.
 *
 * Innocent faces are near-misses on purpose — one away from a multiple, a
 * divisor of the wrong number, a sum off by ten. The wall is full of real
 * mal-rule outputs, so scanning it is the same cognitive act as choosing
 * between distractors, just with a ball involved.
 */
export function makeFace(rule: Rule, wantGuilty: boolean, rng: Rng, stage: number): Face {
  const hard = stage >= 2;
  switch (rule.kind) {
    case "multiple": {
      const k = rule.target.n;
      const span = 6 + stage * 3;
      if (wantGuilty) {
        const m = rng.int(1, span);
        const v = k * m;
        return stage >= 2 && rng.chance(1, 3) ? exprFor(v, rng, hard) : faceInt(v);
      }
      let off = rng.int(1, k - 1);
      if (k === 2) off = 1;
      const v = k * rng.int(1, span) + off;
      return stage >= 2 && rng.chance(1, 4) ? exprFor(v, rng, hard) : faceInt(v);
    }
    case "factor": {
      const N = rule.target.n;
      const divisors: number[] = [];
      for (let k = 1; k <= N; k++) if (N % k === 0) divisors.push(k);
      if (wantGuilty) return faceInt(rng.pick(divisors));
      for (let attempt = 0; attempt < 24; attempt++) {
        const near = rng.pick(divisors) + (rng.chance(1, 2) ? 1 : -1);
        if (near > 1 && N % near !== 0) return faceInt(near);
      }
      for (let k = 2; k <= N; k++) if (N % k !== 0) return faceInt(k);
      return faceInt(N + 1);
    }
    case "equals": {
      if (rule.target.d !== 1) {
        const { n, d } = rule.target;
        if (wantGuilty) {
          const k = rng.int(1, 6);
          return faceFrac(n * k, d * k);
        }
        for (let attempt = 0; attempt < 24; attempt++) {
          const k = rng.int(1, 5);
          const dn = rng.chance(1, 2) ? 1 : -1;
          const nn = n * k + dn;
          const dd = d * k + (rng.chance(1, 3) ? dn : 0);
          if (nn > 0 && dd > 1 && nn * d !== n * dd) return faceFrac(nn, dd);
        }
        return faceFrac(n + 1, d + 2);
      }
      const V = rule.target.n;
      if (wantGuilty) return exprFor(V, rng, hard);
      const offsets = [1, -1, 2, -2, 10, -10, 9, -9, 11];
      for (let attempt = 0; attempt < 12; attempt++) {
        const v = V + rng.pick(offsets);
        if (v > 0 && v !== V) return exprFor(v, rng, hard);
      }
      return faceInt(V + 1);
    }
    case "greater":
    case "less": {
      const N = rule.target.n;
      const want = rule.kind === "greater" ? wantGuilty : !wantGuilty;
      const v = want ? N + rng.int(1, 25) : Math.max(0, N - rng.int(1, Math.min(N, 25)));
      return stage >= 1 && rng.chance(1, 2) ? exprFor(v, rng, hard) : faceInt(v);
    }
  }
}

// ---------------------------------------------------------------------------

export type WaveOptions = { seed: number; index: number };

/** The difficulty rung a wave sits on. Pure function of the wave index. */
export function stageFor(index: number): number {
  return Math.min(6, Math.floor(index / 3));
}

/**
 * A face with the guilt the caller asked for, belt-and-braces checked.
 *
 * The generator is the only source of truth for guilt, so the answer is
 * verified and a drifting family falls back to the stage-0 path. Shared with
 * the remix, so a pane that drops in mid-wave is generated by exactly the same
 * code as a pane the wall was born with — there is no second face generator to
 * disagree with this one.
 */
export function faceFor(rule: Rule, wantGuilty: boolean, rng: Rng, stage: number): Face {
  const face = makeFace(rule, wantGuilty, rng, stage);
  if (guilty(rule, face.value) === wantGuilty) return face;
  return makeFace(rule, wantGuilty, rng, 0);
}

/**
 * The opening wall is deliberately gentle, but it is no longer a rectangle.
 *
 * Wave one used to be hard-coded to `solid`, which is why it was the same
 * thirty-six-pane block in every run the game has ever played. It now draws
 * from the shapes that stay legible at four or five rows — no `frame`, which is
 * a maze, and no `chevron`, whose diagonal banding needs height to read — and
 * then gets carved like every other wall.
 */
const OPENING_LAYOUTS = ["solid", "arch", "rose", "stair", "checker", "lattice"] as const;

export function buildWave({ seed, index }: WaveOptions): Wave {
  const rng = new Rng(subSeed(seed, index, 0x51ed));
  const stage = stageFor(index);

  const rule = ruleForWave(index, rng);
  const cols = index === 0 ? 9 : 9 + rng.int(0, 1) * 2; // 9 or 11, always odd
  const palette = rng.int(0, 5);
  const bands = 4 + rng.int(0, 2);

  // 1. Occupancy, mirrored. A sparse layout on few rows can produce a wall too
  //    thin to read as a window, so candidates are tried in a shuffled order
  //    and the first one dense enough wins — deterministic, and never a
  //    fourteen-tile wave.
  // The opening wave is deliberately the smallest wall in the game.
  const baseRows = index === 0 ? 4 + rng.int(0, 1) : Math.min(7, 5 + Math.floor(index / 5));
  const candidates =
    index === 0 ? rng.shuffle([...OPENING_LAYOUTS]) : rng.shuffle([...LAYOUTS]);
  let layout = "solid";
  let rows = baseRows;
  let occupied: boolean[][] = [];
  outer: for (const extraRows of [0, 1]) {
    for (const candidate of candidates) {
      const r0 = Math.min(8, baseRows + extraRows);
      const grid: boolean[][] = [];
      let count = 0;
      for (let r = 0; r < r0; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
          const mirrored = cols - 1 - c;
          const on = c <= mirrored ? occupies(candidate, c, r, cols, r0) : grid[r]![mirrored]!;
          grid[r]![c] = on;
          if (on) count++;
        }
      }
      if (count >= MIN_TILES) {
        layout = candidate;
        rows = r0;
        occupied = grid;
        break outer;
      }
    }
  }
  if (!occupied.length) {
    rows = baseRows;
    layout = "solid";
    occupied = [];
    for (let r = 0; r < rows; r++) {
      occupied[r] = new Array(cols).fill(true);
    }
  }

  // 1b. Carve. The mask picked the family; this picks the individual.
  const carved = carve(occupied, cols, rows, rng);

  // 2. Guilt, mirrored. Aim for a share of the wall that keeps every wave
  //    winnable inside a couple of minutes without becoming a chore.
  const share = index === 0 ? 0.62 : 0.6 - Math.min(0.14, stage * 0.025);
  const guiltyMask: boolean[][] = [];
  const half = Math.ceil(cols / 2);
  for (let r = 0; r < rows; r++) guiltyMask[r] = new Array(cols).fill(false);
  const halfCells: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < half; c++) if (occupied[r]![c]) halfCells.push([c, r]);
  }
  rng.shuffle(halfCells);
  const wantHalf = Math.max(3, Math.round(halfCells.length * share));
  for (let i = 0; i < Math.min(wantHalf, halfCells.length); i++) {
    const [c, r] = halfCells[i]!;
    guiltyMask[r]![c] = true;
    guiltyMask[r]![cols - 1 - c] = true;
  }

  // 3. Faces + tile kinds.
  const tiles: Tile[] = [];
  let guiltyTotal = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!occupied[r]![c]) continue;
      const wantGuilty = guiltyMask[r]![c]!;
      const face = faceFor(rule, wantGuilty, rng, stage);
      const isGuilty = guilty(rule, face.value);
      let kind: TileKind = "glass";
      // Masonry is not indestructible, only stubborn: three chips, and only
      // once the anti-stall erosion has kicked in (see `sim.ts`).
      let hp = isGuilty ? 1 : MASONRY_HP;
      if (isGuilty) {
        if (stage >= 1 && rng.chance(1, 8)) {
          kind = "star";
        } else if (stage >= 3 && rng.chance(1, 6)) {
          kind = "crystal";
          hp = 2;
        }
        guiltyTotal++;
      }
      tiles.push({
        col: c,
        row: r,
        face,
        guilty: isGuilty,
        kind,
        hp,
        colour: colourAt(c, r, cols, palette, bands),
        alive: true,
        hit: 0,
        warm: 0,
        drop: 0,
        kindle: 0,
      });
    }
  }

  return {
    index,
    rule,
    cols,
    rows,
    tiles,
    guiltyTotal,
    descentRate: index < 2 ? 0 : Math.min(9, 1.2 + (index - 2) * 0.5),
    ballSpeed: Math.min(1250, 820 + index * 28),
    layout,
    carved,
    guiltyShare: guiltyTotal / Math.max(1, tiles.length),
    palette,
    bands,
  };
}
