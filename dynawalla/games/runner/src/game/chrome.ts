/**
 * Where VOLTA is allowed to put things a child has to read or touch.
 *
 * Three separate encroachments, all invisible in a browser window and all
 * certain on a device:
 *
 * **The safe area.** `pack.html` declares `viewport-fit=cover`, which is not a
 * neutral setting — it opts the document *into* the display cutout, the home
 * indicator and the rounded corners. A DOM rule can claw that back with
 * `env(safe-area-inset-*)`; the causeway cannot, because the numerals are drawn
 * by a shader in NDC and a shader has never heard of `env()`. Held sideways, a
 * phone's cutout is about 47 CSS pixels of an 844-wide viewport — five and a
 * half per cent — while the read band's page margin was a flat three per cent.
 * The outer candidate therefore reached roughly twenty pixels into the cutout.
 * In this game the outer candidate is an answer.
 *
 * **The host's chrome.** The app paints an exit control top-left, a how-to-play
 * control top-right, and a progress hairline across the top, over the pack.
 * VOLTA put its score in one of those corners and its surge meter in the other,
 * so both readouts shipped underneath a button.
 *
 * **The system's bottom edge.** Android's gesture-navigation handle eats a strip
 * of the bottom of the glass and reports a safe-area inset of ZERO on plenty of
 * devices, so a bar placed correctly inside the reported safe area is still
 * under it. `games/pulse` hit this and named the allowance; VOLTA now carries
 * the same one. See `GESTURE_STRIP`.
 *
 * The chrome *overlays* — it does not reserve a band, and this file must not
 * pretend it does. The causeway, the sky and the ocean still bleed to all four
 * edges; that is the entire point of `cover`. Only the readouts move.
 *
 * ── one source of truth, because the last two were not ──────────────────────
 *
 * The first version of this file was arithmetic that *described* the stylesheet:
 * `readoutRect` computed what `hud.ts` was believed to resolve to, and the tests
 * asserted against the arithmetic. They were not the same thing, and the
 * disagreement was the whole bug. `hud.ts` wrote
 * `top: calc(env(safe-area-inset-top) + 63px)`, and **`env()` is zero inside a
 * pack**: the frame is sandboxed `allow-scripts` with no `allow-same-origin`, and
 * the safe-area environment variables belong to the TOP-LEVEL browsing context,
 * so a cross-origin child resolves all four to 0. The host measures the real
 * values and posts them; `safeInsets()` returns those. So the arithmetic here was
 * handed a 24px top inset by the test, and the CSS on the device was handed 0 —
 * a row the test placed at y = 87 painted at y = 63, eighteen pixels under the
 * exit chevron, and the test passed.
 *
 * The fix is not a better test. It is that the stylesheet no longer computes any
 * position at all: every box below is produced *here*, by `hudBoxes`, and written
 * onto the root as custom properties by `hudVars`. There is nothing left for the
 * CSS to disagree with, and `chrome.test.ts` asserts that too — no `env()`
 * anywhere in the sheet, and every positional declaration on the five HUD boxes
 * is a `var()`.
 */

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts";
import { BAND, type Frame } from "./readband.ts";

/* --------------------------------- the stage ------------------------------ */

/** The colour of an empty causeway, so a resize never flashes white. */
export const STAGE_BG = "#04060f";

/**
 * Just enough of an element for `makeStage`: the inline style it writes.
 *
 * Structural rather than `HTMLElement` so a test can hand it an object literal
 * and read back exactly what was written, with no cast and no DOM.
 */
export type StageEl = {
  style: { position: string; overflow: string; touchAction: string; background: string };
};

/**
 * Take the host's element over as VOLTA's stage.
 *
 * Everything this game draws — the WebGL canvas and every HUD layer — is
 * `position:absolute; inset:0`, so the stage is the only node in the tree that
 * has a size of its own, and it is the host *document* that decides what that
 * size is. This function's whole job is to not take that away.
 *
 * **What it replaces shipped a black screen on every device.** The line was
 *
 *     el.style.position = el.style.position || "relative";
 *
 * and `el.style.position` reads the *inline* declaration, which is empty for an
 * element positioned from a stylesheet. `pack.html` says
 * `#app { position: fixed; inset: 0 }`, so the fallback always fired and wrote
 * an inline `relative` that won the cascade — taking the `inset: 0` with it,
 * because insets do nothing to a relatively positioned box. The stage fell back
 * to `height: auto` with nothing but absolutely positioned children inside it,
 * measured 820x0, and the canvas came out one CSS pixel tall. Measured in a
 * framed pack: `#app` 820x0, canvas `style="width:820px;height:1px"`.
 *
 * It was invisible in `npm run dev` for one reason. `index.html` gives `#game`
 * `width:100%; height:100%` as well as a position, and a percentage height still
 * resolves against `body` once the position is overwritten — so the dev harness
 * is full-size and the pack entry, which has only `inset: 0` to give it a box, is
 * not. Only the thing a child runs collapses.
 *
 * So: branch on the *computed* position, never the inline one, and write one only
 * when nobody has positioned the element at all.
 */
export function makeStage(el: StageEl, computedPosition: string): void {
  if (computedPosition === "static") el.style.position = "relative";
  el.style.overflow = "hidden";
  el.style.touchAction = "none";
  el.style.background = STAGE_BG;
}

/* ------------------------------- the HUD boxes ---------------------------- */

/** Clear air between the bottom of a host control and the readout under it. */
const GAP = 6;

/**
 * How far below the top safe edge a corner readout starts.
 *
 * The hairline, the control's own margin, the control, and a gap. Derived from
 * the shared constants rather than typed out, so if the host moves its chrome
 * VOLTA follows on the next build instead of drifting.
 */
export const READOUT_CLEAR = HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL + GAP;

/**
 * How much of the bottom edge belongs to the system rather than to the game.
 *
 * The reported bottom inset is honest on iOS, where it is the home indicator. On
 * Android it is not enough: the value the WebView reports describes the DISPLAY
 * CUTOUT, while the thing that eats the pixels and the tap is the
 * gesture-navigation handle — a strip along the bottom edge that the system
 * claims for swipe-up-to-home and that reports a bottom inset of **zero** on
 * plenty of devices. That is exactly the shape of the founder's screenshot: the
 * voltage bar was inside the reported safe area, correctly, and underneath the
 * navigation bar.
 *
 * 24 CSS px is the Android gesture handle's own height, and it is taken off the
 * raw bottom edge *as well as* the reported inset, whichever binds harder.
 * Lifted verbatim from `games/pulse`, which met this first.
 */
export const GESTURE_STRIP = 24;

/** The bottom edge the HUD may actually use, in CSS px from the bottom. */
export function systemBottom(insets: Insets): number {
  return Math.max(insets.bottom, GESTURE_STRIP);
}

/** `clamp(lo, mid, hi)` as CSS resolves it. */
const clampPx = (lo: number, mid: number, hi: number): number =>
  Math.min(hi, Math.max(lo, mid));

/** The HUD's own side margin: the old `clamp(10px, 2.2vw, 26px)`. */
export function hudEdge(w: number): number {
  return clampPx(10, w * 0.022, 26);
}

/**
 * The widest and tallest a corner readout gets.
 *
 * Generous on purpose: the score stack is a label, a number at up to
 * `clamp(24px, 5.4vw, 48px)` and a distance line, and the surge stack is a
 * label, a multiplier and three pips. Nothing here has to be exact, because the
 * readout hugs its own side of the screen and so does the control above it —
 * what the clearance turns on is entirely the vertical offset.
 */
const READOUT_W = 150;
const READOUT_H = 110;

/**
 * The box a top-corner readout occupies: `left` is the score, `right` the surge.
 *
 * This is what `hud.ts` *is*, not what it is believed to resolve to — the
 * stylesheet reads `left: var(--vt-tl-x)` and this is what fills it in.
 */
export function readoutRect(side: "left" | "right", w: number, insets: Insets): Rect {
  const m = hudEdge(w);
  const x = side === "left" ? insets.left + m : Math.max(0, w - insets.right - m - READOUT_W);
  return { x, y: insets.top + READOUT_CLEAR, w: READOUT_W, h: READOUT_H };
}

/** The prompt's nominal box: centred, and as wide as a five-digit sum gets. */
const PROMPT_W = 300;

/**
 * Room above the voltage bar for its own label.
 *
 * An *allowance*, not a mirror: the label is `font-size:clamp(8px,1.5vw,11px)`
 * five pixels above the bar, inside 1px of padding on a bed of its own — so 18px
 * is the most it ever needs and 20 is what it gets. Erring upward is the safe
 * direction: it makes the box this file reports slightly larger than the ink, so
 * every clearance assertion is conservative.
 *
 * The bed is why the padding is here at all. In landscape this label is out over
 * the OCEAN rather than the deck, and in THE BLEACH the ocean is bone while the
 * deck is near-black — one ink cannot clear both, so it is given a backdrop it
 * can be derived against. See `contrast.ts`.
 */
const VOLT_LABEL_H = 20;

/**
 * Every HUD box a child reads or touches, in CSS pixels.
 *
 * The four in-run surfaces plus the debug readout. The veils are deliberately
 * absent: an overlay owns the whole screen, is dismissed by its own button, and
 * pads itself off all four insets.
 */
export type HudBoxes = {
  /** `5 − 2`, just above the horizon. */
  prompt: Rect;
  /** Score and distance, top-left, under the exit control. */
  score: Rect;
  /** Surge and the chain pips, top-right, under the how-to-play control. */
  surge: Rect;
  /** The voltage bar and its label, across the bottom. */
  voltage: Rect;
  /** Sound and reduce-motion, bottom-right, above the voltage bar. */
  tools: Rect;
  /** The perf readout, bottom-left. `?perf` only, but it is still text. */
  perf: Rect;
};

export function hudBoxes(w: number, h: number, insets: Insets): HudBoxes {
  const m = hudEdge(w);
  const sysB = systemBottom(insets);

  // Prompt: a fifteenth of the way down, or under the host's controls, whichever
  // is lower. It is centred and `white-space:nowrap`, so a five-digit sum is wide
  // enough to reach both top corners — on a short viewport with a real top inset
  // it used to reach them at exactly their own height.
  const promptH = clampPx(30, w * 0.074, 72);
  const prompt: Rect = {
    x: Math.max(0, (w - PROMPT_W) / 2),
    y: Math.max(h * 0.15, insets.top + READOUT_CLEAR),
    w: Math.min(w, PROMPT_W),
    h: promptH,
  };

  // Voltage: the bar, plus its label sitting on top of it.
  const voltLift = clampPx(12, w * 0.026, 28);
  const voltH = clampPx(9, w * 0.018, 15);
  const voltBottom = h - sysB - voltLift;
  const voltage: Rect = {
    x: insets.left + m,
    y: voltBottom - voltH - VOLT_LABEL_H,
    w: Math.max(0, w - insets.left - insets.right - 2 * m),
    h: voltH + VOLT_LABEL_H,
  };

  // The two tool buttons sit on the voltage readout rather than at their own
  // offset from the bottom edge. Derived, so the gap between them cannot be
  // closed by a change to either one.
  const toolS = clampPx(30, w * 0.06, 40);
  const toolsBottom = voltage.y - GAP;
  const tools: Rect = {
    x: Math.max(0, w - insets.right - m - (2 * toolS + 6)),
    y: toolsBottom - toolS,
    w: 2 * toolS + 6,
    h: toolS,
  };

  const perf: Rect = { x: insets.left + m, y: tools.y - GAP - 44, w: 220, h: 44 };

  return {
    prompt,
    score: readoutRect("left", w, insets),
    surge: readoutRect("right", w, insets),
    voltage,
    tools,
    perf,
  };
}

/**
 * The custom properties `hud.ts` positions itself from.
 *
 * Written onto `.vt-root` on mount and again on every resize and every inset
 * change. The stylesheet holds no arithmetic of its own — see the module note.
 */
export function hudVars(w: number, h: number, insets: Insets): Record<string, string> {
  const b = hudBoxes(w, h, insets);
  const px = (v: number): string => `${String(Math.round(v * 100) / 100)}px`;
  return {
    // The two sizes the stylesheet would otherwise carry itself. They are here
    // because `hudBoxes` uses them to place the boxes: a height in CSS and a
    // height in the arithmetic are two heights, and they drift.
    "--vt-volt-h": px(clampPx(9, w * 0.018, 15)),
    "--vt-tool-s": px(clampPx(30, w * 0.06, 40)),
    "--vt-prompt-y": px(b.prompt.y),
    "--vt-tl-x": px(b.score.x),
    "--vt-tl-y": px(b.score.y),
    "--vt-tr-x": px(w - (b.surge.x + b.surge.w)),
    "--vt-tr-y": px(b.surge.y),
    "--vt-volt-l": px(b.voltage.x),
    "--vt-volt-r": px(w - (b.voltage.x + b.voltage.w)),
    "--vt-volt-b": px(h - (b.voltage.y + b.voltage.h)),
    "--vt-tools-r": px(w - (b.tools.x + b.tools.w)),
    "--vt-tools-b": px(h - (b.tools.y + b.tools.h)),
    "--vt-perf-l": px(b.perf.x),
    "--vt-perf-b": px(h - (b.perf.y + b.perf.h)),
    // The veils pad themselves off all four edges. They own the screen, so they
    // want the raw insets and not the gesture allowance.
    "--vt-sa-t": px(insets.top),
    "--vt-sa-r": px(insets.right),
    "--vt-sa-b": px(systemBottom(insets)),
    "--vt-sa-l": px(insets.left),
  };
}

/* ----------------------------- the answer frame --------------------------- */

/**
 * The NDC rectangle the numeral row may occupy on a `w`x`h` surface.
 *
 * NDC runs -1..+1 with y up, so a CSS-pixel inset of `i` on a surface of size
 * `s` is `2i/s` of NDC. The sides take the larger of the two insets because the
 * row is symmetric about the centre — three candidates at `-pitch, 0, +pitch`
 * cannot be lopsided without the middle one ceasing to be the middle one.
 */
export function ndcFrame(w: number, h: number, insets: Insets): Frame {
  const vw = Math.max(1, w);
  const vh = Math.max(1, h);
  const side = Math.max(insets.left, insets.right);

  const edge = Math.max(0.2, Math.min(BAND.edge, 1 - (2 * side) / vw));
  // The floor is the HUD's own bottom furniture, measured, not a guess at where
  // the horizon is: the row's real vertical limit at any given moment is the
  // deck at its gate's depth, and `readBand` takes that from the gate.
  const bottomPx = hudBoxes(vw, vh, insets).voltage;
  const bottom = Math.min(0.9, -1 + (2 * (vh - bottomPx.y)) / vh);
  // The top is bounded by the prompt, by the safe area, and by the host's two
  // controls. The controls only bite on a surface short enough that a twelfth
  // of it reaches down past the prompt line — but that is exactly the surface
  // nobody tests on.
  const top = Math.max(
    bottom + 0.02,
    Math.min(BAND.top, 1 - (2 * (insets.top + READOUT_CLEAR)) / vh),
  );

  return { edge, top, bottom, minH: (2 * BAND.minCapPx) / vh };
}
