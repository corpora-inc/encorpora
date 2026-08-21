// Quality tiers. The mid-range tablet sets the FLOOR — LOW is what has to hold
// 60fps, and ULTRA is allowed to be extravagant.
//
// The tier is picked once from device signals and then *ratchets down only*,
// driven by a rolling frame-time budget. It never ratchets back up mid-run: a
// tier that oscillates produces a visibly pulsing particle count, which is
// worse than being one tier low the whole way.

export type TierName = "low" | "high" | "ultra"

export type Quality = {
  name: TierName
  /** Ceiling on live particles. */
  particles: number
  /** Multiplies every emitter's burst count. */
  burst: number
  /** Render scale — devicePixelRatio is clamped to this. */
  maxDpr: number
  /** Soft glow under the automata and along the beams. */
  glow: boolean
  /** Samples per resonance trace. The phasing curve is drawn as a polyline. */
  traceSamples: number
  /** Motes drifting in the hall behind the lattice. */
  dust: number
}

export const TIERS: Record<TierName, Quality> = {
  low: { name: "low", particles: 420, burst: 0.45, maxDpr: 1.5, glow: false, traceSamples: 34, dust: 0 },
  high: { name: "high", particles: 1400, burst: 1, maxDpr: 2, glow: true, traceSamples: 62, dust: 46 },
  ultra: { name: "ultra", particles: 3200, burst: 1.8, maxDpr: 2.25, glow: true, traceSamples: 96, dust: 90 },
}

const ORDER: TierName[] = ["low", "high", "ultra"]

export function detectTier(): TierName {
  const nav = globalThis.navigator as (Navigator & { deviceMemory?: number }) | undefined
  const cores = nav?.hardwareConcurrency ?? 4
  const mem = nav?.deviceMemory ?? 4
  const px = (globalThis.screen?.width ?? 1024) * (globalThis.screen?.height ?? 768)

  // A phone with 8 fast cores still has a small thermal envelope, so cores
  // alone overrates mobile. Memory is the better proxy for "this is a cheap
  // tablet", and pixel count for "this is going to cost a lot to fill".
  if (cores <= 4 || mem <= 3) return "low"
  if (cores >= 8 && mem >= 8 && px >= 1_500_000) return "ultra"
  return "high"
}

/**
 * Watches frame time and ratchets the tier down when the device cannot hold the
 * budget. Deliberately slow to fire: a single 40ms frame is a GC pause, not a
 * verdict. It takes a sustained quarter-second of overrun.
 */
export class TierGovernor {
  private samples = new Float32Array(60)
  private i = 0
  private filled = 0
  private overrunMs = 0
  private cooldown = 0
  quality: Quality

  constructor(start: TierName) {
    this.quality = TIERS[start]
  }

  /** @returns true when the tier changed this frame. */
  sample(dtMs: number): boolean {
    this.samples[this.i] = dtMs
    this.i = (this.i + 1) % this.samples.length
    if (this.filled < this.samples.length) this.filled++

    if (this.cooldown > 0) {
      this.cooldown -= dtMs
      return false
    }
    // 20ms ≈ the point where a 60Hz display has certainly dropped a frame.
    this.overrunMs = dtMs > 20 ? this.overrunMs + (dtMs - 20) : Math.max(0, this.overrunMs - 4)
    if (this.overrunMs < 250) return false

    const idx = ORDER.indexOf(this.quality.name)
    if (idx <= 0) {
      this.overrunMs = 0
      return false
    }
    this.quality = TIERS[ORDER[idx - 1] as TierName]
    this.overrunMs = 0
    this.cooldown = 3000
    console.warn(`[beam] frame budget missed; quality → ${this.quality.name}`)
    return true
  }

  /** Median frame time over the window, for the on-screen perf readout. */
  medianMs(): number {
    if (this.filled === 0) return 0
    const a = Array.from(this.samples.slice(0, this.filled)).sort((x, y) => x - y)
    return a[a.length >> 1] as number
  }
}
