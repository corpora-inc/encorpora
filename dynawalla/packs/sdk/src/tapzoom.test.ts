// The tap guard, driven through the exact sequences a finger emits.
//
// The `click` half is dispatched for real: the targets are Node's own
// `EventTarget` and the guard's default synthesiser builds a real event object
// through `globalThis.MouseEvent`, shimmed below because Node has no DOM. So
// "the child got their tap" is asserted by a listener firing, not by a spy on
// an intention.
//
// The sequence that matters most is `rapid taps on one spot` — the invariant a
// game depends on, and the one the host's deleted guard broke.

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  DOUBLE_TAP_MS,
  DOUBLE_TAP_SLOP_PX,
  DRAG_SLOP_PX,
  LEAK_WINDOW_MS,
  TapZoomGuard,
  installTapZoomGuard,
} from "./tapzoom.ts"
import type { GuardTouch } from "./tapzoom.ts"

/* ------------------------------------------------------------ the DOM shims */

class FakeMouseEvent extends Event {
  readonly clientX: number
  readonly clientY: number
  constructor(type: string, init: { clientX?: number; clientY?: number; bubbles?: boolean } = {}) {
    super(type, init)
    this.clientX = init.clientX ?? 0
    this.clientY = init.clientY ?? 0
  }
}
;(globalThis as { MouseEvent?: unknown }).MouseEvent = FakeMouseEvent

/**
 * The compatibility click the platform fires when a `touchend` was NOT
 * cancelled. Modelled here so that "one click per tap" can be counted across
 * both branches — the tap that kept the platform's click and the tap whose
 * click the guard had to put back. Its own class, so the two are told apart by
 * which code path built them rather than by a flag a test could set wrongly.
 */
class NativeClickEvent extends FakeMouseEvent {
  constructor(type: string, init: { clientX?: number; clientY?: number; bubbles?: boolean } = {}) {
    super(type, init)
    // The guard tells the platform's clicks from its own by exactly this, so
    // the fake has to carry it. A constructed `Event` is never trusted.
    Object.defineProperty(this, "isTrusted", { value: true })
  }
}

/** A node a touch can land on, and a click can be delivered to. */
class FakeNode extends EventTarget {
  readonly clicks: FakeMouseEvent[] = []
  readonly doc: FakeDocument | undefined
  /** What `Element.isConnected` would say. Games replace their DOM constantly. */
  connected = true
  constructor(doc?: FakeDocument) {
    super()
    this.doc = doc
    this.addEventListener("click", (event) => this.clicks.push(event as FakeMouseEvent))
  }
  /**
   * The document sees it first and may stop it.
   *
   * The guard installs in the CAPTURE phase, which runs document-first, and it
   * swallows a duplicate click by calling `stopImmediatePropagation()`. A fake
   * that dispatched at the target first could never observe that, and the test
   * for it would pass whether the guard swallowed or not.
   */
  override dispatchEvent(event: Event): boolean {
    let stopped = false
    const stop = event.stopImmediatePropagation.bind(event)
    Object.defineProperty(event, "stopImmediatePropagation", {
      configurable: true,
      value: () => {
        stopped = true
        stop()
      },
    })
    this.doc?.emit(event.type, event)
    if (stopped) return !event.defaultPrevented
    return super.dispatchEvent(event)
  }
  get isConnected(): boolean {
    return this.connected
  }
  /** Clicks the guard re-dispatched, as opposed to the ones the platform fired. */
  get restored(): FakeMouseEvent[] {
    return this.clicks.filter((c) => !(c instanceof NativeClickEvent))
  }
}

type Bound = { type: string; listener: (event: never) => void; options?: { capture?: boolean; passive?: boolean } }

/** Stands in for the pack document the guard installs on. */
class FakeDocument {
  readonly bound: Bound[] = []
  addEventListener(
    type: string,
    listener: (event: never) => void,
    options?: { capture?: boolean; passive?: boolean },
  ): void {
    this.bound.push(options === undefined ? { type, listener } : { type, listener, options })
  }
  removeEventListener(type: string, listener: (event: never) => void): void {
    const index = this.bound.findIndex((b) => b.type === type && b.listener === listener)
    if (index >= 0) this.bound.splice(index, 1)
  }
  /** Deliver an event to every listener bound for `type`, capture-phase style. */
  emit(type: string, event: unknown): void {
    for (const entry of [...this.bound]) {
      if (entry.type === type) (entry.listener as (event: unknown) => void)(event)
    }
  }
}

type FakeTouchEvent = {
  touches: GuardTouch[]
  changedTouches: GuardTouch[]
  cancelable: boolean
  prevented: boolean
  preventDefault: () => void
}

function touchEvent(
  touch: GuardTouch | GuardTouch[],
  options: { remaining?: number; cancelable?: boolean } = {},
): FakeTouchEvent {
  const remaining = options.remaining ?? 0
  const event: FakeTouchEvent = {
    // `touches` is what is STILL down, so on a lift it excludes this finger and
    // on a press it includes it. The guard reads its length and nothing else,
    // so a filler point is honest enough.
    touches: Array.from({ length: remaining }, () => ({ clientX: 0, clientY: 0 })),
    changedTouches: Array.isArray(touch) ? touch : [touch],
    cancelable: options.cancelable ?? true,
    prevented: false,
    preventDefault: () => {
      event.prevented = true
    },
  }
  return event
}

/** Let the task that carries the re-dispatched click run. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

type Guarded = {
  doc: FakeDocument
  advance: (ms: number) => void
  /**
   * Model an engine that raises the compatibility `click` even though the tap
   * was cancelled — which is what the Touch Events spec actually permits, since
   * it only promises suppression for a cancelled `touchstart`.
   */
  leaky: (on: boolean) => void
  press: (x: number, y: number, node?: FakeNode, downCount?: number) => void
  drag: (x: number, y: number, node?: FakeNode) => void
  /** Returns whether the lift's default action was cancelled. */
  lift: (x: number, y: number, node?: FakeNode, remaining?: number) => boolean
  tap: (x: number, y: number, node?: FakeNode) => boolean
}

/**
 * A guarded document with a controllable clock.
 *
 * `tap` drives the whole sequence — press, lift — and returns whether the lift
 * was cancelled, which is the thing the zoom hangs on.
 */
function guarded(): Guarded {
  const doc = new FakeDocument()
  let clock = 1_000
  let leaky = false
  installTapZoomGuard(doc, { now: () => clock })

  const press = (x: number, y: number, node?: FakeNode, downCount = 1): void => {
    doc.emit("touchstart", touchEvent({ clientX: x, clientY: y, target: node }, { remaining: downCount }))
  }
  const lift = (x: number, y: number, node?: FakeNode, remaining = 0): boolean => {
    const event = touchEvent({ clientX: x, clientY: y, target: node }, { remaining })
    doc.emit("touchend", event)
    // What a browser does next, and the whole reason the guard has to give a
    // click back: an uncancelled `touchend` is followed by the compatibility
    // `click`. A cancelled one is not — unless the engine does not honour that,
    // which is what `leaky` is.
    if ((!event.prevented || leaky) && node) {
      node.dispatchEvent(new NativeClickEvent("click", { clientX: x, clientY: y, bubbles: true }))
    }
    return event.prevented
  }
  return {
    doc,
    press,
    lift,
    advance: (ms) => {
      clock += ms
    },
    leaky: (on) => {
      leaky = on
    },
    drag: (x, y, node) => {
      doc.emit("touchmove", touchEvent({ clientX: x, clientY: y, target: node }, { remaining: 1 }))
    },
    tap: (x, y, node) => {
      press(x, y, node)
      return lift(x, y, node)
    },
  }
}

/* ------------------------------------------------- the sequence that matters */

test("rapid deliberate tapping on one spot delivers every tap to the game", async () => {
  // FOUNDRY's pedals, COLOSSUS's strikes, STACK's commit. Eight presses on the
  // same pixel, 80ms apart — indistinguishable from a double tap by geometry,
  // and the child must lose none of them.
  const g = guarded()
  const pedal = new FakeNode(g.doc)
  const touchends: number[] = []
  g.doc.addEventListener("touchend", (() => touchends.push(1)) as (event: never) => void)

  for (let i = 0; i < 8; i++) {
    g.tap(200, 300, pedal)
    g.advance(80)
  }
  await flush()

  assert.equal(pedal.clicks.length, 8, "every tap must produce exactly one click")
  assert.equal(pedal.restored.length, 7, "one platform click, and seven the guard put back")
  assert.equal(touchends.length, 8, "the game's own touchend listener must see every tap")
})

test("a rapid chain is one click per tap however each tap was handled", async () => {
  // The first tap keeps its real click; every later one is cancelled and
  // re-dispatched. Both branches are exercised here, and the count is the same
  // either way — which is the whole point.
  const g = guarded()
  const node = new FakeNode(g.doc)

  const first = g.tap(50, 50, node)
  g.advance(100)
  const second = g.tap(50, 50, node)
  g.advance(100)
  const third = g.tap(50, 50, node)
  await flush()

  assert.equal(first, false, "the first tap of a chain is never cancelled")
  assert.equal(second, true, "the second tap is the zoom, and is cancelled")
  assert.equal(third, true, "and so is the third, so no untouched pair is left")
  assert.equal(node.clicks.length, 3, "three taps, three clicks")
  assert.deepEqual(
    node.restored.map((c) => [c.clientX, c.clientY]),
    [
      [50, 50],
      [50, 50],
    ],
    "the two cancelled taps got their clicks back, at the coordinates the finger was at",
  )
})

test("an engine that raises the click anyway does not double it", async () => {
  // The Touch Events spec only promises that cancelling `touchstart` suppresses
  // the compatibility mouse events. If an engine raises the `click` after a
  // cancelled `touchend`, a naive re-dispatch gives the control TWO — a second
  // answer submitted, a second revive spent. The guard counts instead of
  // assuming, and keeps the platform's own, which is the one carrying user
  // activation.
  const g = guarded()
  g.leaky(true)
  const node = new FakeNode(g.doc)

  g.tap(60, 60, node)
  g.advance(90)
  assert.equal(g.tap(60, 60, node), true, "still cancelled, so the page still cannot scale")
  await flush()

  assert.equal(node.clicks.length, 2, "two taps, two clicks — not three")
  assert.equal(node.restored.length, 0, "and none of them invented")
})

test("a platform click that leaks LATE, after the restore, is swallowed", async () => {
  // The timing the first draft of this module did not defend. An engine that
  // still runs a double-tap-to-zoom recogniser is the engine that may hold the
  // compatibility click back to wait out the second tap — so the leak that
  // matters arrives long after any `setTimeout(0)`, and a guard that only
  // watched the early window would hand STACK's answer chip two `onChoose`
  // calls from one tap.
  const g = guarded()
  const chip = new FakeNode(g.doc)
  g.tap(90, 90, chip)
  g.advance(90)
  assert.equal(g.tap(90, 90, chip), true)
  await flush()
  assert.equal(chip.clicks.length, 2, "the restore has already been delivered")

  // ...and now, 300ms later, the platform's own turns up anyway.
  g.advance(300)
  chip.dispatchEvent(new NativeClickEvent("click", { clientX: 90, clientY: 90, bubbles: true }))

  assert.equal(chip.clicks.length, 2, "two taps, two clicks — the duplicate never reached the chip")
})

test("a leak after the window has closed is not swallowed", async () => {
  // The swallow must expire, or a control that happens to sit where a tap was
  // cancelled would go on losing clicks for the rest of the session.
  const g = guarded()
  const chip = new FakeNode(g.doc)
  g.tap(90, 90, chip)
  g.advance(90)
  assert.equal(g.tap(90, 90, chip), true)
  await flush()

  g.advance(2_000)
  chip.dispatchEvent(new NativeClickEvent("click", { clientX: 90, clientY: 90, bubbles: true }))
  assert.equal(chip.clicks.length, 3, "a click this late belongs to somebody else")
  assert.ok(LEAK_WINDOW_MS < 2_000, "the window the number above assumes")
})

test("a tap the guard did not cancel keeps its own click, debt or no debt", async () => {
  // The debt has to be dropped the moment a tap comes through uncancelled, or
  // the guard goes on swallowing at that coordinate and the child's next
  // deliberate press does nothing at all.
  const g = guarded()
  const chip = new FakeNode(g.doc)
  g.tap(90, 90, chip)
  g.advance(90)
  assert.equal(g.tap(90, 90, chip), true)
  await flush()
  assert.equal(chip.clicks.length, 2)

  // Well past the double-tap window, so this one is a fresh gesture — and it is
  // still inside the leak window of the tap before it.
  g.advance(400)
  assert.equal(g.tap(90, 90, chip), false, "a new gesture, not a zoom")
  await flush()
  assert.equal(chip.clicks.length, 3, "and its own click reached the chip")
})

test("a trusted click on another control does not eat the restore", async () => {
  // The tally this replaced was global: any click anywhere satisfied the debt,
  // so a click on an unrelated control landing in the window made the guard
  // withhold the tap's own and the child's press vanished with no trace.
  const g = guarded()
  const chip = new FakeNode(g.doc)
  const elsewhere = new FakeNode(g.doc)
  g.tap(90, 90, chip)
  g.advance(90)
  assert.equal(g.tap(90, 90, chip), true)
  elsewhere.dispatchEvent(new NativeClickEvent("click", { clientX: 400, clientY: 400, bubbles: true }))
  await flush()

  assert.equal(elsewhere.clicks.length, 1, "the unrelated click was neither eaten nor counted")
  assert.equal(chip.restored.length, 1, "and the cancelled tap still got its own")
})

test("a first tap that drifted past the drag slop still arms the pair", () => {
  // The guard failing OPEN on the one thing it exists to stop. This module
  // calls 11px a drag; WebKit's double-tap slop is looser, so a first tap that
  // drifted 11px is still half of a double tap to the gesture recogniser. If
  // the guard forgets it, the second tap is not cancelled and the page scales.
  const g = guarded()
  g.press(100, 100)
  g.drag(111, 100)
  assert.equal(g.lift(111, 100), false, "a drag is still never cancelled itself")
  g.advance(90)
  assert.equal(g.tap(105, 100), true, "but the tap after it is")
})

test("a restore whose element has gone is delivered where the platform would have put it", async () => {
  // STACK empties `choicesEl` and rebuilds every button, with the handler
  // delegated on the container: a click on a button that has been replaced
  // reaches nobody, and the child's tap disappears. The platform hit-tests
  // afresh; where the touch's own target is gone, so does the guard.
  const g = guarded()
  const gone = new FakeNode(g.doc)
  const replacement = new FakeNode(g.doc)
  gone.connected = false
  const saved = (globalThis as { document?: unknown }).document
  ;(globalThis as { document?: unknown }).document = { elementFromPoint: () => replacement }
  try {
    g.tap(140, 140, gone)
    g.advance(90)
    assert.equal(g.tap(140, 140, gone), true)
    await flush()
  } finally {
    if (saved === undefined) delete (globalThis as { document?: unknown }).document
    else (globalThis as { document?: unknown }).document = saved
  }

  assert.equal(replacement.restored.length, 1, "the click went to what is actually there")
  assert.equal(gone.restored.length, 0, "and not to the detached node")
})

test("the restored click waits a task, so a leaked platform click gets there first", async () => {
  // Why a task and not a microtask. A browser dispatches the compatibility
  // click in the same input turn as the `touchend`, but AFTER the microtask
  // checkpoint that follows the `touchend` handlers — so a restore queued as a
  // microtask would run first, see nothing, dispatch, and then be joined by the
  // platform's own. Modelled by putting the leaked click in a microtask.
  const g = guarded()
  const node = new FakeNode(g.doc)
  g.tap(70, 70, node)
  g.advance(90)
  g.press(70, 70, node)
  const event = touchEvent({ clientX: 70, clientY: 70, target: node })
  g.doc.emit("touchend", event)
  assert.equal(event.prevented, true)
  queueMicrotask(() => {
    node.dispatchEvent(new NativeClickEvent("click", { clientX: 70, clientY: 70, bubbles: true }))
  })
  await flush()

  assert.equal(node.clicks.length, 2, "two taps, two clicks")
  assert.equal(node.restored.length, 0, "the platform's own was allowed to win the race")
})

test("the restored click lands after the touchend it belongs to", async () => {
  // Dispatched from inside the `touchend` handler it would arrive BEFORE the
  // game's own `touchend` listener — the guard installs in the capture phase,
  // so it runs first — and a game whose state machine reads `pointerup` then
  // `click` would see them inverted. MERGE IDLE's `TapGuard` is exactly such a
  // machine.
  const g = guarded()
  const node = new FakeNode(g.doc)
  const log: string[] = []
  g.doc.addEventListener("touchend", (() => log.push("touchend")) as (event: never) => void)
  node.addEventListener("click", () => log.push("click"))

  g.tap(40, 40, node)
  g.advance(100)
  g.tap(40, 40, node)
  await flush()

  assert.deepEqual(log, ["touchend", "click", "touchend", "click"])
})

test("a correction between two controls 20px apart reaches both controls", async () => {
  // The objection that killed the host's guard in #678: two cells of a
  // segmented control, tapped in sequence, well inside the double-tap slop.
  const g = guarded()
  const left = new FakeNode(g.doc)
  const right = new FakeNode(g.doc)

  g.tap(100, 100, left)
  g.advance(120)
  const prevented = g.tap(120, 100, right)
  await flush()

  assert.equal(prevented, true, "20px apart is a zoom by shape and must be cancelled")
  assert.equal(left.clicks.length, 1, "the first tap kept the platform's own click")
  assert.equal(left.restored.length, 0)
  assert.deepEqual(
    right.restored.map((c) => [c.clientX, c.clientY]),
    [[120, 100]],
    "and the second was re-delivered to the cell it was actually on",
  )
})

/* ------------------------------------------------------- what must not zoom */

test("a second tap inside the window and the slop is cancelled", () => {
  // Literal milliseconds and pixels on purpose. Written against the exported
  // constants, this test would follow them wherever they moved — a window
  // narrowed to 40ms would read as green while the zoom came back.
  const g = guarded()
  assert.equal(g.tap(10, 10), false)
  g.advance(300)
  assert.equal(g.tap(10, 10), true, "300ms later on the same pixel is a double tap")

  const h = guarded()
  assert.equal(h.tap(10, 10), false)
  h.advance(120)
  assert.equal(h.tap(35, 10), true, "and so is 25px away")

  assert.ok(DOUBLE_TAP_MS >= 300 && DOUBLE_TAP_SLOP_PX >= 25, "the constants the numbers above assume")
})

test("gesture events are cancelled, and are pinch rather than double tap", () => {
  const g = guarded()
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    const event = touchEvent({ clientX: 0, clientY: 0 })
    g.doc.emit(type, event)
    assert.equal(event.prevented, true, `${type} must not scale the page`)
  }
})

/* ---------------------------------------------------- what must not be eaten */

test("two taps a second apart are both left alone", () => {
  const g = guarded()
  assert.equal(g.tap(10, 10), false)
  g.advance(1_000)
  assert.equal(g.tap(10, 10), false, "past the window this is a new gesture, not a zoom")
})

test("two taps further apart than the slop are both left alone", () => {
  const g = guarded()
  assert.equal(g.tap(10, 10), false)
  g.advance(50)
  assert.equal(g.tap(200, 10), false)
})

test("a finger-scroll of the manual sheet is never cancelled", async () => {
  // `packs/shared/game-chrome` sets `touch-action: pan-y` on the manual body so
  // it can be scrolled. Two short flicks, ending 15px apart and 60ms apart —
  // close enough in both to be a double tap if the guard failed to notice that
  // the finger travelled. A cancelled `touchend` there would not stop the
  // scroll, but it WOULD fire a click into the manual that the child never made.
  const g = guarded()
  const sheet = new FakeNode(g.doc)
  g.press(100, 400, sheet)
  g.drag(100, 380, sheet)
  g.drag(100, 340, sheet)
  assert.equal(g.lift(100, 340, sheet), false, "a drag is not a tap")
  g.advance(60)
  g.press(100, 340, sheet)
  g.drag(100, 330, sheet)
  g.drag(100, 325, sheet)
  assert.equal(g.lift(100, 325, sheet), false, "and a second flick is not the second half of one")
  await flush()
  assert.equal(sheet.restored.length, 0, "and no click was invented on the way past")
})

test("a jitter inside the drag slop is still a tap", () => {
  const g = guarded()
  g.press(10, 10)
  g.drag(18, 10)
  assert.equal(g.lift(18, 10), false, "first of the chain")
  g.advance(60)
  assert.equal(g.tap(10, 10), true, "an 8px shake is a finger, not a swipe")
  assert.ok(DRAG_SLOP_PX >= 8, "the slop the number above assumes")
})

test("a pinch is not a tap and clears the chain", () => {
  const g = guarded()
  assert.equal(g.tap(100, 100), false)
  g.advance(40)
  // Second finger down, then both up, one at a time.
  g.press(100, 100, undefined, 1)
  g.press(140, 100, undefined, 2)
  assert.equal(g.lift(140, 100, undefined, 1), false, "a lift with a finger still down is not a tap")
  assert.equal(g.lift(100, 100, undefined, 0), false, "and the finger left over is not one either")
  g.advance(40)
  assert.equal(g.tap(100, 100), false, "the pinch cleared the history behind it")
})

test("two fingers lifting in one touchend are not a tap", () => {
  // The sequence that has no lift with a finger still down to catch it: iOS
  // reports both fingers in one `touchend`, `touches` is empty, and the only
  // thing that knows this was never a tap is the second `touchstart`.
  const g = guarded()
  assert.equal(g.tap(100, 100), false)
  g.advance(40)
  g.press(100, 100, undefined, 1)
  g.press(140, 100, undefined, 2)
  const event = touchEvent([{ clientX: 100, clientY: 100 }, { clientX: 140, clientY: 100 }], { remaining: 0 })
  g.doc.emit("touchend", event)
  assert.equal(event.prevented, false, "a pinch release is not the second half of a double tap")
})

test("a cancelled touch clears the chain", () => {
  const g = guarded()
  assert.equal(g.tap(10, 10), false)
  g.advance(40)
  g.doc.emit("touchcancel", touchEvent({ clientX: 10, clientY: 10 }))
  assert.equal(g.tap(10, 10), false, "the system took the gesture, so nothing pairs with it")
})

test("a non-cancelable touchend is left alone and costs no click", async () => {
  const g = guarded()
  const node = new FakeNode(g.doc)
  g.tap(10, 10, node)
  g.advance(40)
  g.press(10, 10, node)
  const event = touchEvent({ clientX: 10, clientY: 10, target: node }, { cancelable: false })
  g.doc.emit("touchend", event)
  await flush()
  assert.equal(event.prevented, false)
  assert.equal(node.restored.length, 0, "nothing was swallowed, so nothing is re-dispatched")
})

/* ------------------------------------------------------------ how it is wired */

test("touchend is non-passive and in the capture phase", () => {
  // A device-only failure: a passive `touchend` makes `preventDefault()` a
  // silent no-op and the zoom comes straight back, with every behavioural test
  // above still green. And a bubble-phase listener never sees a tap on a game
  // that calls `stopPropagation()` on its own `touchend`, which several do.
  const doc = new FakeDocument()
  installTapZoomGuard(doc)
  const wiring = new Map(doc.bound.map((b) => [b.type, b.options] as const))

  assert.deepEqual(wiring.get("touchend"), { capture: true, passive: false })
  assert.deepEqual(wiring.get("touchstart"), { capture: true, passive: true })
  assert.deepEqual(wiring.get("touchmove"), { capture: true, passive: true })
  assert.deepEqual(wiring.get("touchcancel"), { capture: true, passive: true })
  // Non-passive because this listener DOES cancel — a duplicate click after a
  // restore is swallowed there, and a passive listener could not.
  assert.deepEqual(wiring.get("click"), { capture: true, passive: false })
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    assert.deepEqual(wiring.get(type), { capture: true, passive: false }, `${type} must be cancellable`)
  }
  assert.equal(wiring.size, 8, "four touch events, a click watcher and three gesture events")
})

test("installing twice binds one guard, not two", async () => {
  const doc = new FakeDocument()
  const node = new FakeNode(doc)
  installTapZoomGuard(doc, { now: () => 0 })
  installTapZoomGuard(doc, { now: () => 0 })
  const bound = doc.bound.length

  doc.emit("touchstart", touchEvent({ clientX: 5, clientY: 5, target: node }, { remaining: 1 }))
  doc.emit("touchend", touchEvent({ clientX: 5, clientY: 5, target: node }))
  doc.emit("touchstart", touchEvent({ clientX: 5, clientY: 5, target: node }, { remaining: 1 }))
  doc.emit("touchend", touchEvent({ clientX: 5, clientY: 5, target: node }))
  await flush()

  assert.equal(bound, 8, "eight listeners, once")
  assert.equal(node.clicks.length, 1, "one re-dispatched click, not two")
})

test("the disposer unbinds, and a target can then be guarded again", () => {
  const doc = new FakeDocument()
  const dispose = installTapZoomGuard(doc, { now: () => 0 })
  assert.equal(doc.bound.length, 8)
  dispose()
  assert.equal(doc.bound.length, 0)
  installTapZoomGuard(doc, { now: () => 0 })
  assert.equal(doc.bound.length, 8, "the target is no longer marked as guarded")
})

test("no document, and no MouseEvent, are both survivable", async () => {
  assert.doesNotThrow(() => installTapZoomGuard(undefined)())
  assert.doesNotThrow(() => installTapZoomGuard(null)())
  assert.doesNotThrow(() => installTapZoomGuard({} as unknown as FakeDocument)())

  const saved = (globalThis as { MouseEvent?: unknown }).MouseEvent
  delete (globalThis as { MouseEvent?: unknown }).MouseEvent
  try {
    const g = guarded()
    const node = new FakeNode(g.doc)
    g.tap(1, 1, node)
    g.advance(30)
    assert.equal(g.tap(1, 1, node), true, "the zoom is still cancelled")
    await flush()
    assert.equal(node.restored.length, 0, "and nothing threw inside a touch handler")
  } finally {
    ;(globalThis as { MouseEvent?: unknown }).MouseEvent = saved
  }
})

/* ------------------------------------------------------ the machine on its own */

test("the state machine reads a lift with fingers still down as no tap at all", () => {
  const guard = new TapZoomGuard()
  guard.start(0, 0, 1)
  assert.equal(guard.end(0, 0, 0, 0), false)
  guard.start(0, 0, 1)
  assert.equal(guard.end(10, 0, 0, 1), false, "a finger is still down: not a completed tap")
  guard.start(0, 0, 1)
  assert.equal(guard.end(20, 0, 0, 0), false, "and the chain behind it was cleared")
})
