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

/**
 * The numeral cell, and why a brass disc has a character budget at all.
 *
 * The founder played this and reported it in one line: *"long numbers don't fit
 * on the weights so they just run all over each other."* He is describing
 * `Renderer.numeral`, which chose a type size from the digit count — `r * 0.78`
 * for anything two digits or more — and then drew, centred, with no reference to
 * how wide the face it is engraving actually is. At the top of the shipped
 * ladder `80225 × 52762` puts **4232831450** on a disc: ten digits at 0.78r is
 * about four disc-widths of ink, so the numeral covers its neighbours on the
 * rail and neither can be read. Nothing measured it, because nothing in this
 * package could see a pixel until `layout.test.ts` existed and that file is
 * about the frame.
 *
 * So the disc gets a stated capacity, from three numbers that are all about the
 * real thing:
 *
 *   - `NUMERAL_MIN_PX` — the floor a numeral may be shrunk to. 15px, which is
 *     the floor a repo-wide audit set for an answer a child has to read.
 *   - `NUMERAL_ADVANCE_EM` — how wide one digit is in the game's serif stack.
 *     Lining figures in Palatino, Georgia and Times all advance 0.50em; 0.58 is
 *     deliberately above every one of them, because over-estimating costs a
 *     character of budget and under-estimating puts ink outside the brass.
 *   - `NUMERAL_FACE` — the engravable width of the disc, in radii. The knurl
 *     band `Renderer.weight` draws spans ±0.86r, so 1.7r is the flat between
 *     the rims.
 *
 * Those give a two-way conversion: the radius a numeral of N characters needs,
 * and the characters a disc of radius r can hold. `computeLayout` uses the first
 * to grow the disc for a wide board, and the adapter uses the second to refuse a
 * question whose numerals still would not fit. Neither guesses.
 */
export const NUMERAL_MIN_PX = 15;
export const NUMERAL_ADVANCE_EM = 0.58;
export const NUMERAL_FACE = 1.7;

/**
 * The type size an engraved numeral starts at, before it is fitted.
 *
 * `r * 0.78` for two characters or more and `r * 1.02` for one, which is what the
 * renderer always used — with the legibility floor now under it. That floor
 * matters at the small end and was being missed there: `weightR` clamps to 17 on
 * a narrow screen, and `17 × 0.78` is 13.3px, so a plain two-digit answer was
 * drawn under the 15px floor before any question of width came up.
 */
export function idealNumeralPx(r: number, chars: number): number {
  return Math.max(NUMERAL_MIN_PX, r * (chars >= 2 ? 0.78 : 1.02));
}

/**
 * The type size an engraved numeral is actually drawn at.
 *
 * Pure, so the founder's complaint is testable without a canvas: hand it the
 * ideal size, the ink that size measured, and the face it has to fit inside, and
 * it returns a size whose ink is inside the face — or the legibility floor, if
 * even that is not enough, which is the case `numeralBudget` exists to keep off
 * the screen entirely.
 */
export function fittedNumeralPx(idealPx: number, inkAtIdeal: number, faceW: number): number {
  if (!(inkAtIdeal > 0) || inkAtIdeal <= faceW) return idealPx;
  return Math.max(NUMERAL_MIN_PX, (idealPx * faceW) / inkAtIdeal);
}

/** The disc radius a numeral of `chars` characters needs to stay legible. */
export function radiusForChars(chars: number): number {
  return (Math.max(1, chars) * NUMERAL_MIN_PX * NUMERAL_ADVANCE_EM) / NUMERAL_FACE;
}

/** How many characters a disc of radius `r` can engrave at the legibility floor. */
export function charsAtRadius(r: number): number {
  return Math.max(1, Math.floor((r * NUMERAL_FACE) / (NUMERAL_MIN_PX * NUMERAL_ADVANCE_EM)));
}

/**
 * The widest numeral this layout can hold — the pack's own legibility ceiling,
 * read back off the arrangement a child is looking at rather than predicted.
 *
 * A phone and a tablet get different answers and that is correct: the tablet's
 * disc is bigger, so it can honestly show more of the ladder.
 */
export function numeralBudget(L: Layout): number {
  return charsAtRadius(L.weightR);
}

/**
 * More characters than any board could want, used to ask `computeLayout` for the
 * biggest disc a viewport can carry. Sixteen: the widest numeral the shipped
 * ladder produces is ten characters.
 */
const PROBE_CHARS = 16;

/**
 * The widest numeral this *viewport* could ever engrave — the pack's ceiling,
 * measured before a board exists.
 *
 * Distinct from `numeralBudget`, which reads a layout already built for a
 * particular board. This one asks what the screen is capable of, which is the
 * number a question has to be judged against: refusing a wide board because the
 * layout currently on screen was built for a narrow one would refuse boards this
 * device can perfectly well show.
 */
export function numeralCapacity(w: number, h: number, rackCount: number): number {
  const area = safeRect(w, h);
  return charsAtRadius(largestFeasibleRadius(w, h, rackCount, area));
}

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
 * The largest radius the growth walk will consider — the radius a sixteen
 * character numeral would need, which is six more than the widest the shipped
 * ladder produces.
 */
const UP_LIMIT = Math.ceil(radiusForChars(PROBE_CHARS));

/**
 * The biggest disc this screen can carry with the frame still holding.
 *
 * Walked down from `UP_LIMIT`, because feasibility is not monotone in the radius
 * — see the note in `computeLayout` — so "biggest" has to be searched for rather
 * than derived. `base` is the floor and is always feasible: it is what shipped.
 */
function largestFeasibleRadius(w: number, h: number, rackCount: number, area: Rect): number {
  const base = baseRadius(Math.max(120, area.w), Math.max(120, area.h));
  for (let r = UP_LIMIT; r > base; r--) {
    if (frameHolds(computeAtRadius(w, h, rackCount, area, r), area, rackCount)) return r;
  }
  return base;
}

/** The disc size this viewport would pick if no numeral needed room. */
function baseRadius(bw: number, bh: number): number {
  return clamp(Math.min(bw / 15.5, bh / 17), 17, 34);
}

/**
 * Does this arrangement still hold together?
 *
 * The three invariants `layout.test.ts` asserts, restated as a predicate so that
 * growing the disc for a wide numeral cannot break the frame: whatever radius is
 * chosen below, it is chosen because the arrangement it produces passes exactly
 * the checks the frame test runs. A bigger disc that would push the rack into
 * the plinth or off the safe bottom is simply not chosen, and the board is
 * refused instead of drawn badly.
 */
function frameHolds(L: Layout, area: Rect, rackCount: number): boolean {
  if (!(L.rack.y > L.plinth.y + L.plinth.h - 0.5)) return false;
  for (let i = 0; i < rackCount; i++) {
    const p = rackSlot(L, i, rackCount);
    if (p.y + L.rack.slotH / 2 > area.y + area.h + 0.5) return false;
    if (p.x - L.rack.slotW / 2 < area.x - 0.5) return false;
    if (p.x + L.rack.slotW / 2 > area.x + area.w + 0.5) return false;
  }
  return true;
}

/**
 * @param area the safe rectangle, from `safeRect(w, h)`. Required — see the
 * note at the top of this file.
 * @param chars the widest numeral, in characters, that must be engraved on a
 * disc on this board. Defaults to 1, which reproduces the arrangement this
 * function returned before numerals had a budget — so every existing caller and
 * every frame test is bit-for-bit unchanged.
 */
export function computeLayout(
  w: number,
  h: number,
  rackCount: number,
  area: Rect,
  chars = 1,
): Layout {
  const bw = Math.max(120, area.w);
  const bh = Math.max(120, area.h);
  const base = baseRadius(bw, bh);
  const want = radiusForChars(chars);
  if (want <= base) return computeAtRadius(w, h, rackCount, area, base);

  // Grow the brass until the numeral fits, walking a pixel at a time *upward*
  // from the radius the numeral needs, and stopping at the first arrangement that
  // still holds together.
  //
  // Upward, and this is not a taste call. Feasibility is not monotone in the
  // radius: `plinthY` is clamped between `bh * 0.56` and the top of the rack, and
  // when the rack has climbed far enough that the lower bound is above the upper
  // one the clamp returns the *lower* bound and the plinth lands on top of the
  // rack. So on a 320×568 phone r=24 holds, r=25 through 35 do not, and r=36 holds
  // again. Searching downward from the wanted radius therefore stopped at 24 —
  // a disc that fits four characters, for a board that needed six — and the
  // promise `numeralBudget` makes to the adapter would have been a lie. Measured:
  // that is exactly what the first version of this function did.
  for (let r = Math.ceil(want); r <= UP_LIMIT; r++) {
    const candidate = computeAtRadius(w, h, rackCount, area, r);
    if (frameHolds(candidate, area, rackCount)) return candidate;
  }
  // Nothing big enough holds together on this screen. Take the biggest disc it
  // *can* carry and let the adapter refuse the board: `numeralCapacity` reads the
  // same number, so the refusal and the arrangement agree by construction.
  return computeAtRadius(w, h, rackCount, area, largestFeasibleRadius(w, h, rackCount, area));
}

function computeAtRadius(
  w: number,
  h: number,
  rackCount: number,
  area: Rect,
  weightR: number,
): Layout {
  const bw = Math.max(120, area.w);
  const bh = Math.max(120, area.h);
  const cx = area.x + bw / 2;
  const portrait = bh > bw * 1.05;
  const u = clamp(Math.min(bw / 900, bh / 620), 0.55, 1.9);

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
export function layoutForViewport(
  w: number,
  h: number,
  rackCount: number,
  chars = 1,
): Layout {
  return computeLayout(w, h, rackCount, safeRect(w, h), chars);
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
