/**
 * Where the readable things go.
 *
 * GUILTY paints one canvas and nothing else, which is why it drops into any
 * host container without dragging styles along — and is also why none of this
 * was ever right. `env(safe-area-inset-*)` is a CSS value; a canvas cannot see
 * it. This game declares `viewport-fit=cover`, which opts the document *into*
 * the notch, the home indicator and the rounded corners, so `fillText` at
 * `y = pad` landed under the status bar on every phone that has one, and the
 * focus bar at `h - 5` sat under the home indicator.
 *
 * On top of that the host floats two 44px controls over every pack: exit at the
 * top-left, how-to-play at the top-right. The lives sat under the first and the
 * score sat under the second, and the equation — the accusation, the one thing
 * a child has to read — is centred and up to 90% of the screen wide, so it ran
 * under both.
 *
 * **The chrome overlays; it does not reserve a band.** Taking a strip off the
 * top of a trench would be absurd — the trench is the game. So everything here
 * moves *sideways* into the channel between the two corners, and nothing moves
 * down except by the height of the notch itself.
 *
 * **What is NOT in here, on purpose:** the water, the light shafts, the
 * plankton, the seabed grid, the gate, the husks, the ship, the bolts, the
 * particles and the vignette. Those are projected through the camera, which is
 * fitted to the whole glass, and they are supposed to bleed under the notch —
 * it is the entire reason `cover` is set. This module is only the things a
 * child must read.
 */

import {
  HOST_CONTROL,
  HOST_MARGIN,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts";
import { EQUATION_Y, VIEW_HALF_H } from "../core/config.ts";

/** Breathing room between a HUD edge and a host control. */
const CHROME_GAP = 8;

export type HudLayout = {
  /**
   * The whole glass, notch and all.
   *
   * Kept beside `safe` so the difference between the two is legible rather than
   * implied: the trench, the gate, the husks and the scrims use THIS, and only
   * the type uses `safe`.
   */
  glass: { w: number; h: number };
  /** The safe rectangle this was built from. */
  safe: Rect;
  /** Common inset, and the type scale everything in the corners is cut from. */
  pad: number;
  /** Type size for the score. */
  scoreSize: number;
  /** The row of ship silhouettes. Left-aligned inside this box. */
  lives: Rect;
  /** The score numeral. RIGHT-aligned to `score.x + score.w`. */
  score: Rect;
  /** `WAVE n`, under the score, right-aligned to the same edge. */
  wave: Rect;
  /**
   * The accusation. The glyph is centred in this box and sized to fit it.
   *
   * Its centre is the world position `EQUATION_Y` projects to, pushed down only
   * as far as the notch requires, so the husks still visibly fan out of it —
   * that fan-out is the whole tutorial and must not come apart.
   */
  equation: Rect;
  /** Baseline for the focus bar, clear of the home indicator. */
  focusY: number;
  /** Half-width the focus bar may grow to, each side of centre. */
  focusHalfW: number;
  /** Centre of anything full-screen: the banner, the title, the game-over. */
  cx: number;
  cy: number;
};

export function hudLayout(w: number, h: number, area: Rect): HudLayout {
  const pad = Math.max(14, Math.min(area.w, area.h) * 0.045);
  const scoreSize = Math.max(20, Math.min(area.w, area.h) * 0.052);

  // The channel between the two host controls. On a 320px phone this is 196 of
  // the 320, which is plenty for three ship silhouettes on one side and a score
  // on the other.
  const rail = HOST_MARGIN + HOST_CONTROL + CHROME_GAP;
  const left = area.x + rail;
  const right = area.x + area.w - rail;

  // The corner row. Both boxes are one line tall and sit on the same baseline.
  const rowY = area.y + pad;
  const rowH = Math.max(18, scoreSize);
  const livesW = Math.min(120, (right - left) * 0.42);

  const lives: Rect = { x: left, y: rowY - rowH / 2, w: livesW, h: rowH };
  const score: Rect = {
    x: right - (right - left) * 0.5,
    y: rowY - rowH / 2,
    w: (right - left) * 0.5,
    h: rowH,
  };
  const wave: Rect = {
    x: score.x,
    y: score.y + scoreSize * 0.85,
    w: score.w,
    h: scoreSize * 0.5,
  };

  // The equation, where the camera would put it: `fitCamera` maps the world's
  // half-height onto half the glass, so `EQUATION_Y` lands at this fraction of
  // the viewport. Recomputed rather than hard-coded so a change to the camera's
  // framing moves the type with the husks.
  const eqH = Math.min(h * 0.085, area.h * 0.12) * 1.35;
  const worldCy = (h / 2) * (1 - EQUATION_Y / VIEW_HALF_H);
  // Pushed down only as far as the NOTCH requires — never as far as the host's
  // controls, because the width below already keeps it out of their columns.
  // On a flat screen this does nothing at all and the type stays exactly where
  // the husks are born.
  const eqCy = Math.max(worldCy, area.y + eqH / 2);
  // Centred on the GLASS, not on the safe area, because the husks are born at
  // world x = 0 and `fitCamera` maps that to `w / 2`. iOS reports the notch on
  // one long edge only, so a phone rotated left and a phone rotated right give
  // asymmetric insets — and centring on the safe area would slide the sum ~23px
  // off the point the four shells fan out of. That fan-out is the whole
  // tutorial. So the box keeps the glass centre and gives up WIDTH instead,
  // taking the widest symmetric span that still clears both corners.
  // The floor is 40, not something comfortable: it is a guard against a degenerate
  // box, never a licence to overhang a control. `game.ts` clamps the canvas to at
  // least 320 CSS px and the two insets cannot exceed 47 each, so the channel is
  // always at least 102px and this never binds on anything real.
  const eqHalf = Math.max(
    40,
    Math.min(right - left, (w / 2 - left) * 2, (right - w / 2) * 2) / 2,
  );
  const equation: Rect = {
    x: w / 2 - eqHalf,
    y: eqCy - eqH / 2,
    w: eqHalf * 2,
    h: eqH,
  };

  return {
    glass: { w, h },
    safe: area,
    pad,
    scoreSize,
    lives,
    score,
    wave,
    equation,
    focusY: area.y + area.h - 7,
    focusHalfW: Math.max(20, area.w * 0.5 - 12),
    cx: area.x + area.w / 2,
    cy: area.y + area.h / 2,
  };
}
