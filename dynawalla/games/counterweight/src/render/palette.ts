// The bazaar's weigh-house at night: a cold sky through the doorway and one
// brazier over the barrow. Brass for the beam, cold steel for your side of it,
// ember for the goods.
//
// The vocabulary is mechanical, not confetti — EXPERIENCE_DESIGN's juice
// ceiling. Nothing in here is a primary colour and nothing celebrates in
// rainbow: a good weight is a *cold* highlight settling into brass, which reads
// as precision rather than as a prize.

export const PALETTE = {
  night: "#0a0b0e",
  nightDeep: "#06070a",
  yard: "#12141a",
  stone: "#1c202a",
  stoneEdge: "#262c39",

  brass: "#c8a45c",
  brassDim: "#7d6636",
  brassBright: "#f0d79a",

  steel: "#9fb4c8",
  steelDim: "#54657a",
  steelBright: "#dcebf7",

  ember: "#d1633a",
  emberDim: "#7a3a22",
  emberBright: "#ff9a63",

  ink: "#e8ecf3",
  inkDim: "#7d879a",
  inkFaint: "#4a5364",

  /** The cold good-weight highlight. The best colour in the game, used sparingly. */
  seat: "#8fe6ff",
  /** Strain past the safe reach. */
  strain: "#e0573f",
} as const

/** `rgba` from a hex triple. Kept tiny; there is no colour library here. */
export function alpha(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`
}

/** Linear blend between two hex colours. */
export function mix(from: string, to: string, t: number): string {
  const k = Math.max(0, Math.min(1, t))
  const a = Number.parseInt(from.slice(1), 16)
  const b = Number.parseInt(to.slice(1), 16)
  const r = Math.round(((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k)
  const g = Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k)
  const c = Math.round((a & 255) * (1 - k) + (b & 255) * k)
  return `#${((r << 16) | (g << 8) | c).toString(16).padStart(6, "0")}`
}

/** Numerals sit on a tabular grid so a four-digit load does not reflow a two. */
export const FACE_NUM = "700 {size}px ui-monospace, 'SF Mono', 'Roboto Mono', monospace"
export const FACE_TEXT =
  "600 {size}px 'Avenir Next', 'Segoe UI', system-ui, -apple-system, sans-serif"

export function font(face: string, size: number): string {
  return face.replace("{size}", String(Math.round(size)))
}
