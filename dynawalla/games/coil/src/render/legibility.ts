// WHAT EVERY READABLE THING IN THE ALLEY LANDS ON.
//
// *"more attention to details needed."*
//
// This is that, measured rather than guessed. Every ground below is a COMPOSITE
// — the stone, the girih lattice over it, the panel scrim over that, the ember
// gradient inside the furnace, the cold light inside the recess — stacked in the
// order the scene stacks them, and each ink is composited onto it at the alpha
// the scene actually uses. Measuring the constants instead is how COUNTERPOISE
// shipped two literal 1.00:1 cases: they were overlays, and nobody composited
// them.
//
// What the first pass found, before anything moved:
//
//   | readable element             | was    |
//   |------------------------------|--------|
//   | "SHEAR OFF THE LIT NUMBER"   | 2.45:1 |
//   | the slag count, none in lane | 1.15:1 |
//   | the slag count, some in lane | 1.92:1 |
//   | "FURNACE", nothing to melt   | 2.81:1 |
//   | a brick's value on the wall  | 2.58:1 |
//   | "the alley is quiet"         | 2.83:1 |
//   | "n buried"                   | 2.85:1 |
//
// The first of those is the whole rule of the game, in the one place a child
// looks for it, at two and a half to one. The founder's first report on this
// pack was *"the instructions are confusing and I really have no idea what I'm
// doing"*, and one of the reasons is that the instruction was, measurably, not
// legible.
//
// **Nothing here dims an effect.** The ember gradient in the furnace, the cold
// light in the recess and the girih lattice are all exactly as they were; every
// change is to an INK. Legibility on a lit ground is won by the type, not by
// turning the light down.

import {
  BONE,
  BONE_DIM,
  CELESTIAL,
  CELESTIAL_DIM,
  EMBER,
  EMBER_TEXT,
  GROOVE,
  INK,
  SLAG_TEXT,
  STONE_DEEP,
  STONE_EDGE,
  STONE_LIT,
  BRASS,
  BRASS_HOT,
} from "./palette.ts"

export type RGB = readonly [number, number, number]

/** Type a child has to read. WCAG AA body text, held at the body-text number. */
export const MIN_TEXT = 4.5

export function rgb(hex: string): RGB {
  const n = Number.parseInt(hex.replace("#", "").slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function luma(c: RGB): number {
  const f = (v: number): number => {
    const x = v / 255
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}

export function contrast(a: RGB, b: RGB): number {
  const la = luma(a)
  const lb = luma(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** `source-over` at `alpha` — every fill in this pack. Nothing here is additive. */
export function over(src: RGB, dst: RGB, alpha: number): RGB {
  const m = (i: 0 | 1 | 2): number => Math.round(src[i] * alpha + dst[i] * (1 - alpha))
  return [m(0), m(1), m(2)]
}

function lerp(a: RGB, b: RGB, t: number): RGB {
  const m = (i: 0 | 1 | 2): number => Math.round(a[i] + (b[i] - a[i]) * t)
  return [m(0), m(1), m(2)]
}

/**
 * The alley floor: the page gradient with the girih lattice drawn over it.
 *
 * The lattice is a 1.2px stroke of `STONE_EDGE` at 0.7, blitted at 0.55 — so its
 * strongest pixel is a fraction of a fraction. It is included anyway, because a
 * thin bright line under a numeral is exactly the kind of surface the fleet has
 * been caught not compositing twice already.
 */
export function alleySurfaces(): RGB[] {
  const stops = ["#161210", "#0f0a07", STONE_DEEP].map(rgb)
  return stops.map((b) => over(rgb(STONE_EDGE), b, 0.7 * 0.55 * 0.35))
}

/** The stone plate the problem is carved into, and its rim. */
export function wallSurfaces(): RGB[] {
  const plate = rgb(STONE_LIT)
  return [plate, rgb(STONE_EDGE)]
}

/**
 * Inside the recess — the one cold light in the game.
 *
 * Its fill is `CELESTIAL_DIM` at `0.12 + glow × 0.2` where `glow` runs from 0.24
 * at rest to 0.74 on a seated cut, so both ends are here: the brightest ground
 * is the one a child reads the rule against right after a correct answer.
 */
export function recessSurfaces(): RGB[] {
  const out: RGB[] = []
  for (const glow of [0.24, 0.74]) {
    for (const base of wallSurfaces()) out.push(over(rgb(CELESTIAL_DIM), base, 0.12 + glow * 0.2))
  }
  return out
}

/** A lever or gauge panel: `STONE_DEEP` at 0.72 over the alley. */
export function panelSurfaces(): RGB[] {
  return alleySurfaces().map((b) => over(rgb(STONE_DEEP), b, 0.72))
}

/**
 * The furnace, at a fraction `f` of its height measured from the TOP.
 *
 * The panel is a vertical gradient from `STONE_DEEP` at 0.9 down to `EMBER` at
 * `0.15 + heat × 0.5`, and `heat` runs 0.25 to 1 as the lever glows. Sampled at
 * the label's own y rather than over the whole panel, because the two labels sit
 * at fixed heights — 0.36 and 0.70 — and averaging a gradient a label never
 * touches is how a hot ground gets reported as a cool one.
 */
export function furnaceSurfaces(f: number): RGB[] {
  const out: RGB[] = []
  for (const heat of [0.25, 1]) {
    for (const base of alleySurfaces()) {
      const bottom = over(rgb(EMBER), base, 0.15 + heat * 0.5)
      const top = over(rgb(STONE_DEEP), base, 0.9)
      out.push(lerp(top, bottom, f))
    }
  }
  return out
}

/** The brass face of the SHEAR lever, where its word sits. */
export function shearFaceSurfaces(): RGB[] {
  const brass = rgb(BRASS)
  return [0, 0.25].map((press) => lerp(lerp(rgb(BRASS_HOT), brass, press), brass, 0.5))
}

/** The groove the coil rides in, and the alley beside it. */
export function grooveSurfaces(): RGB[] {
  return [rgb(GROOVE), ...alleySurfaces()]
}

/** An ink at an alpha, and the surfaces it is set on. */
export type Readable = {
  readonly name: string
  readonly ink: string
  readonly alpha: number
  readonly ground: RGB[]
}

/**
 * Every piece of type in this game, with the ground it is actually set on.
 *
 * The list is the audit. A readable element that is not in it is one nobody has
 * measured, so adding type to the scene means adding a row here.
 */
export function readables(): Readable[] {
  return [
    { name: '"the alley is quiet"', ink: BONE, alpha: 0.8, ground: recessSurfaces() },
    { name: "the carved problem", ink: BONE, alpha: 0.86, ground: recessSurfaces() },
    { name: "the demand, lit", ink: CELESTIAL, alpha: 1, ground: recessSurfaces() },
    { name: '"SHEAR OFF THE LIT NUMBER"', ink: BONE, alpha: 0.85, ground: recessSurfaces() },
    { name: "the cradle's ×n", ink: BONE, alpha: 0.8, ground: recessSurfaces() },
    { name: "the ingot's value", ink: BONE, alpha: 0.9, ground: recessSurfaces() },
    { name: "a brick's value", ink: BONE, alpha: 0.7, ground: wallSurfaces() },
    { name: '"n buried"', ink: SLAG_TEXT, alpha: 1, ground: grooveSurfaces() },
    { name: "the hint's 10×n", ink: CELESTIAL, alpha: 1, ground: grooveSurfaces() },
    { name: '"FURNACE", something to melt', ink: EMBER_TEXT, alpha: 1, ground: furnaceSurfaces(0.36) },
    { name: '"FURNACE", nothing to melt', ink: EMBER_TEXT, alpha: 0.72, ground: furnaceSurfaces(0.36) },
    { name: "the slag count, some", ink: EMBER_TEXT, alpha: 1, ground: furnaceSurfaces(0.7) },
    { name: "the slag count, none", ink: EMBER_TEXT, alpha: 0.8, ground: furnaceSurfaces(0.7) },
    { name: '"SHEAR"', ink: INK, alpha: 1, ground: shearFaceSurfaces() },
    { name: "the gauge's ×n", ink: BONE, alpha: 1, ground: panelSurfaces() },
    { name: "the hint's reading", ink: CELESTIAL, alpha: 1, ground: panelSurfaces() },
  ]
}

/**
 * The inks this pack used to set these in, kept so "it is better now" is a claim
 * about a change rather than about a constant.
 */
export function shipped(): Readable[] {
  return [
    { name: '"the alley is quiet"', ink: BONE_DIM, alpha: 1, ground: recessSurfaces() },
    { name: '"SHEAR OFF THE LIT NUMBER"', ink: BONE_DIM, alpha: 0.85, ground: recessSurfaces() },
    { name: "the cradle's ×n", ink: BONE_DIM, alpha: 1, ground: recessSurfaces() },
    { name: "a brick's value", ink: BONE_DIM, alpha: 0.7, ground: wallSurfaces() },
    { name: '"n buried"', ink: "#5c665a", alpha: 0.95, ground: grooveSurfaces() },
    { name: '"FURNACE", nothing to melt', ink: "#ffd0a0", alpha: 0.4, ground: furnaceSurfaces(0.36) },
    { name: "the slag count, some", ink: EMBER, alpha: 1, ground: furnaceSurfaces(0.7) },
    { name: "the slag count, none", ink: BONE_DIM, alpha: 0.6, ground: furnaceSurfaces(0.7) },
  ]
}

/** The worst contrast this ink at this alpha presents over its own ground. */
export function worst(r: Readable): number {
  let out = Infinity
  const ink = rgb(r.ink)
  for (const g of r.ground) out = Math.min(out, contrast(over(ink, g, r.alpha), g))
  return out
}
