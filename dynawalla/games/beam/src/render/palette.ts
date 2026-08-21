// THE TUNING HALL — a resonance hall, cut into stone, lit only by its beams.
//
// The register is the house one: brass, lapis, carved stone, cold celestial
// light. Not neon, not gradient soup. The beams are the only light source in
// the room, so everything else is either lit by them or is a silhouette.
//
// Two rules this palette exists to enforce:
//   * **A numeral is never coloured information.** Every number on a hull is
//     the same near-white, one weight, geometric sans. Colour says what class
//     a thing is; the glyph says what it is worth.
//   * **Every class differs in silhouette first, colour second** — a CORE is a
//     wide slab, a candidate is a hexagon, an ordinary automaton is a rhombus.
//     Read with the colour removed, the board still parses.

/** The hall. Stone, unlit, cold. */
export const HALL_TOP = "#04060d"
export const HALL_LOW = "#0a1018"
export const STONE = "#141b26"
export const STONE_EDGE = "#222d3d"

/** The lattice itself: cold celestial light, dim until ridden. */
export const BEAM = "#2b6a86"
export const BEAM_LIT = "#7fe8ff"
export const BEAM_HOT = "#e8fdff"

/** Brass — every automaton hull. */
export const BRASS = "#c9902f"
export const BRASS_DARK = "#5d431a"
export const BRASS_HOT = "#ffdf9e"

/** Lapis — the CORE, and only the CORE. */
export const LAPIS = "#3b57d6"
export const LAPIS_EDGE = "#8ea6ff"
export const LAPIS_HOT = "#dfe7ff"

/** The resonance payoff. One colour, used nowhere else, so it *means*. */
export const RESONANT = "#ffd24a"
export const RESONANT_HOT = "#fff6d6"

/** Dissonance — copper oxide. Never used as decoration, only on a failed lock. */
export const DISSONANT = "#c1533a"

/** Damage. The anchors, and the floor when something lands on it. */
export const ANCHOR = "#ffb03a"
export const BREACH = "#ff3b47"

export const INK = "#05070d"
export const PAPER = "#f4f8ff"

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
