import assert from "node:assert/strict"
import { test } from "node:test"

import {
  NO_INSETS,
  publishSafeVars,
  safeInsets,
  setHostInsets,
  safeRect,
  type Insets,
  type StyleTarget,
} from "./insets.ts"
import { HOST_CONTROL, chromeRects, exitRect, helpRect, hitsHostChrome } from "./hostChrome.ts"

test("with no document to measure, the insets are zero rather than undefined", () => {
  // A game must never have to branch on platform. Node, a test harness and a
  // device with no notch all answer the same way.
  assert.deepEqual(safeInsets(), NO_INSETS)
})

test("with no insets the safe rect is the whole surface", () => {
  assert.deepEqual(safeRect(800, 600, NO_INSETS), { x: 0, y: 0, w: 800, h: 600 })
})

test("the safe rect is inset on every edge that has one", () => {
  const r = safeRect(400, 800, { top: 47, right: 0, bottom: 34, left: 0 })
  assert.deepEqual(r, { x: 0, y: 47, w: 400, h: 800 - 47 - 34 })
})

test("a landscape notch insets the sides, not the top", () => {
  const r = safeRect(844, 390, { top: 0, right: 47, bottom: 21, left: 47 })
  assert.deepEqual(r, { x: 47, y: 0, w: 844 - 94, h: 390 - 21 })
})

test("insets larger than the surface clamp to an empty rect, never a negative one", () => {
  // A negative width silently flips every layout calculation downstream. This
  // is only reachable on an absurd viewport, which is exactly when nobody is
  // watching for it.
  const r = safeRect(20, 20, { top: 100, right: 100, bottom: 100, left: 100 })
  assert.equal(r.w, 0)
  assert.equal(r.h, 0)
  assert.ok(r.x <= 20 && r.y <= 20)
})

test("the rect always stays inside the surface it was given", () => {
  for (const [w, h] of [[320, 568], [1024, 1366], [844, 390], [1, 1]] as const) {
    for (const i of [
      { top: 0, right: 0, bottom: 0, left: 0 },
      { top: 47, right: 0, bottom: 34, left: 0 },
      { top: 59, right: 47, bottom: 34, left: 47 },
    ]) {
      const r = safeRect(w, h, i)
      assert.ok(r.x >= 0 && r.y >= 0, `origin negative at ${w}x${h}`)
      assert.ok(r.w >= 0 && r.h >= 0, `size negative at ${w}x${h}`)
      assert.ok(r.x + r.w <= w, `overflows width at ${w}x${h}`)
      assert.ok(r.y + r.h <= h, `overflows height at ${w}x${h}`)
    }
  }
})


// ---------------------------------------------------------------------------
// Host chrome. It OVERLAYS the game — reserving the whole top band cost 12% of
// a small phone's height and broke a real layout — so a game promises only that
// nothing critical sits in two 44px corners.
// ---------------------------------------------------------------------------

test("the two controls never overlap each other, at any width", () => {
  for (const w of [320, 390, 700, 844, 1024, 1366]) {
    const e = exitRect(NO_INSETS)
    const h = helpRect(w, NO_INSETS)
    assert.ok(e.x + e.w <= h.x, `exit and help collide at width ${w}`)
  }
})

test("both controls sit inside the safe area, never under the notch", () => {
  for (const i of [
    { top: 47, right: 0, bottom: 34, left: 0 },
    { top: 0, right: 47, bottom: 21, left: 47 },
  ]) {
    for (const r of chromeRects(844, i)) {
      assert.ok(r.x >= i.left, "control intrudes into the left inset")
      assert.ok(r.y >= i.top, "control intrudes into the top inset")
      assert.ok(r.x + r.w <= 844 - i.right + 0.001, "control intrudes into the right inset")
    }
  }
})

test("the touch target is never below the platform minimum", () => {
  // If someone tunes these for looks, this fails rather than shipping a button
  // a child misses.
  assert.ok(HOST_CONTROL >= 44, "host control is under the 44px minimum")
})

test("hitsHostChrome finds a score placed in either corner, and clears the middle", () => {
  const w = 390
  assert.equal(hitsHostChrome({ x: 14, y: 14, w: 80, h: 30 }, w, NO_INSETS), true, "top-left missed")
  assert.equal(hitsHostChrome({ x: w - 90, y: 14, w: 80, h: 30 }, w, NO_INSETS), true, "top-right missed")
  assert.equal(hitsHostChrome({ x: 120, y: 14, w: 100, h: 30 }, w, NO_INSETS), false, "top-centre is free")
  assert.equal(hitsHostChrome({ x: 0, y: 300, w: 390, h: 40 }, w, NO_INSETS), false, "mid-screen is free")
})

// ---------------------------------------------------------------------------
// Host-supplied insets. Inside the shipped app the probe can only return zeros
// — a pack is a cross-origin child and env() belongs to the top-level document
// — so the host measures and sends them.
// ---------------------------------------------------------------------------

test("host insets win over the probe, which is blind inside a pack", () => {
  setHostInsets({ top: 47, right: 0, bottom: 34, left: 0 })
  assert.deepEqual(safeInsets(), { top: 47, right: 0, bottom: 34, left: 0 })
  setHostInsets(null)
  assert.deepEqual(safeInsets(), NO_INSETS, "clearing must fall back, not stick")
})

test("a malformed payload from the host is refused, not trusted", () => {
  // An older host sends nothing; a broken one could send anything. Neither may
  // produce a NaN inset, which would poison every layout downstream.
  for (const bad of [
    undefined,
    null,
    { top: Number.NaN, right: 0, bottom: 0, left: 0 },
    { top: -5, right: 0, bottom: 0, left: 0 },
  ]) {
    setHostInsets(bad as never)
    const got = safeInsets()
    for (const v of [got.top, got.right, got.bottom, got.left]) {
      assert.ok(Number.isFinite(v) && v >= 0, `bad payload produced ${v}`)
    }
  }
  setHostInsets(null)
})

// ---------------------------------------------------------------------------
// Publishing the safe area to a stylesheet.
//
// A pack's DOM chrome cannot read `env()` at all — it is a cross-origin child —
// so the four numbers have to be written onto the root as custom properties and
// the stylesheet has to read them through `var()`. These are the two properties
// every pack that does this depends on.
// ---------------------------------------------------------------------------

const spy = (): { seen: Map<string, string>; writes: number; el: StyleTarget } => {
  const seen = new Map<string, string>()
  const box = { writes: 0 }
  const el: StyleTarget = {
    style: {
      setProperty(name: string, value: string): void {
        box.writes++
        seen.set(name, value)
      },
    },
  }
  return {
    seen,
    get writes(): number {
      return box.writes
    },
    el,
  }
}

test("all four properties are published, with zeros written out", () => {
  const s = spy()
  publishSafeVars(s.el, "--mn-safe-", { top: 24, right: 0, bottom: 48, left: 0 })
  assert.deepEqual(
    [...s.seen.entries()].sort(),
    [
      ["--mn-safe-bottom", "48px"],
      ["--mn-safe-left", "0px"],
      ["--mn-safe-right", "0px"],
      ["--mn-safe-top", "24px"],
    ],
  )
  // A zero must be WRITTEN, not left unset: an absent custom property falls
  // through to the `env()` fallback beside it, and inside a pack frame that is
  // the number zero whatever the real inset is. Leaving it out is the bug.
  assert.equal(s.seen.get("--mn-safe-right"), "0px", "a zero inset was left for env() to answer")
})

test("republishing an unchanged safe area writes nothing; a rotation writes", () => {
  const s = spy()
  const i: Insets = { top: 24, right: 0, bottom: 48, left: 0 }
  assert.equal(publishSafeVars(s.el, "--x-", i, null), true)
  assert.equal(s.writes, 4)
  assert.equal(publishSafeVars(s.el, "--x-", { ...i }, i), false, "an unchanged inset was rewritten")
  assert.equal(s.writes, 4)
  assert.equal(publishSafeVars(s.el, "--x-", { ...i, top: 47 }, i), true, "a rotation was not published")
  assert.equal(s.writes, 8)
})
