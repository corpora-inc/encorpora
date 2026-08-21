// The HUD's two promises, asserted at every viewport MOSAIC ships to.
//
//   1. Nothing a child must READ lands in the host's two 44px corners. The host
//      paints an exit control top-left and a how-to-play control top-right, over
//      the game, and does not reserve a band for them.
//   2. Nothing a child must read lands outside the safe rect, on a device with a
//      notch or a home indicator.
//
// Both used to be false. At 320x568 with no insets the cleared-fraction dial sat
// at screen 12.8..34.5 in both axes and the exit square is 10..54 by 13..57 —
// dead centre under it — and the right-aligned score sat under the help square.
// At 768x1024 the dial collided too. This is a canvas HUD, so `env()` was never
// reachable and there was nothing on the device to notice it with.
//
// Tablet and desktop are first-class here. Landscape is not a stretched phone:
// there the piers hold both corners outside the play rect entirely, the mapped
// squares do not overlap anything, and the layout correctly does not move.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hitsHostChrome,
  NO_INSETS,
  safeRect,
  type Insets,
} from "../../../../packs/shared/game-chrome/index.ts";
import { fitPlay, hudLayout, toScreenRect } from "./hud.ts";

const VIEWPORTS: Array<[string, number, number]> = [
  ["small phone portrait", 320, 568],
  ["phone portrait", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
];

// Every rule shape the game can put on the plate, shortest and longest, because
// the plate's width decides whether it can reach a corner at all.
const BANNERS = ["× 6", "24 ÷ ▪", "= 1/2", "> 40", "= 50%", "1000 ÷ ▪"];

/** A notched phone held upright, and the same phone turned on its side. */
const PORTRAIT_NOTCH: Insets = { top: 47, right: 0, bottom: 34, left: 0 };
const LANDSCAPE_NOTCH: Insets = { top: 0, right: 47, bottom: 21, left: 47 };

const CASES: Array<[string, Insets]> = [
  ["no insets", NO_INSETS],
  ["notched, upright", PORTRAIT_NOTCH],
  ["notched, on its side", LANDSCAPE_NOTCH],
];

const inside = (a: { x: number; y: number; w: number; h: number }, b: typeof a): boolean =>
  a.x >= b.x - 0.01 &&
  a.y >= b.y - 0.01 &&
  a.x + a.w <= b.x + b.w + 0.01 &&
  a.y + a.h <= b.y + b.h + 0.01;

for (const [vpName, w, h] of VIEWPORTS) {
  for (const [caseName, insets] of CASES) {
    test(`the HUD clears the host's corners at ${vpName} (${w}×${h}), ${caseName}`, () => {
      const area = safeRect(w, h, insets);
      const view = fitPlay(w, h, area);
      for (const banner of BANNERS) {
        const l = hudLayout(view, insets, banner);
        for (const [name, box] of Object.entries(l.boxes)) {
          const screen = toScreenRect(box, view);
          assert.equal(
            hitsHostChrome(screen, w, insets),
            false,
            `${vpName} ${caseName} "${banner}": the ${name} is under host chrome ` +
              `(${screen.x.toFixed(1)},${screen.y.toFixed(1)} ` +
              `${screen.w.toFixed(1)}×${screen.h.toFixed(1)})`,
          );
        }
      }
    });

    test(`the HUD stays inside the safe rect at ${vpName} (${w}×${h}), ${caseName}`, () => {
      const area = safeRect(w, h, insets);
      const view = fitPlay(w, h, area);
      for (const banner of BANNERS) {
        const l = hudLayout(view, insets, banner);
        for (const [name, box] of Object.entries(l.boxes)) {
          const screen = toScreenRect(box, view);
          assert.ok(
            inside(screen, area),
            `${vpName} ${caseName} "${banner}": the ${name} is outside the safe rect ` +
              `(${screen.x.toFixed(1)},${screen.y.toFixed(1)} ` +
              `${screen.w.toFixed(1)}×${screen.h.toFixed(1)} vs ` +
              `${area.x},${area.y} ${area.w}×${area.h})`,
          );
        }
      }
    });
  }
}

test("the play rect is fitted inside the safe rect, not the canvas", () => {
  // The failure this replaces: `viewport-fit=cover` opts the document into the
  // notch, and a canvas cannot read `env()` back, so the window filled the whole
  // screen and the HUD went under the hardware.
  const insets = PORTRAIT_NOTCH;
  const area = safeRect(390, 844, insets);
  const view = fitPlay(390, 844, area);
  assert.ok(view.playY >= insets.top, `play rect starts at ${view.playY}, above the notch`);
  assert.ok(
    view.playY + view.playH <= 844 - insets.bottom + 0.01,
    "the play rect runs under the home indicator",
  );
  assert.ok(view.playX >= 0 && view.playX + view.playW <= 390.01);
});

test("the background still bleeds: the play rect is smaller than the canvas it sits in", () => {
  // Full bleed is the point of `viewport-fit=cover`. What moves inside the safe
  // rect is what must be READ; the gradient and the stone piers still fill the
  // canvas, and the leftover they fill is no longer symmetric.
  const insets = PORTRAIT_NOTCH;
  const view = fitPlay(390, 844, safeRect(390, 844, insets));
  const top = view.playY;
  const bottom = 844 - view.playY - view.playH;
  assert.ok(top > 0 && bottom > 0, "there is stone to draw above and below the window");
  assert.notEqual(Math.round(top), Math.round(bottom));
});

test("landscape leaves the layout alone, because the corners fall on the piers", () => {
  // A guard against over-correction: the aspect clamp already holds both host
  // squares outside the play rect in landscape, so mapping them in must move
  // nothing. If this starts failing, the clearance push has grown a branch.
  const wide = fitPlay(1024, 768, safeRect(1024, 768, NO_INSETS));
  const l = hudLayout(wide, NO_INSETS, "× 6");
  assert.equal(l.dial.cy, 74);
  assert.equal(l.banner.cy, 78);
  assert.equal(l.right.scoreY, 58);
});

test("portrait pushes the dial and the score column down, and says by how much", () => {
  // The numbers this game shipped with, and the numbers it ships with now.
  const view = fitPlay(320, 568, safeRect(320, 568, NO_INSETS));
  const l = hudLayout(view, NO_INSETS, "× 6");
  // The exit square is 10..54 by 13..57 CSS px; at scale 0.32 that is
  // 31.3..168.8 by 40.6..178.1 virtual units, and the dial rested at 40..108.
  assert.ok(l.dial.cy > 74, `the dial did not move: ${l.dial.cy}`);
  assert.ok(
    l.dial.cy - l.dial.r >= 178.1,
    `the dial's top is ${l.dial.cy - l.dial.r}, still inside the exit square`,
  );
  assert.ok(l.right.scoreY > 58, `the score did not move: ${l.right.scoreY}`);
  // And the wall the tiles hang on starts far below all of it, so nothing the
  // push moved has landed on the playfield.
  assert.ok(l.right.comboY + 35 < Math.max(150, view.vh * 0.28));
});
