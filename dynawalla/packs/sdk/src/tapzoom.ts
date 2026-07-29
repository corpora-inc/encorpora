// A double tap inside a pack must never scale the page it is framed by.
//
// ── What actually happens on an iPhone ───────────────────────────────────────
//
// A pack runs in a sandboxed, opaque-origin iframe. An iframe has no viewport
// and no page scale of its own: WebKit's double-tap-to-zoom recogniser lives on
// the WKWebView and page scale is a property of the TOP-LEVEL document. So a
// double tap on a game canvas scales the HOST. #677 removed the visible half of
// that — while a pack is mounted the host document cannot scroll, so the
// catalogue can no longer surface from behind a `fixed inset-0` stage — and
// left the other half standing: the page still SCALES, and the game visibly
// zooms under the child's finger mid-play.
//
// The host cannot fix that half. Touch events raised inside a cross-origin
// iframe are dispatched in the child realm and never cross the boundary; the
// host cannot see, let alone cancel, the tap that causes this. Prevention
// belongs to the pack document, which is this file — one place, and not a
// paragraph in twenty-seven games' entry files that a twenty-eighth will forget.
//
// ── Why the packs' own `touch-action: none` is not already enough ────────────
//
// Twenty-six of the twenty-seven shipping packs set `touch-action: none` on
// `html, body` and most set it again on the canvas, and the zoom was still
// reported from a device. So whatever `touch-action` does here, it does not
// reach the gesture that scales the top-level page.
//
// The likely reason, and it is reasoning rather than an observation: WebKit
// decides whether a tap may become a zoom in the UI process, against a
// touch-action region the web process publishes for the MAIN FRAME's scrolling
// tree. `touch-action` composes over an element's ancestors only up to its own
// document's root — the chain stops at the frame boundary — so a region
// computed inside an opaque-origin child has to be merged into the main frame's
// to have any effect on a main-frame gesture, and evidently is not. Each pack's
// `<meta name="viewport" content="user-scalable=no">` is dead for the same
// reason: a subframe has no viewport for it to describe.
//
// `preventDefault()` on a touch event is a different mechanism, not a stronger
// dose of the same one. It marks the touch sequence itself as handled, and that
// verdict is what the UI process waits for before it lets a gesture recogniser
// fire — which is why cancelling the second `touchend` was the way every
// pre-`touch-action` library stopped double-tap zoom on iOS. Unverified on a
// device: nobody in this repository has an iPhone in CI. What is proven below
// is the state machine, the listener wiring and the click accounting, in Node.
//
// ── The part that would be easy to get wrong ─────────────────────────────────
//
// `preventDefault()` on `touchend` also cancels the compatibility `click` for
// that tap. #678 deleted a guard from the HOST for exactly this: it ate the
// second press of "Erase everything", a second `addProfile`, and a correction
// between two cells of a segmented control 20px apart. Inside a pack the same
// cost lands on RUNNER's revive lanes, MERGE IDLE's chips, STACK's answer
// choices and game-chrome's help button — all bound to `click` — and on
// FOUNDRY's pedals, COLOSSUS's strikes and STACK's commit, which are rapid by
// design and must not lose a beat.
//
// A geometric test cannot separate those from a zoom: a child tapping the same
// pedal twice in 120ms IS two taps close in time and space. So this does not
// try. It cancels the tap's default action and then RE-DISPATCHES the `click`
// the cancellation swallowed, at the same coordinates on the same target, one
// microtask later so it still lands after the `touchend` it belongs to. The
// zoom is a default action of the touch and does not come back; the activation
// is not a default action of the touch and does.
//
// The accounting that follows from that: the FIRST tap of any chain is never
// cancelled, and every later tap is cancelled and re-clicked. One `click` per
// tap, always, whichever branch a tap took — which is the invariant the tests
// assert, because it is the one a game depends on.
//
// What a re-dispatched `click` does NOT carry is user activation: it is
// untrusted, so it cannot resume an `AudioContext` or enter fullscreen. That is
// why the first tap is left alone rather than cancelled for symmetry — a pack
// unlocks its audio on the first touch of a session, and that one is real.

/** How long after a tap a second tap can still be read as a double tap. */
export const DOUBLE_TAP_MS = 350

/**
 * How far apart two taps may be and still be one zoom gesture.
 *
 * Deliberately loose. WebKit's own slop is generous, an over-wide guard costs
 * only a re-dispatched `click` — which the child cannot tell from the real one
 * — and an under-wide one costs a zoom.
 */
export const DOUBLE_TAP_SLOP_PX = 30

/**
 * How far a finger may travel within one touch and still count as a tap.
 *
 * Past this the sequence is a drag: a swipe on a canvas, or the manual sheet
 * being finger-scrolled. A drag is never cancelled and never becomes the first
 * half of a pair.
 */
export const DRAG_SLOP_PX = 10

/**
 * The tap bookkeeping, with no DOM in it.
 *
 * Split out so the sequences that matter — a rapid chain on one spot, a pinch,
 * a scroll, a tap after a long pause — can be driven exactly rather than
 * approximated through a fake event object.
 */
export class TapZoomGuard {
  /** A single-finger sequence that is still a candidate tap. */
  private alive = false
  private startX = 0
  private startY = 0
  /** The last completed single-finger tap, whatever happened to it. */
  private last: { t: number; x: number; y: number } | null = null

  /**
   * A finger went down. `touchCount` is how many are down INCLUDING this one.
   *
   * A second finger is a pinch, not a tap: it ends the candidate and clears the
   * history, because WebKit will not read a tap either side of a pinch as a
   * double tap and neither should this.
   */
  start(x: number, y: number, touchCount: number): void {
    if (touchCount !== 1) {
      this.alive = false
      this.last = null
      return
    }
    this.alive = true
    this.startX = x
    this.startY = y
  }

  /** The finger moved. Past `DRAG_SLOP_PX` this sequence is no longer a tap. */
  move(x: number, y: number): void {
    if (!this.alive) return
    if (distance(x, y, this.startX, this.startY) > DRAG_SLOP_PX) this.alive = false
  }

  /**
   * A finger lifted. `remaining` is how many are still down.
   *
   * Returns true when this lift is the second-or-later tap of a zoom-shaped
   * chain and its default action must be cancelled.
   */
  end(t: number, x: number, y: number, remaining: number): boolean {
    const wasTap = this.alive && remaining === 0
    this.alive = false
    if (!wasTap) {
      // A drag, or a finger lifting out of a pinch. Not a tap, so it is neither
      // cancelled nor remembered — but it does not erase what came before it
      // either: over-suppressing costs a re-dispatched click, under-suppressing
      // costs a zoom.
      if (remaining !== 0) this.last = null
      return false
    }
    const previous = this.last
    this.last = { t, x, y }
    if (previous === null) return false
    const elapsed = t - previous.t
    if (elapsed < 0 || elapsed > DOUBLE_TAP_MS) return false
    return distance(x, y, previous.x, previous.y) <= DOUBLE_TAP_SLOP_PX
  }

  /** The system took the gesture away. Nothing is pending and nothing is owed. */
  cancel(): void {
    this.alive = false
    this.last = null
  }
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

/* -------------------------------------------------------------------------- */

/** One finger, as much of it as this module reads. */
export type GuardTouch = {
  readonly clientX: number
  readonly clientY: number
  readonly target?: unknown
}

/** A touch event, as much of it as this module reads. */
export type GuardTouchEvent = {
  readonly touches?: ArrayLike<GuardTouch>
  readonly changedTouches?: ArrayLike<GuardTouch>
  readonly cancelable?: boolean
  preventDefault?: () => void
}

type ListenerOptions = { capture?: boolean; passive?: boolean }

/**
 * Just enough of an `EventTarget` to install on.
 *
 * The listener's parameter is `never` on purpose: every handler is assignable
 * to it, so a real `Document` and a plain object in a Node test are both
 * assignable to this type without dragging the DOM's event hierarchy into a
 * module the tests have to drive with no DOM at all.
 */
export type TapGuardTarget = {
  addEventListener(type: string, listener: (event: never) => void, options?: ListenerOptions): void
  removeEventListener(type: string, listener: (event: never) => void, options?: ListenerOptions): void
}

export type TapGuardOptions = {
  /** The clock. Injected so a test can place taps in time exactly. */
  readonly now?: () => number
  /**
   * Dispatch the `click` that cancelling a tap swallowed.
   *
   * Defaults to a real `MouseEvent` on the touch's own target, and no-ops where
   * there is no `MouseEvent` to construct — which is every Node test that does
   * not shim one, and which must not throw inside a touch handler.
   */
  readonly click?: (target: unknown, x: number, y: number) => void
}

/** Targets already guarded, so a second `connect()` cannot double-install. */
const installed = new WeakSet<object>()

/**
 * Stop a double tap in this pack from scaling the page, without costing a tap.
 *
 * Installed by `connect()`, so every pack has it and no pack has to remember
 * it. Idempotent per target, and a no-op where there is no document — a pack's
 * modules are imported by Node tests too.
 *
 * Returns a disposer. Nothing in a pack calls it: the guard's lifetime is the
 * frame's, and the frame is torn down whole.
 */
export function installTapZoomGuard(
  target: TapGuardTarget | null | undefined = defaultTarget(),
  options: TapGuardOptions = {},
): () => void {
  if (!target || typeof target.addEventListener !== "function") return () => {}
  if (installed.has(target)) return () => {}
  installed.add(target)

  const now = options.now ?? Date.now
  const click = options.click ?? dispatchClick
  const guard = new TapZoomGuard()

  const onStart = (event: GuardTouchEvent) => {
    const touch = first(event.changedTouches)
    if (!touch) return
    guard.start(touch.clientX, touch.clientY, count(event.touches))
  }

  const onMove = (event: GuardTouchEvent) => {
    const touch = first(event.changedTouches)
    if (!touch) return
    guard.move(touch.clientX, touch.clientY)
  }

  const onEnd = (event: GuardTouchEvent) => {
    const touch = first(event.changedTouches)
    if (!touch) return
    if (!guard.end(now(), touch.clientX, touch.clientY, count(event.touches))) return
    if (event.cancelable === false || typeof event.preventDefault !== "function") return
    event.preventDefault()
    // After the `touchend` finishes dispatching, so the game sees its own
    // listeners run in the order it wrote them and the click lands where the
    // real one would have.
    const { clientX, clientY } = touch
    const node = touch.target
    queueMicrotask(() => click(node, clientX, clientY))
  }

  const onCancel = () => guard.cancel()

  // Pinch is a different gesture and this is not the fix for it — it is here
  // because the invariant is "a pack never scales the page", and because
  // WebKit's `gesture*` events carry no click, so cancelling them costs
  // nothing. Nobody should read these three lines as covering a double tap.
  const onGesture = (event: GuardTouchEvent) => {
    if (typeof event.preventDefault === "function") event.preventDefault()
  }

  // Capture, so a game that calls `stopPropagation()` on its own `touchend` —
  // several do — cannot hide the tap from the guard. Passive everywhere the
  // guard never cancels, so the manual sheet's `touch-action: pan-y` finger
  // scroll and every canvas drag keep their fast path; `touchend` alone is
  // non-passive, which is the one place `preventDefault()` has to be allowed.
  const bind: [string, (event: never) => void, ListenerOptions][] = [
    ["touchstart", onStart as (event: never) => void, { capture: true, passive: true }],
    ["touchmove", onMove as (event: never) => void, { capture: true, passive: true }],
    ["touchend", onEnd as (event: never) => void, { capture: true, passive: false }],
    ["touchcancel", onCancel as (event: never) => void, { capture: true, passive: true }],
    ["gesturestart", onGesture as (event: never) => void, { capture: true, passive: false }],
    ["gesturechange", onGesture as (event: never) => void, { capture: true, passive: false }],
    ["gestureend", onGesture as (event: never) => void, { capture: true, passive: false }],
  ]
  for (const [type, listener, listenerOptions] of bind) {
    target.addEventListener(type, listener, listenerOptions)
  }

  return () => {
    for (const [type, listener] of bind) target.removeEventListener(type, listener, { capture: true })
    installed.delete(target)
  }
}

function defaultTarget(): TapGuardTarget | undefined {
  return (globalThis as { document?: TapGuardTarget }).document
}

function first(list: ArrayLike<GuardTouch> | undefined): GuardTouch | undefined {
  if (!list || list.length === 0) return undefined
  return list[0]
}

function count(list: ArrayLike<GuardTouch> | undefined): number {
  return list ? list.length : 0
}

function dispatchClick(target: unknown, x: number, y: number): void {
  const Ctor = (globalThis as { MouseEvent?: typeof MouseEvent }).MouseEvent
  if (!Ctor) return
  const node = target as { dispatchEvent?: (event: object) => boolean } | null
  if (!node || typeof node.dispatchEvent !== "function") return
  node.dispatchEvent(
    new Ctor("click", {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail: 1,
      clientX: x,
      clientY: y,
    }),
  )
}
