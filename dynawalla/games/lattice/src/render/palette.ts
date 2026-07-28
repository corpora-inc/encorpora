// The material palette. Brass, lapis, carved stone, cold celestial light —
// al-Jazari's workshop rather than a neon arcade. The colours here are pigments
// and metals, never lighting effects: no purple-to-teal gradient, no glow that
// is not something incandescing.
//
// Two families do all the work:
//
//   * **Stone and brass** for composites. A husk is a carved block with its
//     numeral cut into it; it is inert until it is shot.
//   * **Cold celestial** for primes. A prime is the thing that will not go, and
//     it is the only light in the arena that is its own. That is not decoration
//     — the child learns to read "this one is lit" as "this one is prime" long
//     before they could define the word.

export const VOID = "#050810"
export const VOID_HI = "#0a1020"

/** The sheet. Struts at rest, and a strut that has let go. */
export const STRUT = "rgba(84,116,168,0.30)"
export const STRUT_HOT = "rgba(126,170,232,0.72)"
export const STRUT_TORN = "rgba(214,138,74,0.85)"

/** Carved stone: a composite husk. */
export const STONE = "#2b3242"
export const STONE_EDGE = "#4a5568"
export const STONE_INK = "#cfd8e6"

/** Brass: the ship, the resonator's ring, the tile bar's frame. */
export const BRASS = "#c9a227"
export const BRASS_DIM = "#8c7320"
export const BRASS_LIGHT = "#f0d878"

/** Cold celestial: a prime mote, and everything primeness touches. */
export const CELESTIAL = "#8fd8ff"
export const CELESTIAL_DIM = "#3f7ea0"
export const CELESTIAL_INK = "#04121c"

/** Lapis: the resonator's core, and the sheet where it is listening. */
export const LAPIS = "#1e3a8a"
export const LAPIS_LIGHT = "#4c6ef5"

/** Copper oxide: a refusal. Never red, never a buzzer colour. */
export const OXIDE = "#9c6b3f"

export const INK = "#e8e2d6"
export const INK_DIM = "rgba(232,226,214,0.52)"

/** The numeral face. Tabular so a 2 and a 13 do not shift the layout. */
export const NUMERAL = "600 __PX__px/1 ui-monospace, SFMono-Regular, Menlo, monospace"

export function numeralFont(px: number): string {
  return NUMERAL.replace("__PX__", String(Math.round(px)))
}

export function chromeFont(px: number, weight = 500): string {
  return `${weight} ${Math.round(px)}px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif`
}
