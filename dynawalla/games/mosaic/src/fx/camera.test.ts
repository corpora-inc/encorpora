import { test } from "node:test";
import assert from "node:assert/strict";
import { Camera } from "./camera.ts";

test("the zoom spring cannot overshoot through zero, however hard it is hit", () => {
  // This is a regression test with a screenshot behind it: a chain of impacts
  // in consecutive frames fed an underdamped spring enough energy to overshoot
  // below zero, and the entire scene rendered as a postage stamp in the middle
  // of a black screen.
  const cam = new Camera();
  for (let i = 0; i < 4000; i++) {
    if (i % 3 === 0) cam.punch(4.2);
    if (i % 7 === 0) cam.punch(2.4);
    cam.update(1 / 60);
    assert.ok(cam.zoom >= 0.89 && cam.zoom <= 1.17, `zoom escaped: ${cam.zoom}`);
    assert.ok(Number.isFinite(cam.zoomVel));
  }
  for (let i = 0; i < 400; i++) cam.update(1 / 60);
  assert.equal(cam.zoom, 1, "the camera must always come to rest");
});

test("shake always decays to still", () => {
  const cam = new Camera();
  for (let i = 0; i < 50; i++) cam.addTrauma(0.5);
  assert.ok(cam.trauma <= 1);
  for (let i = 0; i < 200; i++) cam.update(1 / 60);
  assert.equal(cam.trauma, 0);
  assert.equal(cam.offX, 0);
  assert.equal(cam.rot, 0);
});

test("the flash budget holds at three per second, whatever is asked for", () => {
  // A children's product: this is a photosensitivity limit, not a taste one.
  const cam = new Camera();
  let events = 0;
  let prev = 0;
  let peak = 0;
  for (let i = 0; i < 60; i++) {
    cam.requestFlash(1);
    // A luminance event is a *rise*: brightness going up is what a
    // photosensitive viewer reacts to, not brightness decaying.
    if (cam.flash > prev + 0.05) events++;
    prev = cam.flash;
    peak = Math.max(peak, cam.flash);
    cam.update(1 / 60);
  }
  assert.ok(events <= 3, `${events} luminance rises inside one second`);
  assert.ok(peak <= 0.26, `peak ${peak}`);

  // And a second later the budget has rolled over, not vanished.
  for (let i = 0; i < 120; i++) cam.update(1 / 60);
  cam.requestFlash(1);
  assert.ok(cam.flash > 0.2);
});

test("reduced motion removes movement and keeps information", () => {
  const cam = new Camera();
  cam.reduced = true;
  cam.punch(4);
  cam.addTrauma(1);
  cam.requestFlash(1);
  cam.stop(0.2);
  cam.update(1 / 60);
  assert.equal(cam.zoom, 1, "no zoom punch under reduced motion");
  assert.equal(cam.offX, 0, "no shake under reduced motion");
  assert.equal(cam.rot, 0);
  assert.ok(cam.flash <= 0.08, "flashes are far dimmer");
  // Hitstop is information — something was hit — so it survives.
  assert.ok(cam.hitstop > 0.15);
});

test("hitstop freezes the simulation and nothing else", () => {
  const cam = new Camera();
  cam.stop(0.05);
  assert.equal(cam.simDt(1 / 60), 0);
  for (let i = 0; i < 5; i++) cam.update(1 / 60);
  assert.ok(cam.simDt(1 / 60) > 0);
});

test("bullet time scales simulation dt and eases back", () => {
  const cam = new Camera();
  cam.timeScaleTarget = 0.12;
  for (let i = 0; i < 60; i++) cam.update(1 / 60);
  assert.ok(cam.simDt(1 / 60) < (1 / 60) * 0.2);
  cam.timeScaleTarget = 1;
  for (let i = 0; i < 240; i++) cam.update(1 / 60);
  assert.ok(Math.abs(cam.simDt(1 / 60) - 1 / 60) < 1e-4);
});
