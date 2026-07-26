// The clock. Everything in the kit hangs off exactly one of these.
//
// ## Three time channels, and why a math game needs all three
//
//   real   wall clock. Never stops, never scales. Input, audio scheduling and
//          the shake read this. If a child taps during a freeze frame the tap
//          is handled on `real`, which is the whole reason ordinary success
//          stays interruptible.
//   world  the simulation. Hitstop drives it to zero; slow-motion scales it.
//          Anything that reads as "the game" moves on this.
//   ui     unscaled but pausable. The next problem presenting, a panel sliding,
//          the timer bar. Freeze frames must not stall the presentation of the
//          next question or the reaction stops being a tail and becomes a wait.
//
// The distinction is the single most load-bearing decision in this file. A
// one-channel clock forces you to choose between "the freeze frame feels good"
// and "the child is never made to wait", and the product needs both.
//
// ## Hitstop is measured in milliseconds, not frames
//
// The canon (Celeste's `Celeste.Freeze(.05f)`, i.e. 3 frames at 60 Hz) is
// written in seconds for a fixed-60 engine. We ship on iPad ProMotion at 120 Hz
// and on 90 Hz Androids. A frame-counted hitstop tuned at 60 Hz is *half the
// duration* on an iPad Pro and feels like a dropped frame rather than an
// impact. Hitstop here is wall-clock milliseconds and is identical at 60, 90
// and 120 Hz. This is trap T-01 in README.md.
//
// ## One loop
//
// `start()` is idempotent. The repo has been bitten before: React StrictMode /
// hot reload mounts twice, two rAF loops run, everything moves at double speed
// and the profile shows two engines. The guard lives on the instance and
// `Feel` keeps exactly one instance on `globalThis`, which is what survives a
// hot reload.

/** Which time channel a consumer advances on. */
export type Channel = "real" | "world" | "ui"

/**
 * A frame's worth of time, in every channel. Handed to every tick callback.
 * This object is **reused across frames** — do not retain it. Zero allocation
 * per frame is not decoration here; see bench/cpu.mjs.
 */
export interface Tick {
  /** Wall-clock ms since the previous frame, clamped. Never 0 except frame 1. */
  dtReal: number
  /** Simulation ms: `0` during hitstop, `dtReal * timeScale` otherwise. */
  dtWorld: number
  /** Presentation ms: `dtReal` unless the clock is explicitly paused. */
  dtUi: number
  /** `performance.now()` at the top of this frame. */
  now: number
  /** Accumulated real ms since `start()`. */
  tReal: number
  /** Accumulated world ms. Stalls during hitstop. */
  tWorld: number
  /** Frame ordinal since `start()`. */
  frame: number
  /** Current world time scale, after smoothing. 1 = normal. */
  timeScale: number
  /** Hitstop ms still owed after this frame. */
  hitstopMs: number
  /** True if `dtReal` was clamped — a stall, a tab switch, a GC pause. */
  stalled: boolean
}

export type TickFn = (t: Tick) => void

/**
 * Longest frame the clock will admit. A backgrounded tab returns after minutes;
 * without this every spring in the kit integrates a 90-second step and the
 * scene explodes on resume. 50 ms also means a genuine 20 fps hitch degrades to
 * slow-motion rather than teleportation, which is the kinder failure.
 */
export const MAX_DT_MS = 50

export interface ClockOptions {
  /** Injected for tests. Defaults to `performance.now`. */
  now?: () => number
  /** Injected for tests. Defaults to `requestAnimationFrame`. */
  raf?: (cb: (t: number) => void) => number
  cancelRaf?: (h: number) => void
}

export class FeelClock {
  timeScale = 1
  /** Where `timeScale` is heading. Slow-motion snaps in and eases out. */
  private targetScale = 1
  /** ms over which `timeScale` returns to `targetScale`. */
  private recoverMs = 1
  private recoverElapsed = 0
  private recoverFrom = 1

  hitstopMs = 0
  paused = false

  tReal = 0
  tWorld = 0
  tUi = 0
  frame = 0

  private running = false
  private handle = 0
  private last = 0
  private readonly listeners: TickFn[] = []
  private readonly now: () => number
  private readonly raf: (cb: (t: number) => void) => number
  private readonly cancelRaf: (h: number) => void

  /** Reused every frame. Never allocate in the loop. */
  private readonly tick: Tick = {
    dtReal: 0,
    dtWorld: 0,
    dtUi: 0,
    now: 0,
    tReal: 0,
    tWorld: 0,
    frame: 0,
    timeScale: 1,
    hitstopMs: 0,
    stalled: false,
  }

  /** Rolling frame-time record for the quality governor. Fixed size, no alloc. */
  readonly frameTimes = new Float32Array(120)
  private frameCursor = 0

  constructor(opts: ClockOptions = {}) {
    const g = globalThis as unknown as {
      performance?: { now(): number }
      requestAnimationFrame?: (cb: (t: number) => void) => number
      cancelAnimationFrame?: (h: number) => void
    }
    this.now = opts.now ?? (g.performance ? () => g.performance!.now() : () => Date.now())
    this.raf =
      opts.raf ??
      g.requestAnimationFrame?.bind(g) ??
      ((cb) => setTimeout(() => cb(this.now()), 16) as unknown as number)
    this.cancelRaf =
      opts.cancelRaf ?? g.cancelAnimationFrame?.bind(g) ?? ((h) => clearTimeout(h))
  }

  /** Register a per-frame callback. Returns an unsubscribe. */
  onTick(fn: TickFn): () => void {
    this.listeners.push(fn)
    return () => {
      const i = this.listeners.indexOf(fn)
      if (i >= 0) this.listeners.splice(i, 1)
    }
  }

  /** Idempotent. Calling twice does not start a second rAF loop. */
  start(): void {
    if (this.running) return
    this.running = true
    this.last = this.now()
    this.handle = this.raf(this.loop)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    this.cancelRaf(this.handle)
  }

  dispose(): void {
    this.stop()
    this.listeners.length = 0
  }

  /**
   * Freeze the world for `ms` of wall clock. Repeated calls take the maximum
   * rather than summing — two impacts in the same frame should not stack into a
   * visible stall. This is the single most abused knob in the kit; the tier
   * table in `tiers.ts` is the only thing that should be calling it in a
   * prototype.
   */
  hitstop(ms: number): void {
    if (ms > this.hitstopMs) this.hitstopMs = ms
  }

  /**
   * Drop the world to `scale` instantly and ease back to 1 over `recoverMs`.
   *
   * Instant-in/eased-out is the canonical shape: a ramped entry reads as lag,
   * a ramped exit reads as recovery. A ramped *entry* is the mistake that makes
   * slow-motion feel like a performance problem instead of a moment.
   */
  slowmo(scale: number, recoverMs: number): void {
    this.timeScale = scale
    this.recoverFrom = scale
    this.targetScale = 1
    this.recoverMs = Math.max(1, recoverMs)
    this.recoverElapsed = 0
  }

  /**
   * Cancel every time distortion **now**, without a visible pop.
   *
   * Called synchronously at the top of every input handler. Hitstop is dropped
   * outright (it is short and freezing through a tap is the thing we are
   * preventing); the time scale is snapped because a child who has already
   * committed the next answer is not watching the previous flourish.
   */
  settleNow(): void {
    this.hitstopMs = 0
    this.timeScale = 1
    this.targetScale = 1
    this.recoverElapsed = this.recoverMs
  }

  /** p50/p95 of the last 120 frames, in ms. Feeds the quality governor. */
  frameStats(): { p50: number; p95: number; worst: number; n: number } {
    const seen: number[] = []
    for (let i = 0; i < this.frameTimes.length; i++) {
      const v = this.frameTimes[i]!
      if (v > 0) seen.push(v)
    }
    if (seen.length === 0) return { p50: 0, p95: 0, worst: 0, n: 0 }
    seen.sort((a, b) => a - b)
    const at = (q: number) => seen[Math.min(seen.length - 1, Math.floor(seen.length * q))]!
    return { p50: at(0.5), p95: at(0.95), worst: seen[seen.length - 1]!, n: seen.length }
  }

  /** Advance one frame by hand. The tests and the Node benches drive this. */
  step(rawDt: number): Tick {
    const t = this.tick
    const stalled = rawDt > MAX_DT_MS
    const dtReal = stalled ? MAX_DT_MS : rawDt

    // Slow-motion recovery runs on real time: a slow-motion that slowed its own
    // recovery would never come back.
    if (this.timeScale !== this.targetScale) {
      this.recoverElapsed += dtReal
      const k = Math.min(1, this.recoverElapsed / this.recoverMs)
      // outCubic: leaves the slowed state briskly, arrives at 1 without a step.
      const e = 1 - (1 - k) * (1 - k) * (1 - k)
      this.timeScale = this.recoverFrom + (this.targetScale - this.recoverFrom) * e
      if (k >= 1) this.timeScale = this.targetScale
    }

    let dtWorld: number
    if (this.hitstopMs > 0) {
      this.hitstopMs = Math.max(0, this.hitstopMs - dtReal)
      dtWorld = 0
    } else {
      dtWorld = dtReal * this.timeScale
    }

    const dtUi = this.paused ? 0 : dtReal

    this.tReal += dtReal
    this.tWorld += dtWorld
    this.tUi += dtUi
    this.frame++

    this.frameTimes[this.frameCursor] = dtReal
    this.frameCursor = (this.frameCursor + 1) % this.frameTimes.length

    t.dtReal = dtReal
    t.dtWorld = dtWorld
    t.dtUi = dtUi
    t.now = this.last
    t.tReal = this.tReal
    t.tWorld = this.tWorld
    t.frame = this.frame
    t.timeScale = this.timeScale
    t.hitstopMs = this.hitstopMs
    t.stalled = stalled

    for (let i = 0; i < this.listeners.length; i++) this.listeners[i]!(t)
    return t
  }

  private readonly loop = (): void => {
    if (!this.running) return
    this.handle = this.raf(this.loop)
    const now = this.now()
    const raw = now - this.last
    this.last = now
    this.step(raw)
  }
}
