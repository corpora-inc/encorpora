// THE TWO CORNERS AND THE NOTCH.
//
// GUILTY paints one canvas and nothing else. That is a virtue — it drops into
// any host container without dragging styles along — and it is also why the
// safe area was never honoured: `env(safe-area-inset-*)` is a CSS value and a
// canvas cannot see it. The game declares `viewport-fit=cover`, which opts the
// document *into* the notch, so `fillText` at `y = pad` landed under the status
// bar and the focus bar at `h - 5` sat under the home indicator.
//
// The host also floats two 44px controls over every pack. The lives sat under
// the exit control, the score sat under the how-to-play control, and the
// equation — the accusation, the only thing a child has to read — is centred
// and was sized to 90% of the screen width, so it ran under both.
//
// **What counts as critical here:** the equation, the score, the wave counter,
// the row of lives, and the focus bar. That is the whole readable surface;
// `hud.ts` says so itself.
//
// **What is deliberately NOT critical**, and must keep bleeding to the glass:
// the water, the light shafts, the plankton, the seabed grid, the gate line,
// the husks, the ship, the bolts, the particles and the vignette. Those are
// projected through a camera fitted to the whole viewport, which is the entire
// reason `cover` is set. A test below pins that.
//
// The insets are passed explicitly rather than measured, because node has no
// notch and a test that measures zero proves nothing about a device.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  hitsHostChrome,
  safeRect,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts";
import { EQUATION_Y, VIEW_HALF_H } from "../core/config.ts";
import { hudLayout } from "./hudLayout.ts";

const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
];

/** No insets — a laptop, an older tablet, a desktop browser. */
const FLAT: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
/** A notched phone held upright: status bar above, home indicator below. */
const NOTCH: Insets = { top: 47, right: 0, bottom: 34, left: 0 };
/** The same phone on its side. Both long edges lose room. */
const NOTCH_SIDE: Insets = { top: 0, right: 47, bottom: 21, left: 47 };

const INSETS: Array<[string, Insets]> = [
  ["flat", FLAT],
  ["notched", NOTCH],
  ["notched, on its side", NOTCH_SIDE],
];

const inside = (r: Rect, a: Rect): boolean =>
  r.x >= a.x - 0.5 &&
  r.y >= a.y - 0.5 &&
  r.x + r.w <= a.x + a.w + 0.5 &&
  r.y + r.h <= a.y + a.h + 0.5;

for (const [vname, w, h] of VIEWPORTS) {
  for (const [iname, insets] of INSETS) {
    test(`nothing readable is covered — ${vname} (${w}×${h}), ${iname}`, () => {
      const area = safeRect(w, h, insets);
      const l = hudLayout(w, h, area);

      const named: Array<[string, Rect]> = [
        ["the equation", l.equation],
        ["the score", l.score],
        ["the wave counter", l.wave],
        ["the lives", l.lives],
        [
          "the focus bar",
          { x: l.cx - l.focusHalfW, y: l.focusY - 5, w: l.focusHalfW * 2, h: 5 },
        ],
      ];

      for (const [name, r] of named) {
        // 1. Inside the safe rectangle. If `hudLayout` ignored `area` these fail
        //    on the notched profiles — the device-only bug, caught here.
        assert.ok(inside(r, area), `${name} leaves the safe area: ${JSON.stringify(r)}`);

        // 2. Clear of the two host corners. The exit and help squares exist on
        //    every device, insets or not, so these hold at FLAT too — this gate
        //    fails on a laptop as well as on a phone, and cannot pass by
        //    accident the way a zero-inset-only assertion would.
        assert.equal(
          hitsHostChrome(r, w, insets),
          false,
          `${name} is under a host control: ${JSON.stringify(r)}`,
        );
      }
    });
  }
}

test("the accusation stays big enough to read after it narrows", () => {
  // `drawEquation` fits the sprite to `equation.w` and caps it at
  // `equation.h / 1.35`. The longest prompt the arith domain serves is about
  // eleven characters. The bake is ~92 units of sprite height per glyph run, so
  // the width budget per character is what decides legibility.
  for (const [name, w, h] of VIEWPORTS) {
    const l = hudLayout(w, h, safeRect(w, h, NOTCH));
    assert.ok(
      l.equation.w / 11 >= 14,
      `${name}: only ${(l.equation.w / 11).toFixed(1)}px per character of sum`,
    );
    assert.ok(l.equation.h >= 40, `${name}: the sum box is ${l.equation.h.toFixed(1)}px tall`);
  }
});

test("the accusation does not move at all when there is no notch", () => {
  // The husks are born out of the equation and that fan-out is the entire
  // tutorial, so the type must not wander away from where the camera puts the
  // spawn point. With no insets it sits exactly on the projection of
  // `EQUATION_Y`; with a notch it comes down by the notch and no further.
  for (const [name, w, h] of VIEWPORTS) {
    const flat = hudLayout(w, h, safeRect(w, h, FLAT));
    const worldCy = (h / 2) * (1 - EQUATION_Y / VIEW_HALF_H);
    assert.ok(
      Math.abs(flat.equation.y + flat.equation.h / 2 - worldCy) < 0.5,
      `${name}: the sum drifted off the husks' birth point`,
    );

    const notched = hudLayout(w, h, safeRect(w, h, NOTCH));
    const drop = notched.equation.y + notched.equation.h / 2 - worldCy;
    assert.ok(drop >= 0, `${name}: the sum moved up into the notch`);
    assert.ok(drop <= 47, `${name}: the sum dropped ${drop.toFixed(1)}px for a 47px notch`);
  }
});

test("the trench is not letterboxed by the insets", () => {
  // The counterpart assertion, and the reason `safeRect` is not simply applied
  // to everything. The camera is fitted to the whole glass in `game.ts`, and
  // nothing in this layout may be used to shrink it. What is pinned here is
  // that the layout reports the full viewport back, so a change that "fixed"
  // the notch by shrinking the canvas would be visible.
  for (const [name, w, h] of VIEWPORTS) {
    const flat = hudLayout(w, h, safeRect(w, h, FLAT));
    const notched = hudLayout(w, h, safeRect(w, h, NOTCH));
    assert.equal(flat.glass.w, w, `${name}: the layout narrowed the glass`);
    assert.equal(flat.glass.h, h, `${name}: the layout shortened the glass`);
    assert.equal(notched.glass.w, w, `${name}: a notch narrowed the glass`);
    assert.equal(notched.glass.h, h, `${name}: a notch shortened the glass`);
    assert.equal(flat.safe.h, h, `${name}: the flat safe area is not the whole height`);
    assert.ok(notched.safe.h < h, `${name}: the notch cost the HUD nothing, which cannot be right`);
  }
});
