/**
 * The room the host leaves SIEGE, asserted at every shape the fleet has.
 *
 * SIEGE was one of the seven games that already read `env(safe-area-inset-*)`,
 * and it was the half-fix that usually is: `.sg-top` honoured `--top`,
 * `.sg-anvil` honoured `--bottom`, and neither SIDE was touched. In landscape
 * the cutout is a side inset, and the side of that bar is where the ember count
 * and the sound switch lived. Meanwhile the host paints an exit control over the
 * top-left 44px corner and a how-to-play control over the top-right one, and
 * SIEGE's status bar runs the full width of exactly that row.
 *
 * **Removing the fix fails this file.** Set `CORNER_CLEAR` to 0 and the corner
 * tests trip; drop the side safe-area rules out of `styles.css` and the
 * stylesheet test trips; hand `computeView` the whole element instead of the
 * safe box and the board test trips.
 *
 * This file works in the pack's own vocabulary — rects and constants. The
 * stylesheet's arithmetic is evaluated to pixels next door, in
 * `safearea.test.ts`, which is where the defect that survived this file lived.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  HOST_CONTROL,
  hitsHostChrome,
  safeRect,
  type Insets,
} from "../../../../packs/shared/game-chrome/index.ts";
import {
  BAR_PAD,
  CORNER_CLEAR,
  TOP_BAR_MIN,
  boardSafe,
  chromeVars,
  fitBoard,
  topBarContent,
} from "./chrome.ts";
import { BOARD } from "../game/constants.ts";

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
/** A tall phone: cutout at the top, home indicator at the bottom. */
const PORTRAIT: Insets = { top: 47, right: 0, bottom: 34, left: 0 };
/** The same phone on its side: the cutout becomes an inset on BOTH sides. */
const LANDSCAPE: Insets = { top: 0, right: 47, bottom: 21, left: 47 };
/** ...and the shape WebKit actually reports, with the cutout on one side only. */
const LANDSCAPE_ONE_SIDE: Insets = { top: 0, right: 0, bottom: 21, left: 47 };

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
  const rotated: Array<[string, Insets]> = [
    ["cutout at both sides", LANDSCAPE],
    ["cutout at one side", LANDSCAPE_ONE_SIDE],
  ];
  return [["no insets", NONE], ...(w > h ? rotated : [["cutout at the top", PORTRAIT] as [string, Insets]])];
}

/* -------------------------------------------------------------------------- */
/* The host's two corners.                                                    */
/* -------------------------------------------------------------------------- */

test("the status bar's contents never sit under the host's two controls", () => {
  // Embers is the currency and the pips are the forge's remaining life. Both
  // are in this bar and both are things a child reads constantly.
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      const box = topBarContent(w, h, insets);
      assert.equal(
        hitsHostChrome(box, w, insets),
        false,
        `${name} (${w}x${h}), ${label}: the status bar runs under the host's chrome`,
      );
    }
  }
});

test("the clearance is exactly one control and its margin, never a band", () => {
  assert.equal(CORNER_CLEAR, 54, "the clearance drifted from the host's own geometry");
  assert.ok(CORNER_CLEAR >= HOST_CONTROL, "the bar does not clear the control at all");
  // Horizontal only. Nothing here takes height from the board, which is what
  // broke a sibling game when a whole top strip was reserved instead.
  assert.equal(topBarContent(390, 844, NONE).y, 0, "the bar was pushed down — that is a band");
});

test("the bar still has room to say anything after paying for both corners", () => {
  // A clearance that leaves no room is not a fix, it is a different bug. This is
  // why the three switches moved to the anvil: with them still in the bar there
  // was not 196px of anything left on a 320px phone, and `overflow: hidden`
  // silently cut them off the right-hand edge rather than degrading.
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      const box = topBarContent(w, h, insets);
      assert.ok(
        box.w >= TOP_BAR_MIN,
        `${name} (${w}x${h}), ${label}: only ${box.w.toFixed(0)}px left for four figures and the core pips`,
      );
    }
  }
});

/* -------------------------------------------------------------------------- */
/* All four edges of the safe area, not just the top.                         */
/* -------------------------------------------------------------------------- */

test("the status bar stays inside the safe area on every edge", () => {
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      const safe = safeRect(w, h, insets);
      const box = topBarContent(w, h, insets);
      const where = `${name} (${w}x${h}), ${label}`;
      assert.ok(box.x >= safe.x, `${where}: the bar crosses the left inset`);
      assert.ok(box.x + box.w <= safe.x + safe.w + 1e-9, `${where}: the bar crosses the right inset`);
      assert.ok(box.y >= safe.y, `${where}: the bar crosses the top inset`);
    }
  }
});

test("the stylesheet honours all four edges, not only the two obvious ones", () => {
  // The original defect: `.sg-top` had `padding-top: env(...)` and `.sg-anvil`
  // had `padding-bottom: env(...)`, and that was the whole of it. Held sideways
  // the cutout is a SIDE inset.
  //
  // What this test USED to assert was `body.includes("env(safe-area-inset-…")`,
  // and that is a lesson worth leaving in the file. It passed on the day SIEGE
  // shipped its ember count under an Android status bar, because the rule was in
  // the stylesheet and resolved to zero: a pack frame is cross-origin and
  // `env()` belongs to the top-level document. A substring search proves the
  // text is present. It cannot tell you what the text evaluates to.
  //
  // So this now asserts the SHAPE of the fix — every edge is read from a
  // `--dw-safe-*` property, which is the only channel the host's measurement can
  // arrive on — and `safearea.test.ts` next door evaluates the stylesheet to
  // pixels at ten viewports and asserts the geometry.
  const css = read("./styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = (selector: string): string => {
    const at = css.indexOf(`${selector} {`);
    assert.ok(at >= 0, `${selector} is gone from the stylesheet`);
    const end = css.indexOf("}", at);
    return css.slice(at, end);
  };

  for (const [selector, edges] of [
    [".sg-top", ["top", "left", "right"]],
    [".sg-anvil", ["bottom", "left", "right"]],
  ] as const) {
    const body = rule(selector);
    for (const edge of edges) {
      assert.ok(
        body.includes(`var(--dw-safe-${edge},`),
        `${selector} does not read --dw-safe-${edge} — an inset it cannot get any other way`,
      );
    }
  }

  // And the bar's corner clearance is driven by the shared constant, not typed
  // into the stylesheet where it would rot the next time the host moves.
  assert.ok(rule(".sg-top").includes("var(--sg-corner"), ".sg-top does not read --sg-corner");
  assert.ok(chromeVars().includes(`--sg-corner:${CORNER_CLEAR}px`), "the custom property is not published");
  assert.ok(chromeVars().includes(`--sg-bar-pad:${BAR_PAD}px`), "the bar padding is not published");
});

test("the three switches are in the console, not in the corner the host paints over", () => {
  const hud = read("./hud.ts");
  const top = hud.slice(hud.indexOf("top.append("), hud.indexOf(");", hud.indexOf("top.append(")));
  for (const chip of ["callChip", "speedChip", "soundChip"]) {
    assert.ok(!top.includes(chip), `${chip} is back in the status bar`);
  }
  assert.ok(hud.includes('el("div", "sg-switches")'), "the switch row is gone from the anvil");
});

/* -------------------------------------------------------------------------- */
/* The playfield.                                                             */
/* -------------------------------------------------------------------------- */

test("the board square is fitted inside the safe box, sockets and all", () => {
  // A socket under a rounded corner is a tower a child cannot build: the tap
  // lands on nothing and they conclude the game is broken.
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, insets] of insetsFor(w, h)) {
      // The board element sits between the bar and the console, so it owns the
      // side insets and neither of the vertical ones.
      const boardH = Math.max(80, Math.round(h * 0.45));
      const safe = boardSafe(w, boardH, insets);
      const v = fitBoard(w, boardH, 1, safe);
      const where = `${name} (${w}x${boardH}), ${label}`;
      assert.ok(v.scale > 0, `${where}: the board collapsed`);
      assert.ok(v.ox >= safe.x - 1e-9, `${where}: the board runs into the left cutout`);
      assert.ok(
        v.ox + BOARD * v.scale <= safe.x + safe.w + 1e-9,
        `${where}: the board runs into the right cutout`,
      );
      assert.ok(v.oy >= -1e-9 && v.oy + BOARD * v.scale <= boardH + 1e-9, `${where}: the board leaves its element`);
    }
  }
});

test("the board fit obeys the safe box by construction, not by luck", () => {
  // Honesty about what this one is worth: on every shape the fleet has today the
  // board is HEIGHT-limited, and the insets are near enough symmetric, so
  // honouring the safe box changes the fit by nothing at all. That is not a
  // reason to fit against the element instead. It is one screen shape — a split
  // view, a foldable, a future cutout — away from being a socket under a rounded
  // corner, which is a tower a child taps and cannot build.
  //
  // So this asserts the argument is load-bearing rather than decorative: a safe
  // box the fit must actually obey, and a fit that would be different if it did
  // not.
  const safe = { x: 160, y: 0, w: 280, h: 900 };
  const v = fitBoard(600, 900, 1, safe);
  assert.ok(v.ox >= safe.x - 1e-9, "the board starts left of the safe box");
  assert.ok(v.ox + BOARD * v.scale <= safe.x + safe.w + 1e-9, "the board runs past the safe box");

  const ignoringSafe = fitBoard(600, 900, 1, { x: 0, y: 0, w: 600, h: 900 });
  assert.notEqual(v.scale, ignoringSafe.scale, "the fit ignored the safe box's width");
  assert.notEqual(v.ox, ignoringSafe.ox, "the fit ignored the safe box's origin");
});

test("with no insets the board is fitted exactly as it always was", () => {
  // The safe-area work must be a no-op on a device with no insets, or it is not
  // a fix, it is a redesign.
  const v = fitBoard(900, 500, 2, boardSafe(900, 500, NONE));
  const pad = 6;
  const scale = Math.min((900 - pad * 2) / BOARD, (500 - pad * 2) / BOARD);
  assert.equal(v.scale, scale);
  assert.equal(v.ox, (900 - BOARD * scale) / 2);
  assert.equal(v.oy, (500 - BOARD * scale) / 2);
});

/* -------------------------------------------------------------------------- */
/* The gesture guards SIEGE was the only pack of 27 missing.                   */
/* -------------------------------------------------------------------------- */

test("both entries block the double-tap that scales and pans the host document", () => {
  // SIEGE shipped without `maximum-scale=1` and without `touch-action: none`,
  // alone among 27 packs. A double tap inside the pack could zoom and then pan
  // the whole host document, and there is no way for a child to undo that.
  for (const entry of ["../../pack.html", "../../index.html"]) {
    const html = read(entry).replace(/\s+/g, " ");
    for (const needle of [
      "maximum-scale=1",
      "user-scalable=no",
      "viewport-fit=cover",
      "touch-action: none",
      "overscroll-behavior: none",
      "user-select: none",
    ]) {
      assert.ok(html.includes(needle), `${entry} is missing ${needle}`);
    }
  }
});
