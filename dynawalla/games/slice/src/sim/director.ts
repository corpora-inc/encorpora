// The director — what gets thrown, when, and how hard.
//
// The escalation curve is the whole reason this has to hold for twenty minutes
// instead of ninety seconds. Nothing here has a completion state; every knob is
// a saturating curve on elapsed time, so minute nineteen is harder than minute
// three and there is no top.
//
// Throw choreography is the quiet half of why the format works. Objects come in
// **waves**, staggered by 60–150ms across a fanned launch band, so a single
// swipe path can take three of them. Apex is placed between 58% and 84% of the
// screen height, which is where an object is slowest and therefore where the
// game is secretly asking you to cut.

import { Rng } from "../core/rng.ts"
import type { NumberPool } from "./factor.ts"

export type Phase = "calm" | "market" | "rush"

export type Throw = {
  kind: "numeral" | "bomb" | "sigil"
  value: number
  delayMs: number
  /** 0..1 across the launch band. */
  bandT: number
  /** Apex as a fraction of screen height. */
  apex: number
}

export class Director {
  private rng: Rng
  private pool: NumberPool
  elapsed = 0
  private nextWaveIn = 0.45
  private nextSigilIn = 5.5
  /** Seconds of MARKET RUSH remaining. */
  rushLeft = 0
  private nextRushIn = 82
  private queue: Throw[] = []
  private queueT: number[] = []

  constructor(rng: Rng, pool: NumberPool) {
    this.rng = rng
    this.pool = pool
  }

  reset(): void {
    this.elapsed = 0
    this.nextWaveIn = 0.45
    this.nextSigilIn = 5.5
    this.rushLeft = 0
    this.nextRushIn = 82
    this.queue.length = 0
    this.queueT.length = 0
  }

  /** 0 at the start, saturating toward 1. Drives every other curve. */
  get heat(): number {
    // Two stacked curves: a fast one that gets the first two minutes moving and
    // a slow one that keeps climbing for a twenty-minute session.
    const fast = 1 - Math.exp(-this.elapsed / 70)
    const slow = 1 - Math.exp(-this.elapsed / 420)
    return Math.min(1, fast * 0.62 + slow * 0.48)
  }

  get phase(): Phase {
    if (this.rushLeft > 0) return "rush"
    return this.heat > 0.5 ? "market" : "calm"
  }

  /** Host difficulty for the next sigil: 1 → 10, but never ahead of the player. */
  questionDifficulty(accuracy: number): number {
    const base = 1 + this.heat * 7
    // Accuracy nudges by at most ±1.5 so a bad patch eases off without the
    // difficulty visibly yo-yoing.
    const adj = (accuracy - 0.72) * 4
    return Math.max(1, Math.min(10, Math.round(base + Math.max(-1.5, Math.min(1.5, adj)))))
  }

  private waveInterval(): number {
    if (this.rushLeft > 0) return 0.4
    const h = this.heat
    const base = 1.85 - h * 0.99 // 1.85s → 0.86s
    return this.quiet ? base * 1.5 : base
  }

  /** Set while a question is on screen; the market throttles, never stops. */
  quiet = false

  private waveSize(): number {
    if (this.rushLeft > 0) return this.rng.int(3, 5)
    const h = this.heat
    // A live question is a beat. Thinning the wave keeps the lantern row clear
    // without ever freezing the game — the fruit keeps coming, just fewer.
    if (this.quiet) return this.rng.int(1, 2)
    // Never one lonely object: an empty screen in the first ten seconds is the
    // difference between "a game" and "a worksheet with a countdown".
    const lo = 2 + Math.floor(h * 2)
    const hi = 3 + Math.floor(h * 2.6)
    return this.rng.int(lo, hi)
  }

  private omegaCap(): number {
    // How deep a factor tree may be. Starts at 2 (one cut, then two primes) and
    // climbs to 5 (a 96 or a 144 — a genuine cascade).
    const h = this.heat
    if (this.rushLeft > 0) return Math.min(this.pool.maxOmega, 3 + Math.round(h * 2))
    return Math.min(this.pool.maxOmega, 2 + Math.round(h * 3))
  }

  private bombChance(): number {
    if (this.rushLeft > 0) return 0 // a rush is a pure reward; never a trap
    if (this.elapsed < 16) return 0 // the first sixteen seconds are safe
    return Math.min(0.15, (this.elapsed - 16) / 620)
  }

  private pickValue(): number {
    const cap = this.omegaCap()
    // Bias toward the deepest bucket allowed — cascades are the fun — but keep
    // primes in circulation at every heat so the payoff colour stays familiar.
    const r = this.rng.next()
    let w: number
    if (r < 0.16) w = 1
    else if (r < 0.42) w = Math.max(1, cap - 2)
    else if (r < 0.76) w = Math.max(1, cap - 1)
    else w = cap
    const bucket = this.pool.byOmega[Math.min(w, this.pool.byOmega.length - 1)] ?? this.pool.primes
    if (bucket.length === 0) return this.rng.pick(this.pool.primes)
    return this.rng.pick(bucket)
  }

  /**
   * Advance. Returns the throws that should happen *now*; the caller launches
   * them. Never allocates on a frame with nothing to launch.
   */
  step(dt: number, out: Throw[]): number {
    this.elapsed += dt
    let n = 0

    if (this.rushLeft > 0) {
      this.rushLeft -= dt
      // The crest passed and the board is coming down. THE SPLIT has no
      // levels and no ending, so the settle after a rush is the only place in
      // it a child is finished with something rather than interrupted.
      if (this.rushLeft <= 0) this.rushJustEnded = true
    }

    // Release anything whose stagger has elapsed.
    for (let i = 0; i < this.queue.length; i++) {
      const t = (this.queueT[i] as number) - dt * 1000
      this.queueT[i] = t
      if (t <= 0) {
        out[n++] = this.queue[i] as Throw
        this.queue.splice(i, 1)
        this.queueT.splice(i, 1)
        i--
      }
    }

    this.nextWaveIn -= dt
    if (this.nextWaveIn <= 0) {
      this.nextWaveIn = this.waveInterval() * this.rng.range(0.82, 1.2)
      const size = this.waveSize()
      // A fanned band: consecutive objects in a wave land next to each other so
      // one stroke can take the set. The band is narrow when the wave is small.
      const bandCentre = this.rng.range(0.22, 0.78)
      const bandWidth = Math.min(0.62, 0.13 * size)
      const bombP = this.bombChance()
      for (let i = 0; i < size; i++) {
        const f = size === 1 ? 0.5 : i / (size - 1)
        const bandT = Math.max(0.06, Math.min(0.94, bandCentre + (f - 0.5) * bandWidth))
        const isBomb = this.rng.chance(bombP)
        this.queue.push({
          kind: isBomb ? "bomb" : "numeral",
          value: isBomb ? 0 : this.pickValue(),
          delayMs: 0,
          bandT,
          apex: this.rng.range(0.58, 0.84),
        })
        this.queueT.push(i * this.rng.range(55, 150))
      }
    }

    this.nextSigilIn -= dt
    if (this.nextSigilIn <= 0) {
      this.nextSigilIn = (13 - this.heat * 6.2) * this.rng.range(0.9, 1.12)
      this.queue.push({
        kind: "sigil",
        value: 0,
        delayMs: 0,
        bandT: this.rng.range(0.28, 0.72),
        apex: this.rng.range(0.62, 0.78),
      })
      this.queueT.push(0)
    }

    this.nextRushIn -= dt
    if (this.nextRushIn <= 0 && this.rushLeft <= 0 && this.elapsed > 60) {
      this.rushLeft = 9
      this.rushJustStarted = true
      this.nextRushIn = this.rng.range(88, 118)
    }

    return n
  }

  /** Set on the frame a rush starts; the caller reads and clears it. */
  rushJustStarted = false
  /** Set on the frame a rush finishes. Read and cleared the same way. */
  rushJustEnded = false
}
