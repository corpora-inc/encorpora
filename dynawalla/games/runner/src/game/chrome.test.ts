/**
 * The two things a phone does to this game that a browser window never does.
 *
 * 1. It puts a cutout and a home indicator over the glass, and `pack.html` opts
 *    in to that with `viewport-fit=cover`. In landscape the cutout is about 47
 *    CSS pixels of an 844-wide viewport, and the read band's page margin was a
 *    flat 0.94 NDC — three per cent. The outer candidate, which in this game IS
 *    an answer, therefore reached about twenty pixels underneath it.
 * 2. The host paints an exit control top-left and a how-to-play control
 *    top-right, over the pack. VOLTA's score was in the first corner and its
 *    surge meter in the second.
 *
 * Neither is visible in `npm run dev`, both are certain on a device, and both
 * are pure arithmetic — so they belong in a test rather than in a bug report.
 *
 * Removing either fix fails this file: point `ndcFrame` back at `BAND.edge` and
 * the landscape cases below blow up, and set `READOUT_CLEAR` back to a ten-pixel
 * margin and every `hitsHostChrome` assertion trips.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  HOST_CONTROL,
  hitsHostChrome,
  safeRect,
  type Insets,
} from "../../../../packs/shared/game-chrome/index.ts";
import { hudEdge, ndcFrame, readoutRect, READOUT_CLEAR } from "./chrome.ts";
import { BAND, FULL_FRAME, payoffEdge, popupEdge, readBand } from "./readband.ts";
import { INK, TRACK } from "./glyphs.ts";

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
/** A tall phone: cutout at the top, home indicator at the bottom. */
const PORTRAIT: Insets = { top: 47, right: 0, bottom: 34, left: 0 };
/** The same phone on its side: the cutout becomes a side inset, on both sides. */
const LANDSCAPE: Insets = { top: 0, right: 47, bottom: 21, left: 47 };

/**
 * The viewports the fleet actually has, smallest first.
 *
 * 320x568 is here because it is where reserving a band instead of overlaying one
 * broke a sibling game outright, and because it is the shape everything else is
 * tuned away from.
 */
const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
];

/**
 * The insets a given viewport can actually have.
 *
 * Paired with the orientation rather than crossed with it: a 320-wide portrait
 * phone never has 47 pixels of cutout down each side, and asserting against
 * shapes no device produces only tempts the fix into clamping the safe area
 * away to make an imaginary case pass.
 */
function insetsFor(w: number, h: number): Array<[string, Insets]> {
  return [
    ["no insets", NONE],
    w > h ? ["cutout at the side", LANDSCAPE] : ["cutout at the top", PORTRAIT],
  ];
}



/* -------------------------------------------------------------------------- */
/* The host's two corners.                                                    */
/* -------------------------------------------------------------------------- */

test("the score and the surge meter are clear of the host's controls", () => {
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      for (const side of ["left", "right"] as const) {
        const r = readoutRect(side, w, insets);
        assert.equal(
          hitsHostChrome(r, w, insets),
          false,
          `${name} (${w}x${h}), ${label}: the ${side} readout is under the host's chrome`,
        );
        assert.ok(r.y + r.h <= h, `${name}: the ${side} readout runs off the bottom`);
      }
    }
  }
});

test("the readouts stay inside the safe area they were given", () => {
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      const safe = safeRect(w, h, insets);
      const left = readoutRect("left", w, insets);
      const right = readoutRect("right", w, insets);
      assert.ok(left.x >= safe.x, `${name}, ${label}: the score is inside the left inset`);
      assert.ok(
        right.x + right.w <= safe.x + safe.w + 1e-9,
        `${name}, ${label}: the surge meter is inside the right inset`,
      );
      assert.ok(left.y >= safe.y, `${name}, ${label}: the score is under the top inset`);
    }
  }
});

test("dropping the readouts clears the control and no more", () => {
  // A promise about two 44px squares, not a reserved band. If this number ever
  // grows into a real strip, that is the trade the sibling game's lattice
  // already showed to be wrong, and it should fail here first.
  assert.ok(READOUT_CLEAR >= HOST_CONTROL, "the readouts do not clear the control at all");
  assert.ok(READOUT_CLEAR <= HOST_CONTROL + 24, `READOUT_CLEAR is ${READOUT_CLEAR}px — that is a band`);
});

test("the HUD margin matches the clamp the stylesheet resolves to", () => {
  assert.equal(hudEdge(320), 10);
  assert.equal(hudEdge(2000), 26);
  assert.ok(Math.abs(hudEdge(800) - 800 * 0.022) < 1e-9);
});

/* -------------------------------------------------------------------------- */
/* The safe area, in NDC, where the answers are drawn.                        */
/* -------------------------------------------------------------------------- */

/** NDC x -> CSS pixels from the left edge. */
const ndcToPx = (x: number, w: number): number => ((x + 1) / 2) * w;
/** NDC y (up) -> CSS pixels from the top edge. */
const ndcYToPx = (y: number, h: number): number => ((1 - y) / 2) * h;

test("with no insets the frame is exactly the margins the game always had", () => {
  const f = ndcFrame(390, 844, NONE);
  assert.equal(f.edge, BAND.edge);
  assert.equal(f.top, BAND.top);
  assert.equal(f.bottom, BAND.bottom);
  assert.deepEqual(f, FULL_FRAME);
});

test("a side cutout pulls the page margin in, so the outer answer stays visible", () => {
  const f = ndcFrame(844, 390, LANDSCAPE);
  assert.ok(f.edge < BAND.edge, "the frame ignored a 47px side cutout");
  // The margin lands exactly on the safe edge, not somewhere near it.
  assert.ok(Math.abs(ndcToPx(f.edge, 844) - (844 - 47)) < 1e-9);
});

/* The camera, mirrored from `mount.ts` so the numbers are the real ones. */
const CAM_Z = 11.4;
function scales(w: number, h: number, fovDeg: number, dist: number): { kx: number; ky: number } {
  const ky = 1 / Math.tan((fovDeg * Math.PI) / 360) / (dist + CAM_Z);
  return { kx: ky / (w / h), ky };
}
/** World width of a numeral at ink height 1, for `digits` digits. */
const unit = (digits: number, advance: number): number => digits * advance * (1 / INK) * TRACK;

test("no answer is ever drawn under the cutout, at any viewport or rotation", () => {
  // This is the assertion the whole file exists for. The three candidates are
  // the answer UI — there is no keypad and no button — so a numeral the cutout
  // eats is not a cosmetic problem, it is a question with a missing option.
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      const frame = ndcFrame(w, h, insets);
      const safe = safeRect(w, h, insets);
      for (const fov of [58, 74, 104]) {
        for (const dist of [4, 30, 90, 240]) {
          const { kx, ky } = scales(w, h, fov, dist);
          for (const adv of [0.36, 0.43, 0.5]) {
            for (const n of [1, 2, 3, 4]) {
              const u = unit(n, adv);
              for (const approach of [0, 0.5, 1]) {
                for (const archTop of [-0.4, 0.2, 1.4]) {
                  const band = readBand([u, u, u], kx, ky, approach, archTop, frame);
                  const ctx = `${name} ${label} fov${fov} d${dist} adv${adv} n${n} a${approach}`;

                  const leftPx = ndcToPx(band.x[0] - band.wNdc / 2, w);
                  const rightPx = ndcToPx(band.x[2] + band.wNdc / 2, w);
                  assert.ok(leftPx >= safe.x - 1e-6, `${ctx}: left answer is ${leftPx.toFixed(1)}px, inside the left inset`);
                  assert.ok(
                    rightPx <= safe.x + safe.w + 1e-6,
                    `${ctx}: right answer reaches ${rightPx.toFixed(1)}px of a safe area ending at ${(safe.x + safe.w).toFixed(1)}px`,
                  );

                  const topPx = ndcYToPx(band.y + band.hNdc / 2, h);
                  const botPx = ndcYToPx(band.y - band.hNdc / 2, h);
                  assert.ok(topPx >= safe.y - 1e-6, `${ctx}: the row rises into the top inset`);
                  assert.ok(botPx <= safe.y + safe.h + 1e-6, `${ctx}: the row sinks into the bottom inset`);

                  // And the row is never under a host control either.
                  assert.equal(
                    hitsHostChrome(
                      { x: leftPx, y: topPx, w: rightPx - leftPx, h: botPx - topPx },
                      w,
                      insets,
                    ),
                    false,
                    `${ctx}: the answer row is under the host's chrome`,
                  );
                }
              }
            }
          }
        }
      }
    }
  }
});

test("the answers are still large enough to read once the cutout is respected", () => {
  // Pulling the margin in costs width, and width is what a three-digit answer on
  // a small screen is made of. If honouring the safe area ever shrinks a numeral
  // below what a child can read at speed, the fix has broken the game it was
  // protecting, and that is worse than the bug.
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      const frame = ndcFrame(w, h, insets);
      const { kx, ky } = scales(w, h, 74, 90);
      const u = unit(3, 0.5);
      const band = readBand([u, u, u], kx, ky, 0, 0.1, frame);
      const capPx = (band.hNdc / 2) * h;
      const gutterPx = ((band.pitch - band.wNdc) / 2) * w;
      assert.ok(capPx >= 24, `${name}, ${label}: three digits render at ${capPx.toFixed(1)}px cap height`);
      assert.ok(gutterPx >= 12, `${name}, ${label}: only ${gutterPx.toFixed(1)}px of clear air between answers`);
    }
  }
});

test("the payoff and the score popups honour the same frame", () => {
  for (const [, w, h] of VIEWPORTS) {
    for (const [, insets] of insetsFor(w, h)) {
      const f = ndcFrame(w, h, insets);
      assert.ok(payoffEdge(f.edge) < f.edge, "the payoff margin is not inside the frame");
      assert.ok(popupEdge(f.edge) < f.edge, "the popup margin is not inside the frame");
      assert.ok(ndcToPx(payoffEdge(f.edge), w) <= w - insets.right, "the payoff can reach the cutout");
      assert.ok(ndcToPx(popupEdge(f.edge), w) <= w - insets.right, "a popup can reach the cutout");
      assert.ok(h > 0);
    }
  }
});
