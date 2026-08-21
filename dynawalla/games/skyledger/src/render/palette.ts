// The observatory's materials.
//
// Material, not lighting. Brass, lapis, carved stone and cold celestial light —
// al-Jazari's register room at three in the morning. Nothing here is a gradient
// standing in for structure, there is no accent colour for "primary action",
// and nothing glows that is not a light source in the fiction.

/** Night, and the stone the observatory is cut from. */
export const NIGHT = "#050810"
export const NIGHT_HIGH = "#0a1020"
export const STONE = "#14161d"
export const STONE_EDGE = "#242832"

/** Lapis: the ruled lattice, the axis figures, the ledger's ink. */
export const LAPIS = "#1b3a6b"
export const LAPIS_DIM = "#12213c"
export const LAPIS_LIT = "#3f6fb0"

/** Brass: every instrument, every ring, every numeral the child turns. */
export const BRASS = "#c9a44c"
export const BRASS_DIM = "#7c6529"
export const BRASS_DEEP = "#4a3d1c"
export const BRASS_LIT = "#f3dc9a"

/** Cold celestial light: a star, and what a correct measurement looks like. */
export const STARLIGHT = "#dfe9ff"
export const STARLIGHT_CORE = "#ffffff"

/** Copper oxide: a mark that went wide. Cold, quiet, never red and never loud. */
export const OXIDE = "#7d5a44"
export const OXIDE_DIM = "#3a2c23"

/** A lamp on the horizon, burning and snuffed. */
export const LAMP_LIT = "#ffca7a"
export const LAMP_OUT = "#2a2622"

/** The ledger's paper, for the page written at the end of a run. */
export const VELLUM = "#e6dcc4"

/** Type, in one place so the whole instrument is engraved by one hand. */
export const FIGURE_FONT = `600 %spx ui-monospace, "SF Mono", Menlo, monospace`
export const PLATE_FONT = `500 %spx ui-monospace, "SF Mono", Menlo, monospace`

export function sized(template: string, px: number): string {
  return template.replace("%s", String(Math.round(px)))
}

/** `rgba` from one of the constants above. */
export function alpha(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`
}
