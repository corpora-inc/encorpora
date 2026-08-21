/**
 * Where the play rect goes, and where the HUD goes inside it.
 *
 * Two facts about the frame MOSAIC is handed, neither of which it used to know:
 *
 * **The safe area.** `pack.html` declares `viewport-fit=cover`, which is not a
 * neutral setting — it opts the document *into* the notch, the home indicator
 * and the rounded corners. A DOM HUD claws that back with `env(safe-area-inset-
 * *)`. MOSAIC's HUD is drawn on a canvas, where `env()` is unreachable, so it
 * drew the cleared-fraction dial and the score straight under the notch.
 * `fitPlay` therefore fits the aspect-clamped window inside the SAFE rect
 * instead of inside the whole canvas. The background gradient and the stone
 * piers still fill the whole canvas — a full-bleed nave under the notch is what
 * `cover` is for. It is what a child must READ that moves.
 *
 * **The host's two corners.** The host paints an exit control top-left and the
 * shared how-to-play control top-right, each a 44px square, OVER the game. It
 * does not reserve a band: reserving one cost 12% of a 568px phone's height and
 * broke a sibling game's own layout outright. So a game promises only that
 * nothing a child must read or touch lands in those two squares.
 *
 * At 320x568 with no insets MOSAIC broke that promise twice: the dial sat at
 * screen 12.8..34.5 in both axes and the exit square is 10..54 x 13..57, and the
 * right-aligned score sat under the help square. `hudLayout` maps the two
 * squares back into virtual units and pushes the dial, the score column and the
 * rule banner clear of whichever of them overlaps horizontally. Where the corner
 * falls outside the play rect entirely — landscape, where the piers hold it out
 * there — the mapped rect does not overlap and nothing moves.
 *
 * Everything here is pure arithmetic so the promise can be asserted in a test at
 * every viewport, rather than discovered on a device.
 */

import { exitRect, helpRect, type Insets, type Rect } from "../../../../packs/shared/game-chrome/index.ts";
import { VW } from "../game/state.ts";

/** The window is always a window: a wide desktop gets piers, not a squashed wall. */
export const ASPECT_MIN = 1.06;
export const ASPECT_MAX = 1.86;

export type Box = { x: number; y: number; w: number; h: number };

/** The play rect, and the virtual-unit frame drawn inside it. */
export type View = {
  cssW: number;
  cssH: number;
  playX: number;
  playY: number;
  playW: number;
  playH: number;
  /** CSS pixels per virtual unit. */
  scale: number;
  /** The virtual playfield height, given `VW` across. */
  vh: number;
};

/**
 * Fit the aspect-clamped play rect inside `area` — the SAFE rect, not the
 * canvas.
 *
 * `area` is required rather than defaulted. Made optional, a caller that forgets
 * it compiles, runs, and quietly draws under the notch, and the only way to find
 * that out is on a device with a notch.
 */
export function fitPlay(cssW: number, cssH: number, area: Rect): View {
  const w = Math.max(1, area.w);
  const h = Math.max(1, area.h);
  const want = h / w;
  const aspect = Math.max(ASPECT_MIN, Math.min(ASPECT_MAX, want));
  let playW: number;
  let playH: number;
  if (want > aspect) {
    playW = w;
    playH = w * aspect;
  } else {
    playH = h;
    playW = h / aspect;
  }
  return {
    cssW,
    cssH,
    playX: area.x + (w - playW) / 2,
    playY: area.y + (h - playH) / 2,
    playW,
    playH,
    scale: playW / VW,
    vh: VW * aspect,
  };
}

/**
 * The insets a safe rect implies. Exact for any rect `safeRect` produced, and it
 * means the renderer takes ONE frame argument rather than two that can disagree.
 */
export function insetsFromArea(cssW: number, cssH: number, area: Rect): Insets {
  return {
    top: area.y,
    right: Math.max(0, cssW - area.x - area.w),
    bottom: Math.max(0, cssH - area.y - area.h),
    left: area.x,
  };
}

// -- HUD ---------------------------------------------------------------------

// Resting positions, in virtual units. These are the numbers `drawHud` used to
// hard-code; the layout below only ever pushes them DOWN, and only far enough.
const BANNER_CY = 78;
const BANNER_H = 100;
const DIAL_CX = 74;
const DIAL_CY = 74;
const DIAL_R = 34;
const RIGHT_X = VW - 26;
const RIGHT_TOP = 38;
const SCORE_DY = 20;
const WAVE_DY = 58;
const COMBO_DY = 108;
const BEAD_X = 30;
const BEAD_STEP = 26;
const BEAD_R = 7;
const CHARGE_X = 150;
const CHARGE_H = 10;

// Text is measured by the canvas, not here, so the boxes a test asserts on use
// declared maxima. Roughly `chars * size * 0.62` for this weight, rounded up:
// an eight-figure score at 40, a three-figure wave at 22, "x99" at the largest
// chain size (34 + 30, x1.08). Generous on purpose — a box that is too big can
// only make the layout more careful.
const SCORE_W = 200;
const SCORE_H = 40;
const WAVE_W = 46;
const WAVE_H = 22;
const COMBO_W = 140;
const COMBO_H = 70;
/** Beads are one per ball left. Six is past anything the forge can hand out. */
const BEAD_MAX = 6;

/**
 * Slack under a chrome square, in virtual units (~2.5px on a 320px phone).
 *
 * The mapped square is exact; the text boxes around it are estimates, and the
 * glass in this game is bright enough that a numeral kissing the exit chevron
 * still reads as a collision.
 */
const CLEAR_PAD = 8;

export type HudLayout = {
  readonly banner: { cx: number; cy: number; plateW: number; plateH: number };
  readonly dial: { cx: number; cy: number; r: number };
  readonly right: { x: number; scoreY: number; waveY: number; comboY: number };
  readonly beads: { x: number; y: number; step: number; r: number };
  readonly charge: { x: number; y: number; w: number; h: number };
  /**
   * Every box a child must READ, in virtual units, keyed by name. The game draws
   * from the anchors above; the test asserts on these.
   */
  readonly boxes: Readonly<Record<string, Box>>;
};

/** The rule plate's width, which depends on how long the rule reads. */
export function bannerPlateW(banner: string): number {
  return Math.max(240, banner.length * 46 + 96);
}

/** Screen pixels -> virtual units, for a rectangle. */
function toVirtualRect(r: Rect, view: View): Box {
  return {
    x: (r.x - view.playX) / view.scale,
    y: (r.y - view.playY) / view.scale,
    w: r.w / view.scale,
    h: r.h / view.scale,
  };
}

/**
 * The lowest bottom edge of any chrome box that overlaps `left..right`, or `y`.
 *
 * One loop, no branch to get wrong: a box that does not overlap horizontally
 * cannot push anything, and a box already above `y` cannot either.
 */
function clearOf(y: number, left: number, right: number, chrome: readonly Box[]): number {
  let out = y;
  for (const c of chrome) {
    if (right > c.x && c.x + c.w > left && out < c.y + c.h + CLEAR_PAD) out = c.y + c.h + CLEAR_PAD;
  }
  return out;
}

/** Where the HUD goes, given the frame it is drawn in and the rule it must show. */
export function hudLayout(view: View, insets: Insets, banner: string): HudLayout {
  const chrome = [exitRect(insets), helpRect(view.cssW, insets)].map((r) => toVirtualRect(r, view));

  const plateW = bannerPlateW(banner);
  const bannerCy =
    clearOf(BANNER_CY - BANNER_H / 2, VW / 2 - plateW / 2, VW / 2 + plateW / 2, chrome) + BANNER_H / 2;

  const dialCy = clearOf(DIAL_CY - DIAL_R, DIAL_CX - DIAL_R, DIAL_CX + DIAL_R, chrome) + DIAL_R;

  // The score, the wave and the chain are one right-aligned column and move
  // together: splitting them would let the chain slide up past the score.
  const rightTop = clearOf(RIGHT_TOP, RIGHT_X - SCORE_W, RIGHT_X, chrome);
  const scoreY = rightTop + SCORE_DY;
  const waveY = rightTop + WAVE_DY;
  const comboY = rightTop + COMBO_DY;

  const beadY = view.vh - 26;
  const chargeY = view.vh - 26;

  return {
    banner: { cx: VW / 2, cy: bannerCy, plateW, plateH: BANNER_H },
    dial: { cx: DIAL_CX, cy: dialCy, r: DIAL_R },
    right: { x: RIGHT_X, scoreY, waveY, comboY },
    beads: { x: BEAD_X, y: beadY, step: BEAD_STEP, r: BEAD_R },
    charge: { x: CHARGE_X, y: chargeY, w: VW - 220, h: CHARGE_H },
    boxes: {
      banner: { x: VW / 2 - plateW / 2, y: bannerCy - BANNER_H / 2, w: plateW, h: BANNER_H },
      dial: { x: DIAL_CX - DIAL_R, y: dialCy - DIAL_R, w: DIAL_R * 2, h: DIAL_R * 2 },
      score: { x: RIGHT_X - SCORE_W, y: scoreY - SCORE_H / 2, w: SCORE_W, h: SCORE_H },
      wave: { x: RIGHT_X - WAVE_W, y: waveY - WAVE_H / 2, w: WAVE_W, h: WAVE_H },
      combo: { x: RIGHT_X - COMBO_W, y: comboY - COMBO_H / 2, w: COMBO_W, h: COMBO_H },
      beads: {
        x: BEAD_X - BEAD_R,
        y: beadY - BEAD_R,
        w: (BEAD_MAX - 1) * BEAD_STEP + BEAD_R * 2,
        h: BEAD_R * 2,
      },
      charge: { x: CHARGE_X, y: chargeY - CHARGE_H / 2, w: VW - 220, h: CHARGE_H },
    },
  };
}

/** A virtual-unit box back to screen pixels. The inverse of `toVirtualRect`. */
export function toScreenRect(b: Box, view: View): Rect {
  return {
    x: view.playX + b.x * view.scale,
    y: view.playY + b.y * view.scale,
    w: b.w * view.scale,
    h: b.h * view.scale,
  };
}
