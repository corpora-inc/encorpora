/**
 * The room the host leaves SIEGE, and what the pack promises about it.
 *
 * **The defect that survived the first pass.** SIEGE read
 * `env(safe-area-inset-*)` from `styles.css` and believed that was the fix. It
 * is not, and inside the shipped app it is not even close: a pack runs in an
 * iframe sandboxed `allow-scripts` with no `allow-same-origin`, and
 * `env(safe-area-inset-*)` is a property of the TOP-LEVEL browsing context. A
 * cross-origin child resolves all four to **zero**. Every rule in the
 * stylesheet therefore collapsed to its 8px/10px fallback, and on a 1080x2340
 * Android phone the ember count was painted under the OS status bar and the
 * overcharge lever under the three-button navigation bar. The canvas was fine
 * the whole time, because `mount.ts` fitted the board against `safeInsets()` —
 * the DOM half of the same game disagreed with the canvas half about where the
 * screen was.
 *
 * So the numbers now arrive the only way they can: as an ARGUMENT from the
 * host, through `game-chrome`'s `safeInsets()`, published onto the root as four
 * custom properties by `applySafeVars` below. `styles.css` reads
 * `var(--sg-safe-top, env(safe-area-inset-top, 0px))` — the property inside the
 * app, the `env()` only in a dev browser tab where it happens to be right.
 *
 * **The half-fix before that.** `.sg-top` honoured `--top` and `.sg-anvil`
 * honoured `--bottom`, and **neither side was touched at all**.
 * `viewport-fit=cover` opts a document into the rounded corners and the display
 * cutout on every edge, not just the one that is obvious in portrait. Held
 * sideways the ember count and the sound switch sat under the cutout, which is
 * a currency a child cannot read and a control they cannot press.
 *
 * The second encroachment is the host's own chrome: an exit control over the
 * top-LEFT 44px corner and a how-to-play control over the top-RIGHT one. SIEGE's
 * status bar runs the full width of exactly that row. The ember count was under
 * the first control and the sound switch under the second.
 *
 * **The chrome overlays; nothing reserves a band.** The status bar keeps its
 * height, the board keeps its size, the forge behind them still reaches the
 * glass. What changes is that the bar's *contents* start after the left control
 * and stop before the right one — and, because that bar was already over-full
 * on a small phone and silently clipping its own switches off the right edge,
 * the three chips move down to the anvil where there is room for them.
 *
 * Everything here is arithmetic over a viewport and a set of insets, so
 * `chrome.test.ts` can assert it at every shape the fleet has rather than the
 * bug being found on a device.
 */

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  NO_INSETS,
  safeInsets,
  safeRect,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts";
import { BOARD } from "../game/constants.ts";

/**
 * How much room a host control needs at its own end of the status bar.
 *
 * The control's margin plus the control. Derived from the shared constants
 * rather than typed out, so if the host moves its chrome this pack follows on
 * the next build instead of drifting away from it.
 */
export const CORNER_CLEAR = HOST_MARGIN + HOST_CONTROL;

/** The status bar's own margin from whatever edge it ends up against. */
export const BAR_PAD = 10;

/**
 * Down from the SAFE top edge to the bottom of the host's row of controls.
 *
 * Anything that must be read and is laid out across the full width — a banner,
 * the defeat card — starts below this, because it cannot dodge the two corners
 * sideways the way the status bar does.
 */
export const CHROME_BOTTOM = HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL;

/**
 * The box the status bar's contents may use.
 *
 * `insets` is required, not defaulted. An optional safe area is a game that
 * forgets to pass one, compiles clean, and puts its currency under a button —
 * a defect that exists only on hardware, which is the worst place to find one.
 */
export function topBarContent(w: number, h: number, insets: Insets): Rect {
  const safe = safeRect(w, h, insets);
  const x = safe.x + CORNER_CLEAR;
  const right = safe.x + safe.w - CORNER_CLEAR;
  return {
    x,
    y: safe.y,
    w: Math.max(0, right - x),
    // The bar is a row of ~34px controls with 8px of air above and below. Its
    // height is unchanged by any of this; only its width is given up.
    h: 50,
  };
}

/**
 * The narrowest the bar's contents can be squeezed and still say anything.
 *
 * Four figures — embers, damage per second, wave, incoming hit points — and a
 * strip of core pips. Below this the bar is not compact, it is broken, and the
 * three chips that used to live here have to be somewhere else. They are: they
 * are in the anvil.
 */
export const TOP_BAR_MIN = 196;

/**
 * The playfield's letterbox, inside the side insets.
 *
 * The board is a square fitted to the shorter axis and centred, so on most
 * shapes it never reaches the cutout on its own. "Most" is not "every", and a
 * socket under a rounded corner is a tower a child cannot build, so the fit is
 * done inside the safe box rather than inside the element.
 *
 * The board element's own background still bleeds to the glass. That is the
 * point of `cover` and it should stay.
 */
export function boardSafe(w: number, h: number, insets: Insets): Rect {
  return {
    x: Math.min(insets.left, w),
    y: 0,
    w: Math.max(0, w - Math.min(insets.left, w) - Math.min(insets.right, w)),
    h,
  };
}

/**
 * The CSS the stylesheet cannot express on its own.
 *
 * How wide a host control is, and how far in the bar's own margin sits. Written
 * in from the shared constants so the pack follows if the host moves its chrome.
 * These are fixed for the life of the pack, so they can live in a `<style>` tag;
 * the safe area cannot, and goes through `applySafeVars` instead.
 */
export function chromeVars(): string {
  return `.sg{--sg-corner:${CORNER_CLEAR}px;--sg-bar-pad:${BAR_PAD}px;--sg-chrome-bottom:${CHROME_BOTTOM}px}`;
}

/** The four custom properties `styles.css` does its safe-area arithmetic with. */
export const SAFE_VARS = ["--sg-safe-top", "--sg-safe-right", "--sg-safe-bottom", "--sg-safe-left"] as const;

/** The narrow slice of an element this needs — so a test can drive it with a stub. */
export type StyleTarget = { style: { setProperty(name: string, value: string): void } };

/**
 * Hand the stylesheet the safe area, as four lengths it can do arithmetic with.
 *
 * Zeros are written EXPLICITLY rather than left unset. `var(--sg-safe-top, …)`
 * falls back to its `env()` only when the property is absent, and inside the app
 * `env()` is the wrong answer even when the true inset happens to be zero — it
 * is the wrong answer *especially* then, because it is indistinguishable from
 * the right one until the child picks up a phone with a notch.
 *
 * @returns whether anything actually changed, so a caller on a resize path can
 *   avoid touching style it did not need to touch.
 */
export function applySafeVars(
  root: StyleTarget,
  insets: Insets = safeInsets(),
  previous?: Insets | null,
): boolean {
  const i = insets ?? NO_INSETS;
  const now: Insets = {
    top: Math.max(0, i.top),
    right: Math.max(0, i.right),
    bottom: Math.max(0, i.bottom),
    left: Math.max(0, i.left),
  };
  if (
    previous &&
    previous.top === now.top &&
    previous.right === now.right &&
    previous.bottom === now.bottom &&
    previous.left === now.left
  ) {
    return false;
  }
  root.style.setProperty("--sg-safe-top", `${now.top}px`);
  root.style.setProperty("--sg-safe-right", `${now.right}px`);
  root.style.setProperty("--sg-safe-bottom", `${now.bottom}px`);
  root.style.setProperty("--sg-safe-left", `${now.left}px`);
  return true;
}

/** What `computeView` hands the renderer. Declared here so the fit can be tested. */
export type BoardFit = { w: number; h: number; dpr: number; scale: number; ox: number; oy: number };

/**
 * Fit the square board into its element, inside the safe box.
 *
 * The fit lives here rather than in `draw.ts` for one blunt reason: `draw.ts`
 * pulls in `particles.ts`, whose `const enum` node's strip-only TypeScript
 * loader refuses outright, so nothing that imports the renderer can be reached
 * from a test. Geometry that cannot be tested is geometry that is wrong on a
 * device, which is exactly the class of bug this file exists for.
 */
export function fitBoard(
  cssW: number,
  cssH: number,
  dpr: number,
  safe: Rect,
): BoardFit {
  const pad = 6;
  const bw = Math.max(1, safe.w - pad * 2);
  const bh = Math.max(1, safe.h - pad * 2);
  const scale = Math.min(bw / BOARD, bh / BOARD);
  return {
    w: cssW,
    h: cssH,
    dpr,
    scale,
    ox: safe.x + (safe.w - BOARD * scale) / 2,
    oy: safe.y + (safe.h - BOARD * scale) / 2,
  };
}
