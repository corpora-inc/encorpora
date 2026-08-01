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
import {
  arenaAxes,
  arenaEdge,
  createWorld,
  confirmPressed,
  setArenaAspect,
  stepWorld,
  startRun,
  type World,
} from "./world.ts";
import { createOrb, placeOrb } from "./orbs.ts";
import { arenaFrame, topChromeBand } from "./arena.ts";
import { NO_INSETS, safeRect } from "../../../../packs/shared/game-chrome/index.ts";
import { createStubHost } from "../stub/host.ts";
import { TUNE } from "./tuning.ts";
import { TAU, angleDelta } from "./num.ts";
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
  /** How many questions had been served when this run first answered one. */
  servedBeforeFirstAnswer(): number;
};

function instrument(seed: string, startLevel?: number): Instrumented {
  const served: Question[] = [];
  const reports: Report[] = [];
  let before = Infinity;
  const inner = createStubHost(startLevel === undefined ? { seed } : { seed, startLevel });
  const host: Host = {
    next() {
      const q = inner.next();
      served.push(q);
      return q;
    },
    report(r) {
      if (reports.length === 0) before = served.length;
      reports.push(r);
      inner.report(r);
    },
    haptic() {},
    prefersReducedMotion: () => false,
  };
  return { host, served, reports, servedBeforeFirstAnswer: () => before };
}

/**
 * A pilot good enough to be worth measuring: it prefers targets it can turn
 * toward, and it looks ahead along its own arc rather than only pushing away
 * from body points it is already touching. A dumb bot makes a game look harder
 * than it is, and then you tune the wrong thing.
 */
function pilotHeading(w: World, skill: number): number | null {
  const s = w.serpent;
  // Off the wall it actually has. `Math.hypot` was the distance from the middle,
  // which on a circle was the same thing; on a board that is the whole screen it
  // pins the bot to the centre of a tall phone and makes the game look unplayable
  // when it is the measuring instrument that is broken.
  const rim = arenaEdge(w, s.x, s.y);

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
  if (rim.gap < 0.3) {
    ax -= rim.nx * 5;
    ay -= rim.ny * 5;
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

  // Six and not the eight this asked for before the field was thinned. The
  // opening went from ten orbs times the board's AREA to five, so the serpent
  // swims further per bite and a depth costs more minutes. Escalation still
  // arrives, and the number that actually matters — how many questions a child
  // is asked — is asserted below and went UP, not down.
  assert.ok(deepest >= 6, `only reached depth ${deepest} in twenty minutes`);
  assert.ok(smallestArena <= TUNE.arenaStart - TUNE.arenaShrinkPerDepth * 3, `arena barely closed: ${smallestArena}`);
  assert.ok(smallestArena >= TUNE.arenaFloor - 1e-6, `arena shrank past its floor: ${smallestArena}`);
  assert.ok(maxParticles <= w.particles.cap, `particle cap breached: ${maxParticles}`);
  assert.ok(maxOrbs <= TUNE.orbMaxCount, `orb cap breached: ${maxOrbs}`);
  assert.ok(maxBody <= TUNE.maxSegments, `segment cap breached: ${maxBody}`);
  assert.ok(w.rings.count <= w.rings.cap);
  // The retrieval-volume floor, and the reason a sparser field is not a quieter
  // game. Twenty simulated minutes of a competent pilot puts ~548 questions to the
  // child — better than twenty a minute. If thinning the field ever starts
  // starving the question stream, this is where it shows up, and it is the metric
  // this product is actually judged on.
  assert.ok(reports.length > 400, `twenty minutes produced only ${reports.length} answers`);
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
  // A pilot eating wrong answers cannot build a run of right ones. Asserted as the
  // BEST combo of the whole run rather than the combo on the last frame: the
  // opening field is sparse and about a third of it is edible, so a pilot aiming
  // for wrong orbs stumbles into a right one now and then, and which frame the run
  // happens to end on is not a rule.
  assert.ok(w.bestCombo <= 2, `a pilot eating wrong answers reached a combo of ${w.bestCombo}`);
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
  assert.ok(arenaEdge(w, w.serpent.x, w.serpent.y).gap > 0, "the serpent must be put back inside the arena");
  assert.equal(w.combo, 0, "the rim must break the combo");
  // And the deflection must not aim the head back down its own body.
  const e = arenaEdge(w, w.serpent.x, w.serpent.y);
  const away = -(Math.cos(w.serpent.heading) * e.nx + Math.sin(w.serpent.heading) * e.ny);
  assert.ok(away > 0, "the deflection must send the serpent inward, not along the wall forever");
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
  // Up to the first ANSWER, and no further. The host is adaptive by design — it
  // is handed every report and is entitled to serve a struggling child something
  // else — so two runs with different accuracy are supposed to diverge, and a
  // test that compares past that point is asserting the learner model does not
  // work. What is seed-determined, and what this holds, is everything the host
  // says before it has been told anything.
  const n = Math.min(a.servedBeforeFirstAnswer(), b.servedBeforeFirstAnswer(), 30);
  assert.ok(n >= 5, `only ${n} questions were served before either run answered one`);
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

/* -------------------------------------------------------------------------- */
/* The board is the screen — and the wall came with it.                       */
/* -------------------------------------------------------------------------- */

/** The safe box the arena is inscribed in, at the shapes a child holds. */
const SCREENS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait", 390, 844],
  ["phone landscape", 844, 390],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["square", 600, 600],
];

/** A run on a given screen, shaped exactly the way `scene.ts` would shape it. */
function fresh(seed: string, viewW: number, viewH: number): World {
  const { host } = instrument(seed);
  const w = createWorld(host, silentAudio(), false);
  const safe = safeRect(viewW, viewH, NO_INSETS);
  const band = topChromeBand(viewW, safe.y, safe.h, NO_INSETS);
  setArenaAspect(w, arenaFrame(safe.w, safe.h, band).aspect);
  startRun(w);
  return w;
}

test("the rim is a wall you can die against from every direction, on every screen", () => {
  // The circle is gone, so the direction back to the middle is no longer the
  // direction the wall faces — off the end of a long vent they differ by about
  // 30°. Drive at the rim from twelve headings on six screens and check the three
  // things a wall owes the player: it registers, it puts you back inside, and it
  // turns you off the wall rather than turning you round into your own neck.
  for (const [name, sw, sh] of SCREENS) {
    for (let i = 0; i < 12; i++) {
      const heading = (i / 12) * TAU;
      const w = fresh(`wall-${name}-${i}`, sw, sh);
      // Nothing but the wall may interrupt: a bite would change the heading.
      w.orbs.length = 0;
      // The heading on the frame the wall took it, not the random one the run
      // opened with — the turn being measured is the deflection's own.
      let before = w.serpent.heading;
      let hit = false;
      for (let step = 0; step < 4000 && !hit; step++) {
        const prior = w.serpent.heading;
        stepWorld(w, FIXED, { heading, boost: false });
        if (w.wallT > 0) {
          before = prior;
          hit = true;
        }
      }
      const where = `${name}, heading ${((heading * 180) / Math.PI).toFixed(0)}°`;
      assert.ok(hit, `${where}: driving straight at the rim never registered a wall hit`);
      const s = w.serpent;
      const e = arenaEdge(w, s.x, s.y);
      assert.ok(
        e.gap > 0,
        `${where}: the wall left the serpent ${(-e.gap).toFixed(4)} OUTSIDE the vent`,
      );
      // Deflection, not reflection. The head keeps most of its along-wall speed
      // and picks up a definite push off the surface; a mirror bounce at normal
      // incidence would instead be a 180° turn into its own body.
      const inward = -(Math.cos(s.heading) * e.nx + Math.sin(s.heading) * e.ny);
      assert.ok(
        inward > 0.5,
        `${where}: after the hit the head is only ${inward.toFixed(3)} of the way off the wall`,
      );
      // A deflection turns the head at most 136° even head-on (`0.7 × tangent −
      // 0.72 × normal`); a mirror bounce at normal incidence turns it a full π.
      assert.ok(
        Math.abs(angleDelta(before, s.heading)) < 2.6,
        `${where}: the head was turned ${Math.abs(angleDelta(before, s.heading)).toFixed(2)} rad — ` +
          `that is a mirror bounce, and it drives the serpent back down its own neck`,
      );
    }
  }
});

test("the graze band is the same wall, paid for a moment earlier", () => {
  // Two expressions about the edge that disagree is the bug this change invites:
  // paid for grazing a circle while dying against an ellipse. So the band a child
  // is paid in must always have opened BEFORE the wall bites, on every screen.
  assert.ok(
    TUNE.grazeBand > TUNE.headRadius * 0.75,
    "the graze band is narrower than the wall — there is nothing to be paid for",
  );
  for (const [name, sw, sh] of SCREENS) {
    for (const heading of [0, Math.PI / 2, 2.2, 4.4]) {
      const w = fresh(`graze-${name}-${heading}`, sw, sh);
      w.orbs.length = 0;
      let grazedFor = 0;
      let hit = false;
      // The band is not observable directly, but `grazeGlow` only ever RISES
      // while the game thinks the serpent is in it, which is the same thing.
      let glow = w.grazeGlow;
      let deepest = 0;
      for (let step = 0; step < 4000 && !hit; step++) {
        stepWorld(w, FIXED, { heading, boost: false });
        if (w.grazeGlow > glow) {
          grazedFor++;
          deepest = Math.max(deepest, arenaEdge(w, w.serpent.x, w.serpent.y).gap);
        }
        glow = w.grazeGlow;
        hit = w.wallT > 0;
      }
      const where = `${name}, heading ${heading}`;
      assert.ok(hit, `${where}: never reached the wall`);
      // Neither half of the deal may drift from the other: the band never opens
      // out in open water. The 15% is slack for a frame of travel, not for a
      // different curve — a circular band inside this ellipse pays from sixteen
      // times the band's width out.
      assert.ok(
        deepest <= TUNE.grazeBand * 1.15,
        `${where}: the serpent was credited with grazing while it was ${deepest.toFixed(3)} from ` +
          `the rim, and the band is ${TUNE.grazeBand}`,
      );
      // … and it always opens before the wall bites.
      assert.ok(
        grazedFor > 4,
        `${where}: the wall bit after only ${grazedFor} frames in the graze band — the band and ` +
          `the wall are not the same curve`,
      );
    }
  }
});

test("an orb is never spawned against the wall, whatever shape the vent is", () => {
  // Asserted at the spawner and not through a frame of play, because `stepOrbs`
  // walks a stray orb back inside on the very next step and would hide this — the
  // clearance exists so an orb is REACHABLE, and one that appears on the rim and
  // is shoved off it has already been placed somewhere a child cannot bite.
  const clear = TUNE.orbRadius * 2.2;
  for (const [name, sw, sh] of SCREENS) {
    const w = fresh(`spawn-${name}`, sw, sh);
    for (const arenaR of [TUNE.arenaStart, 0.8, TUNE.arenaFloor]) {
      w.arenaR = arenaR;
      const axes = arenaAxes(w);
      const orb = createOrb();
      let worst = Infinity;
      for (let i = 0; i < 300; i++) {
        placeOrb(orb, w.orbs, axes, w.serpent.x, w.serpent.y);
        worst = Math.min(worst, arenaEdge(w, orb.x, orb.y).gap);
      }
      assert.ok(
        worst >= clear - 1e-9,
        `${name}, vent ${arenaR}: an orb was placed ${worst.toFixed(4)} from the rim and the ` +
          `spawn clearance is ${clear.toFixed(4)}`,
      );
    }
  }
});

test("nothing is ever put outside the vent, whatever shape it is", () => {
  // Spawning, drifting, hunting and the shape changing under everything at once.
  // An orb outside the rim is a correct answer a child cannot reach.
  for (const [name, sw, sh] of SCREENS) {
    const w = fresh(`field-${name}`, sw, sh);
    let worst = Infinity;
    let worstAt = "";
    const steps = Math.round(90 / FIXED);
    for (let i = 0; i < steps; i++) {
      if (w.phase === "dead" && w.deathT > 0.6) confirmPressed(w);
      stepWorld(w, FIXED, { heading: pilotHeading(w, 0.9), boost: i % 700 < 90 });
      for (const o of w.orbs) {
        const gap = arenaEdge(w, o.x, o.y).gap;
        if (gap < worst) {
          worst = gap;
          worstAt = `(${o.x.toFixed(3)},${o.y.toFixed(3)}) carrying "${o.label}"`;
        }
      }
    }
    assert.ok(
      worst >= -1e-9,
      `${name}: an orb was ${(-worst).toFixed(4)} outside the rim at ${worstAt}`,
    );
    // And the screen's shape really did reach the game. A "square" viewport is not
    // a square board — the host's chrome band comes off the top first — so it is
    // only asserted to be near one.
    const board = arenaAxes(w);
    const ratio = Math.max(board.a, board.b) / Math.min(board.a, board.b);
    const want = Math.max(sw, sh - 57) / Math.min(sw, sh - 57);
    assert.ok(
      Math.abs(ratio - want) < 0.15,
      `${name}: the board came out ${ratio.toFixed(2)}:1 on a ${want.toFixed(2)}:1 frame — ` +
        `the screen's shape did not reach the game`,
    );
  }
});

test("a rotation reshapes the board without stranding anything outside it", () => {
  // The one moment the vent gets SMALLER along an axis: a tall ellipse becomes a
  // wide one and everything in the ends of the old shape is now in the black.
  const w = fresh("rotate", 390, 844);
  for (let i = 0; i < Math.round(45 / FIXED); i++) {
    stepWorld(w, FIXED, { heading: pilotHeading(w, 0.9), boost: false });
  }
  const before = w.orbs.map((o) => ({ x: o.x, y: o.y }));
  assert.ok(
    before.some((o) => Math.abs(o.y) > w.arenaR * 1.05),
    "no orb was out in the tall end of the vent, so the rotation proves nothing",
  );
  const wide = safeRect(844, 390, NO_INSETS);
  setArenaAspect(w, arenaFrame(wide.w, wide.h, topChromeBand(844, wide.y, wide.h, NO_INSETS)).aspect);
  for (const o of w.orbs) {
    assert.ok(
      arenaEdge(w, o.x, o.y).gap >= TUNE.orbRadius * 1.1 - 1e-9,
      `an orb was left at (${o.x.toFixed(3)},${o.y.toFixed(3)}) after the rotation`,
    );
  }
  assert.ok(arenaEdge(w, w.serpent.x, w.serpent.y).gap > 0, "the serpent was left outside the new vent");
  // And the run keeps running through it.
  for (let i = 0; i < 600; i++) stepWorld(w, FIXED, { heading: pilotHeading(w, 0.9), boost: false });
  assert.ok(Number.isFinite(w.serpent.x) && Number.isFinite(w.serpent.y));
});

/* -------------------------------------------------------------------------- */
/* The opening.                                                               */
/* -------------------------------------------------------------------------- */

test("the first screen of a dive is not crowded, on any screen", () => {
  // The founder, on the shipped 0.3.8: "why are there so many choices when I
  // first start ... it's too hard and crowded and frustrating for the starting
  // density". His screenshot carried about twenty orbs at LV1, because the count
  // was multiplied by the board's AREA and the board had just become the screen.
  //
  // The opening is now the same five numbers whatever a child is holding.
  //
  // The ceiling is absolute and comes first, because everything below compares
  // the field to `TUNE.orbBaseCount` and would happily agree with itself at any
  // value — an opening of twenty orbs matching a constant that says twenty is
  // exactly the state that shipped.
  assert.ok(
    TUNE.orbBaseCount <= 6,
    `a dive opens on ${TUNE.orbBaseCount} numbers; the founder filed 22 as "too hard and ` +
      `crowded and frustrating for the starting density"`,
  );
  for (const [name, sw, sh] of SCREENS) {
    const w = fresh(`opening-${name}`, sw, sh);
    assert.equal(
      w.orbs.length,
      TUNE.orbBaseCount,
      `${name}: a dive opens on ${w.orbs.length} orbs and the opening is ${TUNE.orbBaseCount}`,
    );
    const good = w.orbs.filter((o) => o.good).length;
    assert.ok(good >= 1, `${name}: nothing on the opening screen is edible`);
    assert.ok(
      good < w.orbs.length,
      `${name}: everything on the opening screen is edible — there is no question to answer`,
    );
  }
});

/**
 * The biggest field seen at each depth of a real dive.
 *
 * Measured off a played run and not by poking `w.depth`, because `ensureField` is
 * called by the game at the moments the game calls it — a test that sets the depth
 * and asks nicely is testing an expression, not the field a child sees.
 */
function fieldByDepth(w: World, maxDepth: number, minutes: number): Map<number, { count: number; good: number }> {
  // The field the child mostly SEES, taken as the commonest (count, edible) pair
  // over every frame at that depth. Not the peak: a bite is answered by a spawn
  // and a molt on different frames, so the extremes catch the board mid-restock
  // and make two identical boards look like two different ones.
  const tally = new Map<number, Map<string, number>>();
  const steps = Math.round((minutes * 60) / FIXED);
  for (let i = 0; i < steps && w.depth <= maxDepth; i++) {
    if (w.phase === "dead" && w.deathT > 0.6) confirmPressed(w);
    // A measuring instrument, and it says so: it swims straight at the nearest
    // edible orb and is held at the opening length so it never coils into itself.
    // The question here is what the FIELD does with depth, and a bot that dies at
    // depth three answers a different one — the real pilot's survival is measured
    // by the twenty-minute test above.
    w.serpent.targetSegments = Math.min(w.serpent.targetSegments, TUNE.startSegments);
    w.serpent.segments = Math.min(w.serpent.segments, TUNE.startSegments);
    let want = w.serpent.heading;
    let near = Infinity;
    for (const o of w.orbs) {
      if (!o.good || o.scale < 0.7 || o.moltT > 0) continue;
      const d = Math.hypot(o.x - w.serpent.x, o.y - w.serpent.y);
      if (d < near) {
        near = d;
        want = Math.atan2(o.y - w.serpent.y, o.x - w.serpent.x);
      }
    }
    stepWorld(w, FIXED, { heading: want, boost: false });
    if (w.phase !== "play" || w.mutateT > 0) continue;
    const key = `${w.orbs.length}/${w.orbs.filter((o) => o.good).length}`;
    const at = tally.get(w.depth) ?? new Map<string, number>();
    at.set(key, (at.get(key) ?? 0) + 1);
    tally.set(w.depth, at);
  }
  const out = new Map<number, { count: number; good: number }>();
  for (const [depth, at] of tally) {
    let best = "";
    let bestN = -1;
    for (const [key, n] of at) {
      if (n > bestN) {
        bestN = n;
        best = key;
      }
    }
    const [count, good] = best.split("/").map(Number) as [number, number];
    out.set(depth, { count, good });
  }
  return out;
}

test("the field grows with correct answers, and with nothing else", () => {
  // Not elapsed time and not the size of the screen: a child who is finding it
  // hard is never handed a denser board for having been there a while, and a
  // bigger screen is not an achievement.
  const shapes: Array<[string, number, number]> = [
    ["phone portrait, small", 320, 568],
    ["tablet landscape", 1024, 768],
    ["phone portrait", 390, 844],
  ];
  const byShape = shapes.map(([name, sw, sh]) => [name, fieldByDepth(fresh(`grow-${name}`, sw, sh), 5, 8)] as const);

  const rows: string[] = [];
  for (let depth = 1; depth <= 5; depth++) {
    const seen = new Set<string>();
    for (const [name, m] of byShape) {
      const f = m.get(depth);
      assert.ok(f, `${name} never reached depth ${depth} in eight minutes of perfect play`);
      seen.add(`${f.count}/${f.good}`);
    }
    assert.equal(
      seen.size,
      1,
      `at depth ${depth} three different screens carry different fields: ${[...seen].join(", ")}`,
    );
    const f = (byShape[0] as (readonly [string, Map<number, { count: number; good: number }>]))[1].get(depth) as {
      count: number;
      good: number;
    };
    rows.push(
      `  LV${String(depth).padEnd(3)} ${String(f.count).padStart(2)} orbs, ${f.good} edible ` +
        `(${((f.good / f.count) * 100).toFixed(0)}%)`,
    );
    // About a third of what a child can see is edible, at every depth: a sparse
    // board where everything is food teaches nothing, and a deep one where almost
    // nothing is food is a needle hunt.
    const share = f.good / f.count;
    assert.ok(
      share >= 0.2 && share <= 0.45,
      `at depth ${depth} the field is ${f.count} orbs with ${f.good} edible (${(share * 100).toFixed(0)}%)`,
    );
  }
  console.log(`\n  the field, by depth (nine correct answers each):\n${rows.join("\n")}\n`);

  const counts = [1, 2, 3, 4, 5].map(
    (d) => ((byShape[0] as (readonly [string, Map<number, { count: number; good: number }>]))[1].get(d) as { count: number }).count,
  );
  for (let i = 1; i < counts.length; i++) {
    assert.ok(
      (counts[i] as number) >= (counts[i - 1] as number),
      `the field shrank between depth ${i} and ${i + 1}: ${counts[i - 1]} then ${counts[i]}`,
    );
  }
  assert.ok(
    (counts[4] as number) >= (counts[0] as number) * 2,
    `five depths only took the field from ${counts[0]} to ${counts[4]} — there is nothing to earn`,
  );
});

test("a minute of a first dive stays sparse", () => {
  // The measurement the founder's complaint is really about: not the opening
  // frame, but what the first minute FEELS like. A competent pilot is used, so
  // this is the crowding a child gets for playing WELL — a struggling child sees
  // strictly less.
  const w = fresh("minute", 390, 844);
  let total = 0;
  let peak = 0;
  const steps = Math.round(60 / FIXED);
  const marks: string[] = [];
  for (let i = 0; i < steps; i++) {
    if (w.phase === "dead" && w.deathT > 0.6) confirmPressed(w);
    stepWorld(w, FIXED, { heading: pilotHeading(w, 0.9), boost: false });
    total += w.orbs.length;
    peak = Math.max(peak, w.orbs.length);
    if ((i + 1) % Math.round(10 / FIXED) === 0) {
      marks.push(`${(i + 1) * FIXED}s: ${w.orbs.length} orbs, LV${w.depth}`);
    }
  }
  const mean = total / steps;
  console.log(`\n  first minute, competent pilot: mean ${mean.toFixed(1)} orbs, peak ${peak}\n    ${marks.join("\n    ")}\n`);
  assert.ok(mean <= 9, `the first minute averaged ${mean.toFixed(1)} orbs on screen`);
  assert.ok(peak <= 13, `the first minute peaked at ${peak} orbs on screen`);
});

/* -------------------------------------------------------------------------- */
/* Turning around.                                                            */
/* -------------------------------------------------------------------------- */

/** Hold the tightest turn the serpent can make until something happens. */
function coilUntil(w: World, stop: (w: World) => boolean, limit = 6000): boolean {
  for (let i = 0; i < limit; i++) {
    stepWorld(w, FIXED, { heading: w.serpent.heading + 1.4, boost: false });
    if (stop(w)) return true;
  }
  return false;
}

test("turning around at the start of a dive is a thud, not an ending", () => {
  // "he zooms around and grows and if I turn around he eats himself ... it's too
  // hard". At `startSegments` the head closes a full loop on itself inside two
  // seconds, so a child who turns the way they turn in every other game they own
  // loses the run before they have read the condition once.
  const w = fresh("bump", 390, 844);
  w.orbs.length = 0; // nothing to eat, so nothing arms the latch
  assert.equal(w.selfHitArmed, false, "a dive must open unarmed");

  const before = w.serpent.targetSegments;
  // Stop on EITHER outcome, so the assertion that fires names the one that
  // happened: "it ended the run" and "it never touched its own body" are very
  // different failures and a single stop condition reports them both as the second.
  const touched = coilUntil(w, (x) => x.invulnT > 0.4 || x.phase === "dead");
  assert.ok(touched, "a hard turn at the opening length never reached its own body");
  assert.equal(w.phase, "play", "turning around at the opening length ended the run");
  assert.ok(w.serpent.alive, "the serpent died on its own tail before it had grown");
  assert.equal(
    w.serpent.targetSegments,
    before,
    "the bump cost length — which would keep a child under the arming length for ever",
  );
  // And it is a real event, not a silent no-op: the child feels it.
  assert.ok(w.cam.trauma > 0.1, "the bump was silent — a lesson nobody notices is not a lesson");

  // It also keeps working: a child who has not yet earned length can bump again.
  const second = coilUntil(w, (x) => x.invulnT > 0.4 || x.phase === "dead");
  assert.ok(second, "the grace ran out after one bump without the serpent having grown");
  assert.equal(w.phase, "play");
});

test("once the serpent has grown, its own body ends the dive again", () => {
  const w = fresh("armed", 390, 844);
  w.orbs.length = 0;
  w.serpent.targetSegments = TUNE.selfHitArmsAt;
  w.serpent.segments = TUNE.selfHitArmsAt;
  const ended = coilUntil(w, (x) => x.phase === "dead");
  assert.ok(w.selfHitArmed, "growing past the arming length did not arm the body");
  assert.ok(ended, "a grown serpent coiled into itself and lived");
});

test("the grace is one-way: coughing length back up does not buy it again", () => {
  // Otherwise a player could hover under the arming length and be immortal, and
  // the one thing that can end a dive would be optional.
  const w = fresh("latch", 390, 844);
  w.orbs.length = 0;
  w.serpent.targetSegments = TUNE.selfHitArmsAt;
  w.serpent.segments = TUNE.selfHitArmsAt;
  stepWorld(w, FIXED, { heading: 0, boost: false });
  assert.ok(w.selfHitArmed, "the latch did not trip at the arming length");

  w.serpent.targetSegments = TUNE.startSegments;
  w.serpent.segments = TUNE.startSegments;
  stepWorld(w, FIXED, { heading: 0, boost: false });
  assert.ok(w.selfHitArmed, "shrinking back below the arming length disarmed the body");
  const ended = coilUntil(w, (x) => x.phase === "dead");
  assert.ok(ended, "a serpent that had grown and shrank back was immortal");
});

test("the arming length is reachable, and it is reached by answering correctly", () => {
  // Three correct answers, by construction — and the constant has to actually BE
  // three growths above the opening or the grace is either nothing or for ever.
  assert.ok(
    TUNE.selfHitArmsAt > TUNE.startSegments,
    "the serpent is armed the moment a dive opens — there is no grace at all",
  );
  assert.ok(
    TUNE.selfHitArmsAt <= TUNE.startSegments + TUNE.growPerCorrect * 3,
    `the grace lasts ${(TUNE.selfHitArmsAt - TUNE.startSegments) / TUNE.growPerCorrect} correct ` +
      `answers, which is long enough to be a mechanic rather than a lesson`,
  );
  const { host } = instrument("arming");
  const w = createWorld(host, silentAudio(), false);
  startRun(w);
  for (let i = 0; i < Math.round(200 / FIXED) && !w.selfHitArmed; i++) {
    stepWorld(w, FIXED, { heading: pilotHeading(w, 1), boost: false });
  }
  assert.ok(w.selfHitArmed, "a pilot answering correctly never grew into the lethal length");
  assert.ok(w.correctEats >= 3, `it armed after only ${w.correctEats} correct answers`);
});