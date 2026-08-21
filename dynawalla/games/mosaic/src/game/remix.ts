/**
 * THE REMIX — the window is still being built while you are breaking it.
 *
 * Before this, a MOSAIC board was a single event: the wall was generated once,
 * and from then until the wave cleared the only thing that ever happened to it
 * was that panes left. The middle of a board was the beginning of that board
 * with fewer tiles in it, every time, and the founder's note is the exact
 * consequence: "it just calmly knocks out all of the even numbers and cracks
 * all of the odd ones and just bounces around, not that fun".
 *
 * So the wall now keeps working. On a seeded, jittered schedule one of three
 * things happens to it:
 *
 *   RE-GLAZE  a mirrored pair of panes falls into empty cells and sets there.
 *             The window fills back in behind you, so a board that has been
 *             half-emptied is a different board rather than a smaller one.
 *   KINDLE    a mirrored pair of *stone* catches light and becomes a target.
 *             The field of targets is re-drawn under a wall you thought you
 *             had read.
 *   TURN      the whole rose starts drifting sideways on a new amplitude and a
 *             new period. Nothing about the maths changes; the aim does.
 *
 * ---------------------------------------------------------------------------
 * THE THREE RULES THAT KEEP IT HONEST
 * ---------------------------------------------------------------------------
 *
 * 1. **Nothing a child is aiming at is ever taken away.** A live target never
 *    stops being a target, never stops being alive, and never changes its face.
 *    Kindling is strictly stone → glass; there is no path back. Re-glazing only
 *    ever writes into a cell that is *empty*. So every remix is additive from
 *    where the child is standing: the worst case is a gift they did not plan
 *    for, never a tile that vanished from under a shot.
 *
 * 2. **The board provably converges.** Targets added over a whole wave are hard
 *    capped at `budget` (about a third of the wall's opening count), and no
 *    target may be added at all once three or fewer are left standing. Total
 *    targets a wave can ever contain is therefore `guiltyTotal + budget`, a
 *    finite number, and every break removes one permanently. A wave cannot be
 *    remixed into being unwinnable, and it cannot be remixed into being endless.
 *
 * 3. **It is not a clock.** Every beat here is wall-side. None of it shortens
 *    the time a child has to think about anything: the forge — the one place
 *    MOSAIC asks a question — is untimed apart from its own constant, generous,
 *    unpunished close, and the remix does not touch it. Movement is difficulty
 *    of *aim*, which is a skill the child chooses to spend, and speed here is
 *    rewarded (a faster clear pays a bigger bonus) and nowhere enforced.
 */
import { Rng, subSeed } from "../rng.ts";
import type { Sim, SimEvent } from "./state.ts";
import type { Tile, TileKind, Wave } from "./wall.ts";
import { colourAt, faceFor, MASONRY_HP, MAX_SWAY_CELLS, stageFor } from "./wall.ts";

/** Seconds between remix beats, jittered inside this band. */
export const BEAT_MIN = 4.5;
export const BEAT_MAX = 7.5;

/** Seconds a re-glazed pane spends in the air before it is solid. */
export const DROP_SECONDS = 0.42;

/**
 * Targets remaining at which the remix stops adding any more.
 *
 * The endgame belongs to the child. Once the wall is down to its last few
 * targets, hunting them is the game, and a new one appearing behind you at that
 * point is not variety, it is the finish line moving.
 */
export const ENDGAME_LOCK = 3;

/** Share of the opening target count the remix may add over a whole wave. */
const BUDGET_SHARE = 0.35;

/**
 * Share of the opening wall the remix may re-lead as STONE over a whole wave.
 *
 * Stone has its own budget because it is the one thing here that lengthens a
 * board without adding anything to do. Measured over 240 headless waves,
 * unlimited stone re-glazing took the mean wave from 75 s to 104 s while adding
 * no maths at all; capped, it costs 15 s and the window still fills back in.
 */
const STONE_SHARE = 0.35;

export type RemixBeat = "reglaze" | "kindle" | "turn";

/** Weighted bag. Re-glazing is the one you see, so it comes up most. */
const BEATS: readonly RemixBeat[] = ["reglaze", "reglaze", "reglaze", "kindle", "kindle", "turn"];

export type Remix = {
  rng: Rng;
  /** Wave-seconds until the next beat. */
  next: number;
  /** Targets this remix has introduced so far this wave. */
  added: number;
  /** Stone panes this remix has re-leaded so far this wave. */
  stone: number;
  /** Hard cap on `stone` — pacing, not correctness. */
  stoneBudget: number;
  /** Hard cap on `added` — rule 2 above, and what the property test checks. */
  budget: number;
  /** Live panes may never exceed the count the wall was born with. */
  ceiling: number;
  /** Beats fired this wave, by kind and in total. Reporting and tests. */
  beats: number;
  fired: { reglaze: number; kindle: number; turn: number };
  /** Sway amplitude in CELLS, so it is resolution-independent. */
  swayAmp: number;
  swayTarget: number;
  swayMax: number;
  swayPeriod: number;
  swayAngle: number;
};

export function createRemix(seed: number, wave: Wave): Remix {
  const rng = new Rng(subSeed(seed, wave.index, 0x7e11c));
  // The opening waves drift barely at all: wave one is the only tutorial this
  // game has, and a swinging wall is a worse place to learn to aim.
  const swayMax = Math.min(MAX_SWAY_CELLS, 0.07 + wave.index * 0.05);
  return {
    rng,
    next: BEAT_MIN + rng.f() * (BEAT_MAX - BEAT_MIN),
    added: 0,
    stone: 0,
    stoneBudget: Math.max(2, Math.round(wave.tiles.length * STONE_SHARE)),
    budget: Math.max(2, Math.round(wave.guiltyTotal * BUDGET_SHARE)),
    ceiling: wave.tiles.length,
    beats: 0,
    fired: { reglaze: 0, kindle: 0, turn: 0 },
    swayAmp: swayMax * 0.5,
    swayTarget: swayMax * (0.4 + rng.f() * 0.6),
    swayMax,
    swayPeriod: 5.5 + rng.f() * 5,
    swayAngle: rng.f() * Math.PI * 2,
  };
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

export function remainingTargets(sim: Sim): number {
  let n = 0;
  for (const t of sim.wave.tiles) if (t.alive && t.guilty) n++;
  return n;
}

function livePanes(sim: Sim): number {
  let n = 0;
  for (const t of sim.wave.tiles) if (t.alive) n++;
  return n;
}

/** Rule 2, as one function. Both halves of it, in one place, so neither drifts. */
export function mayAddTargets(sim: Sim, n: number): boolean {
  return sim.remix.added + n <= sim.remix.budget && remainingTargets(sim) > ENDGAME_LOCK;
}

/** A cell nothing occupies right now: never built, or long since broken. */
function emptyCell(sim: Sim, col: number, row: number): boolean {
  const i = sim.grid[row * sim.wave.cols + col]!;
  if (i < 0) return true;
  const t = sim.wave.tiles[i]!;
  return !t.alive && t.drop <= 0;
}

/** Don't materialise a pane on top of a ball. It would read as a cheat. */
function clearOfBalls(sim: Sim, col: number, row: number): boolean {
  const x = sim.wallX + sim.sway + col * sim.cellW + sim.cellW / 2;
  const y = sim.wallY + sim.descent + row * sim.cellH + sim.cellH / 2;
  for (const b of sim.balls) {
    if (!b.alive) continue;
    if (Math.abs(b.x - x) < sim.cellW * 1.25 && Math.abs(b.y - y) < sim.cellH * 1.25) return false;
  }
  return true;
}

/** The mirrored partner of a column; equal to it on the centre column. */
function mirrorOf(wave: Wave, col: number): number {
  return wave.cols - 1 - col;
}

/**
 * Every mirrored pair of cells passing `ok`, as half-grid coordinates.
 *
 * Working in mirrored pairs is not decoration: the wall's whole art direction
 * is that it is a rose window, and a remix that punched one side would turn it
 * into noise the first time it fired.
 */
function pairs(sim: Sim, ok: (col: number, row: number) => boolean): { col: number; row: number }[] {
  const wave = sim.wave;
  const half = Math.floor((wave.cols - 1) / 2);
  const found: { col: number; row: number }[] = [];
  for (let row = 0; row < wave.rows; row++) {
    for (let col = 0; col <= half; col++) {
      const m = mirrorOf(wave, col);
      if (!ok(col, row)) continue;
      if (m !== col && !ok(m, row)) continue;
      found.push({ col, row });
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// The beats
// ---------------------------------------------------------------------------

function settle(sim: Sim, col: number, row: number, wantGuilty: boolean, out: SimEvent[]): void {
  const wave = sim.wave;
  const rx = sim.remix;
  const stage = stageFor(wave.index);
  const face = faceFor(wave.rule, wantGuilty, rx.rng, stage);
  const kind: TileKind = "glass";
  const hp = wantGuilty ? 1 : MASONRY_HP;
  const i = sim.grid[row * wave.cols + col]!;

  let tile: Tile;
  if (i >= 0) {
    // A cell that has held a pane before. Re-use the object so the tile array
    // and the grid index stay exactly as long as each other for ever.
    tile = wave.tiles[i]!;
    tile.face = face;
    tile.guilty = wantGuilty;
    tile.kind = kind;
    tile.hp = hp;
    tile.alive = true;
    tile.hit = 0;
    tile.warm = 0;
    tile.kindle = 0;
    tile.drop = DROP_SECONDS;
  } else {
    tile = {
      col,
      row,
      face,
      guilty: wantGuilty,
      kind,
      hp,
      colour: colourAt(col, row, wave.cols, wave.palette, wave.bands),
      alive: true,
      hit: 0,
      warm: 0,
      drop: DROP_SECONDS,
      kindle: 0,
    };
    wave.tiles.push(tile);
    sim.grid[row * wave.cols + col] = wave.tiles.length - 1;
  }

  if (wantGuilty) {
    wave.guiltyTotal++;
    rx.added++;
  }
  out.push({
    t: "reglaze",
    x: sim.wallX + sim.sway + col * sim.cellW + sim.cellW / 2,
    y: sim.wallY + sim.descent + row * sim.cellH + sim.cellH / 2,
    tile,
  });
}

/** Panes fall back into the window. Returns false if there was nowhere to put one. */
export function reglaze(sim: Sim, out: SimEvent[]): boolean {
  const rx = sim.remix;
  const slots = pairs(sim, (c, r) => emptyCell(sim, c, r) && clearOfBalls(sim, c, r));
  if (!slots.length) return false;

  // Bias upward: glass is set from the crown down, and a pane arriving in the
  // bottom row would land where the ball is working.
  slots.sort((a, b) => a.row - b.row || a.col - b.col);
  const pick = slots[rx.rng.int(0, Math.max(0, Math.ceil(slots.length / 2) - 1))]!;
  const m = mirrorOf(sim.wave, pick.col);
  const n = m === pick.col ? 1 : 2;
  if (livePanes(sim) + n > rx.ceiling) return false;

  // Match the wall's own share so re-glazing never quietly changes what kind of
  // window this is — and drop stone whenever the target budget is spent, until
  // stone runs out of budget too and the wave simply drains to its end.
  const wantGuilty = mayAddTargets(sim, n) && rx.rng.f() < sim.wave.guiltyShare;
  if (!wantGuilty && rx.stone + n > rx.stoneBudget) return false;
  if (!wantGuilty) rx.stone += n;
  settle(sim, pick.col, pick.row, wantGuilty, out);
  if (n === 2) settle(sim, m, pick.row, wantGuilty, out);
  rx.fired.reglaze++;
  return true;
}

/** Stone catches light. Strictly one-directional: there is no un-kindle. */
export function kindle(sim: Sim, out: SimEvent[]): boolean {
  const rx = sim.remix;
  const wave = sim.wave;
  const stage = stageFor(wave.index);
  const stone = (c: number, r: number): boolean => {
    const i = sim.grid[r * wave.cols + c]!;
    if (i < 0) return false;
    const t = wave.tiles[i]!;
    return t.alive && !t.guilty && t.drop <= 0;
  };
  const slots = pairs(sim, stone);
  if (!slots.length) return false;
  const pick = slots[rx.rng.int(0, slots.length - 1)]!;
  const m = mirrorOf(wave, pick.col);
  const n = m === pick.col ? 1 : 2;
  if (!mayAddTargets(sim, n)) return false;

  for (const col of n === 1 ? [pick.col] : [pick.col, m]) {
    const t = wave.tiles[sim.grid[pick.row * wave.cols + col]!]!;
    t.face = faceFor(wave.rule, true, rx.rng, stage);
    t.guilty = true;
    t.kind = "glass";
    t.hp = 1;
    t.kindle = 1;
    wave.guiltyTotal++;
    rx.added++;
    out.push({
      t: "kindle",
      x: sim.wallX + sim.sway + col * sim.cellW + sim.cellW / 2,
      y: sim.wallY + sim.descent + pick.row * sim.cellH + sim.cellH / 2,
      tile: t,
    });
  }
  rx.fired.kindle++;
  return true;
}

/** The rose takes a new swing. Always succeeds; changes no tile. */
export function turn(sim: Sim, out: SimEvent[]): boolean {
  const rx = sim.remix;
  rx.swayTarget = rx.swayMax * (0.25 + rx.rng.f() * 0.75);
  rx.swayPeriod = 4.5 + rx.rng.f() * 6;
  rx.fired.turn++;
  out.push({ t: "turn" });
  return true;
}

// ---------------------------------------------------------------------------

/**
 * Advance the drift and fire beats. Wave time, so the forge's slow-motion
 * slows the window down with everything else.
 */
export function stepRemix(sim: Sim, dt: number, out: SimEvent[], beats = true): void {
  const rx = sim.remix;

  rx.swayAngle += ((Math.PI * 2) / rx.swayPeriod) * dt;
  if (rx.swayAngle > Math.PI * 2) rx.swayAngle -= Math.PI * 2;
  rx.swayAmp += (rx.swayTarget - rx.swayAmp) * Math.min(1, dt * 0.9);
  sim.sway = Math.min(rx.swayMax, rx.swayAmp) * sim.cellW * Math.sin(rx.swayAngle);

  // The window keeps drifting while the ball sits on the paddle, but nothing is
  // rebuilt under a child who is lining up a shot.
  if (!beats) return;

  rx.next -= dt;
  if (rx.next > 0) return;
  rx.next = BEAT_MIN + rx.rng.f() * (BEAT_MAX - BEAT_MIN);

  // A beat with nothing to do falls through to the next thing rather than
  // being spent on nothing — a board with no empty cells still gets kindled,
  // and a board with no stone left still gets re-glazed.
  const beat = rx.rng.pick(BEATS);
  const order: RemixBeat[] =
    beat === "reglaze"
      ? ["reglaze", "kindle", "turn"]
      : beat === "kindle"
        ? ["kindle", "reglaze", "turn"]
        : ["turn"];
  for (const b of order) {
    const done = b === "reglaze" ? reglaze(sim, out) : b === "kindle" ? kindle(sim, out) : turn(sim, out);
    if (done) break;
  }
  rx.beats++;
}
