import { test } from "node:test";
import assert from "node:assert/strict";
import { hitsHostChrome, safeRect } from "../../../packs/shared/game-chrome/index.ts";
import { COLS, ROWS } from "./core/rules.ts";
import { cellCenter, colAt, computeLayout } from "./layout.ts";

/** every viewport the game is expected to survive */
const SIZES: [string, number, number][] = [
  ["iPhone SE portrait", 320, 568],
  ["iPhone 13 portrait", 390, 844],
  ["iPhone 13 landscape", 844, 390],
  ["Pixel 7 portrait", 412, 915],
  ["iPad mini portrait", 744, 1133],
  ["iPad portrait", 768, 1024],
  ["iPad landscape", 1024, 768],
  ["iPad Pro landscape", 1366, 1024],
  ["small desktop", 1024, 640],
  ["wide desktop", 1920, 1080],
  ["absurdly narrow", 280, 760],
  ["absurdly narrow and tall", 280, 1200],
  ["absurdly short", 900, 320],
  // A wide-and-short window is the case that walks the next-chip strip off the
  // bottom: the reactor has to move down to clear the how-to-play button and
  // the strip hangs off the reactor. 1024x330 was found by sweep, not by taste.
  ["short landscape", 1024, 330],
  ["shorter landscape", 1200, 300],
];

test("the well always fits inside the viewport", () => {
  for (const [name, w, h] of SIZES) {
    const l = computeLayout(w, h, 2, safeRect(w, h));
    assert.ok(l.wellX >= 0, `${name}: well hangs off the left (${l.wellX})`);
    assert.ok(l.wellX + l.wellW <= w, `${name}: well hangs off the right`);
    assert.ok(l.wellY >= 0, `${name}: well hangs off the top (${l.wellY})`);
    assert.ok(l.wellY + l.wellH <= h, `${name}: well hangs off the bottom`);
  }
});

test("there is always headroom above the well for the held chip", () => {
  for (const [name, w, h] of SIZES) {
    const l = computeLayout(w, h, 2, safeRect(w, h));
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
    const l = computeLayout(w, h, 2, safeRect(w, h));
    // `soundBox` is the TOUCH square — `input.ts` hit-tests at `soundR + 10`,
    // so anything smaller measures a button that is not the one on the glass.
    const b = l.soundBox;
    const overlaps =
      b.x < l.wellX + l.wellW && l.wellX < b.x + b.w && b.y < l.wellY + l.wellH && l.wellY < b.y + b.h;
    assert.equal(overlaps, false, `${name}: the sound toggle covers the well`);
    assert.ok(l.soundX > 0 && l.soundX < w, `${name}: sound toggle off screen`);
    assert.ok(l.soundY > 0 && l.soundY < h, `${name}: sound toggle off screen`);
  }
});

test("the reactor orb never sits on the well", () => {
  for (const [name, w, h] of SIZES) {
    const l = computeLayout(w, h, 2, safeRect(w, h));
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
    const l = computeLayout(w, h, 2, safeRect(w, h));
    for (let i = 0; i < 3; i++) {
      const x = l.incomingVertical ? l.incomingX : l.incomingX + i * l.incomingStep;
      const y = l.incomingVertical ? l.incomingY + i * l.incomingStep : l.incomingY;
      assert.ok(x - l.chipSize / 2 >= 0 && x + l.chipSize / 2 <= w, `${name}: incoming ${i} off x`);
      assert.ok(y - l.chipSize / 2 >= 0 && y + l.chipSize / 2 <= h, `${name}: incoming ${i} off y`);
    }
  }
});

test("cells tile the board exactly, with no gap and no overlap", () => {
  const l = computeLayout(900, 1200, 2, safeRect(900, 1200));
  const first = cellCenter(l, 0, 0);
  const last = cellCenter(l, ROWS - 1, COLS - 1);
  assert.equal(Math.round(first.x - l.cell / 2), l.boardX);
  assert.equal(Math.round(first.y - l.cell / 2), l.boardY);
  assert.equal(Math.round(last.x + l.cell / 2), l.boardX + l.boardW);
  assert.equal(Math.round(last.y + l.cell / 2), l.boardY + l.boardH);
});

test("colAt inverts cellCenter and clamps outside the board", () => {
  for (const [, w, h] of SIZES) {
    const l = computeLayout(w, h, 2, safeRect(w, h));
    for (let c = 0; c < COLS; c++) {
      assert.equal(colAt(l, cellCenter(l, 0, c).x), c);
    }
    assert.equal(colAt(l, -9999), 0);
    assert.equal(colAt(l, 9999), COLS - 1);
  }
});

test("orientation picks a different design, not a stretched one", () => {
  assert.equal(computeLayout(390, 844, 2, safeRect(390, 844)).landscape, false);
  assert.equal(computeLayout(844, 390, 2, safeRect(844, 390)).landscape, true);
  // portrait puts the score on the left of a top band; landscape centres it in a rail
  assert.equal(computeLayout(390, 844, 2, safeRect(390, 844)).scoreAlign, "left");
  assert.equal(computeLayout(844, 390, 2, safeRect(844, 390)).scoreAlign, "center");
});

test("cells stay aimable on every real phone and tablet", () => {
  // 28px is deliberately under the 44px tap guideline: aiming here is a drag
  // with a live landing ghost, not a discrete tap, so the target is "sweep
  // until the ghost is where you want it" and column width sets precision, not
  // success. A landscape phone (11 rows into 390px) is the tightest case there
  // is; portrait, which is how a well-shaped board is actually held, is roomy.
  for (const [name, w, h] of SIZES) {
    if (Math.min(w, h) < 360) continue;
    const l = computeLayout(w, h, 2, safeRect(w, h));
    assert.ok(l.cell >= 28, `${name}: ${l.cell}px cells are too small to aim`);
  }
  assert.ok(computeLayout(390, 844, 2, safeRect(390, 844)).cell >= 50, "portrait phone should be roomy");
  assert.ok(computeLayout(744, 1133, 2, safeRect(744, 1133)).cell >= 70, "tablet should be generous");
});

test("a squashed window still lays out legally, just smaller", () => {
  const l = computeLayout(900, 320, 2, safeRect(900, 320));
  assert.ok(l.cell >= 18);
  assert.ok(l.wellY >= 0 && l.wellY + l.wellH <= 320);
  assert.ok(l.headY > 0 && l.headY < l.boardY);
});

/** everything a child has to read or touch, as boxes */
function critical(l: ReturnType<typeof computeLayout>): [string, { x: number; y: number; w: number; h: number }][] {
  return [
    ["the score", l.scoreBox],
    ["the level readout", l.levelBox],
    ["the reactor", l.reactorBox],
    ["the incoming strip", l.incomingBox],
    ["the mute toggle", l.soundBox],
    ["the well", { x: l.wellX, y: l.wellY, w: l.wellW, h: l.wellH }],
  ];
}

/** the four inset profiles the game actually meets */
const INSETS: [string, { top: number; right: number; bottom: number; left: number }][] = [
  ["no insets", { top: 0, right: 0, bottom: 0, left: 0 }],
  ["notched portrait", { top: 47, right: 0, bottom: 34, left: 0 }],
  ["notched landscape", { top: 0, right: 47, bottom: 21, left: 47 }],
  ["android gesture bar", { top: 24, right: 0, bottom: 24, left: 0 }],
];

test("nothing a child reads or touches sits under the host's chrome", () => {
  // The host paints an exit chevron over the top-left 44px and the how-to-play
  // button over the top-right 44px, on top of the pack. It overlays rather than
  // reserving a band — a band cost a twelfth of a small phone's height — so the
  // promise this layout keeps is that those two squares are clear of anything
  // that has to be read or tapped: the score, the LV readout, the next-chip
  // strip, the mute toggle, the RESONANCE reactor (which is tapped) and the
  // well itself (every chip in it is a numeral you have to add).
  //
  // The plasma, the well walls and the sparks still bleed under both, which is
  // the whole point of `viewport-fit=cover`.
  // Every viewport against every inset profile, because the corners move with
  // the insets: asserting this only on a device with no notch would be
  // asserting it in the one case the notch cannot break.
  for (const [name, w, h] of SIZES) {
    for (const [where, insets] of INSETS) {
      const l = computeLayout(w, h, 2, safeRect(w, h, insets));
      for (const [what, box] of critical(l)) {
        assert.equal(
          hitsHostChrome(box, w, insets),
          false,
          `${name} (${w}x${h}, ${where}): ${what} is under the host's chrome`,
        );
      }
    }
  }
});

test("a notch pushes the instruments down instead of under it", () => {
  // What a canvas HUD cannot do is read `env(safe-area-inset-*)`, so it is
  // handed the rectangle as numbers. Give it a phone-shaped notch and a home
  // indicator and everything readable has to be inside what is left.
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  for (const [name, w, h] of [
    ["iPhone SE portrait", 320, 568],
    ["iPhone 13 portrait", 390, 844],
    ["iPad portrait", 768, 1024],
  ] as const) {
    const area = safeRect(w, h, insets);
    const l = computeLayout(w, h, 2, area);
    const bottom = area.y + area.h;
    assert.ok(l.scoreBox.y >= area.y, `${name}: the score is under the notch`);
    assert.ok(l.wellY >= area.y, `${name}: the well is under the notch`);
    assert.ok(
      l.wellY + l.wellH <= bottom,
      `${name}: the well is under the home indicator`,
    );
    assert.ok(l.soundBox.y + l.soundBox.h <= bottom, `${name}: the mute toggle is off the safe area`);
    assert.ok(l.keyY >= area.y, `${name}: the KEY numeral is under the notch`);
    assert.ok(l.incomingBox.y >= area.y, `${name}: the incoming strip is under the notch`);
    // and it really did move, rather than the insets being ignored
    const flat = computeLayout(w, h, 2, safeRect(w, h));
    assert.ok(l.wellY > flat.wellY, `${name}: the well ignored the notch`);
  }
});

test("a landscape notch is honoured on the sides too", () => {
  const area = safeRect(844, 390, { top: 0, right: 47, bottom: 21, left: 47 });
  const l = computeLayout(844, 390, 2, area);
  assert.equal(l.landscape, true);
  assert.ok(l.wellX >= area.x, "the well is under the left inset");
  assert.ok(l.wellX + l.wellW <= area.x + area.w, "the well is under the right inset");
  assert.ok(l.scoreBox.x >= area.x, "the score is under the left inset");
  assert.ok(
    l.incomingBox.x + l.incomingBox.w <= area.x + area.w,
    "the incoming strip is under the right inset",
  );
});

test("the incoming strip stays inside the safe area once it has moved clear", () => {
  // It moves twice — down off the how-to-play button, and down again to hang
  // under the reactor — so a short, wide window is exactly where it walks off
  // the bottom edge and under a phone's gesture bar.
  for (const [name, w, h] of SIZES) {
    for (const [where, insets] of INSETS) {
      const area = safeRect(w, h, insets);
      const b = computeLayout(w, h, 2, area).incomingBox;
      assert.ok(b.x >= area.x, `${name} ${where}: incoming strip past the left inset`);
      assert.ok(b.x + b.w <= area.x + area.w, `${name} ${where}: incoming strip past the right inset`);
      assert.ok(b.y >= area.y, `${name} ${where}: incoming strip under the notch`);
      assert.ok(
        b.y + b.h <= area.y + area.h,
        `${name} ${where}: incoming strip under the home indicator`,
      );
    }
    const l = computeLayout(w, h, 2, safeRect(w, h));
    const b = l.incomingBox;
    assert.ok(b.x >= 0 && b.x + b.w <= w, `${name}: incoming strip off x`);
    assert.ok(b.y >= 0 && b.y + b.h <= h, `${name}: incoming strip off y`);
    const onWell =
      b.x < l.wellX + l.wellW && l.wellX < b.x + b.w && b.y < l.wellY + l.wellH && l.wellY < b.y + b.h;
    assert.equal(onWell, false, `${name}: the incoming strip covers the well`);
  }
});
