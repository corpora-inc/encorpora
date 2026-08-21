/**
 * The HUD, at every shape the fleet actually has.
 *
 * SERPENT draws its whole HUD on the canvas, and a canvas cannot read
 * `env(safe-area-inset-*)`: that is a CSS value, and `fillText` at `y = 24` has
 * never heard of it. `pack.html` declares `viewport-fit=cover`, which opts this
 * document *into* the display cutout and the home indicator. So the depth went
 * under the cutout, the sound switch — a control a child taps — went under the
 * home indicator, and the depth and the combo gauge sat in the two 44px corners
 * the host paints its exit and how-to-play controls over.
 *
 * None of that is visible in `npm run dev`, all of it is certain on a device,
 * and all of it is arithmetic. So it lives here.
 *
 * **Removing the fix fails this file.** Point `hudLayout` back at the raw
 * viewport (`safe = {x:0, y:0, w, h}`) and the safe-area tests trip; set
 * `READOUT_CLEAR` back to the old `pad` and every `hitsHostChrome` assertion
 * trips.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  HOST_CONTROL,
  hitsHostChrome,
  safeRect,
  type Insets,
  type Rect,
} from "../../../../../packs/shared/game-chrome/index.ts";
import {
  READOUT_CLEAR,
  depthTarget,
  gaugeTarget,
  hudLayout,
  scoreTarget,
  soundTarget,
} from "./chrome.ts";

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
/** A tall phone: cutout at the top, home indicator at the bottom. */
const PORTRAIT: Insets = { top: 47, right: 0, bottom: 34, left: 0 };
/** The same phone on its side: the cutout becomes an inset on BOTH sides. */
const LANDSCAPE: Insets = { top: 0, right: 47, bottom: 21, left: 47 };

const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
];

/**
 * The insets a viewport can actually have, paired with its orientation rather
 * than crossed with it. A 320-wide portrait phone never has 47 pixels of cutout
 * down each side, and asserting against shapes no device produces only tempts
 * the fix into clamping the safe area away to make an imaginary case pass.
 */
function insetsFor(w: number, h: number): Array<[string, Insets]> {
  return [
    ["no insets", NONE],
    w > h ? ["cutout at the side", LANDSCAPE] : ["cutout at the top", PORTRAIT],
  ];
}

/** Every readout, by the name a failure should print. */
function readouts(w: number, h: number, insets: Insets): Array<[string, Rect]> {
  const l = hudLayout(w, h, insets);
  return [
    ["the depth", depthTarget(l)],
    ["the score", scoreTarget(l)],
    ["the combo gauge", gaugeTarget(l)],
    ["the sound switch", soundTarget(l)],
  ];
}

/* -------------------------------------------------------------------------- */
/* The host's two corners.                                                    */
/* -------------------------------------------------------------------------- */

test("nothing a child reads or taps sits under the host's chrome", () => {
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      for (const [what, rect] of readouts(w, h, insets)) {
        assert.equal(
          hitsHostChrome(rect, w, insets),
          false,
          `${name} (${w}x${h}), ${label}: ${what} is under the host's chrome`,
        );
      }
    }
  }
});

test("the readouts clear the control and no more", () => {
  // A promise about two 44px squares, not a reserved band: reserving the whole
  // top strip cost a sibling game 12% of a small phone's height and broke its
  // layout outright. If this ever becomes a band it should fail here first.
  assert.ok(READOUT_CLEAR >= HOST_CONTROL, "the readouts do not clear the control at all");
  assert.ok(READOUT_CLEAR <= HOST_CONTROL + 24, `READOUT_CLEAR is ${READOUT_CLEAR}px — that is a band`);
});

/* -------------------------------------------------------------------------- */
/* The safe area.                                                             */
/* -------------------------------------------------------------------------- */

test("nothing a child reads or taps leaves the safe area", () => {
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      const safe = safeRect(w, h, insets);
      for (const [what, r] of readouts(w, h, insets)) {
        const where = `${name} (${w}x${h}), ${label}: ${what}`;
        assert.ok(r.x >= safe.x - 1e-9, `${where} crosses the left inset`);
        assert.ok(r.y >= safe.y - 1e-9, `${where} crosses the top inset`);
        assert.ok(r.x + r.w <= safe.x + safe.w + 1e-9, `${where} crosses the right inset`);
        assert.ok(r.y + r.h <= safe.y + safe.h + 1e-9, `${where} crosses the bottom inset`);
      }
    }
  }
});

test("the sound switch is a target a child can actually hit", () => {
  // It is the only control the game draws itself. Under the home indicator it
  // was not merely ugly: an edge swipe there belongs to the OS, so the tap went
  // to the system and the sound never changed.
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      const t = soundTarget(hudLayout(w, h, insets));
      assert.ok(
        t.w >= HOST_CONTROL && t.h >= HOST_CONTROL,
        `${name}, ${label}: the sound target is ${t.w.toFixed(0)}x${t.h.toFixed(0)}`,
      );
    }
  }
});

test("with no insets the layout is the one the game always had, only lower", () => {
  // The safe-area work must be a no-op on a device without insets, or it is not
  // a fix, it is a redesign. The only intended change is the vertical drop.
  const plain = hudLayout(390, 844, NONE);
  assert.equal(plain.safe.x, 0);
  assert.equal(plain.safe.y, 0);
  assert.equal(plain.safe.w, 390);
  assert.equal(plain.safe.h, 844);
  const u = Math.min(390, 844);
  assert.equal(plain.pad, Math.max(14, u * 0.045));
  assert.equal(plain.depthSize, Math.max(24, u * 0.062));
  assert.equal(plain.scoreSize, Math.max(26, u * 0.075));
  assert.equal(plain.scoreX, 195);
  assert.equal(plain.depthY, READOUT_CLEAR + plain.depthSize * 0.6);
  // The ink starts exactly where the host control ends, not a pixel lower.
  assert.equal(depthTarget(plain).y, READOUT_CLEAR);
});

test("every readout is placed off the safe box's edges, not the glass's", () => {
  // Asserted as an identity rather than as a delta, because a cutout also
  // shrinks the box the type scale keys off — the readouts do not simply
  // translate by 47px, they are re-laid-out inside a smaller room.
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      const l = hudLayout(w, h, insets);
      const where = `${name}, ${label}`;
      const right = l.safe.x + l.safe.w;
      const bottom = l.safe.y + l.safe.h;
      assert.ok(Math.abs(l.soundX + l.soundR + l.pad - right) < 1e-9, `${where}: the sound switch is not on the safe right edge`);
      assert.ok(Math.abs(l.soundY + l.soundR + l.pad - bottom) < 1e-9, `${where}: the sound switch is not on the safe bottom edge`);
      assert.ok(Math.abs(l.gaugeX + l.gaugeR + l.pad - right) < 1e-9, `${where}: the gauge is not on the safe right edge`);
      assert.ok(l.depthX > l.safe.x, `${where}: the depth is not inside the safe left edge`);
      assert.ok(Math.abs(l.scoreX - (l.safe.x + l.safe.w / 2)) < 1e-9, `${where}: the score is not centred in the safe box`);
    }
  }

  // And a cutout really does move things: same viewport, insets on, everything
  // steps inward. If this passes with the safe box replaced by the raw
  // viewport, the fix is not in the build.
  const plain = hudLayout(844, 390, NONE);
  const cut = hudLayout(844, 390, LANDSCAPE);
  assert.ok(cut.depthX > plain.depthX, "the depth did not move in from the left cutout");
  assert.ok(cut.soundX < plain.soundX, "the sound switch did not move in from the right cutout");
  assert.ok(cut.soundY < plain.soundY, "the sound switch did not clear the home indicator");
});

test("the readouts stay on screen even on a viewport smaller than its own insets", () => {
  // Only reachable on an absurd surface, which is exactly when nobody is
  // watching. A negative safe box silently flips every expression downstream.
  for (const [w, h] of [
    [40, 40],
    [1, 1],
    [200, 60],
  ] as const) {
    const l = hudLayout(w, h, { top: 100, right: 100, bottom: 100, left: 100 });
    assert.ok(Number.isFinite(l.soundX) && Number.isFinite(l.soundY), "the layout produced NaN");
    assert.ok(l.safe.w >= 0 && l.safe.h >= 0, "the safe box went negative");
    assert.ok(l.pad > 0 && l.depthSize > 0, "a size went to zero or below");
  }
});
