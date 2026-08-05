// THE COIL OF NINETY-SIX — the forge alley of the bazaar, after dark.
//
// The register: carved stone the colour of dry earth, brass that has been
// handled, lapis inlay on the hundreds, and one cold light — the wall's carved
// recess, lit from inside as if the mountain behind it were open. Warmth is
// material (brass, ember, oxide); the cold is structural (the wall, the
// celestial line the shear rides).
//
// Two rules this palette exists to enforce:
//
//   * **A place is a silhouette before it is a colour.** A one is a bead, a ten
//     is a ribbed drum, a hundred is a pierced ring, a thousand is a notched
//     tower. Colour follows, so the coil reads for a colour-blind child by
//     construction rather than by luck.
//   * **A numeral is never coloured information.** Every numeral is the same
//     bone-white, one weight, on a dark carved ground. What glows on the wall is
//     the *demand*, and it glows by light, not by hue.

export const STONE_DEEP = "#0b0906"
export const STONE = "#161210"
export const STONE_LIT = "#221b16"
export const STONE_EDGE = "#332821"
export const GROOVE = "#0d0a08"

export const BRASS = "#c08a2c"
export const BRASS_HOT = "#ffd98a"
export const BRASS_DARK = "#5e4113"
export const BRASS_RIM = "#e8b96a"

export const LAPIS = "#22408c"
export const LAPIS_HOT = "#79b0ff"

/** The cold light in the wall. Used for the recess, the shear, and nothing else. */
export const CELESTIAL = "#a6e9ff"
export const CELESTIAL_DIM = "#4b7d90"

/** Oxide. Slag, and the buried head of a choked coil. */
export const SLAG = "#3a4038"
export const SLAG_EDGE = "#5c665a"
/**
 * Oxide, as TYPE.
 *
 * `SLAG_EDGE` is the rim of a lump lying on stone and it is exactly right there.
 * Set as a numeral on the lane's groove it measures **2.85:1**, which is not a
 * label, it is a smudge — and the label it was carrying is `n buried`, the one
 * that explains why the head of the coil has stopped responding. Same hue, lifted
 * until it is readable: 8.63:1 on the same groove.
 */
export const SLAG_TEXT = "#a9b7a6"

export const EMBER = "#ff7a2c"
export const EMBER_HOT = "#ffd0a0"
/**
 * Ember, as TYPE.
 *
 * The furnace panel is a gradient that runs to hot orange at the bottom, and both
 * of its labels sit in the hot half. `EMBER` on it is orange on orange —
 * **1.92:1** — and the idle `n slag` reading was `BONE_DIM` at 0.6, which is
 * **1.15:1**: a line of type that is, measurably, not there. The heat is the
 * effect and it stays; the ink is what moves.
 */
export const EMBER_TEXT = "#fff3e6"

export const BONE = "#f3e7cf"
export const BONE_DIM = "#8b8272"
export const INK = "#070504"

export const UI_FONT =
  '600 16px/1 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif'

export function font(size: number, weight = 700): string {
  return `${String(weight)} ${String(Math.round(size))}px "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`
}

export function numerals(size: number, weight = 700): string {
  return `${String(weight)} ${String(Math.round(size))}px ui-monospace, "SF Mono", Menlo, monospace`
}

export function withAlpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(a)})`
}

/**
 * The body colour of a link of place `p`.
 *
 * Brass through the ones and tens, lapis from the hundreds up, going colder and
 * paler with each place so a six-figure coil reads as a gradient of *material*
 * from the head down to the tail. The silhouette carries the actual reading.
 */
export function linkBody(p: number): string {
  switch (p) {
    case 0:
      return "#d29a3a"
    case 1:
      return BRASS
    case 2:
      return "#3a5aa8"
    case 3:
      return "#7c86a8"
    case 4:
      return "#9aa4b8"
    default:
      return "#b9c1cc"
  }
}

export function linkRim(p: number): string {
  switch (p) {
    case 0:
      return BRASS_HOT
    case 1:
      return "#efc470"
    case 2:
      return LAPIS_HOT
    case 3:
      return "#cdd6ea"
    default:
      return "#e6ecf5"
  }
}
