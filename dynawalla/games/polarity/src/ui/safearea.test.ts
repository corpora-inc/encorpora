/**
 * The safe area, asserted against the SHIPPED stylesheet rather than against the
 * model of it.
 *
 * **Why this file exists.** `layout.test.ts` next door proves `hudRects` clears
 * a 47px notch, and it was passing on the day `.pol-hud` was padding 10px on
 * every device in the world. The two had come apart: `hudRects` took the insets
 * as an argument, and `styles.css` asked `env(safe-area-inset-*)` — which, in an
 * iframe sandboxed `allow-scripts` with no `allow-same-origin`, is the number
 * zero, because `env()` belongs to the top-level browsing context and a
 * cross-origin child sees none of it. `max(10px, env(...))` is 10px, always.
 *
 * So this file parses `styles.css`, runs the cascade for a viewport, and
 * evaluates every offset to a NUMBER with `env()` defined as ZERO — the
 * environment the game runs in — then asserts the number the CSS produces is the
 * number `hudRects` promised. Text being present in a file proves nothing about
 * what it resolves to; that is how this shipped.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  hitsHostChrome,
  safeRect,
  type Insets,
  type Rect,
  type StyleTarget,
} from "../../../../packs/shared/game-chrome/index.ts";
import {
  SHAPES,
  customPropsOf,
  envReadDirectly,
  lengthOf,
  paddingOf,
  parseCss,
  type Viewport,
} from "../../../../packs/shared/game-chrome/cssSafeArea.ts";
import { MINI, MINI_GAP, SAFE_PREFIX, applySafeVars, applyChromeVars, hudRects } from "./layout.ts";

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const CSS = read("./styles.css");
const RULES = parseCss(CSS);

/**
 * Everything in scope on `.pol-root` — the gutters the stylesheet declares
 * there, then the safe area and the chrome geometry the game writes over them
 * as inline style. Custom properties inherit, so all of it reaches every rule
 * below.
 */
function published(insets: Insets, vp: Viewport): Map<string, string> {
  const vars = customPropsOf(RULES, ".pol-root", vp);
  const stub: StyleTarget = {
    style: { setProperty: (name: string, value: string): void => void vars.set(name, value) },
  };
  applySafeVars(stub, insets);
  // `applyChromeVars` types its argument as an HTMLElement because that is what
  // the game hands it; it touches nothing but `style.setProperty`.
  applyChromeVars(stub as unknown as HTMLElement);
  return vars;
}

const css = (
  selector: string,
  prop: string,
  s: { w: number; h: number; insets: Insets },
  pct = 0,
): number =>
  lengthOf(RULES, selector, prop, { w: s.w, h: s.h }, published(s.insets, { w: s.w, h: s.h }), pct);

const pad = (selector: string, s: { w: number; h: number; insets: Insets }): Record<
  "top" | "right" | "bottom" | "left",
  number
> => paddingOf(RULES, selector, { w: s.w, h: s.h }, published(s.insets, { w: s.w, h: s.h }));

const close = (got: number, want: number, msg: string): void => {
  assert.ok(Math.abs(got - want) < 1e-9, `${msg}: the stylesheet says ${got}, layout.ts says ${want}`);
};

const inside = (r: Rect, safe: Rect, where: string, what: string): void => {
  assert.ok(r.x >= safe.x - 1e-9, `${where}: ${what} crosses the LEFT inset (${r.x} < ${safe.x})`);
  assert.ok(
    r.x + r.w <= safe.x + safe.w + 1e-9,
    `${where}: ${what} crosses the RIGHT inset (${r.x + r.w} > ${safe.x + safe.w})`,
  );
  assert.ok(r.y >= safe.y - 1e-9, `${where}: ${what} crosses the TOP inset (${r.y} < ${safe.y})`);
  assert.ok(
    r.y + r.h <= safe.y + safe.h + 1e-9,
    `${where}: ${what} crosses the BOTTOM inset (${r.y + r.h} > ${safe.y + safe.h})`,
  );
};

/* ========================================================================== */
/* The two dialects agree                                                     */
/* ========================================================================== */

test("the register's padding is exactly the padding hudRects was tested against", () => {
  // The bug as one assertion. Everything `layout.test.ts` proves about the score
  // and the shield pips is a claim about `.pol-hud`'s padding; until the
  // stylesheet produced the same four numbers, it was a claim about nothing.
  for (const s of SHAPES) {
    const r = hudRects(s.w, s.h, s.insets);
    const p = pad(".pol-hud", s);
    close(p.top, r.top.y, `${s.name}: the register's top padding`);
    close(p.left, r.top.x, `${s.name}: the register's left padding`);
    close(p.right, s.w - (r.top.x + r.top.w), `${s.name}: the register's right padding`);
    close(p.bottom, s.h - (r.padFlip.y + r.padFlip.h), `${s.name}: the register's bottom padding`);
  }
});

test("the sound and pause buttons land where hudRects puts them", () => {
  for (const s of SHAPES) {
    const r = hudRects(s.w, s.h, s.insets);
    close(css(".pol-mini", "top", s), r.mini.y, `${s.name}: the mini controls' top edge`);
    close(
      s.w - css(".pol-mini", "right", s) - (MINI * 2 + MINI_GAP),
      r.mini.x,
      `${s.name}: the mini controls' left edge`,
    );
  }
});

/* ========================================================================== */
/* …and what the CSS produces is inside the safe area, and clear of the host   */
/* ========================================================================== */

test("the register's contents are inside the safe area at every shape", () => {
  for (const s of SHAPES) {
    const p = pad(".pol-hud", s);
    const box: Rect = {
      x: p.left,
      y: p.top,
      w: s.w - p.left - p.right,
      h: Math.max(0, s.h - p.top - p.bottom),
    };
    inside(box, safeRect(s.w, s.h, s.insets), s.name, "the register");
  }
});

test("the score, the pips and the touch pads never sit under the host's two controls", () => {
  // The register's content box is the frame minus its padding, and the top row
  // and the pads live at its two ends. Both are built from the CSS numbers here,
  // not from the model.
  for (const s of SHAPES) {
    const p = pad(".pol-hud", s);
    const r = hudRects(s.w, s.h, s.insets);
    const top: Rect = { x: p.left, y: p.top, w: s.w - p.left - p.right, h: r.top.h };
    assert.equal(
      hitsHostChrome(top, s.w, s.insets),
      false,
      `${s.name}: the score and the shield pips run under the host's chrome`,
    );
    const mini: Rect = {
      x: s.w - css(".pol-mini", "right", s) - (MINI * 2 + MINI_GAP),
      y: css(".pol-mini", "top", s),
      w: MINI * 2 + MINI_GAP,
      h: MINI,
    };
    inside(mini, safeRect(s.w, s.h, s.insets), s.name, "the sound and pause buttons");
    assert.equal(
      hitsHostChrome(mini, s.w, s.insets),
      false,
      `${s.name}: the game's own buttons are under the host's how-to-play control`,
    );
  }
});

test("the key hint clears every inset", () => {
  for (const s of SHAPES) {
    for (const side of ["bottom", "left", "right"] as const) {
      const v = css(".pol-keyhint", side, s);
      assert.ok(
        v >= s.insets[side] - 1e-9,
        `${s.name}: the key hint sits ${v}px from the ${side} edge, inside a ${s.insets[side]}px inset`,
      );
    }
  }
});

test("the veil keeps the REPOLARIZE orbs inside the safe area", () => {
  // The veil carries the answer orbs, which a child taps. In landscape on a
  // notched phone the outermost orb ran under the sensor housing.
  for (const s of SHAPES) {
    const p = pad(".pol-veil", s);
    const box: Rect = {
      x: p.left,
      y: p.top,
      w: s.w - p.left - p.right,
      h: Math.max(0, s.h - p.top - p.bottom),
    };
    inside(box, safeRect(s.w, s.h, s.insets), s.name, "the veil's contents");
  }
});

test("a breakpoint cannot quietly delete a safe-area padding", () => {
  // SIEGE's second defect, guarded before it happens here: a `padding:`
  // shorthand resets all four longhands, so a media query that only wanted a
  // tighter gutter throws the safe area away with it. Both padded surfaces are
  // driven by a custom property for exactly that reason.
  for (const rule of RULES) {
    for (const sel of [".pol-hud", ".pol-veil"]) {
      if (!rule.selectors.includes(sel)) continue;
      assert.ok(
        !rule.decls.some((d) => d.prop === "padding"),
        `${sel} uses a \`padding:\` shorthand — a breakpoint can now erase its safe area`,
      );
    }
  }
  // …and the numbers hold at the shapes a media query does apply to.
  for (const s of SHAPES) {
    for (const sel of [".pol-hud", ".pol-veil"]) {
      const p = pad(sel, s);
      for (const side of ["top", "right", "bottom", "left"] as const) {
        assert.ok(
          p[side] >= s.insets[side] - 1e-9,
          `${s.name}: ${sel}'s ${side} padding is ${p[side]}px for a ${s.insets[side]}px inset`,
        );
      }
    }
  }
});

/* ========================================================================== */
/* The seam itself                                                            */
/* ========================================================================== */

test("no rule takes its answer from env() — it is zero where this game runs", () => {
  const offenders = envReadDirectly(CSS, SAFE_PREFIX);
  assert.deepEqual(offenders, [], offenders.join("\n"));
  assert.ok(
    CSS.includes("env(safe-area-inset-top"),
    "the dev-harness fallbacks are gone entirely — a browser tab with no host now gets nothing",
  );
});

test("the safe area is published as four properties, zeros written out", () => {
  const vars = published({ top: 24, right: 0, bottom: 48, left: 0 }, { w: 393, h: 851 });
  for (const [name, want] of [
    [`${SAFE_PREFIX}top`, "24px"],
    [`${SAFE_PREFIX}right`, "0px"],
    [`${SAFE_PREFIX}bottom`, "48px"],
    [`${SAFE_PREFIX}left`, "0px"],
  ] as const) {
    assert.equal(vars.get(name), want, `${name} was not published`);
  }
  // A zero must be WRITTEN, not omitted: an absent custom property falls through
  // to the `env()` beside it, which is the bug this file is about.
  assert.equal(vars.get(`${SAFE_PREFIX}right`), "0px", "a zero inset was left for env() to answer");
});

test("the game publishes the safe area at mount and again on every resize", () => {
  // A wiring check, and only that — the arithmetic above cannot see whether
  // anything ever calls the publisher, and without these calls the stylesheet
  // reads four unset properties and falls through to an `env()` of zero.
  const hud = read("./hud.ts");
  assert.ok(hud.includes("applySafeVars(this.root)"), "the HUD never publishes the safe area at mount");
  const mount = read("../mount.ts");
  const at = mount.indexOf("function measure()");
  assert.ok(at > 0, "measure() is gone");
  const body = mount.slice(at, mount.indexOf("\n  }", at));
  assert.ok(body.includes("hud.setInsets(safeInsets())"), "measure() never republishes the safe area");
  assert.ok(
    mount.includes("onInsetsChange(() => measure())"),
    "nothing listens for the insets changing — the register keeps the shape the pack opened in",
  );
  assert.ok(mount.includes("stopInsets()"), "the inset listener outlives the pack");
});
