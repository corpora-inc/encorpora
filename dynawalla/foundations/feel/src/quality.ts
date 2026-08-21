// Quality tiers and the runtime governor.
//
// The brief: the mid-range tablet sets the **floor**, never the ceiling. So
// there are four tiers, ULTRA is genuinely staggering, and the machine decides
// which one it is running — twice. Once at boot from what it can see, and then
// continuously from what actually happened, because boot-time detection is a
// guess and a thermally-throttled iPad in a warm classroom at minute forty is
// not the device that booted.
//
// ## Boot detection is deliberately pessimistic
//
// `deviceMemory` is Chromium-only and clamped to 8 even on a 64 GB machine.
// `hardwareConcurrency` on an iPad reports performance+efficiency cores
// together. `WEBGL_debug_renderer_info` is gated behind a privacy flag in
// Safari and returns a masked string. Every signal is either missing, lying, or
// both, so boot detection picks the **lower** of what the signals suggest and
// lets the governor promote upward once frames prove it. Starting low and
// promoting is invisible; starting high and demoting is a visible stutter in
// the first ten seconds, which is exactly when a child decides what they think.
//
// ## The governor has hysteresis or it oscillates
//
// A naive "p95 > budget → demote" flips tiers every second at the boundary,
// and tier changes are visible. Demotion needs sustained evidence (2 s) and
// promotion needs much more (8 s) plus headroom, so the system settles.
//
// ## What a tier actually controls
//
// Not "effects on/off". Every tier draws every effect — a LOW-tier child gets
// the same *language*, at a smaller budget. Turning effects off by tier is how
// you end up shipping two different products.

export type QualityTier = "low" | "medium" | "high" | "ultra"

export interface QualitySettings {
  readonly tier: QualityTier
  /** Cap on `devicePixelRatio`. The single biggest lever on GPU cost. */
  readonly maxPixelRatio: number
  /** Multiplier on every tier's particle count. */
  readonly particleScale: number
  /** Multiplier on shake, kick and fov punch. Never 0 — see the header. */
  readonly motionScale: number
  /** Run the composited post-processing pass (flash, vignette, chroma, bloom). */
  readonly postFx: boolean
  /** Bloom inside the post pass. The expensive half of it. */
  readonly bloom: boolean
  /** Shadow map edge, or 0 for none. */
  readonly shadowMapSize: number
  /** Tween pool size. A bigger pool costs memory, not time. */
  readonly tweenCapacity: number
  /** Target frame budget in ms. 16.67 = 60 fps. */
  readonly frameBudgetMs: number
}

export const QUALITY: Readonly<Record<QualityTier, QualitySettings>> = {
  low: {
    tier: "low",
    maxPixelRatio: 1,
    particleScale: 0.3,
    motionScale: 0.8,
    postFx: false,
    bloom: false,
    shadowMapSize: 0,
    tweenCapacity: 96,
    frameBudgetMs: 16.67,
  },
  medium: {
    tier: "medium",
    maxPixelRatio: 1.5,
    particleScale: 0.6,
    motionScale: 1,
    postFx: true,
    bloom: false,
    shadowMapSize: 512,
    tweenCapacity: 192,
    frameBudgetMs: 16.67,
  },
  high: {
    tier: "high",
    maxPixelRatio: 2,
    particleScale: 1,
    motionScale: 1,
    postFx: true,
    bloom: true,
    shadowMapSize: 1024,
    tweenCapacity: 320,
    frameBudgetMs: 16.67,
  },
  ultra: {
    tier: "ultra",
    maxPixelRatio: 2.5,
    particleScale: 1.6,
    motionScale: 1.1,
    postFx: true,
    bloom: true,
    shadowMapSize: 2048,
    tweenCapacity: 512,
    frameBudgetMs: 16.67,
  },
}

const LADDER: readonly QualityTier[] = ["low", "medium", "high", "ultra"]

export interface DetectSignals {
  deviceMemoryGb?: number
  cores?: number
  pixelRatio?: number
  /** Unmasked GPU string if available. Usually is not. */
  renderer?: string
  /** Screen area in device pixels. A big canvas is a real cost. */
  devicePixels?: number
  prefersReducedMotion?: boolean
}

/** Read whatever this platform is willing to admit to. */
export function readSignals(): DetectSignals {
  const g = globalThis as unknown as {
    navigator?: { deviceMemory?: number; hardwareConcurrency?: number }
    devicePixelRatio?: number
    screen?: { width: number; height: number }
    matchMedia?: (q: string) => { matches: boolean }
  }
  const dpr = g.devicePixelRatio ?? 1
  const w = g.screen?.width ?? 0
  const h = g.screen?.height ?? 0
  return {
    deviceMemoryGb: g.navigator?.deviceMemory,
    cores: g.navigator?.hardwareConcurrency,
    pixelRatio: dpr,
    devicePixels: w * h * dpr * dpr,
    prefersReducedMotion: g.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  }
}

/**
 * Boot-time tier. Pessimistic by construction: each signal proposes a tier and
 * the **minimum** wins.
 */
export function detectTier(s: DetectSignals): QualityTier {
  let idx = 2 // start at "high" and let evidence pull it down

  const mem = s.deviceMemoryGb
  if (mem !== undefined) {
    // Chromium clamps this to 8, so 8 means "8 or more" and proves nothing
    // above high. 2 and 4 are real signals and they are bad ones.
    if (mem <= 2) idx = Math.min(idx, 0)
    else if (mem <= 4) idx = Math.min(idx, 1)
  }

  const cores = s.cores
  if (cores !== undefined) {
    if (cores <= 2) idx = Math.min(idx, 0)
    else if (cores <= 4) idx = Math.min(idx, 1)
  }

  // A large panel at a high DPR is the case that quietly kills mid-range
  // tablets: the device looks fine on paper and is filling 6 MP a frame.
  const px = s.devicePixels ?? 0
  if (px > 5_000_000 && (cores ?? 8) < 8) idx = Math.min(idx, 1)

  return LADDER[Math.max(0, Math.min(LADDER.length - 1, idx))]!
}

export interface GovernorOptions {
  /** Sustained ms over budget before demoting. */
  demoteAfterMs?: number
  /** Sustained ms comfortably under budget before promoting. */
  promoteAfterMs?: number
  /** Ceiling the governor may never exceed. Set by boot detection. */
  ceiling?: QualityTier
  onChange?: (settings: QualitySettings, reason: string) => void
}

/**
 * Watches p95 frame time and moves the tier.
 *
 * Feed it `dtReal` every frame. It keeps a 120-sample ring, which at 60 fps is
 * two seconds — long enough that a single GC pause cannot demote the whole app,
 * short enough to react before a child notices a sustained stutter.
 */
export class QualityGovernor {
  settings: QualitySettings
  private idx: number
  private ceilingIdx: number
  private overMs = 0
  private underMs = 0
  private readonly demoteAfterMs: number
  private readonly promoteAfterMs: number
  private readonly onChange: ((s: QualitySettings, reason: string) => void) | null

  private readonly ring = new Float32Array(120)
  private cursor = 0
  private filled = 0
  private readonly scratch = new Float32Array(120)

  /** Diagnostics. */
  demotions = 0
  promotions = 0

  constructor(start: QualityTier = "high", opts: GovernorOptions = {}) {
    this.idx = LADDER.indexOf(start)
    this.ceilingIdx = LADDER.indexOf(opts.ceiling ?? "ultra")
    if (this.idx > this.ceilingIdx) this.idx = this.ceilingIdx
    this.settings = QUALITY[LADDER[this.idx]!]!
    this.demoteAfterMs = opts.demoteAfterMs ?? 2000
    this.promoteAfterMs = opts.promoteAfterMs ?? 8000
    this.onChange = opts.onChange ?? null
  }

  /** p95 of the ring, in ms. 0 until the ring has 30 samples. */
  p95(): number {
    if (this.filled < 30) return 0
    const n = this.filled
    this.scratch.set(this.ring.subarray(0, n))
    const view = this.scratch.subarray(0, n)
    view.sort()
    return view[Math.min(n - 1, Math.floor(n * 0.95))]!
  }

  update(dtRealMs: number, stalled: boolean): void {
    // A clamped frame is a tab switch or a GC, not a rendering cost. Counting
    // it demotes the whole app because someone got a notification.
    if (stalled) return

    this.ring[this.cursor] = dtRealMs
    this.cursor = (this.cursor + 1) % this.ring.length
    if (this.filled < this.ring.length) this.filled++

    const budget = this.settings.frameBudgetMs
    const p = this.p95()
    if (p === 0) return

    if (p > budget * 1.25) {
      this.overMs += dtRealMs
      this.underMs = 0
      if (this.overMs >= this.demoteAfterMs && this.idx > 0) {
        this.idx--
        this.apply(`p95 ${p.toFixed(1)}ms over budget`)
        this.demotions++
        this.overMs = 0
      }
    } else if (p < budget * 0.7) {
      this.underMs += dtRealMs
      this.overMs = 0
      if (this.underMs >= this.promoteAfterMs && this.idx < this.ceilingIdx) {
        this.idx++
        this.apply(`p95 ${p.toFixed(1)}ms with headroom`)
        this.promotions++
        this.underMs = 0
      }
    } else {
      this.overMs = 0
      this.underMs = 0
    }
  }

  /** Force a tier, e.g. from a settings screen. Also becomes the new ceiling. */
  force(tier: QualityTier): void {
    this.idx = LADDER.indexOf(tier)
    this.ceilingIdx = this.idx
    this.apply("forced")
  }

  private apply(reason: string): void {
    this.settings = QUALITY[LADDER[this.idx]!]!
    this.filled = 0
    this.cursor = 0
    this.onChange?.(this.settings, reason)
  }
}
