// MATH NINJA — night market at the blue hour.
//
// The register: an indigo sky an hour after sunset, sodium lamps strung on
// wires, and fruit that glows from *inside* once it is cut open, as if the lamp
// light got in. Not brass. Not lapis. Not an orrery.
//
// Two rules this palette exists to enforce:
//   * **A numeral is never coloured information.** Every numeral is the same
//     near-white on a dark plate with a dark outline, at one weight, in a
//     geometric sans. The flesh colour is decoration; the number is the read.
//   * **Every gameplay class differs in silhouette and motion first**, colour
//     second — colour-blind safe by construction, not by palette luck.

export const SKY_TOP = "#0a0a1f"
export const SKY_MID = "#1b1035"
export const SKY_LOW = "#33143a"
export const HAZE = "#5a1f3d"

export const LAMP = "#ffb03a"
export const LAMP_HOT = "#ffe7b0"

export const INK = "#08060f"
export const PAPER = "#fdf6e8"

/** Rind / flesh pairs. Flesh is the luminous cut face; rind is the outside. */
export type Flesh = { rind: string; flesh: string; core: string; juice: string }

export const FLESHES: readonly Flesh[] = [
  { rind: "#7a1f4d", flesh: "#ff2f6e", core: "#ffd2e0", juice: "#ff5b86" }, // pomegranate
  { rind: "#8a4a12", flesh: "#ffa71f", core: "#ffe9b8", juice: "#ffc356" }, // persimmon
  { rind: "#1d5a46", flesh: "#3ce8a6", core: "#d6fff0", juice: "#6dffc4" }, // jade melon
  { rind: "#5a2a7a", flesh: "#b466ff", core: "#f0dcff", juice: "#c98cff" }, // fig
  { rind: "#7d5a10", flesh: "#ffe14d", core: "#fffbdc", juice: "#ffec8a" }, // quince
  { rind: "#8f2318", flesh: "#ff5a3c", core: "#ffd8cc", juice: "#ff8464" }, // blood orange
]

/** The prime payoff colour. One colour, used nowhere else, so it *means*. */
export const PRIME_GOLD = "#ffd24a"
export const PRIME_HOT = "#fff5cf"

/** The sigil tablet — lacquer black with a hot filament edge. */
export const SIGIL_PLATE = "#120a1c"
export const SIGIL_EDGE = "#57e8ff"
export const SIGIL_HOT = "#d6fbff"

/** Answer motes — the candidates a cut sigil throws into the air. */
export const MOTE_RING = "#57e8ff"
export const MOTE_HOT = "#e8feff"

/** Bombs. Iron, not a colour — the read is the silhouette and the fuse. */
export const IRON = "#191922"
export const IRON_EDGE = "#3d3d52"
export const FUSE = "#ff6b2c"

/** Failure. Used only on damage, never as decoration. */
export const WRONG = "#ff2b3d"

export function withAlpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

/** The stack every numeral is drawn in. Geometric, heavy, unambiguous. */
export const NUM_FONT =
  '800 %spx "Avenir Next", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif'
export const UI_FONT =
  '700 %spx "Avenir Next", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif'

export function font(spec: string, px: number): string {
  return spec.replace("%s", String(Math.round(px)))
}
