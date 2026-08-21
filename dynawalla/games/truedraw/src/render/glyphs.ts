// Tabular layout for the slate.
//
// Canvas has no `font-variant-numeric: tabular-nums`, so a proportional serif
// reflows the whole statement when a `1` follows an `8` — and the statement is
// read at speed, under a clock, by a child. So digits are laid out on a fixed
// cell measured from the widest numeral in the face, and everything else takes
// its natural width. `4003 − 87 = 3916` and `1111 − 11 = 1100` occupy the same
// grid.
//
// This is also what makes the correction roll possible at all: a digit that
// rolls over into another digit has to roll inside a box that does not move.

export type Cell = {
  readonly ch: string
  /** Left edge, relative to the start of the run. */
  readonly x: number
  readonly w: number
  readonly digit: boolean
}

export type Layout = {
  readonly cells: readonly Cell[]
  readonly width: number
  /** The fixed digit cell this layout was built on. */
  readonly cellW: number
}

type Measurer = { measureText(text: string): { width: number } }

/** The widest digit in the current face and size. */
export function digitCellWidth(ctx: Measurer): number {
  let w = 0
  for (let d = 0; d <= 9; d++) w = Math.max(w, ctx.measureText(String(d)).width)
  return w
}

export function layout(ctx: Measurer, text: string, cellW: number): Layout {
  const cells: Cell[] = []
  let x = 0
  for (const ch of text) {
    const digit = ch >= "0" && ch <= "9"
    const w = digit ? cellW : ctx.measureText(ch).width
    cells.push({ ch, x, w, digit })
    x += w
  }
  return { cells, width: x, cellW }
}

/**
 * Which trailing cells hold the claimed value, and whether it can roll into the
 * answer in place.
 *
 * A roll needs the two numerals to have the same number of glyphs — `62 → 72`
 * rolls one column, `90 → 100` cannot roll at all and cross-fades instead. The
 * caller picks the branch; this only reports which it is.
 */
export type Correction = {
  /** Index of the first cell of the claimed value. */
  readonly start: number
  /** Per-column pairs, present only when a roll is possible. */
  readonly rolls: readonly { readonly index: number; readonly from: string; readonly to: string }[]
  readonly canRoll: boolean
}

export function correctionFor(
  layoutOf: Layout,
  claimed: string,
  answer: string,
): Correction {
  const start = Math.max(0, layoutOf.cells.length - [...claimed].length)
  if ([...claimed].length !== [...answer].length) {
    return { start, rolls: [], canRoll: false }
  }
  const from = [...claimed]
  const to = [...answer]
  const rolls: { index: number; from: string; to: string }[] = []
  for (let i = 0; i < from.length; i++) {
    const a = from[i] ?? ""
    const b = to[i] ?? ""
    if (a === b) continue
    rolls.push({ index: start + i, from: a, to: b })
  }
  return { start, rolls, canRoll: rolls.length > 0 }
}
