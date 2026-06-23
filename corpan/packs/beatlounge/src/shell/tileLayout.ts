/**
 * beatlounge — Stage bento layout helpers (pure).
 *
 * The Stage is a SIX-column bento on tablet (≥720px) that collapses to ONE
 * column on phone. Six columns let the home IA mix row compositions cleanly:
 *   • a 3-up row  → three `third` tiles (2/6 each)   — phrases · jam · scratch
 *   • a 2-up row  → two `half` tiles (3/6 each)      — harmony · synth
 *   • a lead pair → `third` + `twothirds` (2 + 4)    — cycle · drums
 *   • a band      → one `full` tile (6/6)            — ribbon, mixer
 * This module is the single source of truth for the span mapping (CSS mirrors
 * it) + the column count, so the layout intent is testable without a DOM.
 */

export type TileAspect =
  | "third"
  | "half"
  | "twothirds"
  | "full"
  | "band" // full-width AND tall (2 rows) — the Ribbon hero
  // Legacy aliases (mapped onto the 6-col grid): square→third, wide→twothirds.
  | "square"
  | "wide"
  | "tall"

export interface TileSpan {
  /** Column span at the given column count. */
  cols: number
  /** Row span (constant across multi-column bands). */
  rows: number
}

/** Width breakpoints (px) → bento column count. Phone = 1 column (clean stack);
 *  tablet+ (≥720, every iPad in either orientation) = the 6-column IA grid. No
 *  in-between count, so the group rows tile identically on iPad portrait AND
 *  landscape. */
export const STAGE_BREAKPOINTS: ReadonlyArray<{ minWidth: number; columns: number }> = [
  { minWidth: 0, columns: 1 },
  { minWidth: 720, columns: 6 },
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
 * The grid span a tile occupies. In the single-column phone band every tile is
 * one full-width row. On the 6-column grid, aspects map to clean fractions.
 */
export const spanForAspect = (
  aspect: TileAspect | undefined,
  columns: number,
): TileSpan => {
  if (columns <= 1) return { cols: 1, rows: 1 }
  const sixth = columns / 6 // 1 at 6-col
  switch (aspect) {
    case "band":
      return { cols: columns, rows: 2 }
    case "full":
      return { cols: columns, rows: 1 }
    case "twothirds":
    case "wide":
      return { cols: Math.round(sixth * 4), rows: 1 }
    case "half":
      return { cols: Math.round(sixth * 3), rows: 1 }
    case "tall":
      return { cols: Math.round(sixth * 2), rows: 2 }
    case "third":
    case "square":
    default:
      return { cols: Math.round(sixth * 2), rows: 1 }
  }
}
