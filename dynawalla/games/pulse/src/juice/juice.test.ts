import { test } from "node:test";
import assert from "node:assert/strict";
import { FlashGovernor, MAX_FLASH_LUMINANCE, MIN_FLASH_INTERVAL_SEC } from "./flash.ts";
import { Hitstop } from "./hitstop.ts";
import { Shake } from "./shake.ts";
import { approach, clamp01, outBack, outElastic, outQuint } from "./ease.ts";

test("the flash governor holds WCAG 2.3.1 under a request storm", () => {
  // 60 requests a second for ten seconds, i.e. what a sixteenth-note strobe would ask
  // for at a tempo no rhythm game would refuse.
  const g = new FlashGovernor(() => false);
  let t = 0;
  for (let i = 0; i < 600; i++) {
    g.request(t, 1);
    t += 1 / 60;
  }
  assert.ok(g.accepted <= 3 * 10 + 1, `accepted ${g.accepted} flashes in 10 s`);
  assert.ok(g.accepted > 0, "the limiter must not refuse everything");
  assert.ok(MIN_FLASH_INTERVAL_SEC >= 1 / 3, "interval must be at or below 3 Hz");
});

test("a flash never exceeds the luminance cap, however hard it is pushed", () => {
  const g = new FlashGovernor(() => false);
  g.request(0, 1000);
  assert.ok(g.level <= MAX_FLASH_LUMINANCE + 1e-9);
  g.request(10, 4);
  assert.ok(g.level <= MAX_FLASH_LUMINANCE + 1e-9);
});

test("reduced motion refuses every flash outright", () => {
  const g = new FlashGovernor(() => true);
  for (let i = 0; i < 50; i++) g.request(i, 1);
  assert.equal(g.accepted, 0);
  assert.equal(g.level, 0);
});

test("flashes decay to nothing", () => {
  const g = new FlashGovernor(() => false);
  g.request(0, 1);
  for (let i = 0; i < 60; i++) g.update(1 / 60);
  assert.equal(g.level, 0);
});

test("hitstop dilates the effects clock and always hands the time back", () => {
  const hs = new Hitstop();
  hs.hit(100, 0);
  let dilated = 0;
  let real = 0;
  for (let i = 0; i < 30; i++) {
    dilated += hs.step(1 / 60);
    real += 1 / 60;
  }
  assert.ok(dilated < real, "frozen effects must fall behind real time");
  assert.ok(dilated > 0.3, "and must resume once the stop expires");
  assert.equal(hs.active, false);
  // Once clear, it is exactly transparent.
  assert.equal(hs.step(0.016), 0.016);
});

test("hitstop takes the strongest request, not the latest", () => {
  const hs = new Hitstop();
  hs.hit(120, 0);
  hs.hit(20, 0.9);
  const d = hs.step(1 / 60);
  assert.ok(d < 1 / 60 / 2, "the weaker later request must not cancel the freeze");
});

test("trauma-squared shake decays cleanly to exactly zero", () => {
  const s = new Shake(2, 3);
  s.add(1);
  s.update(1 / 60, 20, 0.02);
  const first = Math.abs(s.x) + Math.abs(s.y);
  assert.ok(first > 0);
  for (let i = 0; i < 120; i++) s.update(1 / 60, 20, 0.02);
  assert.equal(s.x, 0);
  assert.equal(s.y, 0);
  assert.equal(s.rot, 0);
  assert.equal(s.level, 0);
});

test("shake is quadratic: a small event is nearly invisible, a big one is not", () => {
  const small = new Shake(2, 3);
  const big = new Shake(2, 3);
  small.add(0.25);
  big.add(1);
  small.update(1 / 60, 20, 0.02);
  big.update(1 / 60, 20, 0.02);
  const ratio = (Math.abs(big.x) + 1e-9) / (Math.abs(small.x) + 1e-9);
  assert.ok(ratio > 8, `expected a quadratic gap, got ${ratio.toFixed(1)}×`);
});

test("easings are well behaved at the endpoints", () => {
  for (const fn of [outQuint, outBack, outElastic]) {
    assert.ok(Math.abs(fn(0)) < 1e-6, `${fn.name}(0)`);
    assert.ok(Math.abs(fn(1) - 1) < 1e-6, `${fn.name}(1)`);
  }
  assert.equal(clamp01(-2), 0);
  assert.equal(clamp01(4), 1);
});

test("approach is frame-rate independent", () => {
  const at = (steps: number): number => {
    let v = 0;
    for (let i = 0; i < steps; i++) v = approach(v, 1, 6, 1 / steps);
    return v;
  };
  assert.ok(Math.abs(at(60) - at(240)) < 1e-6, "60 Hz and 240 Hz must land in the same place");
});
