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
class NativeClickEvent extends FakeMouseEvent {}

/** A node a touch can land on, and a click can be delivered to. */
class FakeNode extends EventTarget {
  readonly clicks: FakeMouseEvent[] = []
  constructor() {
    super()
    this.addEventListener("click", (event) => this.clicks.push(event as FakeMouseEvent))
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

/** Let the queued microtask that carries the re-dispatched click run. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

type Guarded = {
  doc: FakeDocument
  advance: (ms: number) => void
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
  installTapZoomGuard(doc, { now: () => clock })

  const press = (x: number, y: number, node?: FakeNode, downCount = 1): void => {
    doc.emit("touchstart", touchEvent({ clientX: x, clientY: y, target: node }, { remaining: downCount }))
  }
  const lift = (x: number, y: number, node?: FakeNode, remaining = 0): boolean => {
    const event = touchEvent({ clientX: x, clientY: y, target: node }, { remaining })
    doc.emit("touchend", event)
    // What a browser does next, and the whole reason the guard has to give a
    // click back: an uncancelled `touchend` is followed by the compatibility
    // `click`, and a cancelled one is not.
    if (!event.prevented && node) {
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
  const pedal = new FakeNode()
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
  const node = new FakeNode()

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

test("the restored click lands after the touchend it belongs to", async () => {
  // Dispatched from inside the `touchend` handler it would arrive BEFORE the
  // game's own `touchend` listener — the guard installs in the capture phase,
  // so it runs first — and a game whose state machine reads `pointerup` then
  // `click` would see them inverted. MERGE IDLE's `TapGuard` is exactly such a
  // machine.
  const g = guarded()
  const node = new FakeNode()
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
  const left = new FakeNode()
  const right = new FakeNode()

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
  const sheet = new FakeNode()
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
  const node = new FakeNode()
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
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    assert.deepEqual(wiring.get(type), { capture: true, passive: false }, `${type} must be cancellable`)
  }
  assert.equal(wiring.size, 7, "four touch events and three gesture events, and nothing silently dropped")
})

test("installing twice binds one guard, not two", async () => {
  const doc = new FakeDocument()
  const node = new FakeNode()
  installTapZoomGuard(doc, { now: () => 0 })
  installTapZoomGuard(doc, { now: () => 0 })
  const bound = doc.bound.length

  doc.emit("touchstart", touchEvent({ clientX: 5, clientY: 5, target: node }, { remaining: 1 }))
  doc.emit("touchend", touchEvent({ clientX: 5, clientY: 5, target: node }))
  doc.emit("touchstart", touchEvent({ clientX: 5, clientY: 5, target: node }, { remaining: 1 }))
  doc.emit("touchend", touchEvent({ clientX: 5, clientY: 5, target: node }))
  await flush()

  assert.equal(bound, 7, "seven listeners, once")
  assert.equal(node.clicks.length, 1, "one re-dispatched click, not two")
})

test("the disposer unbinds, and a target can then be guarded again", () => {
  const doc = new FakeDocument()
  const dispose = installTapZoomGuard(doc, { now: () => 0 })
  assert.equal(doc.bound.length, 7)
  dispose()
  assert.equal(doc.bound.length, 0)
  installTapZoomGuard(doc, { now: () => 0 })
  assert.equal(doc.bound.length, 7, "the target is no longer marked as guarded")
})

test("no document, and no MouseEvent, are both survivable", async () => {
  assert.doesNotThrow(() => installTapZoomGuard(undefined)())
  assert.doesNotThrow(() => installTapZoomGuard(null)())
  assert.doesNotThrow(() => installTapZoomGuard({} as unknown as FakeDocument)())

  const saved = (globalThis as { MouseEvent?: unknown }).MouseEvent
  delete (globalThis as { MouseEvent?: unknown }).MouseEvent
  try {
    const g = guarded()
    const node = new FakeNode()
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
