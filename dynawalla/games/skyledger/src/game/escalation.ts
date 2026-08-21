// THE CHAIN — per-link escalation with named caps, and a hard snap-back.
//
// This is the piece of SKY LEDGER the canon singles out, so it is written as a
// pure state machine with no canvas anywhere near it and its own test file.
//
// **What escalates.** Four channels, and one more link in the chain raises all
// four by a fixed step until each hits a cap that has a name:
//
//   * `hitstopMs`  — the simulation freezes for this long on the next bloom.
//   * `bloom`      — 0..1, how far the lattice's light is pushed.
//   * `chromaRpx`  — chromatic split, in reference pixels.
//   * `timescale`  — the world slows toward `TIMESCALE_FLOOR`.
//
// **Why caps and not a curve.** A ramp with no ceiling turns a nine-link chain
// into an unreadable white screen at 0.2× speed, which is the "Extreme" arm of
// the juiciness study that measured *worse* play time than none at all. The
// caps are the product. They are exported by name so the test can assert them
// and so nobody has to read the arithmetic to know where the ceiling is.
//
// **The snap-back is the point.** When the chain ends the four channels do not
// decay — they are set to rest in a single step, and one AWE-class release
// fires carrying the length that was banked. An escalation that never comes
// back down is not spectacle, it is noise; the drop to stillness is what makes
// the climb feel like it was worth something. It also means the game is never
// sluggish a moment after a big chain, which matters more than it sounds: a
// child who answers fast must never wait on an animation.
//
// **AWE has no impact.** The release carries no hitstop and adds no trauma
// (Juice Bible class 8). A wall of light that shakes the screen reads as
// violence; a wall of light that does not reads as a cathedral.
//
// **Reduced motion is a branch, not a subtraction.** The channels that carry
// *feel* go to zero, but the link count is still information — it is what the
// child is playing for — so it is re-routed: `Escalation.links` is unchanged
// and the astrolabe's rim draws it as filled detents. Nothing is deleted; the
// channel changes.

/**
 * The chain dies this long after the last bloom.
 *
 * Seven seconds, and the number is not arbitrary: the instrumented cadence for
 * a two-digit sum with regrouping is 6 s at p50. A two-second window would make
 * a nine-link chain arithmetically impossible for the child this game is for,
 * which is how a centrepiece mechanic quietly becomes decoration. At seven, a
 * child working at their own pace keeps the chain and a child who stalls loses
 * it — so what the chain actually rewards is fluency, which is the thing worth
 * rewarding.
 */
export const CHAIN_WINDOW_MS = 7000

/** Links past this raise nothing further. The chain still counts; the feel is pinned. */
export const CHAIN_CAP = 9

// ── the named caps ──────────────────────────────────────────────────────────

/** Class 2 KNOCK at one link, class 4 BREAK at the cap. Never past BREAK. */
export const HITSTOP_BASE_MS = 48
export const HITSTOP_STEP_MS = 14
export const HITSTOP_CAP_MS = 160

export const BLOOM_BASE = 0.3
export const BLOOM_STEP = 0.09
export const BLOOM_CAP = 1

export const CHROMA_BASE_RPX = 0.6
export const CHROMA_STEP_RPX = 0.85
export const CHROMA_CAP_RPX = 6

export const TIMESCALE_STEP = 0.06
export const TIMESCALE_FLOOR = 0.55

/**
 * Total hitstop allowed in any rolling window of this length.
 *
 * The Juice Bible's anti-mush rule. One mark can catch several stars at once —
 * that is the Missile Command multi-kill and it is the best moment in the game
 * — and without a pool three simultaneous blooms at cap would freeze the world
 * for half a second.
 */
export const HITSTOP_POOL_WINDOW_MS = 250
export const HITSTOP_POOL_MS = 90

export type Channels = {
  /** How long the simulation freezes on the bloom about to be drawn. */
  readonly hitstopMs: number
  readonly bloom: number
  readonly chromaRpx: number
  readonly timescale: number
}

export const REST: Channels = { hitstopMs: 0, bloom: 0, chromaRpx: 0, timescale: 1 }

/** What the chain hands back when it lets go. */
export type Release = {
  /** Links banked. Zero is impossible — a release with no links is not emitted. */
  readonly links: number
  /** 0..1: how close the chain got to the cap. Drives the size of the ceremony. */
  readonly weight: number
  /** True when the chain was cut by a wrong mark rather than by the light fading. */
  readonly broken: boolean
}

/**
 * The channels a chain of `links` stands at.
 *
 * Pure, so the test can walk it link by link without a `Escalation` instance,
 * and so the render layer can ask "what would ten links look like" without
 * touching the live chain.
 */
export function channelsAt(links: number, reduced: boolean): Channels {
  if (links <= 0) return REST
  const n = Math.min(links, CHAIN_CAP)
  if (reduced) {
    // The branch. No freeze, no slowdown, no colour fringe — and the bloom
    // becomes a flat opacity the renderer cross-fades rather than a light that
    // grows. The information is not lost; `links` still carries it.
    return { hitstopMs: 0, bloom: 1, chromaRpx: 0, timescale: 1 }
  }
  return {
    hitstopMs: Math.min(HITSTOP_CAP_MS, HITSTOP_BASE_MS + HITSTOP_STEP_MS * (n - 1)),
    bloom: Math.min(BLOOM_CAP, BLOOM_BASE + BLOOM_STEP * (n - 1)),
    chromaRpx: Math.min(CHROMA_CAP_RPX, CHROMA_BASE_RPX + CHROMA_STEP_RPX * (n - 1)),
    timescale: Math.max(TIMESCALE_FLOOR, 1 - TIMESCALE_STEP * (n - 1)),
  }
}

/**
 * The live chain.
 *
 * Clock-driven rather than frame-driven: every method takes the wall-clock
 * moment it happened at, so the whole thing is testable with plain numbers and
 * so a pause can be handled by shifting one mark rather than by stopping a
 * timer nobody can see.
 */
export class Escalation {
  private readonly reduced: boolean
  private n = 0
  private deadline = 0
  private best = 0

  /** Hitstop already spent, as (spentAt, ms) pairs inside the pool window. */
  private spent: Array<{ at: number; ms: number }> = []

  constructor(reduced: boolean) {
    this.reduced = reduced
  }

  get links(): number {
    return this.n
  }

  get longest(): number {
    return this.best
  }

  get alive(): boolean {
    return this.n > 0
  }

  /** How long the current chain still has, in ms. Zero when there is none. */
  remainingMs(now: number): number {
    if (this.n === 0) return 0
    return Math.max(0, this.deadline - now)
  }

  /** 0..1 across the window, for the ring that drains on the astrolabe. */
  fuse(now: number): number {
    if (this.n === 0) return 0
    return Math.max(0, Math.min(1, this.remainingMs(now) / CHAIN_WINDOW_MS))
  }

  get channels(): Channels {
    return channelsAt(this.n, this.reduced)
  }

  /**
   * A star bloomed. One more link.
   *
   * Returns the channels *this* bloom is drawn with — the escalated ones, not
   * the ones before it — because the link the child just earned has to be the
   * one they see, not the next one.
   */
  link(now: number): Channels {
    this.n += 1
    if (this.n > this.best) this.best = this.n
    this.deadline = now + CHAIN_WINDOW_MS
    const channels = this.channels
    return { ...channels, hitstopMs: this.spendHitstop(now, channels.hitstopMs) }
  }

  /**
   * The light faded on its own. Returns the release, or `null` when there was
   * no chain to let go of.
   *
   * Called from the game's tick, so it is the one method that is time-driven
   * rather than event-driven.
   */
  expire(now: number): Release | null {
    if (this.n === 0 || now < this.deadline) return null
    return this.release(false)
  }

  /** A wrong mark. The chain is cut, and it is cut *now*, not at the deadline. */
  cut(): Release | null {
    if (this.n === 0) return null
    return this.release(true)
  }

  /**
   * The hard snap-back.
   *
   * Every channel goes to rest in one step — there is no decay curve here and
   * there must not be one. The renderer eases the *visible* consequence over
   * the release's own envelope; the chain's own state is at rest the instant
   * this returns, so a mark on the very next frame starts from nothing.
   */
  private release(broken: boolean): Release {
    const links = this.n
    this.n = 0
    this.deadline = 0
    return { links, weight: Math.min(1, links / CHAIN_CAP), broken }
  }

  /**
   * The anti-mush pool. Returns how much of `want` may actually be spent.
   *
   * Two hard constraints from the Juice Bible, and this implements the first:
   * total hitstop in any rolling 250 ms window is capped, so a five-star
   * multi-catch stays fluid instead of becoming a stutter.
   */
  private spendHitstop(now: number, want: number): number {
    this.spent = this.spent.filter((s) => now - s.at < HITSTOP_POOL_WINDOW_MS)
    const used = this.spent.reduce((sum, s) => sum + s.ms, 0)
    const allowed = Math.max(0, Math.min(want, HITSTOP_POOL_MS - used))
    if (allowed > 0) this.spent.push({ at: now, ms: allowed })
    return allowed
  }

  /** The host raised a sheet. Push the deadline out by the span behind it. */
  shift(byMs: number): void {
    if (this.n === 0) return
    this.deadline += Math.max(0, byMs)
    for (const s of this.spent) s.at += Math.max(0, byMs)
  }
}
