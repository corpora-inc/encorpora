/**
 * The numeral character set, and the two metrics that turn a glyph into a size.
 *
 * This is a separate file from `digits.ts` for one reason: `digits.ts` builds
 * its atlas on a `<canvas>`, so nothing in it can be imported by a test. The
 * layout maths in `readband.ts` depends on these same two numbers, and a test
 * that asserts legibility against a *copy* of them is a test that goes quiet the
 * day someone retunes the real ones. So the constants live here, alone, with no
 * imports at all, and both the renderer and the tests read them from here.
 *
 * `CHARS` is exactly `COLS × ROWS` cells of the atlas. Adding a character means
 * enlarging the atlas grid, which is why the set is small and deliberate.
 */

/**
 * Every character the world can draw, in atlas order.
 *
 * `/` and `.` are here because the contract lets a host answer with anything —
 * `3/4`, `1.5` — and a numeral the atlas does not know used to be *silently
 * skipped*: `3/4` rendered as `34`, which is not an unreadable answer, it is a
 * different and wrong one. Anything still outside the set renders as `?`, which
 * is visibly broken rather than quietly false.
 */
export const CHARS = "0123456789−+×?/.";

/** The atlas grid. `CHARS.length` must equal `COLS * ROWS`. */
export const COLS = 4;
export const ROWS = 4;

/**
 * Fraction of a cell a digit's cap height actually occupies.
 *
 * The glyph is drawn at 0.74 of the cell and a digit's cap height is about 0.73
 * of its font size, so the ink fills a little over half the quad. Without this
 * factor every `h` in the renderer means "quad size" and a caller asking for a
 * 2-unit numeral silently gets a 1.05-unit one — which is exactly how gate
 * numerals ended up at eleven pixels. `h` means ink height, in world units.
 */
export const INK = 0.54;

/** A whisker of tracking; tabular figures set solid are hard to scan at speed. */
export const TRACK = 1.1;

/** The cell index `?` occupies. Every unknown character falls back to it. */
const UNKNOWN = CHARS.indexOf("?");

/**
 * Atlas cell for a character, never -1.
 *
 * A renderer that returns -1 has to decide what to do with it, and the cheap
 * decision — skip the glyph — is the one that turns `3/4` into `34`. There is
 * no such decision to make here.
 */
export function glyphIndex(ch: string): number {
  const i = CHARS.indexOf(ch);
  return i < 0 ? UNKNOWN : i;
}

/** Render ASCII hyphen-minus as the typographic minus the atlas actually has. */
export function fmt(v: string): string {
  return v.replace(/-/g, "−");
}
