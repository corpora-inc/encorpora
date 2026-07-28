// The street's materials.
//
// Cast iron, soot, cold sodium light and the orange of an open furnace door.
// **Material, not lighting effects** — no purple-to-teal, no glassmorphism, no
// neon. The only saturated colour in the game is the ember of the foundry
// itself, and it is used for exactly one thing: heat. A crack is hot. Locked
// arms are cold iron. That is the whole colour logic and it is legible without
// reading anything.

export const PALETTE = {
  /** Night above the roofline. */
  sky: "#0a0806",
  skyLow: "#171310",
  /** Wet cobbles. */
  ground: "#100d0b",
  groundLine: "#221b16",
  /** The wall the shutter hangs on. */
  wall: "#15110e",
  wallLine: "#2a2119",

  /** Cast iron: what a locked, composite rank is made of. */
  iron: "#3a3630",
  ironLit: "#5b544a",
  ironDark: "#221f1b",

  /** Steel: a rank that is prime, and can be taken. Cooler, brighter, alive. */
  steel: "#8fa0a8",
  steelLit: "#c6d4d9",
  steelDark: "#5a666c",

  /** Heat. The crack, the brazier, the furnace door. */
  ember: "#ff7a1c",
  emberHot: "#ffd08a",
  emberDeep: "#a63c05",

  /** Brass: the breaker bar and the rivets. Things you strike. */
  brass: "#c08f3c",
  brassLit: "#f0cf85",
  brassDark: "#6d4e1c",

  /** Chalk on steel. Numerals live here and nowhere else. */
  chalk: "#efe7d8",
  chalkDim: "#9d9484",

  /** Sodium lamp. */
  lamp: "#ffb867",
} as const

/** A hairline that reads on both iron and cobble. */
export const HAIRLINE = "rgba(239, 231, 216, 0.10)"

/** Numerals. Tabular so a two-digit lamp does not shove a one-digit one. */
export const FACE = `600 %dpx ui-monospace, "SF Mono", Menlo, Consolas, monospace`
export const LABEL = `500 %dpx ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif`

export function face(px: number): string {
  return FACE.replace("%d", String(Math.round(px)))
}

export function label(px: number): string {
  return LABEL.replace("%d", String(Math.round(px)))
}

/** `rgba` from a hex and an alpha, so the palette stays a list of materials. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "")
  const n = Number.parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
