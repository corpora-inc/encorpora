import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../rng.ts";
import { createSim, launch, paddleHalf, step, tileAt } from "./sim.ts";
import type { Sim, SimEvent } from "./state.ts";
import { VW } from "./state.ts";
import { chooseShard, dismissForge, openForge, stepForge } from "./forge.ts";
import { REVEAL_SETTLE_MS } from "../../../../packs/shared/game-pacing/index.ts";
import type { Host, Question } from "../contract.ts";

const DT = 1 / 120;
const VH = 1560;

/** A paddle that always returns the ball, at a varied angle so it explores. */
function autoPaddle(sim: Sim, rng: Rng): void {
  let lowest = null as null | { x: number; y: number };
  for (const b of sim.balls) {
    if (!b.alive) continue;
    if (!lowest || b.y > lowest.y) lowest = { x: b.x, y: b.y };
  }
  if (!lowest) return;
  const half = paddleHalf(sim);
  const offset = (rng.f() * 1.5 - 0.75) * half;
  sim.paddleX = Math.max(half, Math.min(VW - half, lowest.x - offset));
}

function run(sim: Sim, seconds: number, rng: Rng, onEvent?: (e: SimEvent) => void): SimEvent[] {
  const all: SimEvent[] = [];
  const out: SimEvent[] = [];
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    autoPaddle(sim, rng);
    out.length = 0;
    step(sim, DT, out);
    for (const e of out) {
      all.push(e);
      onEvent?.(e);
    }
    if (sim.phase === "serve") launch(sim);
    if (sim.phase === "fever" || sim.phase === "gameover") break;
  }
  return all;
}

test("the same seed and the same inputs give the same run, to the bit", () => {
  const a = createSim(999, VH);
  const b = createSim(999, VH);
  launch(a);
  launch(b);
  const ea = run(a, 20, new Rng(4));
  const eb = run(b, 20, new Rng(4));
  assert.equal(ea.length, eb.length);
  assert.equal(a.score, b.score);
  assert.equal(a.broken, b.broken);
  assert.equal(a.balls[0]!.x, b.balls[0]!.x);
  assert.equal(a.balls[0]!.y, b.balls[0]!.y);
});

test("the ball cannot tunnel through the wall at any reachable speed", () => {
  // Fire straight up from just below the wall with a frame time far worse than
  // anything a real device produces, and prove it always registers a hit.
  for (const speed of [600, 900, 1200, 2000]) {
    for (const dt of [1 / 120, 1 / 60, 1 / 30, 1 / 15]) {
      const sim = createSim(5, VH);
      sim.wave.ballSpeed = speed;
      launch(sim);
      const b = sim.balls[0]!;
      const wallBottom = sim.wallY + sim.wave.rows * sim.cellH;
      b.x = sim.wallX + sim.cellW * 4.5;
      b.y = wallBottom + 30;
      b.vx = 0;
      b.vy = -speed;
      b.speed = speed;
      const out: SimEvent[] = [];
      let hit = false;
      for (let i = 0; i < 40 && !hit; i++) {
        out.length = 0;
        step(sim, dt, out);
        hit = out.some((e) => e.t === "masonry" || e.t === "break" || e.t === "crack");
        if (b.y < 0) break;
      }
      assert.ok(hit, `tunnelled at speed ${speed} dt ${dt.toFixed(4)}`);
    }
  }
});

test("the paddle is a lens: where you catch it is the angle it leaves at", () => {
  const angles: number[] = [];
  for (const frac of [-1, -0.5, 0, 0.5, 1]) {
    const sim = createSim(11, VH);
    launch(sim);
    const b = sim.balls[0]!;
    const half = paddleHalf(sim);
    b.x = sim.paddleX + frac * half * 0.98;
    b.y = sim.paddleY - sim.paddleH / 2 - b.r - 2;
    b.vx = 0;
    b.vy = b.speed;
    const out: SimEvent[] = [];
    step(sim, DT, out);
    assert.ok(
      out.some((e) => e.t === "paddle"),
      `no paddle hit at ${frac}`,
    );
    angles.push(Math.atan2(b.vy, b.vx));
  }
  // Monotonic left-to-right, always upward, never wider than the design limit.
  for (const a of angles) assert.ok(Math.sin(a) < 0, "ball must leave upward");
  const deg = angles.map((a) => (a + Math.PI / 2) * (180 / Math.PI));
  assert.ok(deg[0]! < -50 && deg[0]! >= -63, `left edge ${deg[0]}`);
  assert.ok(Math.abs(deg[2]!) < 1, `centre ${deg[2]}`);
  assert.ok(deg[4]! > 50 && deg[4]! <= 63, `right edge ${deg[4]}`);
  for (let i = 1; i < deg.length; i++) assert.ok(deg[i]! > deg[i - 1]!);
});

test("the ball never grinds along a horizontal", () => {
  const sim = createSim(77, VH);
  launch(sim);
  const b = sim.balls[0]!;
  b.vx = b.speed;
  b.vy = 0.0001;
  const rng = new Rng(2);
  const minFrac = Math.sin((17 * Math.PI) / 180) - 1e-9;
  for (let i = 0; i < 4000; i++) {
    autoPaddle(sim, rng);
    step(sim, DT, []);
    for (const ball of sim.balls) {
      if (!ball.alive || ball.held) continue;
      assert.ok(Math.abs(ball.vy) / ball.speed >= minFrac, `vy fraction ${Math.abs(ball.vy) / ball.speed}`);
    }
    if (sim.phase !== "play") break;
  }
});

test("a wave is actually clearable — played to the end, headless", () => {
  for (const seed of [1, 2, 3]) {
    const sim = createSim(seed, VH);
    launch(sim);
    const events = run(sim, 400, new Rng(seed * 31));
    assert.equal(sim.phase, "fever", `seed ${seed} did not clear`);
    assert.equal(sim.beads, 3, `seed ${seed} lost a ball to a perfect paddle`);
    assert.equal(sim.broken, sim.wave.guiltyTotal);
    assert.ok(events.some((e) => e.t === "clear"));
    for (const t of sim.wave.tiles) if (t.guilty) assert.equal(t.alive, false);
  }
});

test("masonry never breaks, and only guilty tiles ever do", () => {
  const sim = createSim(4242, VH);
  launch(sim);
  const broken: boolean[] = [];
  run(sim, 400, new Rng(9), (e) => {
    if (e.t === "break") broken.push(e.tile.guilty);
    if (e.t === "masonry") assert.equal(e.tile.guilty, false);
  });
  assert.ok(broken.length > 0);
  assert.ok(broken.every(Boolean), "a non-target tile was destroyed");
});

test("a wrong tile costs the chain and nothing else", () => {
  const sim = createSim(31337, VH);
  launch(sim);
  let sawReset = false;
  let beadsBefore = sim.beads;
  run(sim, 200, new Rng(3), (e) => {
    if (e.t === "masonry") {
      assert.equal(sim.combo, 0);
      sawReset = true;
      assert.equal(sim.beads, beadsBefore, "masonry must never cost a life");
    }
    if (e.t === "lost") beadsBefore = sim.beads - 1;
  });
  assert.ok(sawReset, "expected at least one masonry bounce in 200s");
});

test("a star only takes its guilty neighbours", () => {
  const sim = createSim(8, VH);
  // Force a star into a known cell surrounded by a mix.
  const target = sim.wave.tiles.find((t) => t.guilty && t.col > 1 && t.col < sim.wave.cols - 2 && t.row > 1)!;
  target.kind = "star";
  const survivors = sim.wave.tiles.filter((t) => !t.guilty).length;
  launch(sim);
  const b = sim.balls[0]!;
  b.x = sim.wallX + target.col * sim.cellW + sim.cellW / 2;
  b.y = sim.wallY + (target.row + 1) * sim.cellH + b.r + 2;
  b.vx = 0;
  b.vy = -b.speed;
  const out: SimEvent[] = [];
  for (let i = 0; i < 20; i++) {
    out.length = 0;
    step(sim, DT, out);
    if (out.some((e) => e.t === "star")) break;
  }
  assert.equal(sim.wave.tiles.filter((t) => !t.guilty && t.alive).length, survivors);
});

test("the wave only clears when every target is gone", () => {
  const sim = createSim(60, VH);
  launch(sim);
  const guiltyTiles = sim.wave.tiles.filter((t) => t.guilty);
  for (const t of guiltyTiles.slice(1)) t.alive = false;
  sim.broken = guiltyTiles.length - 1;
  const out: SimEvent[] = [];
  step(sim, DT, out);
  assert.equal(sim.phase, "play");
  guiltyTiles[0]!.alive = false;
  step(sim, DT, out);
  assert.equal(sim.phase, "fever");
});

test("the grid index and the tile list never disagree", () => {
  const sim = createSim(1234, VH);
  for (const t of sim.wave.tiles) assert.equal(tileAt(sim, t.col, t.row), t);
  const dead = sim.wave.tiles[3]!;
  dead.alive = false;
  assert.equal(tileAt(sim, dead.col, dead.row), null);
});

// ---------------------------------------------------------------------------
// The forge
// ---------------------------------------------------------------------------

function stubQuestion(): Question {
  return {
    id: "q1",
    prompt: "7 × 8",
    answer: "56",
    distractors: ["63", "54", "48"],
    domain: "mul-div",
    difficulty: 0.5,
  };
}

function recordingHost(): Host & { reports: unknown[] } {
  const reports: unknown[] = [];
  return {
    reports,
    next: stubQuestion,
    report: (r) => reports.push(r),
    haptic: () => {},
    prefersReducedMotion: () => false,
  };
}

test("the forge grants exactly the power printed on the correct rune", () => {
  const sim = createSim(2, VH);
  launch(sim);
  sim.charge = sim.chargeMax;
  const host = recordingHost();
  openForge(sim, host, 4242);
  assert.ok(sim.forge);
  assert.equal(sim.forge!.shards.length, 4);
  assert.equal(sim.forge!.shards.filter((s) => s.correct).length, 1);
  const i = sim.forge!.shards.findIndex((s) => s.correct);
  const power = sim.forge!.shards[i]!.power;
  const before = { ...sim.powers, balls: sim.balls.length };
  const out: SimEvent[] = [];
  assert.equal(chooseShard(sim, host, i, out), "right");
  assert.equal(sim.charge, 0);
  assert.deepEqual(host.reports, [{ questionId: "q1", correct: true, ms: 0, answered: "56" }]);
  if (power === "wide") assert.ok(sim.powers.wide > before.wide);
  if (power === "slow") assert.ok(sim.powers.slow > before.slow);
  if (power === "laser") assert.ok(sim.powers.laserShots > before.laserShots);
  if (power === "multi") assert.ok(sim.balls.length > before.balls);
  assert.ok(out.some((e) => e.t === "power"));
});

test("a wrong rune costs the charge and the power, and nothing else", () => {
  const sim = createSim(2, VH);
  launch(sim);
  sim.charge = sim.chargeMax;
  const beads = sim.beads;
  const score = sim.score;
  const host = recordingHost();
  openForge(sim, host, 99);
  const i = sim.forge!.shards.findIndex((s) => !s.correct);
  const out: SimEvent[] = [];
  assert.equal(chooseShard(sim, host, i, out), "wrong");
  assert.equal(sim.charge, 0);
  assert.equal(sim.beads, beads);
  assert.equal(sim.score, score);
  assert.equal(out.some((e) => e.t === "power"), false);
  // The right answer lights up anyway. Nobody is told off, they are shown.
  assert.equal(sim.forge!.shards.find((s) => s.correct)!.state, 1);
});

test("a miss holds the completed sum until a hand takes it down", () => {
  const sim = createSim(2, VH);
  launch(sim);
  sim.charge = sim.chargeMax;
  const host = recordingHost();
  openForge(sim, host, 99);
  const wrong = sim.forge!.shards.findIndex((s) => !s.correct);
  assert.equal(chooseShard(sim, host, wrong, []), "wrong");

  // Nothing but the child ends it. Ten minutes of frames do not.
  assert.equal(sim.forge!.held, true);
  for (let i = 0; i < 12000; i++) assert.equal(stepForge(sim, 0.05), false);
  assert.ok(sim.forge, "the reveal expired on its own");
  // The prompt and the correct rune are both still up: the sum is completed in
  // front of the child, and the wrong rune is dimmed rather than marked.
  assert.equal(sim.forge!.prompt, "7 × 8");
  assert.equal(sim.forge!.shards.find((s) => s.correct)!.state, 1);
  assert.equal(sim.forge!.shards[wrong]!.state, -1);

  assert.equal(dismissForge(sim), true);
  assert.equal(sim.forge, null);
});

test("a held reveal stops the world instead of running it underneath", () => {
  const sim = createSim(2, VH);
  launch(sim);
  const ball = sim.balls[0]!;
  // Mid-rally, well above the paddle, heading down: the exact moment a child
  // would take their hand off the glass to read.
  ball.x = VW / 2;
  ball.y = sim.vh * 0.5;
  ball.vx = 120;
  ball.vy = ball.speed;
  sim.charge = sim.chargeMax;
  const host = recordingHost();
  openForge(sim, host, 99);
  chooseShard(sim, host, sim.forge!.shards.findIndex((s) => !s.correct), []);

  const before = { x: ball.x, y: ball.y, descent: sim.descent, beads: sim.beads, run: sim.runTime };
  // Two full minutes of reading.
  for (let i = 0; i < 14400; i++) step(sim, DT, []);
  assert.equal(ball.x, before.x, "the ball travelled under a held reveal");
  assert.equal(ball.y, before.y, "the ball travelled under a held reveal");
  assert.equal(sim.descent, before.descent, "the wall crept under a held reveal");
  assert.equal(sim.beads, before.beads, "reading the answer cost a bead");
  assert.equal(sim.runTime, before.run);
  assert.equal(sim.phase, "play");

  // And it starts again the instant the reveal is taken down.
  stepForge(sim, 1);
  assert.equal(dismissForge(sim), true);
  step(sim, DT, []);
  assert.notEqual(ball.y, before.y);
});

test("a held reveal freezes the runes where they were chosen", () => {
  const sim = createSim(2, VH);
  launch(sim);
  sim.charge = sim.chargeMax;
  const host = recordingHost();
  openForge(sim, host, 99);
  for (let i = 0; i < 40; i++) stepForge(sim, 1 / 60);
  chooseShard(sim, host, sim.forge!.shards.findIndex((s) => !s.correct), []);
  const right = sim.forge!.shards.find((s) => s.correct)!;
  const at = { x: right.x, y: right.y };
  // The runes rise on an arc with gravity under them. Under an unbounded hold
  // that arc used to carry the lit answer off the bottom of the screen.
  for (let i = 0; i < 6000; i++) stepForge(sim, 1 / 60);
  assert.equal(right.x, at.x, "the correct rune drifted while it was being read");
  assert.equal(right.y, at.y, "the correct rune drifted while it was being read");
  assert.ok(right.y < VH, "the correct rune left the screen");
});

test("the settle lockout stops a stray second tap eating the reveal", () => {
  const sim = createSim(2, VH);
  launch(sim);
  sim.charge = sim.chargeMax;
  const host = recordingHost();
  openForge(sim, host, 99);
  const wrong = sim.forge!.shards.findIndex((s) => !s.correct);
  chooseShard(sim, host, wrong, []);
  // The tap that raised the reveal is still arriving. It may not take it down.
  assert.equal(dismissForge(sim), false);
  assert.ok(sim.forge);
  assert.ok(sim.forge!.settleAt > 0);
  stepForge(sim, REVEAL_SETTLE_MS / 1000 + 0.01);
  assert.equal(dismissForge(sim), true);
});

test("a clean win is not held — there is nothing to marinate on", () => {
  const sim = createSim(2, VH);
  launch(sim);
  sim.charge = sim.chargeMax;
  const host = recordingHost();
  openForge(sim, host, 4242);
  const right = sim.forge!.shards.findIndex((s) => s.correct);
  assert.equal(chooseShard(sim, host, right, []), "right");
  assert.equal(sim.forge!.held, false);
  assert.equal(dismissForge(sim), false, "a win should not need dismissing");
  let closed = false;
  for (let i = 0; i < 200 && !closed; i++) closed = stepForge(sim, 0.02);
  assert.equal(closed, true, "the celebration never ended");
  assert.equal(sim.forge, null);
});

test("hesitating in the forge is never punished", () => {
  const sim = createSim(2, VH);
  launch(sim);
  sim.charge = sim.chargeMax;
  openForge(sim, recordingHost(), 7);
  for (let i = 0; i < 200; i++) if (stepForge(sim, 0.05)) break;
  assert.equal(sim.forge, null);
  assert.ok(sim.charge >= Math.floor(sim.chargeMax * 0.6));
});

test("every distinct answer appears once — four runes, no duplicate", () => {
  const sim = createSim(2, VH);
  launch(sim);
  sim.charge = sim.chargeMax;
  openForge(sim, recordingHost(), 12345);
  const texts = sim.forge!.shards.map((s) => s.text);
  assert.equal(new Set(texts).size, 4);
  const powers = sim.forge!.shards.map((s) => s.power);
  assert.equal(new Set(powers).size, 4);
});
