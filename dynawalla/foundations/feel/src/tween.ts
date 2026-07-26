// The tween runtime. Fixed capacity, struct-of-arrays, zero allocation on the
// hot path.
//
// ## Why this is not "just use GSAP"
//
// GSAP is excellent and it allocates a tween object, a target-proxy and a
// property-tween record per call. At the juice density this product wants —
// several tweens per answer, a child answering every three seconds, an
// eight-hour school day — that is a steady stream of short-lived objects. On a
// mid-range Android WebView a minor GC is 2–6 ms, which is a dropped frame at
// 60 Hz, and it lands *exactly* when the child does something, because that is
// when the allocation happened. Juice that stutters when you use it is worse
// than no juice.
//
// So: a pre-allocated pool of `capacity` slots held in typed arrays. Starting a
// tween writes numbers into existing arrays and returns an integer handle.
// `bench/cpu.mjs` measures bytes-allocated-per-tween; the number in README.md
// is what it printed.
//
// ## Handles carry a generation
//
// A raw slot index is a use-after-free waiting to happen: prototype code holds
// a handle, the tween finishes, the slot is recycled by someone else, and the
// stale `cancel()` kills an unrelated animation. The handle packs a generation
// counter, so a stale handle resolves to nothing.
//
// ## Everything must be fast-forwardable
//
// `settle(channel)` jumps every live tween to its end value, applies it, and
// fires its completion — synchronously, within one frame. That is the
// mechanism behind "ordinary success is interruptible": the child's next tap
// does not cancel the flourish half-drawn, it *completes* it instantly, so the
// screen is always in a valid end state and never mid-pose.

import { EASE, type EaseFn, type EaseName } from "./ease.ts"

/** Which clock channel a tween advances on. */
export const CH_WORLD = 0
/** Unscaled, but stops when the app is paused. Presentation animations. */
export const CH_UI = 1
/** Wall clock. Runs through hitstop and slow-motion. */
export const CH_REAL = 2

export type TweenChannel = typeof CH_WORLD | typeof CH_UI | typeof CH_REAL

/** Opaque. Pack of slot index and generation. `0` is the null handle. */
export type TweenHandle = number

const FREE = 0
const RUNNING = 1
const DONE = 2

type Applier = (obj: object, key: string, value: number) => void

/** Default applier: plain property assignment. Covers Vector3, DOM style, etc. */
const assign: Applier = (obj, key, value) => {
  ;(obj as Record<string, number>)[key] = value
}

export interface ToOptions {
  /** ms to wait before the tween starts moving. Staggering is done with this. */
  delayMs?: number
  channel?: TweenChannel
  /** Go to `to` then back to `from` within `durationMs`. For punches. */
  pingpong?: boolean
  /**
   * Called once when the tween reaches its end — including when `settle()`
   * fast-forwards it. Pass a hoisted function; an inline arrow allocates a
   * closure per call and defeats the point of this file.
   */
  onDone?: (() => void) | null
  /** Custom write. Defaults to `obj[key] = v`. */
  applier?: Applier
}

export class Tweens {
  readonly capacity: number

  private readonly from: Float64Array
  private readonly to: Float64Array
  private readonly elapsed: Float64Array
  private readonly duration: Float64Array
  private readonly delay: Float64Array
  private readonly state: Uint8Array
  private readonly channel: Uint8Array
  private readonly flags: Uint8Array
  private readonly generation: Uint16Array
  private readonly eases: (EaseFn | null)[]
  private readonly targets: (object | null)[]
  private readonly keys: (string | null)[]
  private readonly dones: ((() => void) | null)[]
  private readonly appliers: (Applier | null)[]

  /**
   * Dense list of live slot indices, so `update` and `settle` cost O(live)
   * rather than O(capacity).
   *
   * The first build allocated with a rotating cursor and iterated up to the
   * high-water mark. That is correct and it is 17× slower than this on the
   * commonest operation, because the cursor sweeps the whole pool, the
   * high-water mark reaches capacity within a second of play, and thereafter
   * every frame walks 512 slots to find the two that are live. Measured:
   * 870 ns → 51 ns for start-plus-settle at capacity 512. It was invisible
   * because "we use a pool" sounds like it settles the question.
   */
  private readonly active: Int32Array
  private readonly slotPos: Int32Array
  private readonly free: Int32Array
  private activeCount = 0
  private freeCount: number
  /** Incremented whenever the pool is full and a start is dropped. */
  overflows = 0

  constructor(capacity = 256) {
    this.capacity = capacity
    this.from = new Float64Array(capacity)
    this.to = new Float64Array(capacity)
    this.elapsed = new Float64Array(capacity)
    this.duration = new Float64Array(capacity)
    this.delay = new Float64Array(capacity)
    this.state = new Uint8Array(capacity)
    this.channel = new Uint8Array(capacity)
    this.flags = new Uint8Array(capacity)
    this.generation = new Uint16Array(capacity)
    this.eases = new Array<EaseFn | null>(capacity).fill(null)
    this.targets = new Array<object | null>(capacity).fill(null)
    this.keys = new Array<string | null>(capacity).fill(null)
    this.dones = new Array<(() => void) | null>(capacity).fill(null)
    this.appliers = new Array<Applier | null>(capacity).fill(null)
    this.active = new Int32Array(capacity)
    this.slotPos = new Int32Array(capacity).fill(-1)
    this.free = new Int32Array(capacity)
    for (let i = 0; i < capacity; i++) this.free[i] = capacity - 1 - i
    this.freeCount = capacity
  }

  /** Live tween count. O(1). */
  get liveCount(): number {
    return this.activeCount
  }

  /**
   * Animate `obj[key]` from `from` to `to` over `durationMs`.
   *
   * Returns `0` if the pool is full — a full pool drops the *newest* tween,
   * never an in-flight one, because half-finished animations left frozen
   * mid-pose are the worse failure. `overflows` counts it and the quality
   * governor surfaces it.
   */
  to2(
    obj: object,
    key: string,
    from: number,
    to: number,
    durationMs: number,
    ease: EaseName | EaseFn = "outCubic",
    opts: ToOptions = {},
  ): TweenHandle {
    const slot = this.alloc()
    if (slot < 0) {
      this.overflows++
      return 0
    }
    this.from[slot] = from
    this.to[slot] = to
    this.elapsed[slot] = 0
    this.duration[slot] = Math.max(1, durationMs)
    this.delay[slot] = opts.delayMs ?? 0
    this.state[slot] = RUNNING
    this.channel[slot] = opts.channel ?? CH_WORLD
    this.flags[slot] = opts.pingpong ? 1 : 0
    this.eases[slot] = typeof ease === "function" ? ease : EASE[ease]
    this.targets[slot] = obj
    this.keys[slot] = key
    this.dones[slot] = opts.onDone ?? null
    this.appliers[slot] = opts.applier ?? null
    return (slot + 1) | (this.generation[slot]! << 16)
  }

  /** Cancel where it stands. Does not apply the end value or fire `onDone`. */
  cancel(handle: TweenHandle): void {
    const slot = this.resolve(handle)
    if (slot < 0) return
    this.release(slot)
  }

  /** Jump to the end value, apply it, fire `onDone`. */
  finish(handle: TweenHandle): void {
    const slot = this.resolve(handle)
    if (slot < 0) return
    this.complete(slot)
  }

  isActive(handle: TweenHandle): boolean {
    return this.resolve(handle) >= 0
  }

  /**
   * Advance every tween on a channel. Called once per frame per channel by the
   * kit — a prototype never calls this.
   */
  update(ch: TweenChannel, dtMs: number): void {
    if (dtMs <= 0) return
    // Backwards: `complete()` swap-removes from `active`, and anything a
    // completion appends lands past the cursor and waits for the next frame.
    for (let a = this.activeCount - 1; a >= 0; a--) {
      const i = this.active[a]!
      if (this.channel[i] !== ch) continue

      let dt = dtMs
      const d = this.delay[i]!
      if (d > 0) {
        if (d >= dt) {
          this.delay[i] = d - dt
          continue
        }
        dt -= d
        this.delay[i] = 0
      }

      const e = this.elapsed[i]! + dt
      const dur = this.duration[i]!
      if (e >= dur) {
        this.complete(i)
        continue
      }
      this.elapsed[i] = e

      let k = e / dur
      if (this.flags[i]! & 1) k = k < 0.5 ? k * 2 : (1 - k) * 2
      const f = this.eases[i]!(k)
      const start = this.from[i]!
      const value = start + (this.to[i]! - start) * f
      const applier = this.appliers[i]
      if (applier) applier(this.targets[i]!, this.keys[i]!, value)
      else assign(this.targets[i]!, this.keys[i]!, value)
    }
  }

  /**
   * Fast-forward every tween on `ch` (or all channels) to its end state, now.
   * Synchronous, bounded by the pool size, and the reason the kit can promise
   * that an interrupted reaction never leaves the screen mid-pose.
   */
  settle(ch?: TweenChannel): number {
    let n = 0
    for (let a = this.activeCount - 1; a >= 0; a--) {
      const i = this.active[a]!
      if (ch !== undefined && this.channel[i] !== ch) continue
      this.complete(i)
      n++
    }
    return n
  }

  clear(): void {
    for (let a = this.activeCount - 1; a >= 0; a--) this.release(this.active[a]!)
  }

  /* ------------------------------------------------------------- internals */

  private complete(slot: number): void {
    const pingpong = (this.flags[slot]! & 1) !== 0
    // A pingpong's end state is where it started, not `to`.
    const end = pingpong ? this.from[slot]! : this.to[slot]!
    const applier = this.appliers[slot]
    const obj = this.targets[slot]!
    const key = this.keys[slot]!
    if (applier) applier(obj, key, end)
    else assign(obj, key, end)
    const done = this.dones[slot]
    this.release(slot)
    // Fire *after* release so an `onDone` that starts a new tween can reuse
    // this slot rather than overflowing a full pool.
    if (done) done()
  }

  private alloc(): number {
    if (this.freeCount === 0) return -1
    const i = this.free[--this.freeCount]!
    this.slotPos[i] = this.activeCount
    this.active[this.activeCount++] = i
    return i
  }

  private release(slot: number): void {
    if (this.state[slot] === RUNNING) {
      // Swap-remove from the dense active list.
      const pos = this.slotPos[slot]!
      const last = this.active[--this.activeCount]!
      this.active[pos] = last
      this.slotPos[last] = pos
      this.slotPos[slot] = -1
      this.free[this.freeCount++] = slot
    }
    this.state[slot] = FREE
    this.targets[slot] = null
    this.keys[slot] = null
    this.dones[slot] = null
    this.appliers[slot] = null
    this.eases[slot] = null
    this.generation[slot] = (this.generation[slot]! + 1) & 0xffff
  }

  private resolve(handle: TweenHandle): number {
    if (handle === 0) return -1
    const slot = (handle & 0xffff) - 1
    if (slot < 0 || slot >= this.capacity) return -1
    if (this.state[slot] !== RUNNING) return -1
    if (this.generation[slot] !== (handle >>> 16)) return -1
    return slot
  }
}
