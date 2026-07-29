/**
 * Where VOLTA is allowed to put things a child has to read or touch.
 *
 * Two separate encroachments, both invisible in a browser window and both
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
 * The chrome *overlays* — it does not reserve a band, and this file must not
 * pretend it does. The causeway, the sky and the ocean still bleed to all four
 * edges; that is the entire point of `cover`. Only the readouts move.
 */

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts";
import { BAND, type Frame } from "./readband.ts";

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

/** The HUD's own side margin, mirroring `clamp(10px, 2.2vw, 26px)` in the CSS. */
export function hudEdge(w: number): number {
  return Math.min(26, Math.max(10, w * 0.022));
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
 * This is what the CSS in `hud.ts` resolves to, expressed as arithmetic so a
 * test can assert it against `hitsHostChrome` at every viewport instead of
 * finding out on a device.
 */
export function readoutRect(side: "left" | "right", w: number, insets: Insets): Rect {
  const m = hudEdge(w);
  const x =
    side === "left"
      ? insets.left + m
      : Math.max(0, w - insets.right - m - READOUT_W);
  return { x, y: insets.top + READOUT_CLEAR, w: READOUT_W, h: READOUT_H };
}

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
  const bottom = Math.max(BAND.bottom, -1 + (2 * insets.bottom) / vh);
  // The top is bounded by the prompt, by the safe area, and by the host's two
  // controls. The controls only bite on a surface short enough that a twelfth
  // of it reaches down past the prompt line — but that is exactly the surface
  // nobody tests on.
  const top = Math.max(
    bottom + 0.02,
    Math.min(BAND.top, 1 - (2 * (insets.top + READOUT_CLEAR)) / vh),
  );

  return { edge, top, bottom };
}
