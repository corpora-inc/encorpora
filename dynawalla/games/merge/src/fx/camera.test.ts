import { test } from "node:test";
import assert from "node:assert/strict";
import { Camera, clamp01, ease } from "./camera.ts";

const step = (c: Camera, seconds: number, dt = 1 / 60) => {
  let logic = 0;
  for (let t = 0; t < seconds; t += dt) logic += c.update(dt);
  return logic;
};

test("trauma decays to nothing and the offset goes with it", () => {
  const c = new Camera();
  c.shake(1);
  c.update(1 / 60);
  assert.ok(Math.abs(c.x) > 0 || Math.abs(c.y) > 0, "a full-trauma shake must move the camera");
  step(c, 1.2);
  assert.equal(c.trauma, 0);
  assert.equal(c.x, 0);
  assert.equal(c.y, 0);
  assert.equal(c.rot, 0);
});

test("shake is quadratic in trauma, so a small hit stays subtle", () => {
  const big = new Camera();
  big.shake(1);
  big.update(1 / 60);
  const small = new Camera();
  small.shake(0.3);
  small.update(1 / 60);
  const mag = (c: Camera) => Math.hypot(c.x, c.y);
  // 0.3^2 / 1^2 ~ 0.09, so a third of the trauma is under a fifth of the shake
  assert.ok(mag(small) < mag(big) * 0.2, `${mag(small)} vs ${mag(big)}`);
});

test("the zoom punch springs back and settles exactly at zero", () => {
  const c = new Camera();
  c.punch(3);
  c.update(1 / 60);
  assert.ok(c.zoom > 0);
  step(c, 3);
  assert.equal(c.zoom, 0);
});

test("hitstop eats logic time and then gives it back", () => {
  const c = new Camera();
  c.stop(50);
  const first = c.update(1 / 60);
  assert.equal(first, 0, "a frame inside hitstop advances no logic");
  step(c, 0.2);
  const after = c.update(1 / 60);
  assert.ok(after > 0.015, "logic resumes at full speed once hitstop ends");
});

test("slow motion scales logic time and recovers", () => {
  const c = new Camera();
  c.slowmo(0.25, 200);
  step(c, 0.05);
  const slow = c.update(1 / 60);
  assert.ok(slow < 1 / 60, "logic must run slower than real time");
  step(c, 1.5);
  const back = c.update(1 / 60);
  assert.ok(back > 0.0164, `expected real time back, got ${back}`);
});

/* ---- the two guarantees that exist because children play this ---- */

test("flashes are rate limited to three per second and capped in strength", () => {
  const c = new Camera();
  for (let i = 0; i < 20; i++) c.flash([255, 255, 255], 1);
  assert.equal(c.flashes.length, 3, "no more than three flashes may start in one second");
  for (const f of c.flashes) assert.ok(f.a <= 0.34, `flash alpha ${f.a} exceeds the cap`);

  step(c, 1.2); // let the window slide
  c.flash([255, 255, 255], 1);
  assert.ok(c.flashes.length >= 1, "a flash is allowed again once the window has passed");
});

test("reduced motion removes every motion channel and every flash", () => {
  const c = new Camera();
  c.reduced = true;
  c.shake(1);
  c.punch(4);
  c.slowmo(0.1, 900);
  c.flash([255, 255, 255], 1);
  c.update(1 / 60);
  assert.equal(c.trauma, 0);
  assert.equal(c.x, 0);
  assert.equal(c.y, 0);
  assert.equal(c.rot, 0);
  assert.equal(c.zoom, 0);
  assert.equal(c.timeScale, 1);
  assert.equal(c.flashes.length, 0);
  assert.equal(c.flashAlpha(), null);
});

test("reduced motion keeps hitstop, but caps it", () => {
  // Hitstop is timing, not motion: it is what makes an impact feel heavy, and
  // it moves nothing on screen. It stays, bounded.
  const c = new Camera();
  c.reduced = true;
  c.stop(400);
  assert.ok(c.hitstop > 0 && c.hitstop <= 40);
});

test("reset returns the camera to a clean state", () => {
  const c = new Camera();
  c.shake(1);
  c.punch(2);
  c.flash([255, 0, 0], 0.3);
  c.stop(100);
  c.reset();
  assert.equal(c.trauma, 0);
  assert.equal(c.zoom, 0);
  assert.equal(c.hitstop, 0);
  assert.equal(c.flashes.length, 0);
  assert.equal(c.timeScale, 1);
});

test("easings hit their endpoints", () => {
  for (const [name, fn] of Object.entries(ease)) {
    assert.ok(Math.abs(fn(0) - 0) < 1e-6, `${name}(0)`);
    assert.ok(Math.abs(fn(1) - 1) < 1e-6, `${name}(1)`);
  }
});

test("clamp01 clamps", () => {
  assert.equal(clamp01(-3), 0);
  assert.equal(clamp01(0.4), 0.4);
  assert.equal(clamp01(9), 1);
});
