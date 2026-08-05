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
import { gameOverLayout, hudLayout } from "./hudLayout.ts";

const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait", 390, 844],
  // The founder's own handset: 1080×2340 physical, which the browser reports as
  // 393×851 CSS px at devicePixelRatio 2.75.
  ["the founder's phone, portrait", 393, 851],
  ["the founder's phone, landscape", 851, 393],
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

/** An Android phone with a status bar and a three-button navigation bar. */
const ANDROID: Insets = { top: 24, right: 0, bottom: 48, left: 0 };
/** The same phone turned sideways: the nav bar moves to the trailing edge. */
const ANDROID_SIDE: Insets = { top: 0, right: 48, bottom: 0, left: 24 };

const INSETS: Array<[string, Insets]> = [
  ["flat", FLAT],
  ["notched", NOTCH],
  ["notched, on its side", NOTCH_SIDE],
  ["android status + 3-button nav", ANDROID],
  ["android, on its side", ANDROID_SIDE],
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

test("the accusation stays over the point the shells fan out of", () => {
  // `fitCamera` maps world x = 0 to `w / 2`, and the husks are born at world
  // x = 0. iOS reports the notch on ONE long edge, so a phone rotated left and
  // a phone rotated right give asymmetric insets — and a sum centred on the
  // safe area would slide sideways off the fan-out. The box gives up width
  // instead of moving.
  const LOPSIDED: Insets = { top: 0, right: 0, bottom: 21, left: 47 };
  for (const [name, w, h] of VIEWPORTS) {
    for (const insets of [FLAT, NOTCH, NOTCH_SIDE, LOPSIDED]) {
      const l = hudLayout(w, h, safeRect(w, h, insets));
      assert.equal(
        l.equation.x + l.equation.w / 2,
        w / 2,
        `${name}: the sum drifted off the husks' lane`,
      );
      assert.equal(
        hitsHostChrome(l.equation, w, insets),
        false,
        `${name}: the sum is under a host control`,
      );
    }
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

/* ───────────────────────────────────────────────────── the death screen fits */

// *"the death screen doesn't quite fit."*
//
// It did not. `drawGameOver` set four font sizes from the viewport and then
// called `fillText` on all four without measuring any of them — the only card in
// this game that skipped `fitFont`. What follows is computed at real viewports
// from the same `gameOverLayout` the canvas draws from, with a text metric of
// its own, so it fails if the fitting is removed rather than restating it.

/**
 * Advance width for a bold uppercase run, per character per pixel of type size.
 *
 * 0.62, not the 0.56 the harness in `opening.test.ts` uses for mixed case. Every
 * line on this card is `700`-weight and three of the four are ALL CAPS, and caps
 * in a UI sans run wider than the average glyph. A layout test that models the
 * type as narrower than it is passes for the wrong reason.
 */
const ADVANCE = 0.62;
const measure = (text: string, size: number): number => text.length * size * ADVANCE;

/**
 * The worst card this game can put up: a six-figure best, a two-figure wave and
 * a two-figure run, which is what the ledger line looks like after a good
 * session rather than after the first one.
 */
const COPY = {
  headline: "THE TRENCH TAKES YOU",
  score: "104820",
  ledger: ["BEST 128640", "WAVE 24", "BEST RUN ×31"],
  prompt: "TAP TO DIVE AGAIN",
};

/** The ledger as it reads when all three facts share one row. */
const LEDGER_ONE_ROW = COPY.ledger.join("   ·   ");

for (const [vname, w, h] of VIEWPORTS) {
  for (const [iname, insets] of INSETS) {
    test(`the death screen fits — ${vname} (${w}×${h}), ${iname}`, () => {
      const area = safeRect(w, h, insets);
      const l = hudLayout(w, h, area);
      const card = gameOverLayout(l, COPY, measure);

      for (const line of card.lines) {
        assert.ok(
          inside(line.box, area),
          `"${line.text}" leaves the safe area: ${JSON.stringify(line.box)} vs ${JSON.stringify(area)}`,
        );
        assert.equal(
          hitsHostChrome(line.box, w, insets),
          false,
          `"${line.text}" is under a host control: ${JSON.stringify(line.box)}`,
        );
      }
    });
  }
}

test("the death screen's headline really did run off a phone before this", () => {
  // The defect, measured, so that "it fits now" is a statement about a change
  // and not about a constant. This is the unfitted arithmetic `drawGameOver`
  // used to do: `font(size * 0.62)` and straight into `fillText`.
  for (const [name, w, h] of [
    ["phone portrait, small", 320, 568],
    ["the founder's phone, portrait", 393, 851],
  ] as Array<[string, number, number]>) {
    const area = safeRect(w, h, ANDROID);
    const size = Math.min(area.w * 0.16, area.h * 0.1);
    const headline = measure(COPY.headline, size * 0.62);
    const ledger = measure(LEDGER_ONE_ROW, size * 0.3);
    assert.ok(
      headline > area.w,
      `${name}: the unfitted headline was ${headline.toFixed(0)}px across a ${area.w}px screen`,
    );
    assert.ok(
      ledger > area.w,
      `${name}: the unfitted ledger was ${ledger.toFixed(0)}px across a ${area.w}px screen`,
    );
  }
});

test("the death screen shrinks type rather than moving the block", () => {
  // Two properties that together say the card is FITTED and not merely nudged.
  //
  // 1. A narrow phone gets smaller type than a wide one for the same line.
  // 2. The rows stay where the nominal size puts them, so the card does not
  //    creep upward on the devices where it is already tightest.
  const narrow = gameOverLayout(hudLayout(320, 568, safeRect(320, 568, FLAT)), COPY, measure);
  const wide = gameOverLayout(hudLayout(1024, 768, safeRect(1024, 768, FLAT)), COPY, measure);
  const headline = (c: typeof narrow): number => (c.lines[0] as { size: number }).size;
  assert.ok(
    headline(narrow) < narrow.size * 0.62 - 0.5,
    `a 320px phone got the full ${(narrow.size * 0.62).toFixed(1)}px headline, so nothing was fitted`,
  );
  assert.ok(
    Math.abs(headline(wide) - wide.size * 0.62) < 0.5,
    "a tablet's headline was shrunk even though it fits, which means the fit is a blanket clamp",
  );
  const drops = (c: typeof narrow): number[] =>
    c.lines.map((line) => Number(((line.y - (c.lines[0] as { y: number }).y) / c.size).toFixed(2)));
  assert.deepEqual(
    drops(wide),
    [0, 1.05, 1.75, 2.5],
    "a tablet did not get the single-row card this game has always had",
  );
  // The narrow phone wraps the ledger onto a second row, and the prompt moves
  // down by exactly one ledger step to make room — nothing else moves. If the
  // rows tracked the FITTED type instead of the nominal size these would drift.
  assert.deepEqual(
    drops(narrow),
    [0, 1.05, 1.75, 2.17, 2.92],
    "the rows moved with the fitted type instead of with the nominal size",
  );
});

test("the ledger wraps only where it has to, and never loses a fact", () => {
  // The wrap is a width decision and nothing else. Whatever the safe rectangle
  // is, the three facts are all still on the card, in order, once.
  for (const [vname, w, h] of VIEWPORTS) {
    for (const [iname, insets] of INSETS) {
      const l = hudLayout(w, h, safeRect(w, h, insets));
      const card = gameOverLayout(l, COPY, measure);
      const ledger = card.lines.slice(2, -1).map((line) => line.text);
      assert.equal(
        ledger.join("   ·   "),
        LEDGER_ONE_ROW,
        `${vname}, ${iname}: the ledger rows do not reassemble into the ledger`,
      );
      // No assertion on the row COUNT here: the greedy pack pushes at most one
      // row per fact, so "no more rows than facts" is true of any implementation
      // of that loop and would pass whatever it did. The `join` above is the
      // check — it fails if a fact is dropped, duplicated or reordered.
    }
  }
});

test("a wide safe rectangle keeps the ledger on one row", () => {
  // The counterpart, and the reason the wrap is a width decision rather than a
  // blanket restyle: wherever the ledger fits at full size it is still the
  // single line this card has always had. That is every landscape window,
  // because `size` is driven by the SHORT edge and the ledger is limited by the
  // long one. Portrait is the other way round and wraps — see the rule in
  // `gameOverLayout`.
  for (const [vname, w, h] of [
    ["tablet landscape", 1024, 768],
    ["the founder's phone, landscape", 851, 393],
    ["phone landscape", 844, 390],
  ] as Array<[string, number, number]>) {
    const l = hudLayout(w, h, safeRect(w, h, FLAT));
    const card = gameOverLayout(l, COPY, measure);
    assert.equal(
      card.lines.length,
      4,
      `${vname}: the ledger wrapped into ${card.lines.length - 3} rows on a screen with room for one`,
    );
  }
});
