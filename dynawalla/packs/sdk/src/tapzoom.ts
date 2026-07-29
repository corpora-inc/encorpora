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
// cost lands on RUNNER's revive lanes, MERGE IDLE's chips and actions, STACK's
// answer choices and game-chrome's help and close buttons — every one of them
// bound to `click`, and every one of them a control a child taps twice.
//
// The games whose rapid input is famous are NOT on that list, and it is worth
// saying which is which rather than guessing: FOUNDRY's pedals, COLOSSUS's
// strikes and STACK's commit all act on `pointerdown`, which cancelling a
// `touchend` does not touch. No game in this repository binds `touchend` at
// all. So the tap that a naive guard would eat is an ANSWER, not a beat — which
// is worse, not better.
//
// A geometric test cannot separate a deliberate double press from a zoom: a
// child tapping the same chip twice in 120ms IS two taps close in time and
// space. So this does not try. It cancels the tap's default action and then
// RE-DISPATCHES the `click` the cancellation swallowed, at the same coordinates
// on the same target, in a task of its own so it still lands after the
// `touchend` it belongs to. The zoom is a default action of the touch and does
// not come back; the activation is not a default action of the touch and does.
//
// Reconciled rather than assumed. That cancelling `touchend` suppresses the
// compatibility `click` is engine behaviour this repository cannot observe —
// the Touch Events spec only promises it for `touchstart` — and an engine that
// raised the click anyway would give a control TWO: a second answer submitted,
// a second revive spent.
//
// Watching for that leak in ONE direction is not enough, and the first draft of
// this module got it wrong. An engine that still runs a double-tap-to-zoom
// recogniser is, by construction, an engine that may hold the compatibility
// click back to wait out the second tap — so the leak this defends against is
// precisely the one that arrives LATE, long after any restore. So the guard
// keeps a record of the tap it cancelled and reconciles both ends: a leak that
// beats the restore cancels the restore, and a leak that follows one is
// swallowed. Exactly one click reaches the control either way, and where the
// platform's own survived it is the one that is kept — it is the one carrying
// user activation.
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
 * being finger-scrolled. A drag is never cancelled — but it IS remembered, and
 * `TapZoomGuard.end` says why that is the difference between the guard holding
 * and the guard failing open.
 */
export const DRAG_SLOP_PX = 10

/**
 * How long a cancelled tap may still be reconciled against a platform click.
 *
 * Wide enough to cover the classic ~300ms compatibility-click delay, because
 * that delay exists precisely to wait out a second tap — so the engine that
 * still has a double-tap gesture to hold the click for is exactly the one this
 * has to survive.
 */
export const LEAK_WINDOW_MS = 500

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
  /** ...and one that began with a single finger, whether or not it stayed still. */
  private single = false
  private startX = 0
  private startY = 0
  /** Where the last single-finger sequence ended, tap or drag. */
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
      this.single = false
      this.last = null
      return
    }
    this.alive = true
    this.single = true
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
    const wasSingle = this.single && remaining === 0
    this.alive = false
    if (!wasTap) {
      if (!wasSingle) {
        // A finger lifting out of a pinch. WebKit will not pair a tap across
        // one either.
        this.last = null
        return false
      }
      // A single finger that travelled: a drag, so it is never cancelled — a
      // drag does not zoom, and cancelling one would fire a click into the
      // manual sheet the child never made.
      //
      // But it IS remembered. This module calls 11px a drag; WebKit's own
      // double-tap slop is looser, so a first tap that drifted 11px is still
      // half of a double tap to the gesture recogniser. Forgetting it would
      // leave the SECOND tap uncancelled and the page would scale — the guard
      // failing open on the one thing it exists to stop. Remembering it costs
      // at worst a re-dispatched click after a real drag, which the child
      // cannot tell from the real one.
      this.last = { t, x, y }
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
    this.single = false
    this.last = null
  }
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by)
}

/** A cancelled tap, from the moment its click is owed until it is reconciled. */
type OwedTap = {
  readonly x: number
  readonly y: number
  readonly until: number
  /** The platform's own arrived first, so the guard must not add another. */
  satisfied: boolean
  /** The guard already delivered this tap's click, so a later one is a duplicate. */
  restored: boolean
}

/** Forget taps whose leak window has closed, so nothing is swallowed forever. */
function prune(owed: OwedTap[], t: number): void {
  for (let i = owed.length - 1; i >= 0; i--) {
    const record = owed[i]
    if (record && t > record.until) owed.splice(i, 1)
  }
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

/** A click, as much of it as this module reads. */
export type GuardClickEvent = {
  readonly isTrusted?: boolean
  readonly clientX?: number
  readonly clientY?: number
  preventDefault?: () => void
  stopImmediatePropagation?: () => void
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
  /**
   * The cancelled taps that are owed a click, and how far each has got.
   *
   * Records rather than a tally, and matched on WHERE the click landed: a tally
   * is satisfied by any click anywhere, so a click on an unrelated control
   * arriving inside the window would make the guard withhold a tap's own and
   * the child's press would vanish with no trace.
   *
   * A list rather than one slot because taps overlap: a chain puts a new tap in
   * flight every 50-100ms while the last one is still inside its leak window.
   */
  const owed: OwedTap[] = []

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
    const at = now()
    if (!guard.end(at, touch.clientX, touch.clientY, count(event.touches))) {
      // Nothing was cancelled, so nothing is owed and the click that follows is
      // this tap's own. Dropping the records here is what keeps the guard from
      // swallowing it.
      owed.length = 0
      return
    }
    if (event.cancelable === false || typeof event.preventDefault !== "function") return
    event.preventDefault()
    // After the whole input turn, so the game sees its own listeners run in the
    // order it wrote them, and so a compatibility click the engine raised in
    // spite of the cancellation has already been counted.
    //
    // The target is the touch's OWN — `Touch.target` is where the finger went
    // down — rather than whatever is under the coordinate when the restore
    // runs. A tap moves less than 10px so the two agree, except in the one case
    // where they must not: a game that swaps its DOM inside the `touchend`.
    // There the platform's click hit-tests afresh and lands on whatever
    // appeared underneath, which is a tap-through bug MERGE IDLE has already
    // had to write a guard against.
    const { clientX, clientY } = touch
    const node = touch.target
    const record: OwedTap = {
      x: clientX,
      y: clientY,
      until: at + LEAK_WINDOW_MS,
      satisfied: false,
      restored: false,
    }
    prune(owed, at)
    owed.push(record)
    setTimeout(() => {
      // Keyed on the record, not on it still being the newest: a tap that has
      // been overtaken is still a tap the child made and is still owed its
      // click.
      if (record.satisfied) return
      record.restored = true
      click(node, clientX, clientY)
    }, 0)
  }

  const onCancel = () => {
    guard.cancel()
    owed.length = 0
  }

  /**
   * Watch the platform's own clicks, and reconcile them with the guard's.
   *
   * The whole double-click defence is here, and it has to work at BOTH ends of
   * the timing, because an engine that still runs a double-tap-to-zoom
   * recogniser is by construction an engine that may hold the compatibility
   * click back to wait out the second tap:
   *
   *   * the leak arrives BEFORE the restore — mark the tap satisfied and let
   *     the platform's own through, since it is the one carrying user
   *     activation and the guard's would only duplicate it;
   *   * the leak arrives AFTER the restore — the guard already delivered this
   *     tap's click, so this one is the duplicate and is swallowed.
   *
   * Matched on position and inside a window, so a trusted click that belongs to
   * some other control is neither counted nor eaten. This is the only place the
   * guard ever interferes with a click, and it only ever does so for a tap it
   * cancelled itself.
   */
  const onClick = (event: GuardClickEvent) => {
    if (event.isTrusted === false) return
    prune(owed, now())
    const x = event.clientX
    const y = event.clientY
    if (x === undefined || y === undefined) return
    const index = owed.findIndex((r) => distance(x, y, r.x, r.y) <= DOUBLE_TAP_SLOP_PX)
    const record = owed[index]
    if (!record) return
    // Reconciled either way, so it is taken off the list: whatever happens to
    // the next click at this coordinate, it is not this tap's business.
    owed.splice(index, 1)
    if (!record.restored) {
      record.satisfied = true
      return
    }
    if (typeof event.preventDefault === "function") event.preventDefault()
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation()
  }

  // Pinch is a different gesture and this is not the fix for it — it is here
  // because the invariant is "a pack never scales the page", and because
  // WebKit's `gesture*` events carry no click, so cancelling them costs
  // nothing. Nobody should read these three lines as covering a double tap.
  const onGesture = (event: GuardTouchEvent) => {
    if (typeof event.preventDefault === "function") event.preventDefault()
  }

  // Capture, so that no listener a pack installs can hide a tap from the guard
  // by calling `stopPropagation()`. No game in this repository does today; the
  // guard is the last thing that should depend on that staying true.
  //
  // Passive everywhere the guard never cancels, so the manual sheet's
  // `touch-action: pan-y` finger scroll and every canvas drag keep their fast
  // path. `touchend` and `click` are the two that may cancel, and they are the
  // two that are not passive.
  const bind: [string, (event: never) => void, ListenerOptions][] = [
    ["touchstart", onStart as (event: never) => void, { capture: true, passive: true }],
    ["touchmove", onMove as (event: never) => void, { capture: true, passive: true }],
    ["touchend", onEnd as (event: never) => void, { capture: true, passive: false }],
    ["touchcancel", onCancel as (event: never) => void, { capture: true, passive: true }],
    // Non-passive: this is the one listener that may cancel, and it does so
    // only for a duplicate of a click the guard itself already delivered.
    ["click", onClick as (event: never) => void, { capture: true, passive: false }],
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

function elementAt(x: number, y: number): { dispatchEvent?: (event: object) => boolean } | null {
  const doc = (globalThis as { document?: { elementFromPoint?: (x: number, y: number) => unknown } }).document
  if (!doc || typeof doc.elementFromPoint !== "function") return null
  return (doc.elementFromPoint(x, y) as { dispatchEvent?: (event: object) => boolean } | null) ?? null
}

function dispatchClick(target: unknown, x: number, y: number): void {
  const Ctor = (globalThis as { MouseEvent?: typeof MouseEvent }).MouseEvent
  if (!Ctor) return
  let node = target as { dispatchEvent?: (event: object) => boolean; isConnected?: boolean } | null
  // The touch's own target while it is still in the document — a tap moved less
  // than 11px, so hit-testing afresh would only find the same element, except
  // where a game swapped its DOM inside the `touchend` and the platform's own
  // click would land on whatever appeared underneath. That is a tap-through
  // MERGE IDLE has already had to write a guard against.
  //
  // But when the element is GONE, keeping it drops the child's tap in silence:
  // STACK rebuilds its answer chips and delegates the handler to the container,
  // so a click on a replaced button reaches nobody. There the platform's
  // behaviour is the better of the two, and the guard falls back to it.
  if (node && node.isConnected === false) node = elementAt(x, y) ?? node
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
