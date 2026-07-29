// Responsive geometry. Nothing here is a fixed design size: a 360x640 phone in
// portrait and a 1440x900 desktop get genuinely different arrangements, not one
// scaled to fit the other. The rack reflows into rows; the arm shortens against
// height as well as width; touch targets have a floor.
//
// **The frame is not the canvas.** COUNTERPOISE declares `viewport-fit=cover`,
// which opts the document into the notch, the rounded corners and the home
// indicator. A canvas cannot claw that back with `env()` — that is a CSS value
// and `fillText` knows nothing about it — so the safe rectangle arrives here as
// a required argument and everything a child reads or touches is laid out
// inside it. The rack in particular used to sit `h * 0.035` off the bottom
// edge, which on a phone with a home indicator is underneath the home
// indicator: the row of weights the whole game is played from.
//
// The argument is REQUIRED on purpose. Optional would mean a caller that forgot
// it still compiles and quietly draws under the notch, discoverable only on a
// device.
//
// **The host draws on top of us.** Two 44px corners belong to chrome the pack
// does not own — the exit control top-left, how-to-play top-right. The brass,
// the motes and the beam may run under them freely and should; that is the
// point of `cover`. The HUD and the sound toggle may not, so they are placed
// from `exitRect`/`helpRect` rather than from the corner of the screen.

import {
  exitRect,
  helpRect,
  safeRect,
  type Insets,
  type Rect,
} from "../../../packs/shared/game-chrome/index.ts";

export const MAX_PEG = 5;

export type Layout = {
  w: number;
  h: number;
  /** The safe rectangle everything readable or touchable lives inside. */
  area: Rect;
  portrait: boolean;
  /** general scale hint for line weights and small type */
  u: number;
  pivot: { x: number; y: number };
  /** half-length of the beam, pixels */
  arm: number;
  /** vertical drop from the beam end to the dish */
  drop: number;
  dishW: number;
  dishH: number;
  weightR: number;
  crateR: number;
  plinth: { x: number; y: number; w: number; h: number };
  promptSize: number;
  rack: { y: number; rows: number; slotW: number; slotH: number; cols: number };
  hudPad: number;
  /** Type size of the HUD stack. Shared so draw and layout cannot disagree. */
  hudSize: number;
  /** The block the movement name, the progress dots and the gems occupy. */
  hud: Rect;
  /** The sound toggle: anchor point and the half-side of its touch target. */
  sound: { x: number; y: number; half: number };
};

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/**
 * The insets `area` was cut from. `safeRect` is exactly this subtraction, so
 * running it backwards is lossless and lets the layout ask the shared module
 * where the host's two corners are without a second source of truth.
 */
function insetsOf(w: number, h: number, area: Rect): Insets {
  return {
    top: area.y,
    left: area.x,
    right: Math.max(0, w - area.x - area.w),
    bottom: Math.max(0, h - area.y - area.h),
  };
}

/**
 * @param area the safe rectangle, from `safeRect(w, h)`. Required — see the
 * note at the top of this file.
 */
export function computeLayout(
  w: number,
  h: number,
  rackCount: number,
  area: Rect,
): Layout {
  const bw = Math.max(120, area.w);
  const bh = Math.max(120, area.h);
  const cx = area.x + bw / 2;
  const portrait = bh > bw * 1.05;
  const u = clamp(Math.min(bw / 900, bh / 620), 0.55, 1.9);

  const weightR = clamp(Math.min(bw / 15.5, bh / 17), 17, 34);
  const slotW = weightR * 2 + weightR * 0.52;
  const slotH = weightR * 2.35;

  const margin = Math.max(10, bw * 0.03);
  const cols = Math.max(3, Math.min(rackCount, Math.floor((bw - margin * 2) / slotW)));
  const rows = Math.max(1, Math.ceil(rackCount / cols));

  const rackH = rows * slotH;
  // Off the SAFE bottom, not the glass bottom: the home indicator sits in
  // between, and the rack is the one thing in this game a child touches every
  // single turn.
  const rackY = area.y + bh - rackH - Math.max(12, bh * 0.035);

  const arm = Math.min(bw * 0.315, bh * (portrait ? 0.30 : 0.40));
  const pivotY = area.y + clamp(bh * 0.235, 90, bh * 0.34);
  const drop = clamp((rackY - pivotY) * 0.42, weightR * 2.4, bh * 0.26);

  const plinthW = Math.min(bw * 0.62, arm * 1.7);
  const plinthH = clamp(bh * 0.1, 44, 108);
  const plinthY = clamp(
    pivotY + drop + weightR * 2.9,
    area.y + bh * 0.56,
    rackY - plinthH - 8 * u,
  );

  const hudPad = Math.max(10, Math.min(bw, bh) * 0.028);
  const hudSize = clamp(u * 13, 11, 15);

  // The two corners the host paints into. The HUD stack drops under the exit
  // control and the sound toggle drops under the how-to-play control, so both
  // stay legible and tappable instead of living behind a button.
  const insets = insetsOf(w, h, area);
  const exit = exitRect(insets);
  const help = helpRect(w, insets);
  const gap = Math.max(8, hudPad * 0.6);

  const hudX = area.x + hudPad;
  const hudY = exit.y + exit.h + gap;
  const hudH = hudSize * 3.6 + 12;

  const soundHalf = 22;
  const soundX = help.x + help.w - 16;
  const soundY = help.y + help.h + gap + soundHalf;

  return {
    w,
    h,
    area,
    portrait,
    u,
    pivot: { x: cx, y: pivotY },
    arm,
    drop,
    // never wider than the arm it hangs from, or a narrow screen clips it
    dishW: Math.min(weightR * 4.5, arm * 0.78),
    dishH: weightR * 0.95,
    weightR,
    crateR: weightR * 1.04,
    plinth: { x: cx - plinthW / 2, y: plinthY, w: plinthW, h: plinthH },
    promptSize: clamp(Math.min(bw / 13.5, bh / 13), 17, 52),
    rack: { y: rackY, rows, slotW, slotH, cols },
    hudPad,
    hudSize,
    // 260 is a deliberate over-estimate of the block's real ink: the longest
    // movement name is twenty tracked characters and the gem row is twelve
    // diamonds, neither of which reaches it at any type size this clamps to.
    // Over-estimating is the safe direction — the test that asserts this clears
    // the host's corners is then stricter than the pixels.
    hud: {
      x: hudX,
      y: hudY,
      w: Math.max(60, Math.min(260, area.x + bw - hudX)),
      h: hudH,
    },
    sound: { x: soundX, y: soundY, half: soundHalf },
  };
}

/**
 * The layout the game actually runs at, for a viewport of `w` x `h`.
 *
 * The one entry point production uses, so a test that calls this is testing the
 * arrangement a child sees rather than a pure function fed hand-picked
 * arguments. `safeRect` reads zeros wherever there is no environment to
 * measure, so this is the plain full-screen layout in node and on a device
 * without insets.
 */
export function layoutForViewport(w: number, h: number, rackCount: number): Layout {
  return computeLayout(w, h, rackCount, safeRect(w, h));
}

/** Distance along the arm, in pixels, for a peg on a given mode. */
export function armDistance(L: Layout, mode: "pans" | "beam", peg: number): number {
  return mode === "pans" ? L.arm : (L.arm * peg) / MAX_PEG;
}

/** The point on the rotated beam where something hangs. */
export function beamPoint(
  L: Layout,
  theta: number,
  side: number,
  distance: number,
): { x: number; y: number } {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return {
    x: L.pivot.x + side * distance * c,
    y: L.pivot.y + side * distance * s,
  };
}

export function rackSlot(L: Layout, i: number, total: number): { x: number; y: number } {
  const { cols, rows, slotW, slotH, y } = L.rack;
  const row = Math.floor(i / cols);
  const inRow = i % cols;
  const countInRow = row === rows - 1 ? total - cols * row : cols;
  const rowW = countInRow * slotW;
  const x0 = L.area.x + L.area.w / 2 - rowW / 2 + slotW / 2;
  return { x: x0 + inRow * slotW, y: y + row * slotH + slotH * 0.5 };
}
