/**
 * The two promises this game makes about its frame, checked at every shape a
 * child might hold the thing in.
 *
 * 1. Nothing readable or touchable is under the notch, the home indicator or a
 *    rounded corner. Splitbeat declares `viewport-fit=cover`, so that is opt-in
 *    damage, not bad luck.
 * 2. Nothing readable or touchable is in the host's two 44px corner controls.
 *    The host's exit sits top-left and its how-to-play top-right, floating over
 *    the pack. This game's OWN settings gear used to sit in the second one.
 *
 * These are asserted with the same `hitsHostChrome` the host's constants come
 * from, so if the host moves a control this test moves with it.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hitsHostChrome,
  NO_INSETS,
  safeRect,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts";
import { gearRect, layoutFor, type Layout } from "./layout.ts";

const VIEWPORTS: Array<[string, number, number]> = [
  ["small phone portrait", 320, 568],
  ["phone portrait", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
];

/** A notched phone held upright, and the same phone on its side. */
const PORTRAIT_NOTCH: Insets = { top: 47, right: 0, bottom: 34, left: 0 };
const LANDSCAPE_NOTCH: Insets = { top: 0, right: 47, bottom: 21, left: 47 };

const INSETS: Array<[string, Insets]> = [
  ["no insets", NO_INSETS],
  ["portrait notch", PORTRAIT_NOTCH],
  ["landscape notch", LANDSCAPE_NOTCH],
];

/**
 * Every box a child must read or touch, in screen pixels.
 *
 * The widths are the widest the drawing code can produce: six digits of score at
 * weight 900 is about 7.6 units; the sector line is the longest string on the
 * screen; the question plate's own size cap holds it to `area.w * 0.86` plus its
 * padding. Measuring generously is the point — a box that is too wide can only
 * make this test stricter.
 */
function readables(l: Layout, w: number, insets: Insets): Array<[string, Rect]> {
  const u = l.u;
  const promptW = l.area.w * 0.86 + u * 2.4;
  // The combo grows with the streak; this is the largest it gets.
  const comboH = u * 4.13;
  return [
    ["score", { x: l.hudX, y: l.scoreTop, w: u * 7.6, h: l.scoreH }],
    ["sector line", { x: l.hudX, y: l.sectorY - u * 0.39, w: u * 16, h: u * 0.78 }],
    [
      "charge strip",
      {
        x: l.chargeX,
        y: l.chargeY,
        w: l.chargeCellW * 5 + u * 0.1 * 4,
        h: l.chargeCellH,
      },
    ],
    ["question plate", { x: l.cx - promptW / 2, y: l.promptY, w: promptW, h: l.promptMaxH }],
    ["combo", { x: l.strikeX - u * 0.2, y: l.playTop - u * 0.9 - comboH / 2, w: u * 6, h: comboH }],
    // The play line itself. A note that passes behind a button is a note the
    // child cannot read the answer off, and in a gate bar that is the question.
    // The strike pad is `u * 1.15` wide, centred on the line; everything to the
    // right of it is the note's approach, and everything to the left is history.
    [
      "note run",
      {
        x: l.strikeX - u * 0.6,
        y: l.playTop,
        w: l.area.x + l.area.w - l.strikeX + u * 0.6,
        h: l.playH,
      },
    ],
    ["settings gear", gearRect(w, insets)],
  ];
}

for (const [vname, w, h] of VIEWPORTS) {
  for (const [iname, insets] of INSETS) {
    const area = safeRect(w, h, insets);
    const l = layoutFor(w, area, insets);

    test(`nothing readable is under host chrome — ${vname} ${w}×${h}, ${iname}`, () => {
      for (const [what, box] of readables(l, w, insets)) {
        assert.equal(
          hitsHostChrome(box, w, insets),
          false,
          `${vname}/${iname}: the ${what} is under the host's chrome ` +
            `(${box.x.toFixed(1)},${box.y.toFixed(1)} ${box.w.toFixed(1)}×${box.h.toFixed(1)})`,
        );
      }
    });

    test(`nothing readable is outside the safe area — ${vname} ${w}×${h}, ${iname}`, () => {
      for (const [what, box] of readables(l, w, insets)) {
        assert.ok(box.x >= area.x - 0.5, `${vname}/${iname}: the ${what} runs off the left`);
        assert.ok(box.y >= area.y - 0.5, `${vname}/${iname}: the ${what} runs off the top`);
        assert.ok(
          box.x + box.w <= area.x + area.w + 0.5,
          `${vname}/${iname}: the ${what} runs off the right`,
        );
        assert.ok(
          box.y + box.h <= area.y + area.h + 0.5,
          `${vname}/${iname}: the ${what} runs off the bottom`,
        );
      }
    });

    test(`the playfield is still playable — ${vname} ${w}×${h}, ${iname}`, () => {
      // Chrome OVERLAYS; it does not reserve a band. Pushing the HUD down must
      // not quietly shrink the lanes past a thumb.
      assert.ok(l.laneH >= 44, `${vname}/${iname}: lane is only ${l.laneH.toFixed(0)}px tall`);
      assert.ok(l.playH >= 120, `${vname}/${iname}: playfield is only ${l.playH.toFixed(0)}px`);
      // A note must have room to be read on its way in.
      assert.ok(
        l.pps * 1.85 >= 150,
        `${vname}/${iname}: only ${(l.pps * 1.85).toFixed(0)}px of run`,
      );
      // The run ends inside the safe area, so a label is readable as it enters.
      assert.ok(Math.abs(l.strikeX + l.pps * 1.85 - (area.x + area.w)) < 0.5);
    });
  }
}

test("the settings gear is not in the corner the host puts its help button in", () => {
  // This is the collision most likely to come back: the gear used to be
  // `top:max(8px,env(top)); right:max(8px,env(right))`, which is exactly where
  // the host's how-to-play control lands.
  for (const [, w, h] of VIEWPORTS) {
    for (const [, insets] of INSETS) {
      void h;
      assert.equal(hitsHostChrome(gearRect(w, insets), w, insets), false);
    }
  }
});

test("the question keeps its full width rather than squeezing between the corners", () => {
  // The alternative fix — capping the plate so it fits in the 212px between the
  // two corners at 320px — would shrink the one thing on screen that is being
  // asked. Instead it drops below them, and this asserts it really is below.
  const w = 320;
  const insets = NO_INSETS;
  const l = layoutFor(w, safeRect(w, 568, insets), insets);
  assert.ok(l.promptY >= 57, `the plate starts at ${l.promptY}, inside the corner band`);
  assert.ok(
    l.playTop >= l.promptY + l.promptMaxH,
    "a gate's own plate would cover the lane its answers ride down",
  );
});
