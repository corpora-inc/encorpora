/**
 * The run, driven headlessly.
 *
 * `world.ts` has no DOM and no audio of its own, so the whole rule set can be
 * played thousands of times faster than real time. These tests play twenty
 * simulated minutes and assert what a screenshot can never show: that the
 * escalation actually arrives, that the pools stay inside their budgets, and
 * that the learner model is never told the same thing twice.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createWorld, confirmPressed, stepWorld, startRun, type World } from "./world.ts";
import { createStubHost } from "../stub/host.ts";
import { TUNE } from "./tuning.ts";
import { angleDelta } from "./num.ts";
import { parseLabel, satisfies, type Predicate } from "../stub/exact.ts";
import type { Audio } from "./audio.ts";
import type { Host, Question, Report } from "../contract.ts";

/**
 * The world's ambience — which label an orb wears, whether a hunter spawns,
 * how many sparks a burst throws — runs on `Math.random` by design: `num.ts`
 * calls it "a visual-only RNG, kept separate from the question stream", and the
 * question stream itself is exact and separately seeded. That is the right
 * choice for play and the wrong one for a test. Driven by the real
 * `Math.random`, this file failed about two runs in five, in three different
 * tests, because the bot and the spawner both drew from it.
 *
 * Pin it to a seeded stream for the whole file so a failure here always means a
 * rule changed, never that the dice landed badly. The game itself is untouched.
 */
const seededRandom = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
Math.random = seededRandom(0x5e12e17);

const FIXED = 1 / 120;

const silentAudio = (): Audio => ({
  enabled: false,
  ready: false,
  resume() {},
  setEnabled() {},
  eat() {},
  wrong() {},
  wall() {},
  graze() {},
  depth() {},
  mutate() {},
  shield() {},
  shieldBreak() {},
  death() {},
  setBoost() {},
  ambient() {},
  dispose() {},
});

type Instrumented = {
  host: Host;
  served: Question[];
  reports: Report[];
};

function instrument(seed: string, startLevel?: number): Instrumented {
  const served: Question[] = [];
  const reports: Report[] = [];
  const inner = createStubHost(startLevel === undefined ? { seed } : { seed, startLevel });
  const host: Host = {
    next() {
      const q = inner.next();
      served.push(q);
      return q;
    },
    report(r) {
      reports.push(r);
      inner.report(r);
    },
    haptic() {},
    prefersReducedMotion: () => false,
  };
  return { host, served, reports };
}

/**
 * A pilot good enough to be worth measuring: it prefers targets it can turn
 * toward, and it looks ahead along its own arc rather than only pushing away
 * from body points it is already touching. A dumb bot makes a game look harder
 * than it is, and then you tune the wrong thing.
 */
function pilotHeading(w: World, skill: number): number | null {
  const s = w.serpent;
  const rim = Math.hypot(s.x, s.y);

  let best: { x: number; y: number } | null = null;
  let bestCost = Infinity;
  for (const o of w.orbs) {
    if (o.scale < 0.7 || o.moltT > 0) continue;
    const want = o.good ? Math.random() < skill : Math.random() > skill;
    if (!want) continue;
    const dx = o.x - s.x;
    const dy = o.y - s.y;
    const d = Math.hypot(dx, dy);
    const turn = Math.abs(angleDelta(s.heading, Math.atan2(dy, dx)));
    const cost = d + turn * 0.34; // a target behind you is worth less
    if (cost < bestCost) {
      bestCost = cost;
      best = o;
    }
  }

  let ax = best ? best.x - s.x : -s.x;
  let ay = best ? best.y - s.y : -s.y;
  if (rim > w.arenaR - 0.3) {
    ax -= s.x * 5;
    ay -= s.y * 5;
  }
  // Look ahead: sample where the head will be and steer off anything there.
  for (const lead of [0.14, 0.26]) {
    const px = s.x + Math.cos(s.heading) * lead;
    const py = s.y + Math.sin(s.heading) * lead;
    for (let i = TUNE.neckSegments; i < s.bodyCount; i += 2) {
      const dx = (s.bodyX[i] as number) - px;
      const dy = (s.bodyY[i] as number) - py;
      const dd = dx * dx + dy * dy;
      if (dd < 0.05 && dd > 1e-6) {
        ax -= (dx / dd) * 0.012;
        ay -= (dy / dd) * 0.012;
      }
    }
  }
  for (const o of w.orbs) {
    if (o.good) continue;
    const dx = o.x - s.x;
    const dy = o.y - s.y;
    const dd = dx * dx + dy * dy;
    if (dd < 0.06 && dd > 1e-6) {
      ax -= (dx / dd) * 0.004;
      ay -= (dy / dd) * 0.004;
    }
  }
  return Math.atan2(ay, ax);
}

function play(w: World, seconds: number, skill: number, boost = false): void {
  const steps = Math.round(seconds / FIXED);
  for (let i = 0; i < steps; i++) {
    if (w.phase === "dead" && w.deathT > 0.6) confirmPressed(w);
    stepWorld(w, FIXED, { heading: pilotHeading(w, skill), boost });
  }
}

test("a question is never reported twice, and every report names a served question", () => {
  const { host, served, reports } = instrument("no-double");
  const w = createWorld(host, silentAudio(), false);
  startRun(w);
  play(w, 240, 0.9);

  const ids = new Set(served.map((q) => q.id));
  const seen = new Set<string>();
  for (const r of reports) {
    assert.ok(ids.has(r.questionId), `reported an id that was never served: ${r.questionId}`);
    assert.ok(!seen.has(r.questionId), `reported ${r.questionId} twice`);
    seen.add(r.questionId);
  }
  assert.ok(reports.length > 40, `four minutes of play produced only ${reports.length} reports`);
  assert.ok(reports.length <= served.length);
});

test("a report's verdict is exactly what the arithmetic says", () => {
  // Independent check: take the report's `answered` label, parse it, and judge
  // it against the condition the prompt names. The game must never call an orb
  // correct that the predicate rejects.
  const { host, served, reports } = instrument("verdict");
  const w = createWorld(host, silentAudio(), false);
  startRun(w);
  play(w, 300, 0.75);

  const promptOf = new Map(served.map((q) => [q.id, q.prompt]));
  let checked = 0;
  for (const r of reports) {
    const prompt = promptOf.get(r.questionId);
    assert.ok(prompt);
    const p = predicateFromPrompt(prompt);
    if (!p) continue;
    const v = parseLabel(r.answered);
    assert.ok(v !== null, `report carried an unparsable label ${JSON.stringify(r.answered)}`);
    assert.equal(satisfies(p, v), r.correct, `${r.answered} vs ${prompt}: reported ${r.correct}`);
    checked++;
  }
  assert.ok(checked > 40, `only ${checked} reports were checkable`);
});

function predicateFromPrompt(prompt: string): Predicate | null {
  let m = /^= (-?\d+)$/.exec(prompt);
  if (m) return { kind: "eq", target: { n: Number(m[1]), d: 1 } };
  m = /^(\d+) × \?$/.exec(prompt);
  if (m) return { kind: "multiple", base: Number(m[1]) };
  m = /^([<>]) (\d+)\/(\d+)$/.exec(prompt);
  if (m) {
    const ref = { n: Number(m[2]), d: Number(m[3]) };
    return m[1] === ">" ? { kind: "gt", ref } : { kind: "lt", ref };
  }
  return null;
}

test("twenty minutes of play escalates and never leaves its budgets", () => {
  const { host, reports } = instrument("long-haul");
  const w = createWorld(host, silentAudio(), false);
  startRun(w);

  let maxParticles = 0;
  let maxOrbs = 0;
  let maxBody = 0;
  let deepest = 1;
  let smallestArena = 1;
  const steps = Math.round(20 * 60 / FIXED);
  for (let i = 0; i < steps; i++) {
    if (w.phase === "dead" && w.deathT > 0.6) confirmPressed(w);
    stepWorld(w, FIXED, { heading: pilotHeading(w, 0.97), boost: i % 900 < 120 });
    maxParticles = Math.max(maxParticles, w.particles.count);
    maxOrbs = Math.max(maxOrbs, w.orbs.length);
    maxBody = Math.max(maxBody, w.serpent.bodyCount);
    deepest = Math.max(deepest, w.depth);
    smallestArena = Math.min(smallestArena, w.arenaR);
  }

  assert.ok(deepest >= 8, `only reached depth ${deepest} in twenty minutes`);
  assert.ok(smallestArena <= TUNE.arenaStart - TUNE.arenaShrinkPerDepth * 3, `arena barely closed: ${smallestArena}`);
  assert.ok(smallestArena >= TUNE.arenaFloor - 1e-6, `arena shrank past its floor: ${smallestArena}`);
  assert.ok(maxParticles <= w.particles.cap, `particle cap breached: ${maxParticles}`);
  assert.ok(maxOrbs <= TUNE.orbMaxCount, `orb cap breached: ${maxOrbs}`);
  assert.ok(maxBody <= TUNE.maxSegments, `segment cap breached: ${maxBody}`);
  assert.ok(w.rings.count <= w.rings.cap);
  assert.ok(reports.length > 200, `twenty minutes produced only ${reports.length} answers`);
  assert.ok(Number.isFinite(w.score) && w.score >= 0);
  assert.ok(Number.isFinite(w.serpent.x) && Number.isFinite(w.serpent.y));
});

test("the arena always holds enough correct answers to be playable", () => {
  const { host } = instrument("supply");
  const w = createWorld(host, silentAudio(), false);
  startRun(w);
  let starved = 0;
  const steps = Math.round(180 / FIXED);
  for (let i = 0; i < steps; i++) {
    stepWorld(w, FIXED, { heading: pilotHeading(w, 0.95), boost: false });
    if (w.phase !== "play") continue;
    // Allow one frame of slack around a bite and a mutation's molt.
    if (w.mutateT > 0) continue;
    const good = w.orbs.filter((o) => o.good).length;
    if (good < 1) starved++;
  }
  assert.equal(starved, 0, `the field ran out of correct answers on ${starved} frames`);
});

test("eating wrong costs length; eating right pays it back", () => {
  const { host } = instrument("stakes");
  const w = createWorld(host, silentAudio(), false);
  startRun(w);
  const start = w.serpent.targetSegments;
  play(w, 90, 0); // a pilot that eats only wrong answers
  assert.ok(w.wrongEats > 4, `expected the bad pilot to eat wrong things, got ${w.wrongEats}`);
  assert.ok(w.serpent.targetSegments < start || w.phase === "dead", "wrong answers must cost something");
  assert.ok(w.serpent.targetSegments >= TUNE.minSegments, "the serpent must never shrink below its floor");
  assert.equal(w.combo, 0);
});

test("the wall costs length and throws you back — it never ends the run", () => {
  // Twenty measured minutes said every single death was the wall and none was
  // the serpent's own body. Dying while reading a number is the least
  // interesting death a snake can have, so the rim became a cost.
  const { host } = instrument("wall");
  const w = createWorld(host, silentAudio(), false);
  startRun(w);
  const before = w.serpent.targetSegments;
  let hits = 0;
  for (let i = 0; i < 2400 && hits === 0; i++) {
    stepWorld(w, FIXED, { heading: 0, boost: false });
    if (w.wallT > 0) hits++;
  }
  assert.equal(hits, 1, "driving straight at the wall must register a wall hit");
  assert.equal(w.phase, "play", "the rim must not end the run");
  assert.ok(w.serpent.targetSegments < before, "the rim must cost length");
  assert.ok(Math.hypot(w.serpent.x, w.serpent.y) < w.arenaR, "the serpent must be put back inside the arena");
  assert.equal(w.combo, 0, "the rim must break the combo");
  // And the deflection must not aim the head back down its own body.
  const away = Math.cos(w.serpent.heading) * w.serpent.x + Math.sin(w.serpent.heading) * w.serpent.y;
  assert.ok(away < 0, "the deflection must send the serpent inward, not along the wall forever");
});

test("outgrowing your own turning circle is what ends a run", () => {
  const { host } = instrument("selfdeath");
  const w = createWorld(host, silentAudio(), false);
  startRun(w);
  w.serpent.targetSegments = 120;
  w.serpent.segments = 120;
  // Hold a hard turn: the head comes round into its own flank.
  for (let i = 0; i < 4000 && w.phase === "play"; i++) {
    stepWorld(w, FIXED, { heading: w.serpent.heading + 1.4, boost: false });
  }
  assert.equal(w.phase, "dead", "a tight coil must be lethal");
  assert.ok(w.best >= 0);
  for (let i = 0; i < 80; i++) stepWorld(w, FIXED, { heading: 0, boost: false });
  confirmPressed(w);
  assert.equal(w.phase, "play");
  assert.equal(w.depth, 1);
  assert.equal(w.score, 0);
  assert.ok(w.serpent.alive);
});

test("a shield is earned by a combo and spends itself on the next death", () => {
  const { host } = instrument("shield");
  const w = createWorld(host, silentAudio(), false);
  startRun(w);
  let restarts = 0;
  for (let i = 0; i < 90000 && !w.serpent.shield; i++) {
    if (w.phase === "dead" && w.deathT > 0.6) {
      restarts++;
      confirmPressed(w);
    }
    stepWorld(w, FIXED, { heading: pilotHeading(w, 1), boost: false });
  }
  assert.ok(w.serpent.shield, "a perfect pilot never earned a shield");
  assert.ok(w.combo >= TUNE.shieldAtCombo);

  w.serpent.targetSegments = 120;
  w.serpent.segments = 120;
  for (let i = 0; i < 6000 && w.serpent.shield && w.phase === "play"; i++) {
    stepWorld(w, FIXED, { heading: w.serpent.heading + 1.4, boost: false });
  }
  assert.equal(w.phase, "play", "the shield must absorb the hit, not merely delay it");
  assert.equal(w.serpent.shield, false);
});

test("reduced motion drops the motion and keeps the game", () => {
  const { host, reports } = instrument("reduced");
  const w = createWorld(host, silentAudio(), true);
  startRun(w);
  play(w, 120, 0.85);
  assert.equal(w.cam.trauma, 0, "reduced motion must never accumulate shake");
  assert.equal(w.cam.shakeX, 0);
  assert.equal(w.cam.zoom, 1, "reduced motion must never punch the camera");
  assert.equal(w.cam.flashAlpha, 0);
  assert.ok(w.particles.cap <= TUNE.particleCapReduced);
  assert.ok(reports.length > 20, "reduced motion must not stop the game being playable");
  assert.ok(w.correctEats > 10);
});

test("the same seed serves the same questions to the same run", () => {
  const a = instrument("repeat", 3);
  const b = instrument("repeat", 3);
  const wa = createWorld(a.host, silentAudio(), false);
  const wb = createWorld(b.host, silentAudio(), false);
  startRun(wa);
  startRun(wb);
  play(wa, 60, 0.9);
  play(wb, 60, 0.4);
  const n = Math.min(a.served.length, b.served.length, 30);
  assert.ok(n >= 10);
  for (let i = 0; i < n; i++) {
    assert.equal((a.served[i] as Question).prompt, (b.served[i] as Question).prompt);
    assert.equal((a.served[i] as Question).answer, (b.served[i] as Question).answer);
  }
});

test("the simulation step stays far inside a 60fps budget", () => {
  const { host } = instrument("bench");
  const w = createWorld(host, silentAudio(), false);
  startRun(w);
  // Warm up to a heavy state: long body, full field, particles in flight.
  play(w, 240, 0.98);
  const heavy = w.serpent.bodyCount;

  const N = 24000; // 200 seconds of simulation
  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    stepWorld(w, FIXED, { heading: pilotHeading(w, 0.98), boost: true });
  }
  const perStep = (performance.now() - t0) / N;
  // Two sim steps per rendered frame at 60fps. The whole simulation must be a
  // rounding error next to the 16.7ms frame, leaving the budget for drawing.
  assert.ok(perStep < 0.35, `sim step cost ${perStep.toFixed(3)}ms at body ${heavy}`);
});
