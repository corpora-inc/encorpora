// THE TWO CORNERS.
//
// The host floats a 44px back chevron over the top-LEFT of every game and the
// how-to-play button over the top-RIGHT. It reserves no band — reserving one
// costs a twelfth of a 568px phone to hold two buttons, and it broke SKY
// LEDGER's lattice outright. The promise a game makes instead is narrow and
// testable: nothing a child must READ or TOUCH lands in those two squares.
//
// POLARITY's HUD was careful about the safe area and always had been —
// `.pol-hud` padded all four edges with `env()` — and that is exactly why it
// collided. Host chrome floats INSIDE the safe area, which is where a careful
// HUD puts things. So the score and the chain multiplier sat in the chevron's
// square, the shield pips and the STRATUM label sat under the question mark,
// and `.pol-mini` — the game's own sound and pause buttons — was pinned to the
// how-to-play button's coordinates exactly.
//
// The rects come from `hudRects`, and the same constants are written onto the
// root as custom properties at mount, so this cannot pass while the stylesheet
// says something else.

import assert from "node:assert/strict";
import { test } from "node:test";

import { hitsHostChrome, type Insets } from "../../../../packs/shared/game-chrome/index.ts";
import { CHROME_TOP, MINI, MINI_GAP, hudRects, padSize } from "./layout.ts";

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
const NOTCH_PORTRAIT: Insets = { top: 47, right: 0, bottom: 34, left: 0 };
const NOTCH_LANDSCAPE: Insets = { top: 0, right: 47, bottom: 21, left: 47 };

const VIEWPORTS: Array<[string, number, number]> = [
  ["the smallest phone we support", 320, 568],
  ["phone portrait", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
];

for (const [name, w, h] of VIEWPORTS) {
  for (const [insetName, insets] of [
    ["no insets", NONE],
    ["a notch", w > h ? NOTCH_LANDSCAPE : NOTCH_PORTRAIT],
  ] as const) {
    test(`the register clears the host's corners at ${name} (${w}×${h}, ${insetName})`, () => {
      const r = hudRects(w, h, insets);

      // The whole top row: score and chain on the left, the core gauge in the
      // middle, shields and STRATUM on the right. All of it is read.
      assert.equal(
        hitsHostChrome(r.top, w, insets),
        false,
        `${w}×${h}: the score, the gauge or the shields are under host chrome`,
      );
      assert.equal(
        hitsHostChrome(r.mini, w, insets),
        false,
        `${w}×${h}: the sound and pause buttons are under the host's how-to-play button`,
      );
      // The pads are the only two things a finger must land on during play.
      assert.equal(hitsHostChrome(r.padFlip, w, insets), false, `${w}×${h}: FLIP is covered`);
      assert.equal(hitsHostChrome(r.padVent, w, insets), false, `${w}×${h}: VENT is covered`);
    });
  }
}

test("every HUD box stays inside the safe area on all four edges", () => {
  for (const [name, w, h] of VIEWPORTS) {
    const insets = w > h ? NOTCH_LANDSCAPE : NOTCH_PORTRAIT;
    const r = hudRects(w, h, insets);

    for (const [what, box] of [
      ["the top row", r.top],
      ["the sound and pause buttons", r.mini],
      ["the FLIP pad", r.padFlip],
      ["the VENT pad", r.padVent],
    ] as const) {
      assert.ok(box.x >= insets.left, `${name}: ${what} runs into the left inset`);
      assert.ok(
        box.x + box.w <= w - insets.right + 0.5,
        `${name}: ${what} runs into the right inset`,
      );
      assert.ok(box.y >= insets.top, `${name}: ${what} runs under the notch`);
      assert.ok(
        box.y + box.h <= h - insets.bottom + 0.5,
        `${name}: ${what} runs under the home indicator`,
      );
    }
  }
});

test("the two buttons keep real air between them and the host's", () => {
  // Abutting is not clearing. `hitsHostChrome` uses a strict overlap, so two
  // boxes sharing an edge pass it — and a child's thumb does not know that.
  for (const [name, w, h] of VIEWPORTS) {
    for (const insets of [NONE, w > h ? NOTCH_LANDSCAPE : NOTCH_PORTRAIT]) {
      const r = hudRects(w, h, insets);
      const helpLeft = w - insets.right - 10 - 44;
      assert.ok(
        helpLeft - (r.mini.x + r.mini.w) >= 10,
        `${name}: only ${(helpLeft - (r.mini.x + r.mini.w)).toFixed(0)}px between the game's buttons and the host's`,
      );
      assert.equal(r.mini.w, MINI * 2 + MINI_GAP);
    }
  }
});

test("the pads stay a thumb's size, not merely legal", () => {
  // Clearing the corners by shrinking to nothing would satisfy every assert
  // above. 44 is the platform floor for a touch target.
  for (const [name, w] of VIEWPORTS) {
    assert.ok(padSize(w) >= 44, `${name}: the pad is ${padSize(w)}px`);
  }
});

test("the offset is the host's own number, not one somebody typed", () => {
  // 57 is the bottom of the host's corner squares: a 3px hairline, a 10px
  // margin and a 44px control. This is the inequality the file exists to hold.
  assert.ok(CHROME_TOP >= 57, `CHROME_TOP is ${CHROME_TOP} — the host's corners end at 57`);
});
