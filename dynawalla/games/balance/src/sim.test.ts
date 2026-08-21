// "On iOS 0.3.0 the animation doesn't work — the weights just go nuts and fritz
// out and drift off. The example weights when a problem comes up."
//
// The example weights are the `fixed` items: the statement of the problem,
// dropped in from above by `loadNext` and then held on their seats by a spring.
// The spring was integrated with a step the spring is not stable at. Nothing
// about this is specific to iOS — iOS is simply where a frame first took longer
// than 32 ms.

import { test } from "node:test";
import assert from "node:assert/strict";

import { frac } from "./frac.ts";
import { makeBody, stepBody, launch, toss, MAX_BODY_DT } from "./sim.ts";
import type { Body } from "./sim.ts";

/** The largest dt the frame loop will ever hand the simulation. */
const LOOP_CLAMP = 1 / 20;

function seated(tx: number, ty: number): Body {
  return makeBody({ value: frac(5), state: "seated", x: 0, y: 0, tx, ty, trot: 0 });
}

test("a seated weight springs home at every frame rate the loop can deliver", () => {
  // 31 fps is the analytic stability limit of the seat spring (k = 1000,
  // c = 46): 1000·dt² + 92·dt − 4 < 0 ⟹ dt < 0.0322 s. The loop clamps dt at
  // 1/20 = 0.05, so every rate from 31 fps down to the clamp used to be
  // exponential runaway. A thermal downclock to 30 fps was enough.
  for (const fps of [120, 90, 60, 45, 40, 35, 30, 25, 20]) {
    const dt = 1 / fps;
    const b = seated(100, 100);
    for (let i = 0; i < 600; i++) stepBody(b, dt);
    assert.ok(
      Number.isFinite(b.x) && Number.isFinite(b.y),
      `at ${fps} fps a seated weight left the number line: x=${b.x} y=${b.y}`,
    );
    assert.ok(
      Math.hypot(b.x - 100, b.y - 100) < 1,
      `at ${fps} fps a seated weight settled at (${b.x.toExponential(2)}, ` +
        `${b.y.toExponential(2)}) instead of its seat at (100, 100)`,
    );
  }
});

test("no step the frame loop can produce makes a weight drift off", () => {
  // A sweep rather than a handful of rates: the loop's dt is whatever the
  // device gives it, clamped, and there must be no hole anywhere under that.
  let worst = 0;
  let worstDt = 0;
  for (let i = 0; i <= 200; i++) {
    const dt = (1 / 144) + (LOOP_CLAMP - 1 / 144) * (i / 200);
    const b = seated(-240, 380);
    for (let k = 0; k < 400; k++) stepBody(b, dt);
    const err = Math.hypot(b.x + 240, b.y - 380);
    if (!(err <= worst)) {
      worst = err;
      worstDt = dt;
    }
  }
  assert.ok(
    worst < 1,
    `the worst frame time in the loop's range (dt=${worstDt.toFixed(4)}, ` +
      `${(1 / worstDt).toFixed(1)} fps) left the weight ${worst.toExponential(3)} px ` +
      `from its seat`,
  );
});

test("one stalled frame does not destroy the board", () => {
  // What actually happens on a WebView resume: sixty good frames, one long one,
  // then sixty more. Before substepping the single 50 ms frame put the pile at
  // ~1e5 px and every frame after it made that worse, so the weights never came
  // back — which is the "drift off" in the report.
  const b = seated(200, 150);
  for (let i = 0; i < 60; i++) stepBody(b, 1 / 60);
  stepBody(b, LOOP_CLAMP);
  for (let i = 0; i < 120; i++) stepBody(b, 1 / 60);
  assert.ok(
    Math.hypot(b.x - 200, b.y - 150) < 1,
    `after one stalled frame the weight is at (${b.x.toExponential(2)}, ${b.y.toExponential(2)})`,
  );
});

test("the moving dish still jostles the pile — the fix is not a freeze", () => {
  // Substepping must not have turned the spring into a teleport: a seat that
  // moves has to be chased, visibly, over several frames.
  const b = seated(0, 0);
  for (let i = 0; i < 30; i++) stepBody(b, 1 / 60);
  b.tx = 120;
  const trail: number[] = [];
  for (let i = 0; i < 10; i++) {
    stepBody(b, 1 / 60);
    trail.push(b.x);
  }
  assert.ok(trail[0] > 0.5, "the weight did not start moving toward the new seat");
  assert.ok(trail[0] < 110, `the weight teleported: ${trail[0]} of 120 in one frame`);
  assert.ok(trail[9] > trail[0], "it stopped chasing the seat");
  assert.ok(Math.abs(trail[9] - 120) < 12, `it never got there: ${trail[9]}`);
});

test("a body never carries a NaN forward", () => {
  // A NaN is permanent and it draws as nothing, so a weight that is part of the
  // statement of the problem silently vanishes. Both reachable divides:
  const zeroDur = makeBody({ value: frac(3), x: 0, y: 0 });
  launch(zeroDur, 50, 50, 0, 10);
  for (let i = 0; i < 30; i++) stepBody(zeroDur, 1 / 60);
  assert.ok(
    Number.isFinite(zeroDur.x) && Number.isFinite(zeroDur.y),
    `a zero-duration flight produced (${zeroDur.x}, ${zeroDur.y})`,
  );

  const zeroToss = makeBody({ value: frac(3), x: 10, y: 10 });
  toss(zeroToss, 90, 90, 0);
  // Asserted on the velocity, before a step: `settle` would otherwise mask this
  // by cleaning up afterwards, and a test the guard alone can satisfy proves
  // nothing about the divide that produced the Infinity.
  assert.ok(
    Number.isFinite(zeroToss.vx) && Number.isFinite(zeroToss.vy),
    `a zero-duration toss set the velocity to (${zeroToss.vx}, ${zeroToss.vy})`,
  );
  for (let i = 0; i < 30; i++) stepBody(zeroToss, 1 / 60);
  assert.ok(
    Number.isFinite(zeroToss.x) && Number.isFinite(zeroToss.y),
    `a zero-duration toss produced (${zeroToss.x}, ${zeroToss.y})`,
  );

  // And a body that has already been poisoned from outside — a seat measured on
  // a zero-sized canvas — is put back rather than lost.
  const poisoned = seated(64, 64);
  poisoned.x = NaN;
  poisoned.vy = Infinity;
  stepBody(poisoned, 1 / 60);
  assert.ok(Number.isFinite(poisoned.x), "a poisoned body stayed poisoned");
  assert.equal(poisoned.x, 64);
  assert.equal(poisoned.y, 64);
});

test("a nonsense dt is ignored rather than integrated", () => {
  // The first frame after a resume can deliver a zero, a negative, or a NaN.
  const b = seated(30, 30);
  b.x = 10;
  b.y = 10;
  for (const dt of [0, -1 / 60, NaN, Infinity]) stepBody(b, dt);
  assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), `(${b.x}, ${b.y})`);
});

test("the substep is inside the spring's stability limit, with margin", () => {
  // The number this whole file is about. If somebody raises MAX_BODY_DT past
  // 0.0322 the tests above go red, but this says why in one line.
  const K = 1000;
  const C = 46;
  // The root of K·dt² + 2C·dt − 4 = 0, which is the condition documented on
  // MAX_BODY_DT. An earlier version of this line solved K·dt² + C·dt − 4 and
  // got 0.0443 — itself a divergent step, so the "one line that says why" said
  // the wrong number while the assertion still passed.
  const limit = (-C + Math.sqrt(C * C + 4 * K)) / K;
  assert.ok(Math.abs(limit - 0.0322) < 0.0005, `the stability limit moved: ${limit}`);
  assert.ok(
    MAX_BODY_DT < limit / 2,
    `MAX_BODY_DT ${MAX_BODY_DT} has no margin under the ${limit.toFixed(4)}s limit`,
  );
});
