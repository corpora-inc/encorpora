// Material, not lighting. Brass, lapis, carved stone, cold celestial light,
// and a lot of unlit dust — the palette of `EXPERIENCE_DESIGN.md`'s art
// direction, with nothing in it that glows for its own sake.
//
// There is no accent colour and no "primary action" colour, on purpose: those
// are the two tells the hostile reference board calls a dashboard.

export const NIGHT = "#0a0c11"
export const NIGHT_DEEP = "#06070b"
export const DUST = "#171410"
export const DUST_LIT = "#241d15"
export const HAZE = "#1d222b"

export const STONE = "#2b2f38"
export const STONE_EDGE = "#3b414d"
export const STONE_RECESS = "#191c22"

export const BRASS = "#b08d4e"
export const BRASS_DIM = "#6b5730"
export const BRASS_LIT = "#e6c281"

export const LAPIS = "#22406b"

/**
 * THE ACCENT — and the one thing in this pack that is allowed to be called that.
 *
 * It is `BRASS_LIT`, the brightest material on the street, and it has exactly one
 * job beyond being the frame's highlight: **it is the colour a missed sum
 * completes itself in.**
 *
 * The fleet rule, from `games/stack`, which is the reference implementation: when
 * a child gets it wrong the equation simply completes itself in the accent, held
 * long enough to read, with no adjective attached to the child. NEVER red. NEVER
 * the word WRONG. There is no red anywhere in this palette and there must never
 * be one — `scene.test.ts` asserts that against the ink the renderer actually
 * emits, not against this comment.
 *
 * Aliased rather than duplicated so a future re-tint of the brass cannot leave the
 * correction the only thing on the street still wearing the old colour.
 */
export const ACCENT = BRASS_LIT

/** The statement before the slate lights: legible, and plainly unlit. */
export const CHALK_UNLIT = "#5c6577"
/** The statement once it lights. Cold, celestial, the only bright thing. */
export const CHALK_LIT = "#d6e6ff"
/** A value the slate is about to admit was wrong. */
export const CHALK_WRONG = "#7d7466"

export const FIGURE = "#0e1017"
export const FIGURE_RIM = "#3c4353"

export function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(Math.max(0, Math.min(1, alpha)))})`
}

/** Linear blend between two hex colours. */
export function mix(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t))
  const na = Number.parseInt(a.slice(1), 16)
  const nb = Number.parseInt(b.slice(1), 16)
  const r = Math.round(((na >> 16) & 255) * (1 - k) + ((nb >> 16) & 255) * k)
  const g = Math.round(((na >> 8) & 255) * (1 - k) + ((nb >> 8) & 255) * k)
  const bl = Math.round((na & 255) * (1 - k) + (nb & 255) * k)
  return `rgb(${String(r)}, ${String(g)}, ${String(bl)})`
}

/** The engraved face. A serif, because a slate is cut, not printed. */
export const SLATE_FONT = `"Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", Georgia, serif`
