/**
 * tileLayout.ts — fits a falling tile's label into a fixed-width lane.
 *
 * Tiles are drawn on a <canvas> with a single `ctx.fillText` call each — there
 * is no DOM text flow to wrap them for us, and no CSS `max-width` to shrink
 * them. Left alone, a long target phrase (or a long distractor) simply
 * overflows the tile's rounded-rect box sideways, which on a narrow mobile
 * viewport can run past the lane boundary and read as garbled, overlapping
 * text. This module picks: (a) the largest font in [TILE_MIN_FONT,
 * TILE_MAX_FONT] that fits on ONE line within the lane, else (b) TILE_MIN_FONT
 * wrapped across up to TILE_MAX_LINES lines, with a trailing ellipsis on the
 * rare label that still doesn't fit.
 *
 * Pure logic, no canvas dependency — callers inject a `measure(text, fontPx)`
 * width function (backed by `ctx.measureText` in the real game, or a fake
 * deterministic measurer in tests).
 */

export type Measurer = (text: string, fontPx: number) => number

export type TileTextLayout = {
  lines: string[]
  fontPx: number
}

export const TILE_MAX_FONT = 20
export const TILE_MIN_FONT = 13
export const TILE_MAX_LINES = 2
/** Vertical rhythm for stacked lines + the tile's own vertical padding. */
export const TILE_LINE_HEIGHT = 22
export const TILE_PAD_Y = 16
/** Horizontal padding budget (both sides combined) reserved around text. */
export const TILE_PAD_X = 20

/** A word/line "atom": a run of text plus whether it glues to the previous
 *  atom with NO space (i.e. it's a hard-wrapped fragment of one long word,
 *  not a separate word). */
type Atom = { text: string; glued: boolean }

/**
 * Split any single "word" wider than `maxWidth` into character-level chunks
 * that each individually fit — the fallback for very long compounds or
 * no-space scripts (CJK, etc.) where there is no natural word boundary.
 */
function splitLongWord(word: string, maxWidth: number, measure: (s: string) => number): Atom[] {
  const chars = Array.from(word)
  const chunks: Atom[] = []
  let current = ""
  let first = true
  for (const ch of chars) {
    const attempt = current + ch
    if (current === "" || measure(attempt) <= maxWidth) {
      current = attempt
    } else {
      chunks.push({ text: current, glued: !first })
      first = false
      current = ch
    }
  }
  if (current) chunks.push({ text: current, glued: !first })
  return chunks
}

function atomize(text: string, maxWidth: number, measure: (s: string) => number): Atom[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const atoms: Atom[] = []
  for (const word of words) {
    if (measure(word) <= maxWidth) {
      atoms.push({ text: word, glued: false })
    } else {
      atoms.push(...splitLongWord(word, maxWidth, measure))
    }
  }
  return atoms
}

/** Greedy line-wrap over atoms, capped at `maxLines`. Reports `truncated` when
 *  atoms remain unplaced (label didn't fit even wrapped) so the caller can
 *  ellipsize the last line. */
function wrapAtoms(
  atoms: Atom[],
  maxWidth: number,
  maxLines: number,
  measure: (s: string) => number
): { lines: string[]; truncated: boolean } {
  const lines: string[] = []
  let current = ""
  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i]
    const sep = current === "" || atom.glued ? "" : " "
    const candidate = current + sep + atom.text
    if (current === "" || measure(candidate) <= maxWidth) {
      current = candidate
      continue
    }
    lines.push(current)
    current = atom.text
    if (lines.length >= maxLines) {
      // Everything from `i` on (current included) didn't make it in.
      return { lines, truncated: true }
    }
  }
  if (current) {
    if (lines.length >= maxLines) return { lines, truncated: true }
    lines.push(current)
  }
  return { lines, truncated: false }
}

/** Trim `line` (with a trailing "…") until it fits `maxWidth`. */
function ellipsize(line: string, maxWidth: number, measure: (s: string) => number): string {
  if (measure(line + "…") <= maxWidth) return `${line}…`
  const chars = Array.from(line)
  while (chars.length > 1 && measure(chars.join("") + "…") > maxWidth) {
    chars.pop()
  }
  return `${chars.join("")}…`
}

/**
 * Fit `text` into a tile at most `maxWidth` px wide. Tries progressively
 * smaller single-line fonts first (keeps short/medium labels crisp and big);
 * falls back to wrapped lines at the minimum font, ellipsizing only if the
 * label still doesn't fit within TILE_MAX_LINES.
 */
export function layoutTileText(text: string, maxWidth: number, measure: Measurer): TileTextLayout {
  const usable = Math.max(24, maxWidth - TILE_PAD_X)
  const clean = text.trim() || text

  for (let fontPx = TILE_MAX_FONT; fontPx >= TILE_MIN_FONT; fontPx -= 1) {
    if (measure(clean, fontPx) <= usable) {
      return { lines: [clean], fontPx }
    }
  }

  const fontPx = TILE_MIN_FONT
  const measureAtMin = (s: string) => measure(s, fontPx)
  const atoms = atomize(clean, usable, measureAtMin)
  const { lines, truncated } = wrapAtoms(atoms, usable, TILE_MAX_LINES, measureAtMin)
  if (lines.length === 0) return { lines: [ellipsize(clean, usable, measureAtMin)], fontPx }
  if (truncated) {
    lines[lines.length - 1] = ellipsize(lines[lines.length - 1], usable, measureAtMin)
  }
  return { lines, fontPx }
}

/** Pixel height for a laid-out tile, given its line count. */
export function tileHeightFor(lineCount: number, baseHeight: number): number {
  return Math.max(baseHeight, lineCount * TILE_LINE_HEIGHT + TILE_PAD_Y)
}
