/**
 * beatlounge — Stage bento layout helpers (pure).
 *
 * The Stage grid is a fixed-column bento with `grid-auto-flow: dense`; each
 * tile's `tileAspect` maps to a column/row span. This module is the single
 * source of truth for that mapping (CSS mirrors it in styles.css) and for the
 * column count at a given width, so the layout intent is testable without a DOM.
 *
 * Span model (from 2 columns up; the single-column phone band collapses every
 * tile to 1×1 so nothing overflows a ~300px track):
 *   square → 1 col × 1 row
 *   wide   → 2 cols × 1 row
 *   tall   → 1 col × 2 rows
 */

export type TileAspect = "square" | "wide" | "tall" | "full"

export interface TileSpan {
  /** Column span at the given column count. */
  cols: number
  /** Row span (constant across multi-column bands). */
  rows: number
}

/** Width breakpoints (px) → bento column count. Mirrors the media queries.
 *  Capped at 3 columns so the home IA groups ([cycle+drums]·[harmony+
 *  instruments+ribbon]·[phrases+jam+scratch]·[mixer]) tile as clean rows on
 *  every iPad (2-col portrait-11" / 3-col 12.9"-portrait + landscape); a wider
 *  screen just gets roomier 3-col tiles instead of a 4th column that splits the
 *  groups. */
export const STAGE_BREAKPOINTS: ReadonlyArray<{ minWidth: number; columns: number }> = [
  { minWidth: 0, columns: 1 },
  { minWidth: 520, columns: 2 },
  { minWidth: 900, columns: 3 },
]

/** Resolve the bento column count for a viewport width. */
export const columnsForWidth = (width: number): number => {
  let cols = 1
  for (const bp of STAGE_BREAKPOINTS) {
    if (width >= bp.minWidth) cols = bp.columns
  }
  return cols
}

/**
 * The grid span a tile occupies, clamped to the available columns. In the
 * single-column band a wide tile can only ever be one column — never overflow.
 */
export const spanForAspect = (
  aspect: TileAspect | undefined,
  columns: number,
): TileSpan => {
  if (columns <= 1) return { cols: 1, rows: 1 }
  switch (aspect) {
    case "full":
      // Spans every column (a full-width row) — e.g. the Mixer.
      return { cols: columns, rows: 1 }
    case "wide":
      // Two columns, but ONLY from 3 columns up; at 2 columns it stays one so the
      // [cycle+drums] / [harmony+instruments+ribbon] rows tile cleanly.
      return { cols: columns >= 3 ? 2 : 1, rows: 1 }
    case "tall":
      return { cols: 1, rows: 2 }
    case "square":
    default:
      return { cols: 1, rows: 1 }
  }
}
