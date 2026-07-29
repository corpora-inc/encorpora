/**
 * A gesture that OPENS a surface must never also act on that surface.
 *
 * The tide bubble is drawn on the canvas and answered in a DOM overlay that is
 * a child of that same canvas stage. `Game.onDown` opens the gate from
 * `pointerdown`, synchronously, so by the time the finger lifts the four answer
 * chips are already laid out underneath it — and the browser then delivers the
 * `click` for that same tap to whatever is now at that coordinate. One tap
 * opened the gate AND picked an answer. It only happened "sometimes" because it
 * needed the bubble to be over where a chip landed.
 *
 * Moving the opener to `pointerup` does not help: the `click` still follows, at
 * the same coordinate, after the overlay exists.
 *
 * So the overlay is ARMED rather than merely shown. It ignores input for the
 * remainder of the gesture that opened it, and swallows the one `click` that
 * gesture synthesises on its way out. A guard, not a timeout: a timeout is a
 * guess about how fast a finger is, and it is wrong on a slow device in one
 * direction and on a quick tap in the other.
 *
 * How the two halves meet, because the order matters and is not obvious. The
 * pack-wide `pointerDown`/`pointerUp` are bound on the ROOT in the capture
 * phase and the overlay's `accept` on the GATE, also capture — and capture runs
 * outside-in, so the root always sees an event first. In the single-touch case
 * that means the lift is recorded before `accept` is asked about it, and what
 * actually stops the tap-through is `eatClick`. The `blocked` branch of
 * `accept` is for the second finger of a multi-touch: a `pointerdown` that
 * lands on the gate while the opening finger is still down.
 *
 * It is a plain state machine with no DOM in it, so `tapGuard.test.ts` can
 * drive the exact sequence a real touch emits — `pointerdown`, `pointerup`,
 * `click` — and assert what got through.
 *
 * Opening WITHOUT a finger down is the normal case for the offline tide at
 * launch and for the next question after a wrong answer, and it must not cost
 * the child a tap. `open()` therefore blocks only when a pointer is actually
 * down; otherwise the surface is live immediately.
 */

/** The pointer events the guard cares about, in the order a touch emits them. */
export type TapEvent = 'pointerdown' | 'pointerup' | 'click'

export class TapGuard {
  /** Is a finger down anywhere in the pack right now? */
  private down = false
  /** The surface opened inside a gesture that has not finished. */
  private blocked = false
  /** ...and that gesture still owes us a `click` we must not honour. */
  private eatClick = false

  /* --- what the pack as a whole sees, bound in the capture phase on the root */

  pointerDown(): void {
    this.down = true
    // A gesture that never produced its click (a cancel, a scroll) must not
    // leave the guard holding a veto for the child's next real tap.
    this.eatClick = false
  }

  pointerUp(): void {
    this.down = false
    if (this.blocked) {
      this.blocked = false
      this.eatClick = true
    }
  }

  /* ------------------------------------------- what the surface itself sees */

  /** The surface just appeared. */
  open(): void {
    this.blocked = this.down
    this.eatClick = false
  }

  /** The surface went away; nothing is owed. */
  close(): void {
    this.blocked = false
    this.eatClick = false
  }

  /** True while the opening gesture is still in flight. */
  get blocking(): boolean {
    return this.blocked
  }

  /**
   * May the surface act on this event? Call it for every event the overlay
   * receives, in the order they arrive, and act only when it returns true.
   */
  accept(e: TapEvent): boolean {
    if (this.blocked) {
      if (e === 'pointerup') this.eatClick = true
      return false
    }
    if (e === 'click' && this.eatClick) {
      this.eatClick = false
      return false
    }
    return true
  }
}
