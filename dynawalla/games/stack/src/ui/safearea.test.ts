/**
 * The safe area, asserted against the SHIPPED stylesheet rather than against the
 * model of it.
 *
 * **Why this file exists.** `place.test.ts` next door is a good test of the
 * wrong thing. It feeds `hudRects(w, h, insets)` a 59px status bar and proves
 * the floor count clears it — and it was passing on the day the shipped rule put
 * that same floor count at 13px down the screen, under an Android clock. The two
 * dialects `place.ts` owns had come apart: the numeric one knew about the notch
 * and the CSS one asked `env(safe-area-inset-top)`, which inside a pack frame is
 * the number zero. A pack is an iframe sandboxed `allow-scripts` with no
 * `allow-same-origin`; `env()` belongs to the top-level browsing context and a
 * cross-origin child reads all four as 0.
 *
 * So this file does not check text and does not re-derive geometry. It PARSES
 * the stylesheet `hud.ts` actually injects, runs the cascade for a viewport, and
 * evaluates every chrome offset to a NUMBER with `env()` defined as zero — the
 * environment the game runs in. Then it asserts the number the CSS produces is
 * the number `hudRects` promised. The two dialects cannot drift again without
 * this failing.
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
  envReadDirectly,
  lengthOf,
  paddingOf,
  parseCss,
} from "../../../../packs/shared/game-chrome/cssSafeArea.ts";
import { CSS } from "./hud.ts";
import {
  CHROME_TOP,
  SAFE_PREFIX,
  TOOL_EDGE,
  TOOL_SIZE,
  applySafeVars,
  hudRects,
  promptHalf,
} from "./place.ts";

const RULES = parseCss(CSS);

/** The four properties the running game writes onto the HUD root. */
function published(insets: Insets): Map<string, string> {
  const vars = new Map<string, string>();
  const stub: StyleTarget = {
    style: { setProperty: (name: string, value: string): void => void vars.set(name, value) },
  };
  applySafeVars(stub, insets);
  return vars;
}

/** A length from the stylesheet, at a viewport, as the browser would resolve it. */
const css = (
  selector: string,
  prop: string,
  s: { w: number; h: number; insets: Insets },
  pct = 0,
): number => lengthOf(RULES, selector, prop, { w: s.w, h: s.h }, published(s.insets), pct);

/**
 * Equal to within a float's worth of noise.
 *
 * `(min(w,h) * vmin) / 100` and `(vmin / 100) * min(w,h)` are the same number
 * and not the same double. The tolerance is 1e-9 of a CSS pixel: it cannot hide
 * a layout defect and it cannot fail on the order of two multiplications.
 */
const close = (got: number, want: number, msg: string): void => {
  assert.ok(
    Math.abs(got - want) < 1e-9,
    `${msg}: the stylesheet says ${got}, hudRects says ${want}`,
  );
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

test("the stylesheet puts the readouts exactly where hudRects says they are", () => {
  // The bug, as one assertion. `place.test.ts` proves the RIGHT-hand side of
  // each of these clears the notch; until the stylesheet produced the same
  // number, that proof was about a layout nobody shipped.
  for (const s of SHAPES) {
    const r = hudRects(s.w, s.h, s.insets);
    close(css(".mn-floor", "top", s), r.floor.y, `${s.name}: the floor count's top edge`);
    close(css(".mn-floor", "left", s), r.floor.x, `${s.name}: the floor count's left edge`);
    close(css(".mn-best", "top", s), r.best.y, `${s.name}: the best score's top edge`);
    close(
      s.w - css(".mn-best", "right", s),
      r.best.x + r.best.w,
      `${s.name}: the best score's right edge`,
    );
    close(
      s.w - css(".mn-tools", "right", s),
      r.tools.x + r.tools.w,
      `${s.name}: the sound button's right edge`,
    );
    close(
      s.h - css(".mn-tools", "bottom", s) - TOOL_SIZE,
      r.tools.y,
      `${s.name}: the sound button's top edge`,
    );
    // The plate is centred on its own `top`, so the CSS number is its centre.
    close(
      css(".mn-prompt", "top", s, s.h),
      r.prompt.y + promptHalf(s.w, s.h),
      `${s.name}: the equation plate's centre`,
    );
  }
});

/* ========================================================================== */
/* …and what the CSS produces is inside the safe area                         */
/* ========================================================================== */

test("every readout the stylesheet places is inside the safe area", () => {
  for (const s of SHAPES) {
    const safe = safeRect(s.w, s.h, s.insets);
    const r = hudRects(s.w, s.h, s.insets);
    const floor: Rect = { x: css(".mn-floor", "left", s), y: css(".mn-floor", "top", s), w: r.floor.w, h: r.floor.h };
    const best: Rect = {
      x: s.w - css(".mn-best", "right", s) - r.best.w,
      y: css(".mn-best", "top", s),
      w: r.best.w,
      h: r.best.h,
    };
    const tools: Rect = {
      x: s.w - css(".mn-tools", "right", s) - TOOL_SIZE,
      y: s.h - css(".mn-tools", "bottom", s) - TOOL_SIZE,
      w: TOOL_SIZE,
      h: TOOL_SIZE,
    };
    inside(floor, safe, s.name, "the floor count");
    inside(best, safe, s.name, "the best score");
    inside(tools, safe, s.name, "the sound button");
    for (const [what, box] of [["the floor count", floor], ["the best score", best], ["the sound button", tools]] as const) {
      assert.equal(
        hitsHostChrome(box, s.w, s.insets),
        false,
        `${s.name}: ${what} is under the host's exit or how-to-play control`,
      );
    }
  }
});

test("the tool row keeps a full 40px button clear of the bottom inset", () => {
  // The home indicator is a system gesture area, not just an ugly place to draw:
  // a button whose lower edge is inside it is a button a child presses and the
  // OS answers.
  for (const s of SHAPES) {
    const bottom = css(".mn-tools", "bottom", s);
    assert.ok(
      bottom >= s.insets.bottom + TOOL_EDGE - 1e-9,
      `${s.name}: the sound button sits ${bottom}px up, inside a ${s.insets.bottom}px inset`,
    );
  }
});

test("the tap hint clears the bottom inset", () => {
  for (const s of SHAPES) {
    const bottom = css(".mn-hint", "bottom", s, s.h);
    assert.ok(
      bottom >= s.insets.bottom - 1e-9,
      `${s.name}: the hint sits ${bottom}px up, inside a ${s.insets.bottom}px inset`,
    );
  }
});

test("the stratum banner's text stays out of the side insets", () => {
  // The banner spans the full width, so it cannot dodge a landscape cutout
  // sideways — its padding is the only thing keeping the stratum name legible.
  for (const s of SHAPES) {
    const left = css(".mn-band", "padding-left", s);
    const right = css(".mn-band", "padding-right", s);
    assert.ok(
      left >= s.insets.left - 1e-9,
      `${s.name}: the banner's left padding is ${left}px for a ${s.insets.left}px inset`,
    );
    assert.ok(
      right >= s.insets.right - 1e-9,
      `${s.name}: the banner's right padding is ${right}px for a ${s.insets.right}px inset`,
    );
  }
});

test("the end-of-run card keeps its question and its buttons inside the safe area", () => {
  // This card carries the revive question and the answer buttons — the most
  // important thing to touch in the whole game, and it is full-bleed.
  for (const s of SHAPES) {
    const pad = paddingOf(RULES, ".mn-over", { w: s.w, h: s.h }, published(s.insets));
    const box: Rect = {
      x: pad.left,
      y: pad.top,
      w: s.w - pad.left - pad.right,
      h: s.h - pad.top - pad.bottom,
    };
    inside(box, safeRect(s.w, s.h, s.insets), s.name, "the end-of-run card");
  }
});

test("a breakpoint cannot quietly delete the card's safe-area padding", () => {
  // SIEGE's second defect, guarded here before it happens: a `padding:`
  // shorthand resets all four longhands, so a media query that only wanted a
  // tighter gutter throws the safe area away with it. The card's gutter is a
  // custom property for exactly that reason.
  for (const rule of RULES) {
    if (!rule.selectors.includes(".mn-over")) continue;
    assert.ok(
      !rule.decls.some((d) => d.prop === "padding"),
      "the end-of-run card uses a `padding:` shorthand again — a breakpoint can now erase the safe area",
    );
  }
  for (const s of SHAPES) {
    const pad = paddingOf(RULES, ".mn-over", { w: s.w, h: s.h }, published(s.insets));
    for (const side of ["top", "right", "bottom", "left"] as const) {
      assert.ok(
        pad[side] >= s.insets[side] - 1e-9,
        `${s.name}: the card's ${side} padding is ${pad[side]}px for a ${s.insets[side]}px inset`,
      );
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
  const vars = published({ top: 24, right: 0, bottom: 48, left: 0 });
  assert.deepEqual(
    [...vars.entries()].sort(),
    [
      [`${SAFE_PREFIX}bottom`, "48px"],
      [`${SAFE_PREFIX}left`, "0px"],
      [`${SAFE_PREFIX}right`, "0px"],
      [`${SAFE_PREFIX}top`, "24px"],
    ],
  );
  // A zero must be WRITTEN, not omitted: an absent custom property falls through
  // to the `env()` beside it, which is the bug this file is about.
  assert.equal(vars.get(`${SAFE_PREFIX}right`), "0px", "a zero inset was left for env() to answer");
});

test("the host's own geometry is where the top row's offset comes from", () => {
  // Not typed in: if the host moves its chrome, this game follows on the next
  // build rather than on the next bug report.
  const s = SHAPES[0] as (typeof SHAPES)[number];
  assert.equal(css(".mn-floor", "top", s), s.insets.top + CHROME_TOP);
});

test("the game publishes the safe area at mount and again on every resize", () => {
  // A wiring check, and only that — everything above is arithmetic and none of
  // it can see whether anything ever calls the publisher. Without these two
  // calls the stylesheet reads four unset properties and falls through to an
  // `env()` that answers zero, which is precisely the shipped bug.
  const hud = readSrc("./hud.ts");
  assert.ok(hud.includes("applySafeVars(d)"), "the HUD never publishes the safe area at mount");
  const mount = readSrc("../game/mount.ts");
  const at = mount.indexOf("function resize()");
  assert.ok(at > 0, "resize() is gone");
  const body = mount.slice(at, mount.indexOf("\n  }", at));
  assert.ok(body.includes("hud.setInsets(safeInsets())"), "resize() never republishes the safe area");
  assert.ok(
    mount.includes("onInsetsChange(() => resize())"),
    "nothing listens for the insets changing — the HUD keeps the shape the pack opened in",
  );
  assert.ok(mount.includes("stopInsets()"), "the inset listener outlives the pack");
});

function readSrc(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}
