/**
 * The simulation.
 *
 * Fixed-step, sub-stepped, grid-indexed. Nothing here touches the DOM, so the
 * whole thing runs headless in a test or a benchmark.
 *
 * Physics notes that matter for feel, in the order they matter:
 *
 * 1. **The paddle is a lens, not a wall.** Where the ball lands across the
 *    paddle sets the outgoing angle (±62°), Arkanoid-style. Speed is preserved
 *    and re-normalised. This is the entire skill ceiling of the genre and every
 *    weak Breakout clone gets it wrong by reflecting the ball geometrically.
 * 2. **Sub-stepping, not swept collision.** Displacement per step is capped
 *    below a third of a cell, so the ball cannot tunnel at any speed the game
 *    can reach, and the code stays simple enough to be obviously correct.
 * 3. **No horizontal death spirals.** |vy| is clamped away from zero after
 *    every deflection, so the ball never grinds along a row for ten seconds.
 */
import { Rng, subSeed } from "../rng.ts";
import type { Ball, PowerKind, Sim, SimEvent } from "./state.ts";
import { VW } from "./state.ts";
import type { Tile, Wave } from "./wall.ts";
import { buildWave, MASONRY_HP } from "./wall.ts";
import { createRemix, stepRemix } from "./remix.ts";

export const TRAIL_LEN = 22;

const MAX_DEFLECT = (62 * Math.PI) / 180;
const MIN_VY_FRAC = Math.sin((17 * Math.PI) / 180);
const WALL_MARGIN = 50;
/**
 * The window hangs at 28% of the playfield height, not at the very top.
 *
 * A wall pinned to the ceiling means the ball spends most of its life crossing
 * empty air, which is the real reason so many Breakout clones feel slow. This
 * is the single biggest pacing number in the game.
 */
const WALL_TOP_FRAC = 0.28;
const WALL_TOP_MIN = 150;
const SUBSTEP_MAX = 9;

export const CHARGE_MAX = 8;

/**
 * Chain length at which the ball goes molten.
 *
 * This is the best moment in the game and the reason the chain matters beyond
 * points. Five targets in a row and the ball stops bouncing off them — it burns
 * *through*, ripping a tunnel across the window in one pass while the chain
 * climbs a scale and the screen shakes itself apart. Masonry still stops it
 * dead, and one wrong tile puts the ball out. So the chain is not "be lucky
 * five times", it is "read five tiles correctly in a row", and the payoff for
 * doing the arithmetic is the single loudest thing on screen.
 */
export const MOLTEN_AT = 5;

/** Seconds without a target falling before the wall starts to give way. */
export const ERODE_AFTER = 12;
/** Seconds without a target falling before the wall starts to creep down. */
export const PRESSURE_AFTER = 7;

export function makeBall(x: number, y: number, speed: number): Ball {
  return {
    x,
    y,
    vx: 0,
    vy: -speed,
    r: 11,
    speed,
    alive: true,
    held: true,
    trail: new Float32Array(TRAIL_LEN * 2),
    trailN: 0,
    sqx: 0,
    sqy: -1,
    squash: 0,
  };
}

function layoutWall(sim: Sim, wave: Wave): void {
  const wallW = VW - WALL_MARGIN * 2;
  sim.cellW = wallW / wave.cols;
  sim.cellH = Math.min(sim.cellW / 1.62, 62);
  sim.wallX = WALL_MARGIN;
  sim.wallY = Math.max(WALL_TOP_MIN, sim.vh * WALL_TOP_FRAC);
  sim.grid = new Int32Array(wave.cols * wave.rows).fill(-1);
  for (let i = 0; i < wave.tiles.length; i++) {
    const t = wave.tiles[i]!;
    sim.grid[t.row * wave.cols + t.col] = i;
  }
}

export function createSim(seed: number, vh: number): Sim {
  const wave = buildWave({ seed, index: 0 });
  const sim: Sim = {
    vh,
    seed,
    wave,
    rule: wave.rule,
    balls: [],
    bolts: [],
    paddleX: VW / 2,
    paddleY: vh - 118,
    paddleW: 156,
    paddleH: 19,
    paddleVX: 0,
    paddleSquash: 0,
    aim: -Math.PI / 2,
    aimDir: 1,
    wallX: 0,
    wallY: 0,
    sway: 0,
    cellW: 0,
    cellH: 0,
    grid: new Int32Array(0),
    beads: 3,
    score: 0,
    combo: 0,
    comboTimer: 0,
    best: 0,
    cleared: 0,
    broken: 0,
    masonryHits: 0,
    charge: 0,
    chargeMax: CHARGE_MAX,
    powers: { wide: 0, slow: 0, laserShots: 0 },
    forge: null,
    remix: createRemix(seed, wave),
    phase: "serve",
    feverT: 0,
    stall: 0,
    descent: 0,
    waveTime: 0,
    runTime: 0,
  };
  layoutWall(sim, wave);
  serve(sim);
  return sim;
}

export function resize(sim: Sim, vh: number): void {
  sim.vh = vh;
  sim.paddleY = vh - 118;
  sim.wallY = Math.max(WALL_TOP_MIN, vh * WALL_TOP_FRAC);
  for (const b of sim.balls) if (b.held) b.y = sim.paddleY - sim.paddleH / 2 - b.r - 1;
}

export function serve(sim: Sim): void {
  sim.balls.length = 0;
  const b = makeBall(sim.paddleX, sim.paddleY - sim.paddleH / 2 - 12, sim.wave.ballSpeed);
  sim.balls.push(b);
  sim.phase = "serve";
  sim.aim = -Math.PI / 2;
  sim.combo = 0;
  sim.comboTimer = 0;
}

export function launch(sim: Sim): void {
  if (sim.phase !== "serve") return;
  const b = sim.balls[0];
  if (!b || !b.held) return;
  b.held = false;
  b.vx = Math.cos(sim.aim) * b.speed;
  b.vy = Math.sin(sim.aim) * b.speed;
  sim.phase = "play";
}

export function nextWave(sim: Sim): void {
  const wave = buildWave({ seed: sim.seed, index: sim.wave.index + 1 });
  sim.wave = wave;
  sim.rule = wave.rule;
  sim.remix = createRemix(sim.seed, wave);
  sim.descent = 0;
  sim.sway = 0;
  sim.stall = 0;
  sim.waveTime = 0;
  sim.broken = 0;
  layoutWall(sim, wave);
  sim.bolts.length = 0;
  serve(sim);
}

export function restart(sim: Sim, seed: number): void {
  sim.seed = seed;
  const wave = buildWave({ seed, index: 0 });
  sim.wave = wave;
  sim.rule = wave.rule;
  sim.beads = 3;
  sim.score = 0;
  sim.cleared = 0;
  sim.broken = 0;
  sim.masonryHits = 0;
  sim.charge = 0;
  sim.combo = 0;
  sim.best = 0;
  sim.powers = { wide: 0, slow: 0, laserShots: 0 };
  sim.forge = null;
  sim.remix = createRemix(seed, wave);
  sim.descent = 0;
  sim.sway = 0;
  sim.stall = 0;
  sim.waveTime = 0;
  sim.runTime = 0;
  sim.feverT = 0;
  layoutWall(sim, wave);
  serve(sim);
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Left edge of the window right now — the base origin plus the drift. */
export function wallLeft(sim: Sim): number {
  return sim.wallX + sim.sway;
}

export function tileX(sim: Sim, col: number): number {
  return wallLeft(sim) + col * sim.cellW;
}
export function tileY(sim: Sim, row: number): number {
  return sim.wallY + row * sim.cellH + sim.descent;
}
export function tileAt(sim: Sim, col: number, row: number): Tile | null {
  const { cols, rows, tiles } = sim.wave;
  if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
  const i = sim.grid[row * cols + col]!;
  if (i < 0) return null;
  const t = tiles[i]!;
  // A pane still in the air is alive — the wave may not clear while one is
  // falling — but it is not yet *there*, so nothing may collide with it.
  return t.alive && t.drop <= 0 ? t : null;
}

export function paddleHalf(sim: Sim): number {
  return (sim.paddleW * (sim.powers.wide > 0 ? 1.72 : 1)) / 2;
}

function speedScale(sim: Sim): number {
  return sim.powers.slow > 0 ? 0.62 : 1;
}

// ---------------------------------------------------------------------------
// Deflection
// ---------------------------------------------------------------------------

function normalise(b: Ball, speed: number): void {
  const m = Math.hypot(b.vx, b.vy) || 1;
  b.vx = (b.vx / m) * speed;
  b.vy = (b.vy / m) * speed;
  // Never let the ball settle into a horizontal grind.
  const minVy = speed * MIN_VY_FRAC;
  if (Math.abs(b.vy) < minVy) {
    const sign = b.vy < 0 ? -1 : 1;
    b.vy = sign * minVy;
    const rem = Math.sqrt(Math.max(0, speed * speed - b.vy * b.vy));
    b.vx = (b.vx < 0 ? -1 : 1) * rem;
  }
}

function impact(b: Ball, nx: number, ny: number, amount: number): void {
  b.sqx = nx;
  b.sqy = ny;
  b.squash = Math.min(1, amount);
}

// ---------------------------------------------------------------------------
// Breaking
// ---------------------------------------------------------------------------

function scoreFor(tile: Tile, combo: number): number {
  const base = tile.kind === "star" ? 260 : tile.kind === "crystal" ? 200 : 120;
  return base * Math.min(9, 1 + combo * 0.5);
}

function breakTile(sim: Sim, tile: Tile, out: SimEvent[], chain: number, pierce = false): void {
  tile.alive = false;
  sim.broken++;
  sim.combo++;
  sim.comboTimer = 2.1;
  sim.best = Math.max(sim.best, sim.combo);
  const value = Math.round(scoreFor(tile, sim.combo));
  sim.score += value;
  sim.stall = 0;
  const cx = tileX(sim, tile.col) + sim.cellW / 2;
  const cy = tileY(sim, tile.row) + sim.cellH / 2;
  out.push({ t: "break", x: cx, y: cy, tile, combo: sim.combo, chain, value, pierce });
  // The exact moment the ball catches fire. It gets its own event because it
  // is the biggest thing that can happen without the wave ending.
  if (sim.combo === MOLTEN_AT) out.push({ t: "molten", x: cx, y: cy });

  if (sim.charge < sim.chargeMax) {
    sim.charge++;
    if (sim.charge >= sim.chargeMax) out.push({ t: "chargefull" });
  }

  if (tile.kind === "star") {
    out.push({ t: "star", x: cx, y: cy });
    // A star detonates its guilty neighbours — and only its guilty ones, so a
    // chain is always a reward for arithmetic, never a bypass of it.
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue;
        const n = tileAt(sim, tile.col + dc, tile.row + dr);
        if (n && n.guilty && chain < 6) breakTile(sim, n, out, chain + 1);
      }
    }
  }
}

function hitTile(sim: Sim, tile: Tile, out: SimEvent[], px: number, py: number, pierce = false): void {
  if (!tile.guilty) {
    tile.hit = 1;
    sim.masonryHits++;
    // A wrong tile costs the chain. Nothing else — no red mark, no lecture.
    sim.combo = 0;
    sim.comboTimer = 0;
    // Masonry gives way under repeated fire. Three chips and a stone falls: it
    // walled in, and the child is grinding. So after a while with nothing
    // broken the light starts eating the masonry — three chips and a stone
    // gives way. It pays nothing: no score, no chain, no charge. It exists
    // only so that being stuck is temporary, and it turns itself off the
    // moment a real target falls.
    tile.hp -= sim.stall > ERODE_AFTER ? MASONRY_HP : 1;
    if (tile.hp <= 0) {
      tile.alive = false;
      out.push({ t: "erode", x: px, y: py, tile });
      return;
    }
    out.push({ t: "masonry", x: px, y: py, tile });
    return;
  }
  tile.hp--;
  if (tile.hp > 0) {
    tile.hit = 1;
    out.push({ t: "crack", x: px, y: py, tile });
    return;
  }
  breakTile(sim, tile, out, 0, pierce);
}

// ---------------------------------------------------------------------------
// Ball step
// ---------------------------------------------------------------------------

function collideTiles(sim: Sim, b: Ball, out: SimEvent[]): boolean {
  const { cols, rows } = sim.wave;
  const top = sim.wallY + sim.descent;
  const bottom = top + rows * sim.cellH;
  if (b.y + b.r < top || b.y - b.r > bottom) return false;

  const left = wallLeft(sim);
  const c0 = Math.max(0, Math.floor((b.x - b.r - left) / sim.cellW));
  const c1 = Math.min(cols - 1, Math.floor((b.x + b.r - left) / sim.cellW));
  const r0 = Math.max(0, Math.floor((b.y - b.r - top) / sim.cellH));
  const r1 = Math.min(rows - 1, Math.floor((b.y + b.r - top) / sim.cellH));

  let best: Tile | null = null;
  let bestPen = Infinity;
  let bnx = 0;
  let bny = 0;

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const t = tileAt(sim, c, r);
      if (!t) continue;
      const tx = tileX(sim, c);
      const ty = tileY(sim, r);
      // Closest point on the cell to the ball centre.
      const qx = Math.max(tx, Math.min(b.x, tx + sim.cellW));
      const qy = Math.max(ty, Math.min(b.y, ty + sim.cellH));
      const dx = b.x - qx;
      const dy = b.y - qy;
      const d2 = dx * dx + dy * dy;
      if (d2 > b.r * b.r) continue;

      // Inside or touching. Pick the axis with the smallest overlap.
      const overlapL = b.x + b.r - tx;
      const overlapR = tx + sim.cellW - (b.x - b.r);
      const overlapT = b.y + b.r - ty;
      const overlapB = ty + sim.cellH - (b.y - b.r);
      const minX = Math.min(overlapL, overlapR);
      const minY = Math.min(overlapT, overlapB);
      const pen = Math.min(minX, minY);
      if (pen < bestPen) {
        bestPen = pen;
        best = t;
        if (minX < minY) {
          bnx = overlapL < overlapR ? -1 : 1;
          bny = 0;
        } else {
          bnx = 0;
          bny = overlapT < overlapB ? -1 : 1;
        }
      }
    }
  }

  if (!best) return false;

  // Molten: burn straight through a target instead of bouncing off it.
  if (sim.combo >= MOLTEN_AT && best.guilty && best.hp <= 1) {
    hitTile(sim, best, out, b.x, b.y, true);
    return true;
  }

  if (bnx !== 0) {
    b.vx = Math.abs(b.vx) * bnx;
    b.x += bnx * (bestPen + 0.5);
  } else {
    b.vy = Math.abs(b.vy) * bny;
    b.y += bny * (bestPen + 0.5);
  }
  impact(b, bnx, bny, 1);
  hitTile(sim, best, out, b.x - bnx * b.r, b.y - bny * b.r);
  return true;
}

function stepBall(sim: Sim, b: Ball, dt: number, out: SimEvent[]): void {
  const speed = sim.wave.ballSpeed * speedScale(sim);
  b.speed = speed;
  normalise(b, speed);

  const dist = speed * dt;
  const steps = Math.max(1, Math.ceil(dist / SUBSTEP_MAX));
  const sdt = dt / steps;

  for (let i = 0; i < steps; i++) {
    b.x += b.vx * sdt;
    b.y += b.vy * sdt;

    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = Math.abs(b.vx);
      impact(b, 1, 0, 0.8);
      out.push({ t: "wallbounce", x: 0, y: b.y, nx: 1, ny: 0 });
    } else if (b.x + b.r > VW) {
      b.x = VW - b.r;
      b.vx = -Math.abs(b.vx);
      impact(b, -1, 0, 0.8);
      out.push({ t: "wallbounce", x: VW, y: b.y, nx: -1, ny: 0 });
    }
    if (b.y - b.r < 0) {
      b.y = b.r;
      b.vy = Math.abs(b.vy);
      impact(b, 0, 1, 0.8);
      out.push({ t: "wallbounce", x: b.x, y: 0, nx: 0, ny: 1 });
    }

    collideTiles(sim, b, out);

    // Paddle. Only from above and only while descending, so a ball that
    // clips the side never gets yanked back up through it.
    const half = paddleHalf(sim);
    const py = sim.paddleY - sim.paddleH / 2;
    if (
      b.vy > 0 &&
      b.y + b.r >= py &&
      b.y - b.r <= sim.paddleY + sim.paddleH / 2 + 6 &&
      b.x >= sim.paddleX - half - b.r &&
      b.x <= sim.paddleX + half + b.r
    ) {
      b.y = py - b.r;
      const offset = Math.max(-1, Math.min(1, (b.x - sim.paddleX) / half));
      // Where you catch it is the whole game.
      const angle = -Math.PI / 2 + offset * MAX_DEFLECT;
      b.vx = Math.cos(angle) * speed + sim.paddleVX * 0.18;
      b.vy = Math.sin(angle) * speed;
      normalise(b, speed);
      impact(b, 0, -1, 1);
      sim.paddleSquash = 1;
      out.push({ t: "paddle", x: b.x, y: py, offset });
    }

    if (b.y - b.r > sim.vh) {
      b.alive = false;
      out.push({ t: "lost", x: b.x });
      return;
    }
  }

  // Trail sample per frame, not per substep.
  const n = b.trailN % TRAIL_LEN;
  b.trail[n * 2] = b.x;
  b.trail[n * 2 + 1] = b.y;
  b.trailN++;
}

// ---------------------------------------------------------------------------
// Bolts
// ---------------------------------------------------------------------------

export function fireLaser(sim: Sim, out: SimEvent[]): void {
  if (sim.powers.laserShots <= 0 || sim.phase !== "play") return;
  sim.powers.laserShots--;
  const half = paddleHalf(sim);
  const y = sim.paddleY - sim.paddleH;
  for (const dx of [-half * 0.72, half * 0.72]) {
    sim.bolts.push({ x: sim.paddleX + dx, y, vy: -1500, alive: true, age: 0 });
  }
  out.push({ t: "laser", x: sim.paddleX, y });
}

function stepBolts(sim: Sim, dt: number, out: SimEvent[]): void {
  const { cols, rows } = sim.wave;
  const top = sim.wallY + sim.descent;
  for (const bolt of sim.bolts) {
    if (!bolt.alive) continue;
    bolt.age += dt;
    const steps = 3;
    const sdt = dt / steps;
    for (let i = 0; i < steps && bolt.alive; i++) {
      bolt.y += bolt.vy * sdt;
      if (bolt.y < -40) {
        bolt.alive = false;
        break;
      }
      const c = Math.floor((bolt.x - wallLeft(sim)) / sim.cellW);
      const r = Math.floor((bolt.y - top) / sim.cellH);
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const t = tileAt(sim, c, r);
      if (!t) continue;
      bolt.alive = false;
      hitTile(sim, t, out, bolt.x, bolt.y);
    }
  }
  if (sim.bolts.length > 24) sim.bolts = sim.bolts.filter((b) => b.alive);
}

// ---------------------------------------------------------------------------
// Powers
// ---------------------------------------------------------------------------

export function grantPower(sim: Sim, kind: PowerKind, out: SimEvent[]): void {
  switch (kind) {
    case "wide":
      sim.powers.wide = Math.min(30, sim.powers.wide + 20);
      break;
    case "slow":
      sim.powers.slow = Math.min(20, sim.powers.slow + 10);
      break;
    case "laser":
      sim.powers.laserShots = Math.min(24, sim.powers.laserShots + 10);
      break;
    case "multi": {
      const src = sim.balls.find((b) => b.alive) ?? null;
      if (src) {
        for (const spread of [-0.42, 0.42]) {
          const nb = makeBall(src.x, src.y, src.speed);
          nb.held = false;
          const a = Math.atan2(src.vy, src.vx) + spread;
          nb.vx = Math.cos(a) * src.speed;
          nb.vy = Math.sin(a) * src.speed;
          sim.balls.push(nb);
        }
      }
      break;
    }
  }
  out.push({ t: "power", kind });
}

// ---------------------------------------------------------------------------
// The step
// ---------------------------------------------------------------------------

export function step(sim: Sim, dt: number, out: SimEvent[]): void {
  // A held reveal STOPS THE WORLD. The forge already ran the game underneath
  // itself at a twelfth speed while a beat was open, which was harmless when a
  // beat lasted at most seven seconds; a reveal the child dismisses in their
  // own time is unbounded, and the manual now tells them to take it. Without
  // this the ball keeps travelling and the wall keeps creeping while their hand
  // is off the glass — measured, a ten-second read cost a bead in 81 runs out
  // of 120, and on the last bead it ended the run underneath the lesson.
  // Nothing here is a clock, so nothing here may run while one is being read.
  if (sim.forge?.held) return;

  sim.runTime += dt;

  if (sim.phase === "gameover") return;

  if (sim.phase === "fever") {
    sim.feverT -= dt;
    if (sim.feverT <= 0) {
      sim.cleared++;
      sim.beads = Math.min(5, sim.beads + 1);
      nextWave(sim);
    }
    return;
  }

  sim.waveTime += dt;
  if (sim.powers.wide > 0) sim.powers.wide = Math.max(0, sim.powers.wide - dt);
  if (sim.powers.slow > 0) sim.powers.slow = Math.max(0, sim.powers.slow - dt);
  if (sim.comboTimer > 0) {
    sim.comboTimer -= dt;
    if (sim.comboTimer <= 0) sim.combo = 0;
  }
  sim.paddleSquash = Math.max(0, sim.paddleSquash - dt * 5.5);

  for (const t of sim.wave.tiles) {
    if (t.hit > 0) t.hit = Math.max(0, t.hit - dt * 3.2);
    if (t.warm > 0) t.warm = Math.max(0, t.warm - dt * 2.6);
    if (t.kindle > 0) t.kindle = Math.max(0, t.kindle - dt * 1.4);
    // A falling pane lands even while the ball is being re-served, so a life
    // lost mid-drop never leaves a pane hanging in the air for ever.
    if (t.drop > 0) t.drop = Math.max(0, t.drop - dt);
  }

  // Serving: sweep the aim so a launch is a choice, not a coin flip.
  if (sim.phase === "serve") {
    const b = sim.balls[0];
    if (b) {
      b.x = sim.paddleX;
      b.y = sim.paddleY - sim.paddleH / 2 - b.r - 1;
      const n = b.trailN % TRAIL_LEN;
      b.trail[n * 2] = b.x;
      b.trail[n * 2 + 1] = b.y;
      b.trailN++;
    }
    sim.aim += sim.aimDir * dt * 1.15;
    const lo = -Math.PI / 2 - 1.02;
    const hi = -Math.PI / 2 + 1.02;
    if (sim.aim > hi) {
      sim.aim = hi;
      sim.aimDir = -1;
    } else if (sim.aim < lo) {
      sim.aim = lo;
      sim.aimDir = 1;
    }
    stepRemix(sim, dt, out, false);
    stepBolts(sim, dt, out);
    return;
  }

  // Descent: the wall creeps. This is the only clock in the game and it is a
  // visible object rather than a number counting down at a child.
  sim.stall += dt;
  const rate =
    sim.stall > PRESSURE_AFTER
      ? Math.max(sim.wave.descentRate * 2.6, 11)
      : sim.wave.descentRate;
  sim.descent += rate * dt;
  const wallBottom = sim.wallY + sim.descent + sim.wave.rows * sim.cellH;
  if (wallBottom > sim.paddleY - 96) {
    sim.descent -= rate * dt;
    out.push({ t: "danger" });
  }

  // The window is still being built while you are breaking it. See `remix.ts`.
  stepRemix(sim, dt, out);

  for (const b of sim.balls) {
    if (!b.alive || b.held) continue;
    stepBall(sim, b, dt, out);
  }
  stepBolts(sim, dt, out);

  // Warm the guilty tiles the ball is skimming past. Only within a cell and
  // only for a moment — it confirms, it never lets you plan without reading.
  for (const b of sim.balls) {
    if (!b.alive || b.held) continue;
    const c = Math.round((b.x - wallLeft(sim)) / sim.cellW);
    const r = Math.round((b.y - sim.wallY - sim.descent) / sim.cellH);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const t = tileAt(sim, c + dc, r + dr);
        if (t && t.guilty) t.warm = 1;
      }
    }
  }

  if (sim.balls.length > 1) sim.balls = sim.balls.filter((b) => b.alive);

  const anyAlive = sim.balls.some((b) => b.alive);
  if (!anyAlive) {
    sim.beads--;
    sim.powers.wide = 0;
    sim.powers.slow = 0;
    if (sim.beads <= 0) {
      sim.phase = "gameover";
      out.push({ t: "gameover" });
    } else {
      serve(sim);
    }
    return;
  }

  // Wave clear.
  let remaining = 0;
  for (const t of sim.wave.tiles) if (t.alive && t.guilty) remaining++;
  if (remaining === 0) {
    sim.phase = "fever";
    sim.feverT = 2.35;
    const speedBonus = Math.max(0, 4000 - Math.round(sim.waveTime * 60));
    sim.score += 1500 + speedBonus + sim.best * 120;
    out.push({ t: "clear", waveIndex: sim.wave.index });
  }
}

/** Fraction of this wave's guilty tiles already broken, as exact integers. */
export function clearedParts(sim: Sim): { done: number; total: number } {
  return { done: sim.broken, total: sim.wave.guiltyTotal };
}

/** Deterministic seed for the next run so a replay is reproducible. */
export function nextSeed(seed: number): number {
  return subSeed(seed, 0x7a11) || new Rng(seed).u32();
}
