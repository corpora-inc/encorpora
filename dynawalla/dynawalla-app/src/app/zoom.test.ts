// The document lock and the scale watchdog, asserted rather than described.
//
// What can be proved here: that the lock adds and removes the class it says it
// does, counts its holders, and hands the scroll offset back; that the pinch
// listeners are on the right target with the one option that makes
// `preventDefault` work at all; and that the two strings this module duplicates
// from files TypeScript never reads — the viewport meta in `index.html` and the
// class name in `index.css` — still match.
//
// What CANNOT be proved here, and is stated in the PR rather than hidden:
// whether WebKit on a real iPhone honours any of it. Nobody in this repository
// has an iPhone in CI. In particular a tap that lands inside a pack's iframe is
// dispatched in the child realm and never reaches this document at all, so no
// test in this file can stand in for one.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  createDocumentLock,
  installPinchGuard,
  LOCKED_CLASS,
  resetViewportScale,
  VIEWPORT_CONTENT,
  watchScale,
  type GuardTarget,
  type Listener,
} from "./zoom.ts"

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const appRoot = path.resolve(srcRoot, "..")

// ── the document lock ────────────────────────────────────────────────────────

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

test("locking freezes the document and releasing gives the scroll back where it was", () => {
  const lock = createDocumentLock()
  const { doc, win, classes, scrolls } = docHarness(742)

  const release = lock.acquire(doc, win)
  assert.ok(classes.has(LOCKED_CLASS), "the document must be locked while a pack is up")
  assert.deepEqual(scrolls, [], "nothing may scroll on the way in")

  release()
  assert.equal(classes.has(LOCKED_CLASS), false, "the lock must not outlive the pack")
  // `overflow: hidden` clamps the offset to zero, so a child who scrolled to
  // the bottom of the catalogue and played a game would come back to the top.
  assert.deepEqual(scrolls, [742])
})

test("releasing twice restores the scroll once", () => {
  // React StrictMode runs an effect's cleanup twice on the first mount.
  const lock = createDocumentLock()
  const { doc, win, scrolls } = docHarness(120)
  const release = lock.acquire(doc, win)
  release()
  release()
  assert.deepEqual(scrolls, [120])
  assert.equal(lock.holders(), 0, "a double release must not drive the count negative")
})

test("a second holder keeps the lock when the first lets go", () => {
  // The day-pass sheet opens over a running game. The sheet closing must not
  // hand the scroll back to a pack that is still on the stage.
  const lock = createDocumentLock()
  const { doc, win, classes, scrolls } = docHarness(310)

  const stage = lock.acquire(doc, win)
  const sheet = lock.acquire(doc, win)
  assert.equal(lock.holders(), 2)

  sheet()
  assert.ok(classes.has(LOCKED_CLASS), "one holder left is still a holder")
  assert.deepEqual(scrolls, [], "the scroll may not come back while a game is up")

  stage()
  assert.equal(classes.has(LOCKED_CLASS), false)
  assert.deepEqual(scrolls, [310])
})

test("the offset restored is the one the page really had, not the clamped zero", () => {
  // The second holder arrives while the document is already locked, so its
  // `scrollY` is whatever `overflow: hidden` clamped it to. Reading that one
  // would silently discard the child's place in the catalogue.
  const lock = createDocumentLock()
  const first = docHarness(880)
  const clamped = { scrollY: 0, scrollTo: (_x: number, y: number) => first.scrolls.push(y) }

  const stage = lock.acquire(first.doc, first.win)
  const sheet = lock.acquire(first.doc, clamped)
  sheet()
  stage()

  assert.deepEqual(first.scrolls, [880])
})

test("locking again after a full release captures the new offset", () => {
  const lock = createDocumentLock()
  const a = docHarness(50)
  lock.acquire(a.doc, a.win)()
  const b = docHarness(900)
  lock.acquire(b.doc, b.win)()

  assert.deepEqual(a.scrolls, [50])
  assert.deepEqual(b.scrolls, [900])
})

// ── the pinch guard ──────────────────────────────────────────────────────────

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

const GESTURES = ["gesturestart", "gesturechange", "gestureend"]

test("the gesture listeners are registered non-passive, which is the whole point", () => {
  // A passive listener's preventDefault() is ignored and logs nothing. iOS
  // treats window touch listeners as passive unless told otherwise, so
  // `{ passive: false }` is the difference between this working and this being
  // decoration.
  const { target, registered } = targetHarness()
  installPinchGuard(target)

  assert.deepEqual(
    registered.map((entry) => entry.type).sort(),
    [...GESTURES].sort(),
    "exactly the three WebKit gesture events, and nothing else",
  )
  for (const entry of registered) {
    assert.deepEqual(entry.options, { passive: false }, `${entry.type} must be non-passive`)
  }
})

test("every gesture event is prevented", () => {
  const { target, fire } = targetHarness()
  installPinchGuard(target)

  for (const type of GESTURES) {
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
  const dispose = installPinchGuard(target)
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

// ── the scale watchdog ───────────────────────────────────────────────────────

function metaHarness() {
  const written: string[] = []
  const meta = {
    get content() {
      return written[written.length - 1] ?? ""
    },
    set content(value: string) {
      written.push(value)
    },
  }
  return { meta, written }
}

test("resetting the scale ends on the canonical viewport, via a different string", () => {
  // Writing the same string back is a no-op and WebKit never re-evaluates.
  const { meta, written } = metaHarness()
  resetViewportScale(meta)
  assert.equal(written.length, 2)
  assert.notEqual(written[0], written[1])
  assert.equal(written[1], VIEWPORT_CONTENT)
  // The intermediate value must be the STRICTER of the two: a frame painted
  // while it is live must not be scalable in either direction.
  assert.match(written[0] ?? "", /minimum-scale=1/)
})

test("the watchdog fires only when the page has actually scaled", () => {
  const { meta, written } = metaHarness()
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

test("a missing viewport meta is loud, not silent", () => {
  // House rule: every catch is visible. Without the meta this whole module is
  // inert and nothing else in the app would say so.
  const said: unknown[] = []
  const real = console.error
  console.error = (...args: unknown[]) => said.push(args[0])
  try {
    const dispose = watchScale(
      {
        scale: 3,
        addEventListener: () => assert.fail("must not subscribe with nothing to write back"),
        removeEventListener: () => {},
      },
      null,
    )
    dispose()
  } finally {
    console.error = real
  }
  assert.equal(said.length, 1)
  assert.match(String(said[0]), /viewport meta/)
})

// ── the files this module duplicates strings from ────────────────────────────

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

/**
 * Every innermost rule in a stylesheet, comments stripped.
 *
 * `[^{}]*` cannot cross a brace, so each match runs from just after the
 * previous `}` (or `{`, inside `@layer`) to the next `}` with no nesting in
 * between — which is exactly the set of real declaration blocks. An earlier
 * version of this anchored on `(^|\})` and consumed the closing brace, so it
 * returned every OTHER rule and its coverage flipped with the parity of
 * anything added above. The sanity assertions below exist so that failure mode
 * cannot come back quietly.
 */
function rulesOf(css: string): { selector: string; body: string }[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "")
  return [...clean.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] ?? "").trim(),
    body: match[2] ?? "",
  }))
}

test("the stylesheet is cut for the class the lock actually sets", () => {
  const indexCss = fs.readFileSync(path.join(srcRoot, "index.css"), "utf8")
  const rules = rulesOf(indexCss)

  const lock = rules.find((rule) => rule.selector.includes(`html.${LOCKED_CLASS}`))
  assert.ok(lock, `index.css must carry a rule for .${LOCKED_CLASS}`)
  assert.match(lock.body, /overflow:\s*hidden/)
  // Both, not just html: body is the taller box and is what actually scrolls.
  assert.match(lock.selector, new RegExp(`html\\.${LOCKED_CLASS} body`))
})

test("the document lock is scoped to the class and never applied to html outright", () => {
  // An earlier attempt at this put the lock on `body` unconditionally and
  // stopped the catalogue scrolling entirely. `overflow-x: hidden` on html/body
  // is deliberate and stays; a bare `overflow` on either is the regression.
  const indexCss = fs.readFileSync(path.join(srcRoot, "index.css"), "utf8")
  const rules = rulesOf(indexCss)

  // The walker must actually be seeing the rules it is being asked about. A
  // parser that silently returns half the file is a test that reports green on
  // the very edit it exists to stop.
  assert.ok(
    rules.some((rule) => rule.selector === "body"),
    "the walker must find the base `body` rule",
  )
  assert.ok(
    rules.some((rule) => /overflow-x:\s*hidden/.test(rule.body)),
    "the walker must find the `html, body { overflow-x }` rule",
  )

  const bare = /(^|,)\s*(html|body)\s*(,|$)/m
  for (const rule of rules) {
    if (!bare.test(rule.selector)) continue
    assert.doesNotMatch(
      rule.body,
      /(^|;)\s*overflow\s*:/,
      `an unscoped \`overflow\` on \`${rule.selector}\` freezes the catalogue`,
    )
  }
})

test("the stage is what takes the lock", () => {
  // A source assertion, and a weak one — it proves the call is written, not
  // that React runs it. It is here because the whole fix is inert if the wiring
  // is deleted, and there is no DOM in this test runner to render Stage.tsx in.
  const stage = fs.readFileSync(path.join(srcRoot, "packs/Stage.tsx"), "utf8")
  assert.ok(
    stage.includes("documentLock.acquire(document, window)"),
    "Stage.tsx must take the document lock while a pack is mounted",
  )
  assert.ok(
    /useLayoutEffect\(\(\) => \{[^}]*documentLock\.acquire/s.test(stage),
    "the lock must be taken in the layout phase, or the scroll restore lands a frame late",
  )
  const main = fs.readFileSync(path.join(srcRoot, "main.tsx"), "utf8")
  assert.ok(
    main.includes('import "./app/zoom.ts"'),
    "main.tsx must import ./app/zoom.ts so the guard is registered before the first paint",
  )
})
