/**
 * Headless pacing and performance benchmark.
 *
 * Two things are being measured and neither is optional:
 *
 *  - **Pacing.** How long a competent player takes to clear a wave. A wave that
 *    takes four minutes is not hard, it is boring. The AI here aims: it picks
 *    the paddle offset whose outgoing angle points at the nearest remaining
 *    target, which is roughly what a ten-year-old does after two minutes.
 *  - **Cost.** Microseconds per simulation step, so the frame budget can be
 *    stated as a number rather than a hope.
 *
 * Run: `npm run bench`
 */
import { Rng } from "../src/rng.ts";
import { createSim, launch, paddleHalf, step } from "../src/game/sim.ts";
import type { Sim, SimEvent } from "../src/game/state.ts";
import { VW } from "../src/game/state.ts";
import { buildWave } from "../src/game/wall.ts";

const DT = 1 / 120;
const VH = 1560;
const MAX_DEFLECT = (62 * Math.PI) / 180;

/** Aim the return at the nearest live target. */
function aimingPaddle(sim: Sim, rng: Rng): void {
  let ball = null as null | { x: number; y: number; vx: number; vy: number };
  for (const b of sim.balls) {
    if (!b.alive) continue;
    if (!ball || b.y > ball.y) ball = b;
  }
  if (!ball) return;
  const half = paddleHalf(sim);

  // Where will it cross the paddle plane?
  let landing = ball.x;
  if (ball.vy > 0) {
    const t = (sim.paddleY - ball.y) / ball.vy;
    let x = ball.x + ball.vx * t;
    // Fold the reflections off the side walls.
    const span = VW * 2;
    x = ((x % span) + span) % span;
    landing = x > VW ? span - x : x;
  }

  // Nearest target, and the angle from the paddle to it.
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const t of sim.wave.tiles) {
    if (!t.alive || !t.guilty) continue;
    const tx = sim.wallX + (t.col + 0.5) * sim.cellW;
    const ty = sim.wallY + sim.descent + (t.row + 0.5) * sim.cellH;
    const d = Math.hypot(tx - landing, ty - sim.paddleY);
    if (d < bestD) {
      bestD = d;
      best = { x: tx, y: ty };
    }
  }
  let offset = rng.f() * 0.6 - 0.3;
  if (best) {
    const want = Math.atan2(best.y - sim.paddleY, best.x - landing);
    const rel = want + Math.PI / 2; // relative to straight up
    offset = Math.max(-0.94, Math.min(0.94, rel / MAX_DEFLECT)) + (rng.f() * 0.16 - 0.08);
  }
  sim.paddleX = Math.max(half, Math.min(VW - half, landing - offset * half));
}

function playWave(seed: number, index: number, limit = 400): { t: number; cleared: boolean; masonry: number } {
  const sim = createSim(seed, VH);
  if (index > 0) {
    const wave = buildWave({ seed, index });
    sim.wave = wave;
    sim.rule = wave.rule;
    const grid = new Int32Array(wave.cols * wave.rows).fill(-1);
    sim.cellW = (VW - 100) / wave.cols;
    sim.cellH = Math.min(sim.cellW / 1.62, 62);
    for (let i = 0; i < wave.tiles.length; i++) grid[wave.tiles[i]!.row * wave.cols + wave.tiles[i]!.col] = i;
    sim.grid = grid;
  }
  launch(sim);
  const rng = new Rng(seed * 7919 + index);
  const out: SimEvent[] = [];
  let t = 0;
  let masonry = 0;
  const steps = Math.round(limit / DT);
  for (let i = 0; i < steps; i++) {
    aimingPaddle(sim, rng);
    out.length = 0;
    step(sim, DT, out);
    for (const e of out) if (e.t === "masonry") masonry++;
    t += DT;
    if (sim.phase === "serve") launch(sim);
    if (sim.phase === "fever") return { t, cleared: true, masonry };
    if (sim.phase === "gameover") break;
  }
  return { t, cleared: false, masonry };
}

const times: number[] = [];
let failures = 0;
for (const index of [0, 1, 2, 4, 6, 9, 12, 16, 20]) {
  const row: number[] = [];
  for (const seed of [11, 22, 33, 44, 55]) {
    const r = playWave(seed, index);
    if (!r.cleared) failures++;
    row.push(r.t);
    times.push(r.t);
  }
  row.sort((a, b) => a - b);
  const w = buildWave({ seed: 11, index });
  console.log(
    `wave ${String(index + 1).padStart(2)}  ${w.layout.padEnd(8)} ${String(w.guiltyTotal).padStart(3)}/${String(
      w.tiles.length,
    ).padStart(3)} targets   clear median ${row[2]!.toFixed(0)}s   range ${row[0]!.toFixed(0)}-${row[4]!.toFixed(0)}s`,
  );
}
times.sort((a, b) => a - b);
console.log(
  `\nmedian clear ${times[Math.floor(times.length / 2)]!.toFixed(0)}s   p90 ${times[
    Math.floor(times.length * 0.9)
  ]!.toFixed(0)}s   uncleared ${failures}/${times.length}`,
);

// -- cost -------------------------------------------------------------------

{
  const sim = createSim(1, VH);
  launch(sim);
  const out: SimEvent[] = [];
  const rng = new Rng(5);
  for (let i = 0; i < 2000; i++) {
    aimingPaddle(sim, rng);
    out.length = 0;
    step(sim, DT, out);
  }
  const N = 240000;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) {
    out.length = 0;
    step(sim, DT, out);
    if (sim.phase !== "play") {
      sim.phase = "play";
      for (const b of sim.balls) b.alive = true;
    }
  }
  const t1 = process.hrtime.bigint();
  const us = Number(t1 - t0) / 1000 / N;
  console.log(
    `\nsim step ${us.toFixed(3)} µs  →  ${(us * 2).toFixed(2)} µs per 60 Hz frame (2 fixed steps at 120 Hz)`,
  );
}
