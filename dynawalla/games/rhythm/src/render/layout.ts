/**
 * Where everything goes, as numbers a test can check without a canvas.
 *
 * **Why this file exists.** Splitbeat declares `viewport-fit=cover`, which is not
 * a neutral setting: it opts the document *into* the notch, the home indicator
 * and the rounded corners. The DOM chrome could claw that back with `env()` and
 * partly did — the gear guarded `top` and `right` and nothing guarded `bottom`
 * or `left` — but the HUD that actually matters is drawn on a canvas, and a
 * canvas cannot read `env()`. So the score sat at `y = u * 1.55` and the question
 * plate at `y = u * 0.55`, which on a notched phone is behind the notch.
 *
 * On top of that the host paints its own controls over every pack: an exit
 * control in the top-LEFT corner and a how-to-play control in the top-RIGHT,
 * each a 44px square. Those overlay; they do not reserve a band, because
 * reserving one costs 12% of a 568px phone and broke SKY LEDGER's own layout.
 * What a game promises instead is that nothing a child must READ or TOUCH lands
 * in those two squares — and in Splitbeat the score, the charge strip and the
 * QUESTION all did.
 *
 * `area` is required, not optional. Made optional, a caller that forgets it
 * compiles and quietly draws under the notch, and the only way to find out is on
 * a device.
 */

import {
  chromeRects,
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts";

export type { Rect };

/** Seconds a note is visible before it reaches the strike line. */
export const LEAD = 1.85;

/**
 * The game's own settings gear, which used to sit exactly where the host's
 * how-to-play control lands. It drops below that square instead of moving to a
 * different corner: every other corner is inside a lane a child is tapping, and
 * a settings button that eats a note is worse than one that has moved 65px.
 */
export const GEAR_SIZE = 40;
export const GEAR_EDGE = 8;
export const GEAR_TOP = HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL + 8;
export const PANEL_TOP = GEAR_TOP + GEAR_SIZE + 8;

/** Where the gear ends up, for a test that will not take the CSS's word for it. */
export function gearRect(w: number, insets: Insets): Rect {
  return {
    x: w - Math.max(GEAR_EDGE, insets.right) - GEAR_SIZE,
    y: Math.max(GEAR_EDGE, insets.top) + GEAR_TOP,
    w: GEAR_SIZE,
    h: GEAR_SIZE,
  };
}

export type Layout = {
  /** The rectangle everything readable lives inside. */
  area: Rect;
  /** Type unit, from the short axis of the safe area. */
  u: number;
  /** Centre of the safe area, for everything that is centred. */
  cx: number;
  playTop: number;
  playH: number;
  laneH: number;
  strikeX: number;
  /** Pixels per second a note travels. */
  pps: number;
  /** Left edge of the score and the sector line. */
  hudX: number;
  /** Middle baseline of the score, plus the box it was cleared as. */
  scoreY: number;
  scoreTop: number;
  scoreH: number;
  /** Middle baseline of the sector / BPM / level line. */
  sectorY: number;
  /** Left edge and top of the five charge cells. */
  chargeX: number;
  chargeY: number;
  chargeCellW: number;
  chargeCellH: number;
  /** Top of the question plate, and the tallest it can be. */
  promptY: number;
  promptMaxH: number;
};

/**
 * The smallest `y` at or below `top` where a box spanning `left`..`right`
 * touches no host control.
 *
 * There is no branch here on "is the corner over the playfield" — in landscape
 * the corners simply do not overlap the span and nothing moves.
 */
function clearOf(top: number, left: number, right: number, chrome: readonly Rect[]): number {
  let y = top;
  for (const c of chrome) {
    if (right > c.x && c.x + c.w > left && y < c.y + c.h) y = c.y + c.h;
  }
  return y;
}

/**
 * @param w      canvas width in CSS pixels — the host's help control is measured
 *               from the canvas's right edge, not the safe area's.
 * @param area   the safe rectangle — `safeRect(w, h)`. REQUIRED, so that a
 *               caller who forgets it does not compile.
 * @param insets the same insets `area` was built from, for the host's corners.
 */
export function layoutFor(w: number, area: Rect, insets: Insets): Layout {
  const chrome = chromeRects(w, insets);
  const u = Math.min(area.w, area.h) / 46;
  const cx = area.x + area.w / 2;

  // The question is the most critical thing on the screen, so it keeps its full
  // width and moves DOWN past the corners rather than being shrunk to fit
  // between them. At 320px the between-the-corners budget is 212px, and a
  // question squeezed into that is a question a nine-year-old squints at.
  const promptMaxH = u * 5.75;
  const promptY = clearOf(area.y + u * 0.55, area.x, area.x + area.w, chrome);

  // The playfield starts below whatever the question plate can occupy, so a
  // gate never covers the lane its own answers are travelling down.
  const playTop = Math.max(
    area.y + Math.max(58, area.h * 0.155),
    promptY + promptMaxH + u * 0.5,
  );
  const botPad = Math.max(40, area.h * 0.11);
  const playH = Math.max(120, area.y + area.h - playTop - botPad);
  const laneH = playH / 3;

  const strikeX = area.x + Math.min(Math.max(area.w * 0.235, 62), 240);
  const pps = (area.x + area.w - strikeX) / LEAD;

  // Score column, top-left. Six digits at weight 900 is about 7.6 units wide;
  // the sector line under it is longer, so the span is measured generously.
  const hudX = area.x + u * 0.9;
  const scoreH = u * 2.05;
  const colRight = area.x + area.w * 0.6;
  const scoreTop = clearOf(area.y + u * 1.55 - scoreH / 2, hudX, colRight, chrome);
  const scoreY = scoreTop + scoreH / 2;
  const sectorY = scoreY + u * 1.4;

  // Charge strip, top-right.
  const chargeCellW = u * 1.15;
  const chargeCellH = u * 0.72;
  const chargeW = chargeCellW * 5 + u * 0.1 * 4;
  const chargeX = area.x + area.w - u * 0.9 - chargeCellW * 5 - u * 0.4;
  const chargeY = clearOf(area.y + u * 0.85, chargeX, chargeX + chargeW, chrome);

  return {
    area,
    u,
    cx,
    playTop,
    playH,
    laneH,
    strikeX,
    pps,
    hudX,
    scoreY,
    scoreTop,
    scoreH,
    sectorY,
    chargeX,
    chargeY,
    chargeCellW,
    chargeCellH,
    promptY,
    promptMaxH,
  };
}
