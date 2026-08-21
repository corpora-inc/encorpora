// Visual register: risograph screenprint. Flat spot inks on near-black paper,
// hard edges, no gradients outside the glow passes, a little grain baked into
// every cell so the fills look pressed rather than filled.
//
// Ten games should look like ten games. This one looks like a poster.

export type Rgb = readonly [number, number, number]

export const INK = {
  paper: [13, 13, 18] as Rgb,
  paperLift: [22, 22, 30] as Rgb,
  pink: [255, 72, 176] as Rgb,
  red: [241, 80, 96] as Rgb,
  orange: [255, 108, 47] as Rgb,
  yellow: [255, 232, 0] as Rgb,
  green: [0, 196, 106] as Rgb,
  aqua: [94, 200, 229] as Rgb,
  blue: [47, 125, 209] as Rgb,
  purple: [139, 107, 196] as Rgb,
  bone: [244, 241, 232] as Rgb,
}

export function css(c: Rgb, alpha = 1): string {
  return alpha >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${alpha})`
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

/**
 * One ink pair per level. Each cut is printed somewhere between the two, so a
 * finished arena reads as layered strata — you can see the shape of every
 * decision you made.
 */
export type LevelInk = { a: Rgb; b: Rgb; name: string }

const INK_PAIRS: LevelInk[] = [
  { a: INK.aqua, b: INK.blue, name: "aqua" },
  { a: INK.green, b: INK.yellow, name: "green" },
  { a: INK.orange, b: INK.red, name: "orange" },
  { a: INK.purple, b: INK.pink, name: "purple" },
  { a: INK.blue, b: INK.aqua, name: "blue" },
  { a: INK.yellow, b: INK.orange, name: "yellow" },
  { a: INK.pink, b: INK.purple, name: "pink" },
  { a: INK.red, b: INK.orange, name: "red" },
  { a: INK.green, b: INK.aqua, name: "sea" },
]

export function levelInk(level: number): LevelInk {
  return INK_PAIRS[(level - 1) % INK_PAIRS.length] as LevelInk
}

/** Colour for a cell painted by claim `batch`, with a little press grain. */
export function batchColour(ink: LevelInk, batch: number, cell: number): Rgb {
  // Deterministic hash of (batch, cell) — same run, same speckle.
  let h = (batch * 2654435761) ^ (cell * 40503)
  h = (h ^ (h >>> 13)) >>> 0
  const t = ((batch * 37) % 100) / 100
  const base = mix(ink.a, ink.b, t)
  const grain = ((h & 15) - 7) * 1.5
  return [
    Math.max(0, Math.min(255, base[0] + grain)),
    Math.max(0, Math.min(255, base[1] + grain)),
    Math.max(0, Math.min(255, base[2] + grain)),
  ]
}
