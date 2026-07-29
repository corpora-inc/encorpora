// The zoom guard, asserted rather than described.
//
// What can be proved here: the state machine that decides a double tap, that
// the listener is on the right target with the one option that makes
// `preventDefault` work at all, that the scroll lock adds and removes the class
// it says it does and hands the offset back, and that the two strings this
// module duplicates from files TypeScript never reads — the viewport meta in
// `index.html` and the class name in `index.css` — still match.
//
// What CANNOT be proved here, and is stated in the PR rather than hidden:
// whether WebKit on a real iPhone honours any of it. Nobody in this repository
// has an iPhone in CI. In particular a tap that lands inside a pack's iframe is
// dispatched in the child realm and never reaches these listeners, so no test
// in this file can stand in for one.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  createTapGuard,
  DOUBLE_TAP_MS,
  installZoomGuard,
  resetViewportScale,
  STAGED_CLASS,
  stageDocument,
  TAP_SLOP_PX,
  VIEWPORT_CONTENT,
  watchScale,
  type GuardTarget,
  type Listener,
  type TouchEventLike,
} from "./zoom.ts"

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const appRoot = path.resolve(srcRoot, "..")

// ── the state machine ────────────────────────────────────────────────────────

/** A one-finger touch that went down and came up at the same point. */
function tap(guard: ReturnType<typeof createTapGuard>, at: number, x = 100, y = 100): boolean {
  guard.start(1, { x, y }, at)
  return guard.end({ x, y }, at + 20)
}

test("a single tap is never suppressed", () => {
  const guard = createTapGuard()
  assert.equal(tap(guard, 0), false)
})

test("the second tap of a double tap is suppressed", () => {
  const guard = createTapGuard()
  assert.equal(tap(guard, 0), false)
  assert.equal(tap(guard, 100), true)
})

test("two taps further apart in time than the gesture window are two taps", () => {
  const guard = createTapGuard()
  assert.equal(tap(guard, 0), false)
  // The first tap ended at 20, so this lands one millisecond outside.
  assert.equal(tap(guard, DOUBLE_TAP_MS + 2), false)
})

test("two taps in different places are two taps", () => {
  const guard = createTapGuard()
  assert.equal(tap(guard, 0, 100, 100), false)
  assert.equal(tap(guard, 100, 100, 100 + TAP_SLOP_PX + 1), false)
})

test("a scroll is not a tap, and does not become half of a double tap", () => {
  const guard = createTapGuard()
  // A finger that went down and travelled: a flick of the catalogue, a
  // joystick, a swipe. Suppressing the touchend at the end of one of these is
  // the bug that froze the catalogue last time.
  guard.start(1, { x: 100, y: 400 }, 0)
  assert.equal(guard.end({ x: 100, y: 40 }, 200), false)
  // And the tap that follows it is a first tap, not a second.
  assert.equal(tap(guard, 260, 100, 40), false)
})

test("a tap that drifts within the slop is still a tap", () => {
  const guard = createTapGuard()
  guard.start(1, { x: 100, y: 100 }, 0)
  assert.equal(guard.end({ x: 100, y: 100 + TAP_SLOP_PX - 1 }, 20), false)
  assert.equal(tap(guard, 100), true)
})

test("a two-finger gesture is never counted as taps", () => {
  const guard = createTapGuard()
  // Pinch: two fingers down, two fingers up, in the same place and well inside
  // the window. Counted naively that is a double tap.
  guard.start(1, { x: 100, y: 100 }, 0)
  guard.start(2, { x: 140, y: 100 }, 10)
  assert.equal(guard.end({ x: 140, y: 100 }, 60), false)
  assert.equal(guard.end({ x: 100, y: 100 }, 70), false)
  // The next single tap opens a fresh pair rather than closing one.
  assert.equal(tap(guard, 100), false)
})

test("a pinch that follows a tap does not close a pair with it", () => {
  // The case the finger count is actually there for. One real tap, and then a
  // second finger arrives near it — a child steadying a tablet, or starting a
  // pinch. Without the count the pinch's first lift lands inside the window and
  // inside the slop, and gets swallowed as if it were the second tap.
  const guard = createTapGuard()
  assert.equal(tap(guard, 0), false)

  guard.start(2, { x: 110, y: 105 }, 60)
  assert.equal(guard.end({ x: 110, y: 105 }, 120), false)
})

test("a third tap opens a new pair rather than closing the second", () => {
  const guard = createTapGuard()
  assert.equal(tap(guard, 0), false)
  assert.equal(tap(guard, 100), true)
  assert.equal(tap(guard, 200), false)
  assert.equal(tap(guard, 300), true)
})

test("a touchend with no touchstart is ignored", () => {
  const guard = createTapGuard()
  assert.equal(guard.end({ x: 1, y: 1 }, 0), false)
})

// ── the listener ─────────────────────────────────────────────────────────────

type Registration = { type: string; listener: Listener; options: unknown }

function targetHarness() {
  const registered: Registration[] = []
  const removed: Registration[] = []
  const target: GuardTarget = {
    addEventListener: (type, listener, options) => registered.push({ type, listener, options }),
    removeEventListener: (type, listener, options) => removed.push({ type, listener, options }),
  }
  const fire = (type: string, event: unknown) => {
    for (const entry of registered) {
      if (entry.type === type) (entry.listener as (e: unknown) => void)(event)
    }
  }
  return { target, registered, removed, fire }
}

function touch(x: number, y: number, at: number, fingers = 1) {
  let prevented = 0
  const event: TouchEventLike = {
    touches: { length: fingers },
    changedTouches: { length: 1, 0: { clientX: x, clientY: y } },
    timeStamp: at,
    preventDefault: () => {
      prevented += 1
    },
  }
  return { event, prevented: () => prevented }
}

test("touchend is registered non-passive, which is the whole fix", () => {
  // A passive listener's preventDefault() is ignored and logs nothing. iOS
  // treats window touch listeners as passive unless told otherwise, so
  // `{ passive: false }` is the difference between this working and this being
  // decoration.
  const { target, registered } = targetHarness()
  installZoomGuard(target)

  const end = registered.find((entry) => entry.type === "touchend")
  assert.ok(end, "touchend must be registered")
  assert.deepEqual(end.options, { passive: false })

  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    const entry = registered.find((r) => r.type === type)
    assert.ok(entry, `${type} must be registered`)
    assert.deepEqual(entry.options, { passive: false })
  }
})

test("the guard prevents the second tap and nothing else", () => {
  const { target, fire } = targetHarness()
  installZoomGuard(target)

  const first = touch(50, 50, 0)
  fire("touchstart", first.event)
  fire("touchend", touch(50, 50, 20).event)
  assert.equal(first.prevented(), 0)

  fire("touchstart", touch(50, 50, 100).event)
  const second = touch(50, 50, 120)
  fire("touchend", second.event)
  assert.equal(second.prevented(), 1)
})

test("a lone tap on the catalogue is left alone", () => {
  const { target, fire } = targetHarness()
  installZoomGuard(target)

  fire("touchstart", touch(50, 50, 0).event)
  const end = touch(50, 50, 20)
  fire("touchend", end.event)
  assert.equal(end.prevented(), 0)
})

test("a scroll of the catalogue is left alone", () => {
  const { target, fire } = targetHarness()
  installZoomGuard(target)

  fire("touchstart", touch(50, 500, 0).event)
  const end = touch(50, 80, 300)
  fire("touchend", end.event)
  assert.equal(end.prevented(), 0)
})

test("the WebKit gesture events are all prevented", () => {
  const { target, fire } = targetHarness()
  installZoomGuard(target)

  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    let prevented = 0
    fire(type, {
      preventDefault: () => {
        prevented += 1
      },
    })
    assert.equal(prevented, 1, `${type} must be prevented`)
  }
})

test("disposing removes every listener it added, once", () => {
  const { target, registered, removed } = targetHarness()
  const dispose = installZoomGuard(target)
  dispose()
  dispose()

  assert.equal(removed.length, registered.length)
  for (const entry of registered) {
    assert.ok(
      removed.some((r) => r.type === entry.type && r.listener === entry.listener),
      `${entry.type} must be removed with the same function reference`,
    )
  }
})

// ── the scroll lock ──────────────────────────────────────────────────────────

function docHarness(scrollY = 0) {
  const classes = new Set<string>()
  const scrolls: number[] = []
  const doc = {
    documentElement: {
      classList: {
        add: (token: string) => classes.add(token),
        remove: (token: string) => classes.delete(token),
      },
    },
  }
  const win = { scrollY, scrollTo: (_x: number, y: number) => scrolls.push(y) }
  return { doc, win, classes, scrolls }
}

test("staging locks the document and releasing gives the scroll back where it was", () => {
  const { doc, win, classes, scrolls } = docHarness(742)

  const release = stageDocument(doc, win)
  assert.ok(classes.has(STAGED_CLASS), "the document must be locked while a pack is up")

  release()
  assert.equal(classes.has(STAGED_CLASS), false, "the lock must not outlive the pack")
  // `overflow: hidden` clamps the offset to zero, so a child who scrolled to
  // the bottom of the catalogue and played a game would come back to the top.
  assert.deepEqual(scrolls, [742])
})

test("releasing twice restores the scroll once", () => {
  // React StrictMode runs an effect's cleanup twice on the first mount.
  const { doc, win, scrolls } = docHarness(120)
  const release = stageDocument(doc, win)
  release()
  release()
  assert.deepEqual(scrolls, [120])
})

// ── the scale watchdog ───────────────────────────────────────────────────────

test("resetting the scale ends on the canonical viewport, via a different string", () => {
  // Writing the same string back is a no-op and WebKit never re-evaluates.
  const written: string[] = []
  const meta = {
    get content() {
      return written[written.length - 1] ?? ""
    },
    set content(value: string) {
      written.push(value)
    },
  }
  resetViewportScale(meta)
  assert.equal(written.length, 2)
  assert.notEqual(written[0], written[1])
  assert.equal(written[1], VIEWPORT_CONTENT)
})

test("the watchdog fires only when the page has actually scaled", () => {
  const written: string[] = []
  const meta = { content: "" }
  Object.defineProperty(meta, "content", {
    get: () => written[written.length - 1] ?? "",
    set: (value: string) => written.push(value),
  })

  const subscription: { fn: (() => void) | null } = { fn: null }
  const viewport = {
    scale: 1,
    addEventListener: (_type: string, fn: () => void) => {
      subscription.fn = fn
    },
    removeEventListener: () => {
      subscription.fn = null
    },
  }

  const dispose = watchScale(viewport, meta)
  const fire = subscription.fn
  assert.ok(fire, "the watchdog must subscribe to the visual viewport")

  // A resize with no scale change — a rotation, a keyboard — is not a zoom.
  fire()
  assert.deepEqual(written, [])

  viewport.scale = 2.4
  fire()
  assert.equal(written[written.length - 1], VIEWPORT_CONTENT)

  dispose()
  assert.equal(subscription.fn, null)
})

// ── the strings this module duplicates ───────────────────────────────────────

test("index.html still carries the viewport this module writes back", () => {
  // `resetViewportScale` restores VIEWPORT_CONTENT verbatim. If the meta in
  // index.html drifts — someone drops `user-scalable=no`, or adds a token —
  // the first zoom silently rewrites the page's viewport to a stale one, and
  // nothing else in this repository would notice.
  const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8")
  const match = /<meta\s+name="viewport"\s+content="([^"]+)"/s.exec(html.replace(/\s+/g, " "))
  assert.ok(match, "index.html must declare a viewport meta this test can read")
  assert.equal(match[1] ?? "", VIEWPORT_CONTENT)
})

test("the stylesheet is cut for the class the stage actually sets", () => {
  const indexCss = fs.readFileSync(path.join(srcRoot, "index.css"), "utf8")
  assert.match(indexCss, new RegExp(`html\\.${STAGED_CLASS}\\s*,`))
  assert.match(indexCss, new RegExp(`html\\.${STAGED_CLASS} body\\s*\\{\\s*overflow: hidden;`))
})

test("the document lock is scoped to the stage and never applied to html outright", () => {
  // An earlier attempt at this put the lock on `body` unconditionally and
  // stopped the catalogue scrolling entirely. `overflow-x: hidden` on html/body
  // is deliberate and stays; a bare `overflow` on either is the regression.
  const indexCss = fs.readFileSync(path.join(srcRoot, "index.css"), "utf8")
  const rules = indexCss.matchAll(/(^|\})([^{}]*)\{([^{}]*)\}/g)
  for (const rule of rules) {
    const selector = (rule[2] ?? "").replace(/\/\*[\s\S]*?\*\//g, "").trim()
    const body = rule[3] ?? ""
    if (!/(^|,)\s*(html|body)\s*(,|$)/m.test(selector)) continue
    assert.doesNotMatch(
      body,
      /(^|;)\s*overflow\s*:/,
      `an unscoped \`overflow\` on \`${selector}\` freezes the catalogue`,
    )
  }
})

test("the stage is what turns the lock on", () => {
  // A source assertion, and a weak one — it proves the call is written, not
  // that React runs it. It is here because the whole fix is inert if the wiring
  // is deleted, and there is no DOM in this test runner to render Stage.tsx in.
  const stage = fs.readFileSync(path.join(srcRoot, "packs/Stage.tsx"), "utf8")
  assert.ok(
    stage.includes("stageDocument(document, window)"),
    "Stage.tsx must call stageDocument(document, window) while a pack is mounted",
  )
  const main = fs.readFileSync(path.join(srcRoot, "main.tsx"), "utf8")
  assert.ok(
    main.includes('import "./app/zoom.ts"'),
    "main.tsx must import ./app/zoom.ts so the guard is registered before the first paint",
  )
})
