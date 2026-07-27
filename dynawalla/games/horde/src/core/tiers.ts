/**
 * Quality tiers. The mid-range tablet is the FLOOR, never the ceiling.
 *
 * ULTRA is allowed to be genuinely absurd — two bloom octaves, chromatic
 * aberration, a persistent bioluminescent stain layer, 1800 simultaneous
 * enemies. LOW keeps every mechanic and every readable signal and drops only
 * ornament, so a child on a cheap tablet plays the same game.
 */

export type TierName = "low" | "mid" | "ultra"

export type Tier = {
  name: TierName
  maxEnemies: number
  maxBullets: number
  maxParticles: number
  maxNumbers: number
  maxGems: number
  /** Instances the sprite buffer can hold in one frame. */
  maxInstances: number
  /** 0 = none, 1 = one octave, 2 = two octaves. */
  bloomOctaves: number
  /** Persistent light-stain layer where the horde died. */
  stain: boolean
  /** Chromatic aberration driven by trauma. */
  aberration: boolean
  /** Render scale multiplier applied on top of devicePixelRatio. */
  renderScale: number
  /** Cap on devicePixelRatio. */
  maxDpr: number
  /** Particle count multiplier. */
  particleScale: number
  /** Enemy separation neighbour budget per enemy per frame. */
  separationBudget: number
}

const TIERS: Record<TierName, Tier> = {
  low: {
    name: "low",
    maxEnemies: 420,
    maxBullets: 420,
    maxParticles: 900,
    maxNumbers: 90,
    maxGems: 420,
    maxInstances: 4200,
    bloomOctaves: 0,
    stain: false,
    aberration: false,
    renderScale: 1,
    maxDpr: 1.25,
    particleScale: 0.42,
    separationBudget: 5,
  },
  mid: {
    name: "mid",
    maxEnemies: 900,
    maxBullets: 900,
    maxParticles: 2600,
    maxNumbers: 190,
    maxGems: 900,
    maxInstances: 11000,
    bloomOctaves: 1,
    stain: true,
    aberration: true,
    renderScale: 1,
    maxDpr: 1.75,
    particleScale: 1,
    separationBudget: 8,
  },
  ultra: {
    name: "ultra",
    maxEnemies: 1800,
    maxBullets: 1600,
    maxParticles: 6000,
    maxNumbers: 300,
    maxGems: 1600,
    maxInstances: 24000,
    bloomOctaves: 2,
    stain: true,
    aberration: true,
    renderScale: 1,
    maxDpr: 2,
    particleScale: 1.9,
    separationBudget: 10,
  },
}

export function tier(name: TierName): Tier {
  return TIERS[name]
}

/** A first guess from the device, before a single frame has been measured. */
export function detectTier(): TierName {
  if (typeof navigator === "undefined") return "mid"
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const cores = navigator.hardwareConcurrency ?? 4
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches
  const px = typeof window !== "undefined" ? window.innerWidth * window.innerHeight : 1e6

  if (mem >= 8 && cores >= 8 && !(coarse && px < 500000)) return "ultra"
  if (mem <= 2 || cores <= 3) return "low"
  return "mid"
}

/**
 * A running frame-time judge. It only ever steps *down*, and only on sustained
 * evidence, so a single hitch during a level-up never costs a child their
 * bloom for the rest of the run.
 */
export class TierGovernor {
  private samples = new Float32Array(120)
  private i = 0
  private filled = 0
  private cooldown = 4
  current: TierName

  constructor(current: TierName) {
    this.current = current
  }

  /** @returns the new tier if it changed, else null. */
  sample(dtMs: number): TierName | null {
    this.samples[this.i] = dtMs
    this.i = (this.i + 1) % this.samples.length
    if (this.filled < this.samples.length) this.filled++
    if (this.filled < this.samples.length) return null
    if (this.cooldown > 0) {
      this.cooldown--
      this.filled = 0
      return null
    }

    // 90th-percentile-ish: how bad are the bad frames, not the average.
    const sorted = Array.prototype.slice.call(this.samples, 0, this.filled).sort((a: number, b: number) => a - b)
    const p90 = sorted[Math.floor(sorted.length * 0.9)] as number
    this.filled = 0

    if (p90 > 26 && this.current === "ultra") {
      this.current = "mid"
      this.cooldown = 6
      return "mid"
    }
    if (p90 > 30 && this.current === "mid") {
      this.current = "low"
      this.cooldown = 999999
      return "low"
    }
    return null
  }
}
