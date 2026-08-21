/**
 * The promise the HUD makes about the host's chrome, at every shape a tablet or
 * phone can hand it.
 *
 * These run against `place.ts` — the module the stylesheet is actually built
 * from — rather than against a copy of its arithmetic, because a test that
 * re-derives the layout proves only that it agrees with itself.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  chromeRects,
  hitsHostChrome,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts";
import { hudRects } from "./place.ts";

/** Phone upright, phone on its side, tablet both ways, and the smallest shape. */
const PORTRAIT: readonly (readonly [number, number])[] = [
  [320, 568],
  [390, 844],
  [768, 1024],
];
const LANDSCAPE: readonly (readonly [number, number])[] = [
  [1024, 768],
  [844, 390],
];

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
/** A notched phone held upright: the status bar and the home indicator. */
const NOTCH_UP: Insets = { top: 59, right: 0, bottom: 34, left: 0 };
/** The same phone on its side: the notch moves to a cheek. */
const NOTCH_SIDE: Insets = { top: 0, right: 47, bottom: 21, left: 47 };

const CASES: readonly (readonly [string, number, number, Insets])[] = [
  ...PORTRAIT.flatMap(
    ([w, h]) =>
      [
        [`${w}x${h}`, w, h, NONE],
        [`${w}x${h} notched`, w, h, NOTCH_UP],
      ] as const,
  ),
  ...LANDSCAPE.flatMap(
    ([w, h]) =>
      [
        [`${w}x${h}`, w, h, NONE],
        [`${w}x${h} notched`, w, h, NOTCH_SIDE],
      ] as const,
  ),
];

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const show = (r: Rect): string =>
  `x ${r.x.toFixed(1)}..${(r.x + r.w).toFixed(1)}, y ${r.y.toFixed(1)}..${(r.y + r.h).toFixed(1)}`;

test("nothing a child must read or touch lands in the host's two corners", () => {
  for (const [name, w, h, insets] of CASES) {
    const r = hudRects(w, h, insets);
    for (const [what, rect] of Object.entries(r)) {
      assert.equal(
        hitsHostChrome(rect, w, insets),
        false,
        `${name}: the ${what} is under host chrome — ${show(rect)} vs ` +
          chromeRects(w, insets).map(show).join(" and "),
      );
    }
  }
});

test("the floor count and the best score never run into each other", () => {
  // Stepping in past the two corner controls costs 54px off each side. On a
  // 320px phone that is a third of the width, so the two readouts have to be
  // proven to still fit beside each other, at a three-digit floor.
  for (const [name, w, h, insets] of CASES) {
    const { floor, best } = hudRects(w, h, insets);
    assert.ok(
      floor.x + floor.w < best.x,
      `${name}: the readouts collide — floor ${show(floor)}, best ${show(best)}`,
    );
  }
});

test("the equation plate never touches the floor count", () => {
  // Pushing the readout in from the corner moved it toward a centred plate, and
  // on a landscape tablet the numeral is 80px tall against 18% of 768. The
  // plate's `max()` is what keeps this true rather than nearly true.
  for (const [name, w, h, insets] of CASES) {
    const { floor, prompt } = hudRects(w, h, insets);
    assert.equal(
      overlaps(floor, prompt),
      false,
      `${name}: the plate is over the floor count — floor ${show(floor)}, plate ${show(prompt)}`,
    );
  }
});

test("every readout stays inside the safe area", () => {
  // The sky, the tower and the sparks bleed to the edges on purpose; text does
  // not. A landscape notch is 47px of cheek, and 14px of gutter is not enough.
  for (const [name, w, h, insets] of CASES) {
    const r = hudRects(w, h, insets);
    for (const [what, rect] of Object.entries(r)) {
      assert.ok(rect.x >= insets.left, `${name}: the ${what} runs into the left inset`);
      assert.ok(rect.y >= insets.top, `${name}: the ${what} runs into the top inset`);
      assert.ok(
        rect.x + rect.w <= w - insets.right + 0.5,
        `${name}: the ${what} runs into the right inset — ${show(rect)}`,
      );
      assert.ok(
        rect.y + rect.h <= h - insets.bottom + 0.5,
        `${name}: the ${what} runs into the bottom inset — ${show(rect)}`,
      );
    }
  }
});
