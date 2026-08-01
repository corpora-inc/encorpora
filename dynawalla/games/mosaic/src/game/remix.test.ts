import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng } from "../rng.ts";
import { createSim, launch, paddleHalf, step, tileAt } from "./sim.ts";
import type { Sim, SimEvent } from "./state.ts";
import { VW } from "./state.ts";
import { guilty } from "./rules.ts";
import { MAX_SWAY_CELLS } from "./wall.ts";
import { BEAT_MAX, ENDGAME_LOCK, kindle, reglaze, remainingTargets } from "./remix.ts";

const DT = 1 / 120;
const VH = 1560;

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

/** A snapshot of everything a child could be aiming at right now. */
type Aimable = { tile: object; col: number; row: number; text: string };
function aimables(sim: Sim): Aimable[] {
  const out: Aimable[] = [];
  for (const t of sim.wave.tiles) {
    if (t.alive && t.guilty) out.push({ tile: t, col: t.col, row: t.row, text: t.face.text });
  }
  return out;
}

/**
 * Play headless with a paddle that always returns the ball, checking every
 * invariant every frame. Returns what happened, so a test can also assert that
 * the remix actually did something rather than passing vacuously.
 */
function play(seed: number, seconds: number, waves = 1): {
  sim: Sim;
  beats: { reglaze: number; kindle: number; turn: number };
  events: SimEvent[];
  maxSway: number;
  addedPeak: number;
  cleared: number;
} {
  const sim = createSim(seed, VH);
  launch(sim);
  const rng = new Rng(seed * 31 + 7);
  const events: SimEvent[] = [];
  const out: SimEvent[] = [];
  const steps = Math.round(seconds / DT);
  let maxSway = 0;
  let addedPeak = 0;
  let cleared = 0;
  const beats = { reglaze: 0, kindle: 0, turn: 0 };

  let openingGuilty = sim.wave.guiltyTotal;
  let openingTiles = sim.wave.tiles.length;
  let budget = sim.remix.budget;
  let waveIndex = sim.wave.index;

  for (let i = 0; i < steps; i++) {
    if (sim.wave.index !== waveIndex) {
      waveIndex = sim.wave.index;
      openingGuilty = sim.wave.guiltyTotal;
      openingTiles = sim.wave.tiles.length;
      budget = sim.remix.budget;
    }
    autoPaddle(sim, rng);
    const before = aimables(sim);
    const beforeRemaining = remainingTargets(sim);
    out.length = 0;
    step(sim, DT, out);
    for (const e of out) events.push(e);

    // 1. Nothing a child is aiming at is taken away. A live target may only
    //    leave the board by being broken, and while it is up its face is fixed.
    const broke = new Set(out.filter((e) => e.t === "break").map((e) => e.tile));
    for (const a of before) {
      const t = a.tile as { alive: boolean; guilty: boolean; face: { text: string }; col: number; row: number };
      if (broke.has(t as never)) continue;
      assert.equal(t.alive, true, `seed ${seed}: a live target vanished at ${a.col},${a.row}`);
      assert.equal(t.guilty, true, `seed ${seed}: a live target stopped being a target at ${a.col},${a.row}`);
      assert.equal(t.face.text, a.text, `seed ${seed}: a live target's face changed at ${a.col},${a.row}`);
      assert.equal(t.col, a.col, `seed ${seed}: a target changed column`);
      assert.equal(t.row, a.row, `seed ${seed}: a target changed row`);
    }

    // 2. The board converges: targets added over the whole wave never exceed
    //    the budget, and none are added inside the endgame.
    assert.ok(
      sim.remix.added <= sim.remix.budget,
      `seed ${seed}: remix added ${sim.remix.added} targets over a budget of ${sim.remix.budget}`,
    );
    if (beforeRemaining <= ENDGAME_LOCK) {
      assert.ok(
        remainingTargets(sim) <= beforeRemaining,
        `seed ${seed}: a target was added inside the endgame (${beforeRemaining} left)`,
      );
    }
    assert.ok(
      sim.remix.stone <= sim.remix.stoneBudget,
      `seed ${seed}: remix re-leaded ${sim.remix.stone} stone over a budget of ${sim.remix.stoneBudget}`,
    );
    addedPeak = Math.max(addedPeak, sim.remix.added);

    // 3. Structure. Every tile in bounds, the grid agreeing with the list, the
    //    printed face agreeing with the rule, the wall on screen.
    let live = 0;
    for (const t of sim.wave.tiles) {
      assert.ok(t.col >= 0 && t.col < sim.wave.cols, `seed ${seed}: tile off the grid at col ${t.col}`);
      assert.ok(t.row >= 0 && t.row < sim.wave.rows, `seed ${seed}: tile off the grid at row ${t.row}`);
      assert.equal(guilty(sim.wave.rule, t.face.value), t.guilty, `seed ${seed}: "${t.face.text}" misjudged`);
      if (t.alive) live++;
      if (t.alive && t.drop <= 0) assert.equal(tileAt(sim, t.col, t.row), t, `seed ${seed}: grid/list disagree`);
      if (t.drop > 0) assert.equal(tileAt(sim, t.col, t.row), null, `seed ${seed}: a falling pane was solid`);
    }
    assert.ok(live <= openingTiles, `seed ${seed}: ${live} live panes over an opening ${openingTiles}`);
    maxSway = Math.max(maxSway, Math.abs(sim.sway));
    // Two bounds, and the tight one is the point: a wave may only swing as far
    // as its OWN amplitude, which is what keeps the tutorial nearly still while
    // a late wave swings hard. The global bound is what keeps the wall on
    // screen at all.
    assert.ok(
      Math.abs(sim.sway) <= sim.remix.swayMax * sim.cellW + 1e-9,
      `seed ${seed}: wave ${sim.wave.index} swung ${sim.sway} past its own ${sim.remix.swayMax * sim.cellW}`,
    );
    assert.ok(
      Math.abs(sim.sway) <= MAX_SWAY_CELLS * sim.cellW + 1e-9,
      `seed ${seed}: sway ${sim.sway} beyond the bound`,
    );

    assert.ok(
      sim.wave.guiltyTotal <= openingGuilty + budget,
      `seed ${seed}: total targets ${sim.wave.guiltyTotal} above the proven ceiling`,
    );

    if (sim.phase === "serve") launch(sim);
    if (sim.phase === "gameover") break;
    if (sim.phase === "fever") {
      cleared++;
      beats.reglaze += sim.remix.fired.reglaze;
      beats.kindle += sim.remix.fired.kindle;
      beats.turn += sim.remix.fired.turn;
      if (cleared >= waves) break;
      // Ride the celebration out and pick up the next wall, so a session test
      // reaches the waves that descend, sway hard, and carry crystal and star.
      while (sim.phase === "fever") step(sim, DT, out);
      launch(sim);
    }
  }
  if (sim.phase !== "fever") {
    beats.reglaze += sim.remix.fired.reglaze;
    beats.kindle += sim.remix.fired.kindle;
    beats.turn += sim.remix.fired.turn;
  }
  return { sim, beats, events, maxSway, addedPeak, cleared };
}

// ---------------------------------------------------------------------------

test("a board is remixed while it runs, not only when it is built", () => {
  let boards = 0;
  let withBeats = 0;
  let totalBeats = 0;
  let seconds = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const r = play(seed, 400);
    boards++;
    const n = r.beats.reglaze + r.beats.kindle + r.beats.turn;
    totalBeats += n;
    seconds += r.sim.waveTime;
    if (n > 0) withBeats++;
  }
  // Before this change the answer to both was zero, for ever, on every board.
  assert.equal(boards, 24);
  assert.ok(withBeats >= 20, `only ${withBeats}/24 boards were remixed at all`);
  assert.ok(totalBeats / boards >= 2, `only ${(totalBeats / boards).toFixed(1)} beats per board`);
  // And the cadence is real, not one beat at the start: a board that runs for
  // n seconds should see roughly n / BEAT_MAX beats at the very least.
  assert.ok(totalBeats >= Math.floor(seconds / BEAT_MAX / 2), `${totalBeats} beats over ${seconds.toFixed(0)}s`);
});

test("every remix beat kind actually fires over a session", () => {
  const seen = { reglaze: 0, kindle: 0, turn: 0 };
  for (let seed = 1; seed <= 24; seed++) {
    const r = play(seed, 400);
    seen.reglaze += r.beats.reglaze;
    seen.kindle += r.beats.kindle;
    seen.turn += r.beats.turn;
  }
  assert.ok(seen.reglaze > 0, "no pane ever dropped in");
  assert.ok(seen.kindle > 0, "no stone ever caught light");
  assert.ok(seen.turn > 0, "the window never took a new swing");
});

test("a remixed board is still solvable — every seed, played to the end", () => {
  for (let seed = 1; seed <= 24; seed++) {
    const r = play(seed, 900);
    assert.equal(r.sim.phase, "fever", `seed ${seed} never cleared`);
    assert.equal(remainingTargets(r.sim), 0, `seed ${seed} cleared with targets standing`);
    assert.equal(r.sim.broken, r.sim.wave.guiltyTotal, `seed ${seed}: broken/total disagree`);
    // Including the ones the remix put there: the wave is only over once the
    // added targets have been broken too.
    assert.ok(r.addedPeak >= 0);
    if (r.addedPeak > 0) {
      assert.ok(
        r.sim.broken > r.sim.wave.guiltyTotal - r.addedPeak,
        `seed ${seed} cleared without breaking the added targets`,
      );
    }
  }
});

test("the remix stops adding targets once the endgame has started", () => {
  const sim = createSim(4242, VH);
  launch(sim);
  // Leave exactly the lock threshold standing.
  const targets = sim.wave.tiles.filter((t) => t.guilty);
  for (const t of targets.slice(ENDGAME_LOCK)) t.alive = false;
  sim.broken = targets.length - ENDGAME_LOCK;
  assert.equal(remainingTargets(sim), ENDGAME_LOCK);

  const total = sim.wave.guiltyTotal;
  const out: SimEvent[] = [];
  // Fire both target-adding beats directly, many times, at point-blank range.
  for (let i = 0; i < 200; i++) {
    reglaze(sim, out);
    kindle(sim, out);
  }
  assert.equal(sim.wave.guiltyTotal, total, "the finish line moved during the endgame");
  assert.equal(sim.remix.added, 0);
  assert.equal(out.some((e) => e.t === "kindle"), false, "stone was kindled inside the endgame");
});

test("kindling is one-directional: stone becomes glass, never the reverse", () => {
  const sim = createSim(777, VH);
  launch(sim);
  const out: SimEvent[] = [];
  let flips = 0;
  for (let i = 0; i < 400; i++) {
    const before = new Map(sim.wave.tiles.map((t) => [t, t.guilty] as const));
    out.length = 0;
    if (!kindle(sim, out)) break;
    for (const [t, wasGuilty] of before) {
      if (wasGuilty) assert.equal(t.guilty, true, "a target was turned back into stone");
      if (!wasGuilty && t.guilty) flips++;
    }
  }
  assert.ok(flips > 0, "nothing was ever kindled");
});

test("a re-glazed pane only ever lands in an empty cell", () => {
  const sim = createSim(99, VH);
  launch(sim);
  const out: SimEvent[] = [];
  // Empty half the wall so there is somewhere to re-glaze into.
  for (const t of sim.wave.tiles) if (t.col % 2 === 0) t.alive = false;
  const occupied = new Set(
    sim.wave.tiles.filter((t) => t.alive).map((t) => `${t.col},${t.row}`),
  );
  let landed = 0;
  for (let i = 0; i < 60; i++) {
    out.length = 0;
    if (!reglaze(sim, out)) break;
    for (const e of out) {
      if (e.t !== "reglaze") continue;
      landed++;
      assert.equal(
        occupied.has(`${e.tile.col},${e.tile.row}`),
        false,
        `a pane was re-glazed on top of a live tile at ${e.tile.col},${e.tile.row}`,
      );
      assert.ok(e.tile.drop > 0, "a re-glazed pane was solid the instant it appeared");
      occupied.add(`${e.tile.col},${e.tile.row}`);
    }
  }
  assert.ok(landed > 0, "nothing was ever re-glazed");
});

test("the remix is a pure function of the seed", () => {
  const a = play(31337, 120);
  const b = play(31337, 120);
  assert.deepEqual(a.beats, b.beats);
  assert.equal(a.sim.score, b.sim.score);
  assert.equal(a.sim.wave.guiltyTotal, b.sim.wave.guiltyTotal);
  assert.equal(a.maxSway, b.maxSway);
  assert.equal(a.events.length, b.events.length);
});

test("two runs a millisecond apart are not the same board", () => {
  // What `mount.ts` actually does: seed from the clock. Eight launches in
  // consecutive milliseconds must all be different boards, remixed differently.
  const now = 1785000000000;
  const runs = Array.from({ length: 8 }, (_, i) => play(((now + i) ^ 0x5eed1e) >>> 0, 90));
  const shape = (r: (typeof runs)[number]): string =>
    r.sim.wave.tiles
      .map((t) => `${t.col},${t.row}`)
      .sort()
      .join("|");
  // The remix trace: what happened, where, and in what order. Beat *counts*
  // collide between unrelated runs often enough to be worthless as a
  // fingerprint; the trace does not.
  const trace = (r: (typeof runs)[number]): string =>
    r.events
      .filter((e) => e.t === "reglaze" || e.t === "kindle")
      .map((e) => `${e.t}@${e.tile.col},${e.tile.row}:${e.tile.face.text}`)
      .join(" ");
  assert.equal(new Set(runs.map(shape)).size, runs.length, "two fresh sessions opened on the same wall");
  assert.equal(new Set(runs.map(trace)).size, runs.length, "two fresh sessions were remixed identically");
  for (const r of runs) assert.ok(trace(r).length > 0, "a run had no remix at all to compare");

  // And the schedule is seeded from the run in its own right, rather than
  // merely riding on a wall that happened to differ: eight fresh sims disagree
  // about when the first beat lands and how the window swings, before a single
  // frame has been stepped.
  const schedules = new Set(
    Array.from({ length: 8 }, (_, i) => {
      const s = createSim(((now + i) ^ 0x5eed1e) >>> 0, VH).remix;
      return `${s.next}|${s.swayPeriod}|${s.swayAngle}|${s.swayTarget}`;
    }),
  );
  assert.equal(schedules.size, 8, "every session got the same remix schedule");
});

test("a whole session stays solvable, wave after remixed wave", () => {
  // The later waves are the interesting ones: they descend, they swing hardest,
  // and they carry crystal and star. Every invariant in `play` is checked on
  // every frame of all of them.
  for (const seed of [11, 23, 57, 101]) {
    const r = play(seed, 4000, 6);
    assert.ok(r.cleared >= 6, `seed ${seed} only cleared ${r.cleared} waves`);
    assert.ok(r.sim.wave.index >= 5, `seed ${seed} stopped at wave ${r.sim.wave.index}`);
    assert.ok(r.maxSway > 0, `seed ${seed} never drifted`);
  }
});

test("a late wave swings far harder than the tutorial does", () => {
  const early = play(5, 400, 1);
  const late = play(5, 4000, 6);
  assert.ok(late.maxSway > early.maxSway * 3, `${late.maxSway} vs ${early.maxSway}`);
  // A quarter of a cell of travel is plainly visible; the tutorial gets a
  // fifteenth of one. Both numbers are the wave's own bound, never a global.
  assert.ok(late.maxSway > late.sim.cellW * 0.2, `a late wave only swung ${late.maxSway}`);
  assert.ok(early.maxSway < early.sim.cellW * 0.1, `the tutorial swung ${early.maxSway}`);
});

test("the window drifts, and the drift never leaves the playfield", () => {
  // Wave one drifts barely at all; a later wave drifts a lot. Both stay on.
  const early = play(5, 200);
  assert.ok(early.maxSway > 0, "the window never moved at all");
  assert.ok(early.maxSway < early.sim.cellW * 0.2, `the tutorial wall swung ${early.maxSway}`);
  const sim = createSim(5, VH);
  const margin = sim.wallX;
  assert.ok(
    MAX_SWAY_CELLS * sim.cellW < margin,
    `a full swing of ${MAX_SWAY_CELLS * sim.cellW} would push a ${margin}-unit margin off screen`,
  );
});
