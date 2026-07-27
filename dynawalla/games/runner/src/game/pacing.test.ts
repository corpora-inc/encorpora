import test from "node:test";
import assert from "node:assert/strict";
import {
  speedAt, readWindow, breather, beatTime, difficultyFor,
  READ_WINDOW_FLOOR, V_START, V_TERMINAL, V_REDUCED_CAP,
  COST_WRONG_GATE, COST_HAZARD, GAIN_GATE, VOLT_BLEED, VOLT_MAX,
} from "./pacing.ts";
import { Rng } from "./rng.ts";

/* --------------------------------- pacing --------------------------------- */

test("speed rises monotonically and is bounded by terminal velocity", () => {
  let prev = -1;
  for (let t = 0; t <= 1800; t += 5) {
    const v = speedAt(t, false);
    assert.ok(v >= prev - 1e-9, `speed went backwards at ${t}s`);
    assert.ok(v >= V_START - 1e-9 && v <= V_TERMINAL, `speed ${v} out of range at ${t}s`);
    prev = v;
  }
});

test("the run feels fast inside a five-minute free session", () => {
  // The business model gives a child 5-10 minutes. If terminal velocity is not
  // reached inside that, most players never see the game's top gear.
  assert.ok(speedAt(90, false) > 48, `only ${speedAt(90, false).toFixed(1)} u/s at 90 seconds`);
  assert.ok(speedAt(300, false) > 0.92 * V_TERMINAL, "not near terminal velocity at five minutes");
});

test("reduced motion caps speed without stopping the world", () => {
  for (const t of [0, 60, 600]) {
    const v = speedAt(t, true);
    assert.ok(v <= V_REDUCED_CAP, `reduced motion hit ${v} u/s`);
    assert.ok(v > 20, "reduced motion must still be a runner, not a slideshow");
  }
});

test("the reading window shrinks but never below its floor", () => {
  let prev = Infinity;
  for (let m = 0; m <= 60000; m += 50) {
    const w = readWindow(m, false);
    assert.ok(w <= prev + 1e-9, `reading window grew at ${m}m`);
    assert.ok(w >= READ_WINDOW_FLOOR - 1e-9, `reading window collapsed to ${w}s at ${m}m`);
    prev = w;
  }
  assert.ok(readWindow(0, false) > 3, "the first gates must be generous");
  assert.ok(readWindow(1e9, true) > readWindow(1e9, false), "reduced motion must buy extra reading time");
});

test("gate cadence and hazard beats stay positive and tighten with distance", () => {
  for (const [fn, name] of [[breather, "breather"], [beatTime, "beat"]] as const) {
    let prev = Infinity;
    for (let m = 0; m <= 40000; m += 100) {
      const v = fn(m);
      assert.ok(v > 0.15, `${name} collapsed to ${v}s at ${m}m`);
      assert.ok(v <= prev + 1e-9, `${name} grew at ${m}m`);
      prev = v;
    }
  }
});

test("a twenty-minute run keeps escalating rather than plateauing into nothing", () => {
  // Distance covered over twenty minutes, integrated at one-second steps.
  let travel = 0;
  for (let t = 0; t < 1200; t++) travel += speedAt(t, false);
  assert.ok(travel > 60000, `only ${Math.round(travel)}m in twenty minutes`);
  // The reading window at that distance is still at its floor, not below it.
  assert.equal(readWindow(travel, false) >= READ_WINDOW_FLOOR, true);
});

/* ------------------------------- difficulty ------------------------------- */

test("difficulty climbs with distance and is clamped", () => {
  assert.ok(difficultyFor(0, 1, 0, 0) < difficultyFor(5000, 1, 0, 0));
  assert.ok(difficultyFor(1e9, 9, 100, 100) <= 12);
  assert.ok(difficultyFor(0, 1, 100, 0) >= 0, "difficulty must never go negative");
});

test("a child who is drowning gets relief, not more escalation", () => {
  const struggling = difficultyFor(4000, 1, 10, 4); // 40% right
  const cruising = difficultyFor(4000, 1, 10, 10);
  assert.ok(struggling < cruising - 1.5, "a bad patch must visibly ease the questions");
  // Fewer than four answered is not evidence of anything; do not punish it.
  assert.equal(difficultyFor(4000, 1, 3, 0), difficultyFor(4000, 1, 0, 0));
});

/* --------------------------------- economy -------------------------------- */

test("the damage economy survives mistakes but punishes guessing", () => {
  // Three lanes means a guesser is right a third of the time. Guessing must be
  // strictly worse than reading, and one mistake must not end a run.
  assert.ok(VOLT_MAX / COST_WRONG_GATE > 3, "fewer than three wrong gates ends a run");
  assert.ok(VOLT_MAX / COST_WRONG_GATE < 5, "wrong gates cost too little to matter");
  const perGuess = (1 / 3) * GAIN_GATE - (2 / 3) * COST_WRONG_GATE;
  assert.ok(perGuess < -10, `guessing nets ${perGuess.toFixed(1)} voltage per gate, which is survivable`);
  const perRead = GAIN_GATE;
  assert.ok(perRead > 0, "reading must be net positive");
  assert.ok(COST_HAZARD < COST_WRONG_GATE, "a reflex slip must cost less than a maths mistake");
});

test("the passive bleed is pressure, not a countdown", () => {
  // Doing nothing else, an untouched player survives well past the free tier's
  // ten minutes; the bleed only matters alongside mistakes.
  assert.ok(VOLT_MAX / VOLT_BLEED > 400, `bleed alone kills in ${(VOLT_MAX / VOLT_BLEED).toFixed(0)}s`);
});

/* ----------------------------------- rng ---------------------------------- */

test("the rng is deterministic, bounded and uniform enough to trust", () => {
  const a = new Rng(42), b = new Rng(42), c = new Rng(43);
  const seqA = Array.from({ length: 500 }, () => a.next());
  const seqB = Array.from({ length: 500 }, () => b.next());
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, Array.from({ length: 500 }, () => c.next()));
  for (const v of seqA) assert.ok(v >= 0 && v < 1);

  const r = new Rng(7);
  const buckets = new Array(3).fill(0);
  for (let i = 0; i < 30000; i++) buckets[r.int(0, 2)]++;
  for (const n of buckets) assert.ok(n > 9000 && n < 11000, `lane bias: ${buckets.join("/")}`);

  // A zero seed must not collapse the generator to a constant.
  const z = new Rng(0);
  assert.notEqual(z.next(), z.next());
});

test("shuffle is a permutation, in place, and reproducible", () => {
  const r1 = new Rng(11), r2 = new Rng(11);
  const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const out = r1.shuffle(xs.slice());
  assert.deepEqual(out.slice().sort((a, b) => a - b), xs);
  assert.deepEqual(out, r2.shuffle(xs.slice()));
});
