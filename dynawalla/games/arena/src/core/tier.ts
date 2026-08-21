/**
 * Quality tiering.
 *
 * The mid-range tablet sets the FLOOR, never the ceiling. ULTRA is allowed to
 * be genuinely staggering; LOW must hold 60fps on a 2019 iPad. We start from a
 * static guess and then let a running frame-time governor demote (and, if the
 * machine proves itself, promote once) so nobody ever plays a slideshow.
 */

export type TierName = "low" | "mid" | "high" | "ultra"

export type TierSpec = {
  name: TierName
  /** Render-target scale for the bloom chain. */
  bloomScale: number
  /** Number of separable blur passes. 0 disables bloom entirely. */
  bloomPasses: number
  /** Max simultaneous particles. */
  particles: number
  /** Motes alive in the arena. */
  motes: number
  /** Rival cores. */
  rivals: number
  /** Marine-snow backdrop instances. */
  snow: number
  /** Device pixel ratio ceiling. */
  dprCap: number
  /** Volumetric god-rays + caustic layer. */
  godrays: boolean
  /** Per-core refraction rim + chromatic dispersion on the bloom composite. */
  dispersion: boolean
}

const SPECS: Record<TierName, TierSpec> = {
  low: {
    name: "low",
    bloomScale: 0.25,
    bloomPasses: 1,
    particles: 380,
    motes: 115,
    rivals: 12,
    snow: 140,
    dprCap: 1.5,
    godrays: false,
    dispersion: false,
  },
  mid: {
    name: "mid",
    bloomScale: 0.35,
    bloomPasses: 2,
    particles: 900,
    motes: 155,
    rivals: 16,
    snow: 320,
    dprCap: 2,
    godrays: true,
    dispersion: false,
  },
  high: {
    name: "high",
    bloomScale: 0.5,
    bloomPasses: 3,
    particles: 1800,
    motes: 195,
    rivals: 20,
    snow: 620,
    dprCap: 2,
    godrays: true,
    dispersion: true,
  },
  ultra: {
    name: "ultra",
    bloomScale: 0.6,
    bloomPasses: 4,
    particles: 3200,
    motes: 240,
    rivals: 24,
    snow: 1100,
    dprCap: 2.25,
    godrays: true,
    dispersion: true,
  },
}

const ORDER: TierName[] = ["low", "mid", "high", "ultra"]

export function specFor(name: TierName): TierSpec {
  return SPECS[name]
}

/** A conservative static guess before we have any frame timings. */
export function guessTier(): TierName {
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number }
  const mem = nav.deviceMemory ?? 4
  const cores = nav.hardwareConcurrency ?? 4
  const coarse = matchMedia?.("(pointer: coarse)")?.matches ?? false
  const px = window.screen.width * window.screen.height * (window.devicePixelRatio || 1)

  // A phone or small tablet: start mid and let the governor promote.
  if (coarse) {
    if (mem >= 6 && cores >= 6 && px > 3_000_000) return "high"
    if (mem >= 4 && cores >= 4) return "mid"
    return "low"
  }
  if (mem >= 8 && cores >= 8) return "ultra"
  if (cores >= 6) return "high"
  return "mid"
}

/**
 * Watches frame time and moves the tier. Demotes readily (a child must never
 * see stutter); promotes exactly once, and only after a long clean stretch, so
 * the picture never oscillates.
 */
export class TierGovernor {
  spec: TierSpec
  private idx: number
  private acc = 0
  private frames = 0
  private badStreak = 0
  private goodStreak = 0
  private promotions = 0
  private onChange: (s: TierSpec) => void
  /** Rolling median-ish frame time in ms, for the readout. */
  ms = 16.6
  fps = 60

  constructor(start: TierName, onChange: (s: TierSpec) => void) {
    this.idx = ORDER.indexOf(start)
    this.spec = SPECS[start]
    this.onChange = onChange
  }

  /** Call once per frame with the raw dt in ms. */
  sample(dtMs: number): void {
    // Ignore obvious tab-switch spikes.
    if (dtMs > 400) return
    this.acc += dtMs
    this.frames++
    if (this.frames < 30) return

    const avg = this.acc / this.frames
    this.ms = this.ms * 0.6 + avg * 0.4
    this.fps = 1000 / this.ms
    this.acc = 0
    this.frames = 0

    if (avg > 21.5) {
      this.badStreak++
      this.goodStreak = 0
    } else if (avg < 14.5) {
      this.goodStreak++
      this.badStreak = 0
    } else {
      this.badStreak = 0
      this.goodStreak = 0
    }

    if (this.badStreak >= 2 && this.idx > 0) {
      this.idx--
      this.badStreak = 0
      this.apply()
    } else if (this.goodStreak >= 12 && this.idx < ORDER.length - 1 && this.promotions < 1) {
      this.idx++
      this.promotions++
      this.goodStreak = 0
      this.apply()
    }
  }

  /** Force a tier — used by the perf harness and the dev overlay. */
  force(name: TierName): void {
    this.idx = ORDER.indexOf(name)
    this.promotions = 99
    this.apply()
  }

  private apply(): void {
    this.spec = SPECS[ORDER[this.idx] as TierName]
    this.onChange(this.spec)
  }
}
