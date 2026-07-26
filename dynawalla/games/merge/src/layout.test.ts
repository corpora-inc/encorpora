import { test } from "node:test";
import assert from "node:assert/strict";
import { COLS, ROWS } from "./core/rules.ts";
import { cellCenter, colAt, computeLayout } from "./layout.ts";

/** every viewport the game is expected to survive */
const SIZES: [string, number, number][] = [
  ["iPhone SE portrait", 320, 568],
  ["iPhone 13 portrait", 390, 844],
  ["iPhone 13 landscape", 844, 390],
  ["Pixel 7 portrait", 412, 915],
  ["iPad mini portrait", 744, 1133],
  ["iPad Pro landscape", 1366, 1024],
  ["small desktop", 1024, 640],
  ["wide desktop", 1920, 1080],
  ["absurdly narrow", 280, 760],
  ["absurdly short", 900, 320],
];

test("the well always fits inside the viewport", () => {
  for (const [name, w, h] of SIZES) {
    const l = computeLayout(w, h, 2);
    assert.ok(l.wellX >= 0, `${name}: well hangs off the left (${l.wellX})`);
    assert.ok(l.wellX + l.wellW <= w, `${name}: well hangs off the right`);
    assert.ok(l.wellY >= 0, `${name}: well hangs off the top (${l.wellY})`);
    assert.ok(l.wellY + l.wellH <= h, `${name}: well hangs off the bottom`);
  }
});

test("there is always headroom above the well for the held chip", () => {
  for (const [name, w, h] of SIZES) {
    const l = computeLayout(w, h, 2);
    assert.ok(l.headY > 0, `${name}: the held chip is off screen`);
    assert.ok(l.headY < l.boardY, `${name}: the held chip is inside the well`);
    assert.ok(
      l.boardY - l.headY > l.cell * 0.4,
      `${name}: the held chip overlaps the well rim`,
    );
  }
});

test("the sound toggle never sits on the well", () => {
  for (const [name, w, h] of SIZES) {
    const l = computeLayout(w, h, 2);
    const r = l.soundR + 6;
    const overlaps =
      l.soundX + r > l.wellX &&
      l.soundX - r < l.wellX + l.wellW &&
      l.soundY + r > l.wellY &&
      l.soundY - r < l.wellY + l.wellH;
    assert.equal(overlaps, false, `${name}: the sound toggle covers the well`);
    assert.ok(l.soundX > 0 && l.soundX < w, `${name}: sound toggle off screen`);
    assert.ok(l.soundY > 0 && l.soundY < h, `${name}: sound toggle off screen`);
  }
});

test("the reactor orb never sits on the well", () => {
  for (const [name, w, h] of SIZES) {
    const l = computeLayout(w, h, 2);
    const r = l.keyR * 1.35;
    const overlaps =
      l.keyX + r > l.wellX &&
      l.keyX - r < l.wellX + l.wellW &&
      l.keyY + r > l.wellY &&
      l.keyY - r < l.wellY + l.wellH;
    assert.equal(overlaps, false, `${name}: the reactor covers the well`);
  }
});

test("the incoming strip stays on screen", () => {
  for (const [name, w, h] of SIZES) {
    const l = computeLayout(w, h, 2);
    for (let i = 0; i < 3; i++) {
      const x = l.incomingVertical ? l.incomingX : l.incomingX + i * l.incomingStep;
      const y = l.incomingVertical ? l.incomingY + i * l.incomingStep : l.incomingY;
      assert.ok(x - l.chipSize / 2 >= 0 && x + l.chipSize / 2 <= w, `${name}: incoming ${i} off x`);
      assert.ok(y - l.chipSize / 2 >= 0 && y + l.chipSize / 2 <= h, `${name}: incoming ${i} off y`);
    }
  }
});

test("cells tile the board exactly, with no gap and no overlap", () => {
  const l = computeLayout(900, 1200, 2);
  const first = cellCenter(l, 0, 0);
  const last = cellCenter(l, ROWS - 1, COLS - 1);
  assert.equal(Math.round(first.x - l.cell / 2), l.boardX);
  assert.equal(Math.round(first.y - l.cell / 2), l.boardY);
  assert.equal(Math.round(last.x + l.cell / 2), l.boardX + l.boardW);
  assert.equal(Math.round(last.y + l.cell / 2), l.boardY + l.boardH);
});

test("colAt inverts cellCenter and clamps outside the board", () => {
  for (const [, w, h] of SIZES) {
    const l = computeLayout(w, h, 2);
    for (let c = 0; c < COLS; c++) {
      assert.equal(colAt(l, cellCenter(l, 0, c).x), c);
    }
    assert.equal(colAt(l, -9999), 0);
    assert.equal(colAt(l, 9999), COLS - 1);
  }
});

test("orientation picks a different design, not a stretched one", () => {
  assert.equal(computeLayout(390, 844, 2).landscape, false);
  assert.equal(computeLayout(844, 390, 2).landscape, true);
  // portrait puts the score on the left of a top band; landscape centres it in a rail
  assert.equal(computeLayout(390, 844, 2).scoreAlign, "left");
  assert.equal(computeLayout(844, 390, 2).scoreAlign, "center");
});

test("cells stay aimable on every real phone and tablet", () => {
  // 28px is deliberately under the 44px tap guideline: aiming here is a drag
  // with a live landing ghost, not a discrete tap, so the target is "sweep
  // until the ghost is where you want it" and column width sets precision, not
  // success. A landscape phone (11 rows into 390px) is the tightest case there
  // is; portrait, which is how a well-shaped board is actually held, is roomy.
  for (const [name, w, h] of SIZES) {
    if (Math.min(w, h) < 360) continue;
    const l = computeLayout(w, h, 2);
    assert.ok(l.cell >= 28, `${name}: ${l.cell}px cells are too small to aim`);
  }
  assert.ok(computeLayout(390, 844, 2).cell >= 50, "portrait phone should be roomy");
  assert.ok(computeLayout(744, 1133, 2).cell >= 70, "tablet should be generous");
});

test("a squashed window still lays out legally, just smaller", () => {
  const l = computeLayout(900, 320, 2);
  assert.ok(l.cell >= 18);
  assert.ok(l.wellY >= 0 && l.wellY + l.wellH <= 320);
  assert.ok(l.headY > 0 && l.headY < l.boardY);
});
