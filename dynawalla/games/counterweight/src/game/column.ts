// The chit, split back into the column the goods' pan has to draw.
//
// The host hands over a display string — `"473 + 168"` — and the column is this
// game's own presentation of it, because lining the places up is the thing the
// `dw.add.column.*` rows are named for and a single line hides it.
//
// Anything that will not split is drawn on one line rather than dropped. A pan
// with nothing on it is the one state that must never happen: it is a round the
// child cannot win and cannot see why.

export type Column = {
  readonly top: string
  readonly glyph: string
  readonly bottom: string
}

const SHAPE = /^\s*([\d ,. ]*\d)\s*([+\-−–])\s*([\d ,. ]*\d)\s*$/

export function splitPrompt(prompt: string): Column | null {
  const match = SHAPE.exec(prompt)
  if (!match) return null
  const [, top, glyph, bottom] = match
  if (!top || !glyph || !bottom) return null
  return {
    top: top.trim(),
    // One minus sign, whatever the host sent.
    glyph: glyph === "+" ? "+" : "−",
    bottom: bottom.trim(),
  }
}
