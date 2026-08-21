/**
 * The escalation spine.
 *
 * ARENA has no completion state. It has DEPTHS: bands of the water you sink
 * into as the run goes on. Each depth changes the palette, the density, the
 * temper of the rivals, and adds exactly one new thing to be afraid of.
 *
 * Two things about this file were wrong and were measured wrong. The band was
 * chosen from CURRENT mass, so a bad patch dropped you back a depth: across a
 * five-minute soak the water flipped between DRIFT and THE CURRENT and back,
 * and the run oscillated instead of climbing — a treadmill, exactly what a
 * growth game must never be. And there were only six bands with the first
 * three set so far apart that a five-minute run saw TWO of them.
 *
 * So: nine bands, the index is monotone and never falls, and the clock is a
 * FLOOR as well as a ceiling. Mass may run you two bands ahead of the clock —
 * that is the reward for playing well — but the world sinks on its own whether
 * you are winning or not, which is the Vampire Survivors bargain and the only
 * honest way to make the twelfth minute different from the second.
 */

export type Depth = {
  index: number
  name: string
  /** Mass at which this depth may be reached ahead of the clock. */
  at: number
  /** Water colour, linear RGB, deliberately near-black so numerals win. */
  water: [number, number, number]
  /** Ambient light seeping down from a surface you will never see. */
  shaft: [number, number, number]
  /** Player bioluminescence. */
  self: [number, number, number]
  /** Edible motes. */
  food: [number, number, number]
  /** Anything larger than you. */
  threat: [number, number, number]
  /** Density multiplier for motes. */
  density: number
  /** How hard rivals push. 0 = timid drifters, 1 = relentless. */
  temper: number
  /** Fraction of motes that carry a negative value. */
  voidRate: number
  /** Rivals that actively lock on and pursue. */
  hunters: number
  /** A single enormous slow core worth a fortune. */
  leviathan: boolean
  /** Question difficulty handed to the Host during a Resonance. */
  difficulty: number
}

/**
 * Nine looks, and they are meant to be nine looks — an arc, not a hue rotation.
 * Cold blue, kelp green, a violet storm, volcanic ember, a bleached ice shelf,
 * electric indigo, an almost totally black trench lit by one acid green, gold
 * on oxblood, and finally white-hot on black where everything is a silhouette.
 * A child should be able to say which depth a screenshot came from.
 */
export const DEPTHS: Depth[] = [
  {
    index: 0,
    name: "DRIFT",
    at: 0,
    water: [0.004, 0.014, 0.038],
    shaft: [0.10, 0.42, 0.72],
    self: [0.62, 1.0, 0.80],
    food: [0.16, 0.82, 1.0],
    threat: [1.0, 0.14, 0.44],
    density: 1.0,
    temper: 0.22,
    voidRate: 0,
    hunters: 0,
    leviathan: false,
    difficulty: 2,
  },
  {
    index: 1,
    name: "THE CURRENT",
    at: 90,
    water: [0.004, 0.026, 0.030],
    shaft: [0.10, 0.62, 0.54],
    self: [0.86, 1.0, 0.62],
    food: [0.22, 1.0, 0.58],
    threat: [1.0, 0.10, 0.34],
    density: 1.06,
    temper: 0.34,
    voidRate: 0.08,
    hunters: 0,
    leviathan: false,
    difficulty: 3,
  },
  {
    index: 2,
    name: "THE CHURN",
    at: 380,
    water: [0.024, 0.008, 0.038],
    shaft: [0.56, 0.24, 0.96],
    self: [0.98, 0.82, 1.0],
    food: [0.70, 0.44, 1.0],
    threat: [1.0, 0.22, 0.28],
    density: 1.08,
    temper: 0.46,
    voidRate: 0.12,
    hunters: 1,
    leviathan: false,
    difficulty: 4,
  },
  {
    index: 3,
    name: "THE VENTS",
    at: 1300,
    water: [0.040, 0.010, 0.006],
    shaft: [0.94, 0.32, 0.08],
    self: [1.0, 0.86, 0.30],
    food: [1.0, 0.48, 0.06],
    threat: [1.0, 0.94, 0.42],
    density: 1.02,
    temper: 0.58,
    voidRate: 0.15,
    hunters: 2,
    leviathan: true,
    difficulty: 5,
  },
  {
    index: 4,
    name: "THE SHELF",
    at: 4200,
    water: [0.020, 0.027, 0.036],
    shaft: [0.78, 0.90, 1.0],
    self: [0.92, 0.99, 1.0],
    food: [0.72, 0.96, 1.0],
    threat: [1.0, 0.42, 0.06],
    density: 1.0,
    temper: 0.68,
    voidRate: 0.16,
    hunters: 2,
    leviathan: false,
    difficulty: 6,
  },
  {
    index: 5,
    name: "APEX",
    at: 13000,
    water: [0.020, 0.014, 0.052],
    shaft: [0.62, 0.56, 1.0],
    self: [1.0, 1.0, 1.0],
    food: [0.50, 0.70, 1.0],
    threat: [1.0, 0.20, 1.0],
    density: 0.98,
    temper: 0.78,
    voidRate: 0.17,
    hunters: 3,
    leviathan: true,
    difficulty: 7,
  },
  {
    index: 6,
    name: "THE ABYSSAL",
    at: 40000,
    water: [0.002, 0.007, 0.005],
    shaft: [0.10, 0.36, 0.20],
    self: [0.74, 1.0, 0.30],
    food: [0.56, 1.0, 0.14],
    threat: [1.0, 0.06, 0.16],
    density: 0.94,
    temper: 0.86,
    voidRate: 0.18,
    hunters: 4,
    leviathan: true,
    difficulty: 8,
  },
  {
    index: 7,
    name: "SOVEREIGN",
    at: 120000,
    water: [0.042, 0.008, 0.012],
    shaft: [1.0, 0.62, 0.18],
    self: [1.0, 0.94, 0.52],
    food: [1.0, 0.76, 0.20],
    threat: [0.30, 1.0, 1.0],
    density: 0.90,
    temper: 0.94,
    voidRate: 0.19,
    hunters: 5,
    leviathan: true,
    difficulty: 9,
  },
  {
    index: 8,
    name: "THE LAST LIGHT",
    at: 350000,
    water: [0.007, 0.006, 0.011],
    shaft: [1.0, 0.98, 0.92],
    self: [1.0, 1.0, 1.0],
    food: [1.0, 1.0, 0.90],
    threat: [1.0, 0.10, 0.62],
    density: 0.86,
    temper: 1.0,
    voidRate: 0.20,
    hunters: 6,
    leviathan: true,
    difficulty: 10,
  },
]

/** Seconds of play after which the world sinks a band on its own. */
export const DEPTH_CLOCK_SECONDS = 100

/** The band a given mass has genuinely earned. */
export function bandForMass(mass: number): number {
  for (let k = DEPTHS.length - 1; k >= 0; k--) if (mass >= (DEPTHS[k] as Depth).at) return k
  return 0
}

/**
 * Band, plus how far through it we are (0..1) for palette blending.
 *
 * `floorBand` is the ratchet: pass the band you were in last frame and the
 * water can never rise again. This is the fix for the oscillation — depth is a
 * record of how deep the run has been, not a readout of how you are doing
 * right now.
 */
export function depthFor(
  mass: number,
  seconds = Infinity,
  floorBand = 0,
): { depth: Depth; next: Depth; t: number } {
  const byMass = bandForMass(mass)
  let i = byMass
  let tTime = 0
  if (Number.isFinite(seconds)) {
    const byClock = Math.floor(seconds / DEPTH_CLOCK_SECONDS)
    // A run that is genuinely winning may sit two bands ahead of the clock.
    // One was too mean — a measured optimal run had earned band seven inside
    // ninety seconds and was still being shown band one — and unlimited would
    // spend all nine looks in the first three minutes.
    i = Math.max(byClock, Math.min(byMass, byClock + 2))
    tTime = Math.min(1, Math.max(0, (seconds - i * DEPTH_CLOCK_SECONDS) / DEPTH_CLOCK_SECONDS))
  }
  i = Math.min(DEPTHS.length - 1, Math.max(i, floorBand))
  const depth = DEPTHS[i] as Depth
  const next = (DEPTHS[i + 1] ?? DEPTHS[DEPTHS.length - 1]) as Depth
  const span = next.at - depth.at
  const tMass = span > 0 ? Math.min(1, Math.max(0, (mass - depth.at) / span)) : 1
  return { depth, next, t: Math.min(1, Math.max(tMass, tTime)) }
}

/**
 * Past THE LAST LIGHT the named depths stop but the run does not. Everything
 * keeps compounding — on mass for a player who is winning, on the clock for a
 * player who is merely surviving — so the eighteenth minute still escalates.
 */
export function overdrive(mass: number, seconds = Infinity): number {
  const last = DEPTHS[DEPTHS.length - 1] as Depth
  const byMass = mass > last.at ? Math.log(mass / last.at) / Math.log(6) : 0
  let byTime = 0
  if (Number.isFinite(seconds)) {
    const t0 = (DEPTHS.length - 1) * DEPTH_CLOCK_SECONDS
    byTime = seconds > t0 ? (seconds - t0) / 260 : 0
  }
  return Math.min(1.6, Math.max(byMass, byTime))
}
