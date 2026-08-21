// The kit. One object, one call per moment.
//
// A prototype author writes three lines total:
//
//   feel.attach({ camera, invoke })                 // once, at boot
//   feel.start()                                    // once
//   feel.answer(outcome, { subject: tile })         // every answer
//
// and gets a tuned, coherent seven-system response — haptic, hitstop,
// slow-motion, shake, directional kick, punch-zoom, flash, squash, tone,
// particles — at the right tier, at the right quality for the device, that a
// child can interrupt, that is frame-rate independent, and that allocates
// nothing per call.
//
// Everything below the surface is separately usable. `feel.rig`, `feel.tweens`,
// `feel.clock` are public because a prototype that wants one specific thing
// should not have to fight the facade to get it — but the default path has to
// be one line or the foundation has not done its job.
//
// ## Ordering inside `react()` is load-bearing
//
// Haptics are dispatched first because they cross the IPC bridge and are the
// slowest to land. Time distortion is set before the visual systems so that the
// same frame that starts the flourish is already the slowed one. Audio is last
// because it is scheduled against the audio clock and does not care when it is
// called. This ordering is why the flash, the thump and the buzz land together
// instead of as three events.
//
// ## Interruption
//
// `press()` calls `interrupt()` synchronously before anything else. Every
// running flourish jumps to its **end state** — not cancelled mid-pose, not
// left half-drawn. That is the mechanism behind the product rule that a fast
// child never waits: there is no reaction in the kit that a tap does not end
// instantly, and no reaction that ends in an invalid frame.

import { FeelClock, type Tick, type TickFn } from "./clock.ts"
import { CameraRig, type CameraLike, type CameraRigOptions } from "./camera.ts"
import { Tweens, CH_REAL, CH_UI, CH_WORLD } from "./tween.ts"
import { ScreenFlash } from "./flash.ts"
import { FeelAudio } from "./audio.ts"
import { Haptics } from "./haptics.ts"
import { Squash } from "./squash.ts"
import {
  QualityGovernor,
  detectTier,
  readSignals,
  type QualitySettings,
  type QualityTier,
} from "./quality.ts"
import { TIERS, chooseTier, type FeelTier, type Outcome, type TierName } from "./tiers.ts"
import { InputBuffer, TOUCH_CSS, type Target, nearestTarget } from "./input.ts"

export interface AttachOptions {
  /** A `THREE.Camera`, or anything with `position`/`rotation`. Optional. */
  camera?: CameraLike | null
  /** Tauri's `invoke`, for native haptics. Omit in a browser prototype. */
  invoke?: ((cmd: string, args: Record<string, unknown>) => Promise<unknown>) | null
  /** Mount point for the flash overlay. Defaults to `document.body`. */
  parent?: HTMLElement
  rig?: CameraRigOptions
  /** Skip boot detection and pin a tier. */
  quality?: QualityTier
  /** Inject the touch CSS that makes taps feel instant. Default true. */
  touchCss?: boolean
}

export interface ReactOptions {
  /**
   * Impact direction, camera space. The kick pushes the camera *along* this,
   * so pass the direction the force travels. Defaults to a slight downward
   * settle, which is what "a thing landed in a slot" feels like.
   */
  dir?: readonly [number, number, number]
  /** Normalised screen position of the event, −1…1. Drives lookahead + emit. */
  at?: readonly [number, number]
  /** Something with a `.scale` to squash. A mesh, a sprite, a DOM proxy. */
  subject?: { scale: { x: number; y: number; z: number } } | null
  /** Scale the whole tier, 0…2. For a prototype that wants one louder moment. */
  gain?: number
}

/** Called when a tier wants particles. The prototype owns the particle system. */
export type EmitFn = (count: number, x: number, y: number, tier: FeelTier) => void

export class Feel {
  readonly clock = new FeelClock()
  readonly rig: CameraRig
  readonly tweens: Tweens
  readonly flash = new ScreenFlash()
  readonly audio = new FeelAudio()
  readonly haptics = new Haptics()
  readonly governor: QualityGovernor
  /** Squash channel for whatever `react` was last pointed at. */
  readonly squash = new Squash()

  private camera: CameraLike | null = null
  private subject: { scale: { x: number; y: number; z: number } } | null = null
  private emitters: EmitFn[] = []
  private blockUntilMs = 0
  private ascendSpent = false
  private readonly buffer = new InputBuffer<unknown>()
  private started = false

  /**
   * A branch, not a degradation. Motion systems go silent; flash becomes a slow
   * gentle wash; haptics and audio are untouched, because neither is motion and
   * a child who needs reduced motion still deserves the whole response.
   */
  reducedMotion = false

  /** Diagnostics, surfaced by the demo's HUD and asserted by the tests. */
  readonly stats = {
    reactions: 0,
    interrupts: 0,
    buffered: 0,
    blockedTaps: 0,
    lastInterruptMs: 0,
  }

  constructor(rigOpts: CameraRigOptions = {}) {
    const signals = readSignals()
    this.reducedMotion = signals.prefersReducedMotion ?? false
    const boot = detectTier(signals)
    this.governor = new QualityGovernor(boot, { ceiling: "ultra", onChange: this.onQuality })
    this.rig = new CameraRig(rigOpts)
    this.tweens = new Tweens(this.governor.settings.tweenCapacity)
    this.applyQuality(this.governor.settings)
  }

  /** The process-wide instance. Survives hot reload — one clock, one rAF loop. */
  static get(): Feel {
    const g = globalThis as unknown as { __dwFeel?: Feel }
    g.__dwFeel ??= new Feel()
    return g.__dwFeel
  }

  get quality(): QualitySettings {
    return this.governor.settings
  }

  attach(opts: AttachOptions = {}): void {
    this.camera = opts.camera ?? null
    this.haptics.attach({ invoke: opts.invoke ?? null })
    this.audio.attach()
    this.flash.attach({ parent: opts.parent })
    if (opts.quality) this.governor.force(opts.quality)
    if (opts.touchCss !== false) injectTouchCss()
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.clock.onTick(this.tick)
    this.clock.start()
  }

  stop(): void {
    this.clock.stop()
  }

  dispose(): void {
    this.clock.dispose()
    this.flash.dispose()
    this.audio.dispose()
    this.tweens.clear()
    this.emitters.length = 0
    this.started = false
    const g = globalThis as unknown as { __dwFeel?: Feel }
    if (g.__dwFeel === this) delete g.__dwFeel
  }

  onFrame(fn: TickFn): () => void {
    return this.clock.onTick(fn)
  }

  /** Register a particle emitter. The kit decides count and timing, not shape. */
  onEmit(fn: EmitFn): () => void {
    this.emitters.push(fn)
    return () => {
      const i = this.emitters.indexOf(fn)
      if (i >= 0) this.emitters.splice(i, 1)
    }
  }

  /* ------------------------------------------------------------------ input */

  /** False only during `ascend`'s 350 ms. Everything else is always live. */
  acceptsInput(): boolean {
    return this.clock.tReal >= this.blockUntilMs
  }

  /**
   * The top of every input handler.
   *
   * Interrupts any running flourish, then either reports that the input is live
   * now (`true`) or buffers it for the moment the gate opens (`false`). A
   * prototype's handler is:
   *
   *   if (!feel.press(answer)) return
   *   commit(answer)
   */
  press<T>(payload: T): boolean {
    this.interrupt()
    if (this.acceptsInput()) return true
    this.buffer.press(payload as unknown)
    this.stats.blockedTaps++
    return false
  }

  /** Take a buffered input if one is waiting and still fresh. */
  takeBuffered<T>(): T | null {
    if (!this.acceptsInput()) return null
    const b = this.buffer.consume(this.clock.tReal)
    if (!b) return null
    this.stats.buffered++
    return b.payload as T
  }

  /** Fat-finger correction. See `input.ts` for why this is nearest-centre. */
  hit(targets: readonly Target[], x: number, y: number, slopPx?: number): Target | null {
    return nearestTarget(targets, x, y, slopPx)
  }

  /**
   * Cancel every time distortion and fast-forward every flourish to its end
   * state. Synchronous, bounded, and measured — `bench/cpu.mjs` reports the
   * worst case with a full tween pool.
   */
  interrupt(): void {
    const t0 = perfNow()
    this.clock.settleNow()
    this.tweens.settle()
    this.rig.settle()
    this.flash.settle()
    this.squash.settle()
    this.blockUntilMs = 0
    this.stats.interrupts++
    this.stats.lastInterruptMs = perfNow() - t0
  }

  /* --------------------------------------------------------------- reacting */

  /**
   * The one-liner. Choose the tier from the outcome and fire it.
   *
   * `ascend` is spent at most once per session; a second major milestone
   * downgrades to `bloom` rather than being swallowed, because a milestone that
   * produces nothing reads as a bug.
   */
  answer(outcome: Outcome, opts: ReactOptions = {}): TierName {
    let tier = chooseTier(outcome)
    if (tier === "ascend") {
      if (this.ascendSpent) tier = "bloom"
      else this.ascendSpent = true
    }
    this.react(tier, opts)
    return tier
  }

  /** Fire a named tier directly. */
  react(name: TierName, opts: ReactOptions = {}): void {
    const t = TIERS[name]
    const gain = opts.gain ?? 1
    const q = this.governor.settings
    this.stats.reactions++

    // 1. Haptics first: async IPC, the slowest thing here to actually land.
    this.haptics.fire(t.haptic)

    const reduced = this.reducedMotion
    const motion = reduced ? 0 : q.motionScale * gain

    // 2. Time distortion before the visuals, so the first flourish frame is
    //    already the slowed one.
    if (!reduced) {
      if (t.hitstopMs > 0) this.clock.hitstop(t.hitstopMs)
      if (t.timeScale < 1) this.clock.slowmo(t.timeScale, t.timeRecoverMs)
      if (t.blockingMs > 0) this.blockUntilMs = this.clock.tReal + t.blockingMs
    }

    // 3. Camera.
    if (motion > 0) {
      const d = opts.dir ?? DEFAULT_DIR
      this.rig.impact(t.trauma * motion, t.kick * motion, d[0], d[1], d[2])
      // Punch-zoom scales with the tier but is capped: past ~6° the perspective
      // change reads as a lens artifact rather than as force.
      const fov = Math.min(6, (t.level + 1) * 0.9) * motion
      if (fov > 0.05) this.rig.punchFov(-fov)
      if (opts.at) this.rig.lookahead(opts.at[0] * 0.35, opts.at[1] * 0.35)
    }

    // 4. Flash. Reduced motion keeps it — light is not motion — but slows it
    //    to a wash and halves the peak.
    if (t.flash > 0) {
      const peak = reduced ? t.flash * 0.5 : t.flash * gain
      const ms = reduced ? 260 : 90 + t.level * 22
      this.flash.fire(peak, ms, t.flashColor)
    }

    // 5. Squash the thing that was hit.
    const subject = opts.subject ?? this.subject
    if (subject && motion > 0) {
      this.squash.punch((t.punchScale - 1) * motion)
      this.subject = subject
    }

    // 6. Particles: count is the kit's decision, shape is the prototype's.
    const count = Math.round(t.particles * q.particleScale * gain * (reduced ? 0.25 : 1))
    if (count > 0 && this.emitters.length > 0) {
      const x = opts.at?.[0] ?? 0
      const y = opts.at?.[1] ?? 0
      for (let i = 0; i < this.emitters.length; i++) this.emitters[i]!(count, x, y, t)
    }

    // 7. Audio last: scheduled against the audio clock, indifferent to when.
    if (t.tone !== null) {
      if (name === "nudge") this.audio.thud(0.6)
      else if (t.level >= 4) this.audio.chord(t.tone, t.level === 5 ? 6 : 4, 70, 0.75)
      else this.audio.note(t.tone, 0.45 + t.level * 0.12, 220 + t.level * 90)
    }
  }

  /** Sugar for the smallest response: a digit landing, a chip picked up. */
  tap(opts: ReactOptions = {}): void {
    this.react("tick", opts)
  }

  /** Reset the once-a-session budget. Call when a new session starts. */
  newSession(): void {
    this.ascendSpent = false
  }

  /* --------------------------------------------------------------- internals */

  private readonly tick = (t: Tick): void => {
    this.governor.update(t.dtReal, t.stalled)
    // Three channels, three updates. This is the whole reason for the split:
    // the world can be frozen while the UI keeps presenting the next problem.
    this.tweens.update(CH_WORLD, t.dtWorld)
    this.tweens.update(CH_UI, t.dtUi)
    this.tweens.update(CH_REAL, t.dtReal)
    this.rig.update(t.dtReal)
    this.flash.update(t.dtReal)
    this.squash.update(t.dtReal)
    if (this.subject) this.squash.applyTo(this.subject)
    if (this.camera) this.rig.applyTo(this.camera)
  }

  private readonly onQuality = (s: QualitySettings): void => {
    this.applyQuality(s)
  }

  private applyQuality(s: QualitySettings): void {
    this.rig.intensity = this.reducedMotion ? 0 : s.motionScale
    this.squash.intensity = this.reducedMotion ? 0 : s.motionScale
    this.flash.intensity = this.reducedMotion ? 0.5 : 1
  }
}

const DEFAULT_DIR = [0, -1, 0] as const

function perfNow(): number {
  const g = globalThis as unknown as { performance?: { now(): number } }
  return g.performance ? g.performance.now() : Date.now()
}

let cssInjected = false
function injectTouchCss(): void {
  if (cssInjected) return
  const doc = (globalThis as unknown as { document?: Document }).document
  if (!doc) return
  cssInjected = true
  const style = doc.createElement("style")
  style.setAttribute("data-dw-feel", "")
  style.textContent = TOUCH_CSS
  doc.head.appendChild(style)
}

/** The instance a prototype imports. */
export const feel = Feel.get()
