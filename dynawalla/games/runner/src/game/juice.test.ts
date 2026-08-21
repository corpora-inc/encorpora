import test from "node:test";
import assert from "node:assert/strict";
import { FlashBus, Shake, HitStop, Springy, approach, clamp01, easeOutQuint } from "./juice.ts";

/**
 * The accessibility guarantees are behaviour, not documentation. A future
 * change that makes the game flash faster than three times a second, or that
 * lets screen shake survive `prefers-reduced-motion`, should fail here rather
 * than in front of a child.
 */

/** Drive a bus at 60fps for `seconds`, requesting a full flash `hz` times/sec. */
function driveFlash(hz: number, seconds: number, reduced = false) {
  const bus = new FlashBus();
  const dt = 1 / 60;
  const samples: number[] = [];
  let sinceFire = Infinity;
  for (let i = 0; i < seconds * 60; i++) {
    sinceFire += dt;
    if (sinceFire >= 1 / hz) {
      sinceFire = 0;
      bus.fire(1, [1, 1, 1], reduced);
    }
    bus.update(dt);
    samples.push(bus.value);
  }
  return samples;
}

test("flashes are rate-limited well under the photosensitivity threshold", () => {
  // Count rising edges that cross a perceptible amplitude. WCAG's general flash
  // threshold is three per second; anything at or above 0.25 full-screen
  // luminance counts as one for our purposes.
  const samples = driveFlash(20, 3);
  let crossings = 0;
  let above = false;
  for (const v of samples) {
    if (!above && v > 0.25) { crossings++; above = true; }
    if (above && v < 0.12) above = false;
  }
  assert.ok(crossings <= 9, `${crossings} perceptible flashes in 3 seconds (limit 9)`);
});

test("a rapid burst is attenuated rather than dropped", () => {
  // Information must survive; brightness need not. Fire ten times in a tenth of
  // a second and the bus should still be lit, just quietly.
  const bus = new FlashBus();
  for (let i = 0; i < 10; i++) {
    bus.fire(1, [1, 1, 1], false);
    bus.update(1 / 600);
  }
  assert.ok(bus.value > 0, "a burst of events left the screen completely dark");
  assert.ok(bus.value < 0.6, `burst reached ${bus.value.toFixed(2)}, which is a strobe`);
});

test("a flash rises over at least ~90ms, never as a single-frame stab", () => {
  const bus = new FlashBus();
  bus.fire(1, [1, 1, 1], false);
  bus.update(1 / 60);
  assert.ok(bus.value < 0.35, `one frame after firing the screen was at ${bus.value.toFixed(2)}`);
});

test("reduced motion halves flash amplitude", () => {
  const normal = Math.max(...driveFlash(1, 1, false));
  const reduced = Math.max(...driveFlash(1, 1, true));
  assert.ok(reduced < normal * 0.6, `reduced ${reduced.toFixed(2)} vs normal ${normal.toFixed(2)}`);
});

test("screen shake is fully suppressed under reduced motion", () => {
  const s = new Shake();
  for (let i = 0; i < 40; i++) {
    s.add(1);
    s.update(1 / 60, true);
    assert.equal(s.x, 0);
    assert.equal(s.y, 0);
    assert.equal(s.roll, 0);
  }
});

test("screen shake decays to nothing and never runs away", () => {
  const s = new Shake();
  for (let i = 0; i < 200; i++) s.add(1); // absurd trauma
  assert.ok(s.trauma <= 1, "trauma exceeded 1");
  let maxOffset = 0;
  for (let i = 0; i < 120; i++) {
    s.update(1 / 60, false);
    maxOffset = Math.max(maxOffset, Math.abs(s.x), Math.abs(s.y));
  }
  assert.ok(maxOffset < 1.2, `shake reached ${maxOffset.toFixed(2)} world units`);
  assert.equal(s.trauma, 0, "shake never settled");
});

test("hitstop slows time briefly and always releases", () => {
  const h = new HitStop();
  h.hit(0.1, 0.06);
  assert.ok(h.scale(1 / 60) < 0.2, "hitstop did not bite");
  let frames = 0;
  while (h.active && frames < 600) { h.scale(1 / 60); frames++; }
  assert.ok(frames < 12, `hitstop lasted ${frames} frames`);
  assert.equal(h.scale(1 / 60), 1, "time did not resume at full speed");
});

test("springs settle and survive a long frame without exploding", () => {
  const s = new Springy(0, 150, 18);
  s.target = 10;
  for (let i = 0; i < 240; i++) s.update(1 / 60);
  assert.ok(Math.abs(s.value - 10) < 0.05, `spring settled at ${s.value}`);

  const rough = new Springy(0, 150, 18);
  rough.target = 10;
  rough.update(0.5); // a half-second hitch
  assert.ok(Number.isFinite(rough.value) && Math.abs(rough.value) < 40, `spring blew up to ${rough.value}`);
});

test("easing and approach helpers stay in range", () => {
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const v = easeOutQuint(t);
    assert.ok(v >= -1e-9 && v <= 1 + 1e-9, `easeOutQuint(${t}) = ${v}`);
  }
  assert.equal(easeOutQuint(0), 0);
  assert.equal(easeOutQuint(1), 1);
  assert.equal(clamp01(-5), 0);
  assert.equal(clamp01(5), 1);

  let v = 0;
  for (let i = 0; i < 600; i++) v = approach(v, 100, 8, 1 / 60);
  assert.ok(Math.abs(v - 100) < 0.01);
  // Frame-rate independence: the same elapsed time gets the same result.
  let a = 0, b = 0;
  for (let i = 0; i < 60; i++) a = approach(a, 100, 4, 1 / 60);
  for (let i = 0; i < 10; i++) b = approach(b, 100, 4, 1 / 10);
  assert.ok(Math.abs(a - b) < 1, `60fps ${a.toFixed(2)} vs 10fps ${b.toFixed(2)}`);
});
