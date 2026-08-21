// Input forgiveness, ported from the platformer canon to a touch surface.
//
// The three techniques that make Celeste feel fair are all really the same
// idea — *accept the input the player meant* — and all three have an exact
// analogue in a maths game on a tablet. Values from Celeste's own source
// (`Source/Player/Player.cs`, verified, not remembered):
//
//   private const float JumpGraceTime = 0.1f;      // coyote time, 100 ms
//   private const int UpwardCornerCorrection = 4;  // 4 px of nudge
//   private const int DashCornerCorrection = 4;
//
// ## Coyote time → the deadline that just passed
//
// Celeste lets you jump for 100 ms after you walk off a ledge. We let a tap
// land for `coyoteMs` after a timed round ends, a countdown hits zero, or the
// free-tier lamp burns out. A child who was already moving their finger when
// the timer expired committed to that answer *before* the deadline; refusing it
// is punishing reaction time, which is not the skill under test. 100 ms is
// Celeste's number and it is the right order of magnitude here too — long
// enough to cover the gap between decision and contact, short enough that
// nobody can exploit it.
//
// ## Input buffering → the tap during the flourish
//
// Celeste queues a jump pressed slightly before landing. We queue a tap that
// arrives during a blocking window (only `ascend` has one) or while the next
// problem is still presenting, and apply it the instant the surface is live.
// The window here is deliberately **longer** than a platformer's five frames:
// a child's follow-up tap is a considered action, not a rhythm-game input.
// 180 ms measured against the tail budgets in `tiers.ts` covers every
// non-blocking tier completely, so in practice a buffered tap on the common
// path is applied on the *next frame*, not at the end of anything.
//
// ## Corner correction → fat-finger hit slop
//
// Celeste nudges you up to 4 px sideways so a jump that clips a corner
// succeeds. The touch analogue is the highest-value one in the whole file: a
// tap that lands just outside a target snaps to it. A six-year-old's finger
// contact patch is ~10 mm and the reported point is its centroid, which sits
// low and toward the thumb; a tap the child *aimed* at a button routinely lands
// 6–10 CSS px below it. Without slop that is a mis-tap the child cannot explain
// and will blame themselves for.
//
// Slop is applied as *nearest target within the slop radius*, never as an
// enlarged hit box, because enlarged boxes overlap and then two adjacent
// answers both claim the tap. Nearest-centre resolves ties correctly and
// degrades to exact hit testing when targets are dense.

/** Anything tappable. Coordinates are CSS px in viewport space. */
export interface Target {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly enabled?: boolean
}

/** Celeste's `JumpGraceTime`, in ms. */
export const COYOTE_MS = 100
/** Longer than a platformer's, for the reason in the header. */
export const BUFFER_MS = 180
/**
 * Default hit slop, CSS px. Apple's 44×44 pt and Material's 48×48 dp minimums
 * are about *target size*; slop is about what happens outside it. 12 px is
 * about half a finger radius and, at the 64–96 px targets this product uses,
 * never bridges the gap between two adjacent answers.
 */
export const HIT_SLOP_PX = 12

/**
 * Nearest enabled target whose box, grown by `slop`, contains the point.
 *
 * Returns the target whose *centre* is nearest when several qualify, which is
 * the behaviour a child predicts. `null` if the tap was nowhere near anything —
 * a tap on empty space must stay a tap on empty space or the surface feels
 * possessed.
 */
export function nearestTarget(
  targets: readonly Target[],
  px: number,
  py: number,
  slop = HIT_SLOP_PX,
): Target | null {
  let best: Target | null = null
  let bestD2 = Infinity
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]!
    if (t.enabled === false) continue
    if (px < t.x - slop || px > t.x + t.w + slop) continue
    if (py < t.y - slop || py > t.y + t.h + slop) continue
    const cx = t.x + t.w * 0.5
    const cy = t.y + t.h * 0.5
    const dx = px - cx
    const dy = py - cy
    const d2 = dx * dx + dy * dy
    if (d2 < bestD2) {
      bestD2 = d2
      best = t
    }
  }
  return best
}

export interface BufferedInput<T> {
  readonly payload: T
  /** `performance.now()` at the moment the child actually touched the glass. */
  readonly atMs: number
}

/**
 * A one-slot input buffer with a staleness window.
 *
 * One slot, not a queue: a child mashing three times during a flourish means
 * "go", not "go three times". The newest press replaces the buffered one,
 * which is what a player expects and what Celeste's `VirtualButton` does.
 */
export class InputBuffer<T> {
  private payload: T | null = null
  private atMs = 0
  private readonly windowMs: number
  private readonly now: () => number

  /** Diagnostics: how often buffering actually saved an input. */
  saved = 0
  expired = 0

  constructor(windowMs = BUFFER_MS, now?: () => number) {
    this.windowMs = windowMs
    const g = globalThis as unknown as { performance?: { now(): number } }
    this.now = now ?? (g.performance ? () => g.performance!.now() : () => Date.now())
  }

  press(payload: T, atMs = this.now()): void {
    this.payload = payload
    this.atMs = atMs
  }

  /** Take the buffered input if it is still fresh. Clears either way. */
  consume(atMs = this.now()): BufferedInput<T> | null {
    if (this.payload === null) return null
    const p = this.payload
    const t = this.atMs
    this.payload = null
    if (atMs - t > this.windowMs) {
      this.expired++
      return null
    }
    this.saved++
    return { payload: p, atMs: t }
  }

  get pending(): boolean {
    return this.payload !== null
  }

  clear(): void {
    this.payload = null
  }
}

/**
 * Coyote time. `arm()` when the window opens; `expire()` when it closes;
 * `isOpen()` stays true for `graceMs` afterwards.
 */
export class Coyote {
  private closedAt = -Infinity
  private open = false
  private readonly graceMs: number
  private readonly now: () => number

  /** Diagnostics: inputs that only landed because of the grace period. */
  rescued = 0

  constructor(graceMs = COYOTE_MS, now?: () => number) {
    this.graceMs = graceMs
    const g = globalThis as unknown as { performance?: { now(): number } }
    this.now = now ?? (g.performance ? () => g.performance!.now() : () => Date.now())
  }

  arm(): void {
    this.open = true
    this.closedAt = -Infinity
  }

  expire(atMs = this.now()): void {
    if (!this.open) return
    this.open = false
    this.closedAt = atMs
  }

  isOpen(atMs = this.now()): boolean {
    if (this.open) return true
    const within = atMs - this.closedAt <= this.graceMs
    if (within) this.rescued++
    return within
  }

  /** Hard close, no grace. For "the session is over" rather than "time is up". */
  slam(): void {
    this.open = false
    this.closedAt = -Infinity
  }
}

/**
 * The WebView touch settings that have to be right or none of the above helps.
 *
 * `touch-action: manipulation` removes the 300 ms double-tap-zoom wait that
 * still exists on iOS for elements the browser thinks might be zoom targets.
 * `-webkit-tap-highlight-color: transparent` removes the grey flash that lands
 * *before* our feedback and reads as the real response. `user-select: none`
 * stops a slightly-long press turning into a text selection and a callout,
 * which on iOS cancels the pointer sequence outright.
 *
 * Applied to the document once by `Feel.attach()`.
 */
export const TOUCH_CSS = `
*{-webkit-tap-highlight-color:transparent}
html,body{overscroll-behavior:none;touch-action:manipulation}
.dw-tap{touch-action:manipulation;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
`
