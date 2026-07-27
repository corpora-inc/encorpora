/**
 * Where the three gate candidates go, in screen units.
 *
 * The single most important function in this game, because it is the one that
 * decides whether a child can read the question at all. It is pure arithmetic
 * with no THREE in sight so that `readband.test.ts` can hammer it with every
 * viewport and every candidate width the game can produce and assert the two
 * properties that actually matter:
 *
 *   1. adjacent numerals never touch — there is always a gutter wider than a
 *      digit stroke, so 13 | 42 | 36 can never render as "134236";
 *   2. nothing leaves the viewport — including the third numeral on a 320px
 *      phone, which used to be clipped clean off the right edge.
 *
 * Everything is NDC: x and y run -1..+1 across the viewport, so "0.5" means a
 * quarter of the screen's width regardless of device, orientation or DPR. The
 * caller converts back to world space with `Projector`.
 */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const BAND = {
  /** NDC x between adjacent candidates while the gate is still distant. */
  pitchFar: 0.58,
  /** ...and by the time it arrives. The row opens out as it comes at you. */
  pitchNear: 0.72,
  /**
   * The share of the pitch a numeral's ink may occupy. The remaining 30% is
   * gutter, and it is the whole reason this file exists. Do not raise it.
   */
  fill: 0.7,
  /** Ceiling on apparent size, in NDC y. A single digit would otherwise fill the screen. */
  maxH: 0.3,
  /** Hard page margin: no ink past |x| = this. */
  edge: 0.94,
  /** The row never rises past here — above it lives the prompt. */
  top: 0.56,
  /** ...nor sinks below here, which is roughly the horizon. */
  bottom: 0.06,
  /** Clear air between the numeral row and the top of its own gate arch. */
  lift: 0.07,
} as const;

export type Band = {
  /** Ink height, in NDC y. Multiply by `1/|ky|` for world units. */
  hNdc: number;
  /** NDC x of each candidate's centre, left to right. */
  x: [number, number, number];
  /** NDC y of the row's centre. */
  y: number;
  /** NDC x between adjacent centres. */
  pitch: number;
  /** NDC width of the widest candidate at `hNdc`. */
  wNdc: number;
};

/**
 * @param units    world width of each candidate at ink height 1, left to right
 * @param kx       NDC x per world unit at the gate's depth (magnitude)
 * @param ky       NDC y per world unit at the gate's depth (magnitude)
 * @param approach 0 when the gate spawns, 1 when it reaches the answer plane
 * @param archTop  NDC y of the top of the gate's arch
 */
export function readBand(
  units: readonly [number, number, number],
  kx: number,
  ky: number,
  approach: number,
  archTop: number,
): Band {
  const ax = Math.max(1e-6, Math.abs(kx));
  const ay = Math.max(1e-6, Math.abs(ky));
  const t = clamp01(approach);

  // One size for all three. Three different sizes on one row reads as three
  // different kinds of thing, and the eye stops comparing them.
  const widest = Math.max(units[0], units[1], units[2], 1e-6);

  // The widest a numeral can ever be: the point where the gutter rule
  // (w <= fill * pitch) and the page margin (pitch + w/2 <= edge) meet.
  const wCeil = (BAND.fill * BAND.edge) / (1 + BAND.fill / 2);
  // The width at which the apparent-size cap bites. On a narrow phone this is
  // enormous, which is exactly why the pitch has to be free to open up: a
  // three-digit answer on a 320px screen needs most of the width or it lands at
  // twenty pixels, and twenty pixels is the bug we are here to kill.
  const wWanted = (BAND.maxH * widest * ax) / ay;

  let wNdc = Math.min(wCeil, wWanted);
  // The row spreads as the gate closes, but never tighter than the gutter needs.
  let pitch = Math.max(lerp(BAND.pitchFar, BAND.pitchNear, t), wNdc / BAND.fill);
  const pitchCeil = BAND.edge - wNdc / 2;
  if (pitch > pitchCeil) pitch = pitchCeil;
  wNdc = Math.min(wNdc, BAND.fill * pitch);

  const hNdc = (wNdc / (widest * ax)) * ay;

  const half = hNdc / 2;
  // Sit just clear of the arch, but never behind the prompt and never under the
  // deck. When the two limits collide the top wins: off the bottom is invisible,
  // slightly tight against the prompt is merely close.
  const lo = BAND.bottom + half;
  const hi = BAND.top - half;
  let y = archTop + half + BAND.lift;
  if (y < lo) y = lo;
  if (y > hi) y = hi;

  return { hNdc, x: [-pitch, 0, pitch], y, pitch, wNdc };
}

/* -------------------------------------------------------------------------- */
/* The other two places ink can leave the frame.                              */
/* -------------------------------------------------------------------------- */

/**
 * Half-width, in NDC, that the winning numeral may fill as it rushes the camera.
 *
 * Slightly inside the frame: the glyph is allowed to feel like it is bursting
 * out of the screen, but a child has to be able to see *which number* won. Past
 * about 0.96 a two-digit answer on a phone stops being a number and starts being
 * a wall.
 */
export const PAYOFF_EDGE = 0.92;

/** Ceiling on the payoff numeral's NDC height, whatever the aspect ratio. */
export const PAYOFF_MAX_H = 1.55;

/**
 * How big the winning numeral is allowed to get, in NDC height.
 *
 * It used to swell to a flat 1.55 NDC *tall* and nothing looked at how wide that
 * made it. On a laptop a two-digit answer just fits; on a 390px phone it is 2.7
 * NDC wide against a 2.0 NDC screen, so the best moment in the game — the value
 * you just earned rushing the camera — became two unrecognisable green slabs
 * jammed against the left and right edges. Same rule as `readBand`: decide in
 * screen units, then convert back.
 *
 * @param wPerH NDC width the text occupies per NDC of height (aspect-corrected)
 * @param from  the numeral's NDC height when it left the row
 * @param swell 0 at the moment of crossing, 1 when fully arrived
 */
export function payoffHeight(wPerH: number, from: number, swell: number): number {
  const ceil = Math.min(PAYOFF_MAX_H, (2 * PAYOFF_EDGE) / Math.max(1e-4, wPerH));
  // Belt and braces: the swell only ever runs upward. `readBand` already keeps
  // every candidate under 0.54 NDC wide, well inside this ceiling, so `from` is
  // never the larger of the two in practice — but a numeral that *shrank* on a
  // win would read as the game taking the prize back, and that should be
  // impossible by construction rather than by the row happening to be small.
  const to = Math.max(from, ceil);
  return from + (to - from) * clamp01(swell);
}

/** The margin a score popup is kept inside. Tighter than the payoff: it is chrome. */
export const POPUP_EDGE = 0.93;

/**
 * Nudge a centre back inside the frame, in NDC.
 *
 * Score popups are placed at the lane they belong to, which on a wide screen is
 * well inside the frame and on a 390px phone is not: a `+100` over the outer
 * lane used to hang half off the edge as a meaningless `00`. Text keeps its lane
 * as long as the lane fits, and gives that up rather than be unreadable.
 *
 * @param ndcX  where the text wants to be centred
 * @param halfW half the text's NDC width
 * @param edge  the hard page margin
 */
export function keepInside(ndcX: number, halfW: number, edge = POPUP_EDGE): number {
  const lim = Math.max(0, edge - Math.max(0, halfW));
  return ndcX < -lim ? -lim : ndcX > lim ? lim : ndcX;
}
