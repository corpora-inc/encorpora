/**
 * Numeral atlas addressing. Every printed number in the playfield is one quad
 * sampling one tile, so a screen full of labelled bullets costs a single draw
 * call and no text layout at all.
 *
 * Legibility rule learned the hard way elsewhere in this program: a numeral a
 * child has 0.45s to read gets a heavy geometric face, a solid backing plate
 * and a real U+2212 minus — never an engraved serif.
 */

export const LABEL_MIN = -40;
export const LABEL_MAX = 40;
export const LABEL_COLS = 9;
export const LABEL_ROWS = 9;
export const LABEL_COUNT = LABEL_COLS * LABEL_ROWS; // 81 == the whole range

/** Atlas tile for an integer, or -1 if it is outside the printable range. */
export function labelTile(v: number): number {
  if (!Number.isInteger(v) || v < LABEL_MIN || v > LABEL_MAX) return -1;
  return v - LABEL_MIN;
}

/** Inverse of `labelTile`, for tests and debugging. */
export function tileValue(tile: number): number {
  return tile + LABEL_MIN;
}
