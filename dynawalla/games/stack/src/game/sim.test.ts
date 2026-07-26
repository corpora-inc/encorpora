import test from "node:test";
import assert from "node:assert/strict";

import { Sim } from "./sim.ts";
import { T, perfectTol } from "./tuning.ts";
import type { Host, Question } from "../contract.ts";

/** A host with no randomness at all, so every assertion is about the sim. */
function fixedHost(over: Partial<Host> = {}): Host & { reports: unknown[] } {
  let n = 0;
  const reports: unknown[] = [];
  return {
    reports,
    next(): Question {
      n++;
      return {
        id: `q${n}`,
        prompt: "7 + ? = 10",
        answer: "3",
        distractors: ["4", "2", "17"],
        domain: "bond-10",
        difficulty: 1,
      };
    },
    report(r) {
      reports.push(r);
    },
    haptic() {},
    prefersReducedMotion() {
      return false;
    },
    ...over,
  };
}

/** Put the sweep exactly `delta` from true, with `value` showing. */
function aim(sim: Sim, delta: number, value: string): void {
  const i = sim.slots.indexOf(value);
  assert.notEqual(i, -1, `value ${value} not among slots ${sim.slots.join(",")}`);
  sim.slot = i;
  sim.holdLeft = 0;
  const axis = sim.axis;
  const centre = (axis === 0 ? sim.cx : sim.cz) + (axis === 0 ? sim.bendX(1) : sim.bendZ(1));
  sim.sweep = centre + delta;
}

test("a true placement snaps dead centre and widens the tower", () => {
  const sim = new Sim(fixedHost());
  const w0 = sim.wx;
  aim(sim, perfectTol(0) * 0.4, "3");
  const ev = sim.place(1)!;
  assert.equal(ev.outcome, "perfect");
  assert.equal(sim.floor, 1);
  assert.ok(sim.wx > w0, "perfect must widen");
  assert.equal(sim.cx, 0, "perfect snaps the centre back to true");
  assert.equal(ev.shear, null, "a perfect never sheds a slice");
});

test("width is capped, and a long true run parks at the cap", () => {
  const sim = new Sim(fixedHost());
  for (let i = 0; i < 200; i++) aim(sim, 0, "3"), sim.place(i);
  assert.ok(sim.wx <= T.MAX_W + 1e-9);
  assert.ok(sim.wz <= T.MAX_W + 1e-9);
  assert.equal(sim.floor, 200, "endless: two hundred true courses, no end state");
  assert.equal(sim.phase, "sweep");
});

test("a correct value dropped wide keeps exactly the overlap", () => {
  const sim = new Sim(fixedHost());
  const w0 = sim.wx;
  const d = 0.3;
  aim(sim, d, "3");
  const ev = sim.place(1)!;
  assert.equal(ev.outcome, "good");
  assert.ok(Math.abs(sim.wx - (w0 - d)) < 1e-9, `${sim.wx} != ${w0 - d}`);
  assert.ok(Math.abs(sim.cx - d / 2) < 1e-9, "the course recentres on the overlap");
  assert.ok(ev.shear, "the overhang leaves");
});

test("a wrong value takes a second bite out of the overlap", () => {
  const sim = new Sim(fixedHost());
  const w0 = sim.wx;
  const d = 0.1;
  aim(sim, d, "4");
  const ev = sim.place(1)!;
  assert.equal(ev.outcome, "wrong");
  assert.ok(Math.abs(sim.wx - (w0 - d) * T.WRONG_SHEAR) < 1e-9);
  assert.ok(sim.slabs[sim.slabs.length - 1]!.cracked);
});

test("a wrong value dropped dead centre is still wrong — alignment cannot rescue arithmetic", () => {
  const sim = new Sim(fixedHost());
  aim(sim, 0, "4");
  const ev = sim.place(1)!;
  assert.equal(ev.outcome, "wrong");
  assert.equal(sim.combo, 0);
});

test("a complete miss costs width and progress but never the run", () => {
  const sim = new Sim(fixedHost());
  const w0 = sim.wx;
  aim(sim, w0 + 0.5, "3");
  const ev = sim.place(1)!;
  assert.equal(ev.outcome, "miss");
  assert.equal(sim.floor, 0, "a miss places nothing");
  assert.equal(sim.slabs.length, 1);
  assert.ok(Math.abs(sim.wx - w0 * T.MISS_KEEP) < 1e-9);
  assert.equal(sim.phase, "sweep", "a miss is not death");
});

test("the axis alternates only when a course was actually set", () => {
  const sim = new Sim(fixedHost());
  assert.equal(sim.axis, 0);
  aim(sim, 0, "3");
  sim.place(1);
  assert.equal(sim.axis, 1);
  aim(sim, sim.wz + 1, "3"); // miss
  sim.place(2);
  assert.equal(sim.axis, 1, "a miss does not hand the next course to the other axis");
});

test("the monument falls when it becomes a needle, and only then", () => {
  const sim = new Sim(fixedHost());
  let guard = 0;
  while (sim.phase === "sweep" && guard++ < 60) {
    aim(sim, Math.min(0.3, sim.width * 0.45), "4");
    sim.place(guard);
  }
  assert.equal(sim.phase, "over");
  assert.ok(sim.width < T.DEATH_W, `died at width ${sim.width}`);
  assert.ok(guard < 60, "the death spiral must actually terminate");
});

test("nothing but a perfect can ever widen the tower", () => {
  const sim = new Sim(fixedHost());
  const rnd = mulberry(99);
  let prev = sim.width;
  for (let i = 0; i < 400 && sim.phase === "sweep"; i++) {
    const value = rnd() < 0.5 ? "3" : "4";
    const d = (rnd() - 0.5) * 0.5;
    const tol = perfectTol(sim.floor);
    const willPerfect = value === "3" && Math.abs(d) <= tol;
    aim(sim, d, value);
    const before = sim.axis === 0 ? sim.wx : sim.wz;
    sim.place(i);
    const after = sim.axis === 0 ? sim.wz : sim.wx; // axis may have flipped
    void after;
    const now = sim.axis === 0 ? sim.wz : sim.wx;
    if (!willPerfect) assert.ok(now <= before + 1e-9, `width grew on a non-perfect at i=${i}`);
    prev = sim.width;
  }
  assert.ok(prev >= 0);
});

test("the tower it reports and the tower it draws agree", () => {
  const sim = new Sim(fixedHost());
  const rnd = mulberry(7);
  for (let i = 0; i < 120 && sim.phase === "sweep"; i++) {
    aim(sim, (rnd() - 0.5) * 0.2, rnd() < 0.8 ? "3" : "4");
    sim.place(i);
  }
  const top = sim.slabs[sim.slabs.length - 1]!;
  assert.equal(top.i, sim.floor);
  assert.ok(Math.abs(top.wx - sim.wx) < 1e-9);
  assert.ok(Math.abs(top.wz - sim.wz) < 1e-9);
  for (let i = 1; i < sim.slabs.length; i++) {
    assert.equal(sim.slabs[i]!.i, sim.slabs[i - 1]!.i + 1, "no gaps in the courses");
  }
});

test("every placement is reported to the host exactly once, with the value that was showing", () => {
  const host = fixedHost();
  const sim = new Sim(host);
  aim(sim, 0, "3");
  sim.place(1);
  aim(sim, 0.05, "4");
  sim.place(2);
  aim(sim, 99, "3");
  sim.place(3);
  assert.equal(host.reports.length, 3);
  const r = host.reports as { correct: boolean; answered: string; ms: number }[];
  assert.deepEqual(
    r.map((x) => [x.correct, x.answered]),
    [
      [true, "3"],
      [false, "4"],
      [true, "3"],
    ],
  );
  assert.ok(r.every((x) => Number.isFinite(x.ms) && x.ms >= 0));
});

test("a wrong value reveals the truth, and the sweep is held while it is on screen", () => {
  const sim = new Sim(fixedHost());
  aim(sim, 0.05, "4");
  sim.place(1);
  assert.equal(sim.revealPrompt, "7 + ? = 10");
  assert.equal(sim.revealAnswer, "3");
  assert.ok(sim.holdLeft >= sim.revealLeft - 1e-9, "never aim at one thing while reading another");
  sim.update(1.0, 2);
  assert.equal(sim.revealPrompt, null);
});

test("sway leaves the foundation alone and only moves the top", () => {
  const sim = new Sim(fixedHost());
  sim.swayX = 0.05;
  assert.equal(sim.bendX(0), 0);
  assert.ok(Math.abs(sim.bendX(1) - 0.05) < 1e-12);
  assert.ok(sim.bendX(0.5) > 0 && sim.bendX(0.5) < 0.05);
});

test("a true placement calms the tower; a mistake whips it", () => {
  const sim = new Sim(fixedHost());
  sim.swayExcite = 1;
  aim(sim, 0.05, "4");
  sim.place(1);
  assert.ok(sim.swayExcite > 1, "a mistake excites the sway");
  sim.swayExcite = 1;
  aim(sim, 0, "3");
  sim.place(2);
  assert.ok(sim.swayExcite < 1, "a perfect calms it");
});

test("shoring it up costs something and cannot be farmed", () => {
  const sim = new Sim(fixedHost());
  let guard = 0;
  while (sim.phase === "sweep" && guard++ < 60) {
    aim(sim, Math.min(0.3, sim.width * 0.45), "4");
    sim.place(guard);
  }
  assert.equal(sim.phase, "over");
  sim.offerRevive();
  assert.equal(sim.phase, "revive");
  const w1 = (assert.ok(sim.reviveQ), sim.answerRevive(sim.reviveQ!.answer, 1), sim.wx);
  assert.equal(sim.phase, "sweep");
  assert.ok(w1 > T.DEATH_W);

  // A second revive must restore strictly less than the first.
  guard = 0;
  while (sim.phase === "sweep" && guard++ < 60) {
    aim(sim, Math.min(0.3, sim.width * 0.45), "4");
    sim.place(guard);
  }
  sim.offerRevive();
  sim.answerRevive(sim.reviveQ!.answer, 2);
  assert.ok(sim.wx <= w1 + 1e-9, `revive 2 (${sim.wx}) must not beat revive 1 (${w1})`);
});

test("a wrong revive answer ends the run", () => {
  const sim = new Sim(fixedHost());
  let guard = 0;
  while (sim.phase === "sweep" && guard++ < 60) {
    aim(sim, Math.min(0.3, sim.width * 0.45), "4");
    sim.place(guard);
  }
  sim.offerRevive();
  const bad = sim.reviveChoices.find((c) => c !== sim.reviveQ!.answer)!;
  assert.equal(sim.answerRevive(bad, 1), false);
  assert.equal(sim.phase, "over");
});

test("the same seed replays exactly", () => {
  const run = (): string => {
    const sim = new Sim(fixedHost(), 1234);
    const out: string[] = [];
    for (let i = 0; i < 40 && sim.phase === "sweep"; i++) {
      sim.update(1 / 60, i / 60);
      out.push(`${sim.slots.join("|")}@${sim.slot}`);
      aim(sim, 0, "3");
      sim.place(i);
    }
    return out.join(",");
  };
  assert.equal(run(), run());
});

test("no placement ever produces a NaN, at any offset", () => {
  const sim = new Sim(fixedHost());
  const rnd = mulberry(5150);
  for (let i = 0; i < 3000; i++) {
    if (sim.phase !== "sweep") sim.reset();
    aim(sim, (rnd() - 0.5) * 3, rnd() < 0.5 ? "3" : "4");
    sim.place(i);
    assert.ok(Number.isFinite(sim.wx) && Number.isFinite(sim.wz), `w NaN at ${i}`);
    assert.ok(Number.isFinite(sim.cx) && Number.isFinite(sim.cz), `c NaN at ${i}`);
    assert.ok(sim.wx > 0 && sim.wz > 0, `non-positive width at ${i}`);
  }
});

test("the sweep never leaves the travel it is allowed", () => {
  const sim = new Sim(fixedHost());
  for (let i = 0; i < 4000; i++) {
    sim.update(1 / 60, i / 60);
    assert.ok(Math.abs(sim.sweep) <= sim.sweepHalf + 1e-9, `sweep escaped at ${i}`);
  }
});

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
