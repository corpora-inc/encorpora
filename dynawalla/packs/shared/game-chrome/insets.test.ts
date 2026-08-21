import assert from "node:assert/strict"
import { test } from "node:test"

import {
  SAFE_PREFIX,
  SIDES,
  installSafeArea,
  onInsetsChange,
  safeVar,
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

/* ── installSafeArea: the one call every pack makes ──────────────────────── */

/**
 * A stand-in for `globalThis` that records its listeners, so a test can fire a
 * rotation without a browser. `onInsetsChange` attaches to `globalThis`, so
 * this swaps it for the duration and puts it back.
 */
function withFakeWindow<T>(body: (fire: () => void) => T): T {
  const listeners: (() => void)[] = []
  const realAdd = globalThis.addEventListener
  const realRemove = globalThis.removeEventListener
  globalThis.addEventListener = ((_type: string, fn: () => void): void => {
    listeners.push(fn)
  }) as typeof globalThis.addEventListener
  globalThis.removeEventListener = ((_type: string, fn: () => void): void => {
    const at = listeners.indexOf(fn)
    if (at >= 0) listeners.splice(at, 1)
  }) as typeof globalThis.removeEventListener
  try {
    return body(() => {
      for (const fn of [...listeners]) fn()
    })
  } finally {
    globalThis.addEventListener = realAdd
    globalThis.removeEventListener = realRemove
    setHostInsets(null)
  }
}

test("installSafeArea publishes all four immediately, zeros written out", () => {
  const s = spy()
  setHostInsets({ top: 24, right: 0, bottom: 48, left: 0 })
  // Disposed BEFORE the reset. `setHostInsets` notifies now, so a live
  // subscription would see the reset and rewrite all four back to zero — which
  // is correct behaviour and would make this assertion measure the teardown.
  try {
    installSafeArea(s.el).dispose()
  } finally {
    setHostInsets(null)
  }
  assert.deepEqual(
    [...s.seen.entries()].sort(),
    [
      ["--dw-safe-bottom", "48px"],
      ["--dw-safe-left", "0px"],
      ["--dw-safe-right", "0px"],
      ["--dw-safe-top", "24px"],
    ],
    "the stylesheet was not handed the numbers the host measured",
  )
  // The two zeros are the whole point. Left unset, `var(--dw-safe-right, env(…))`
  // falls through to an `env()` that is itself zero inside a pack frame — the
  // right answer here and the wrong answer the moment the device rotates.
  assert.equal(s.seen.get("--dw-safe-right"), "0px")
  assert.equal(s.seen.get("--dw-safe-left"), "0px")
})

test("installSafeArea calls back synchronously, so nothing needs a second 'and lay out now'", () => {
  const s = spy()
  const seen: Insets[] = []
  setHostInsets({ top: 47, right: 0, bottom: 34, left: 0 })
  try {
    const area = installSafeArea(s.el, (i) => seen.push(i))
    assert.deepEqual(seen, [{ top: 47, right: 0, bottom: 34, left: 0 }])
    assert.deepEqual(area.current(), { top: 47, right: 0, bottom: 34, left: 0 })
    area.dispose()
  } finally {
    setHostInsets(null)
  }
})

test("installSafeArea republishes when the insets change under it", () => {
  withFakeWindow((fire) => {
    const s = spy()
    const seen: Insets[] = []
    setHostInsets({ top: 24, right: 0, bottom: 48, left: 0 })
    const area = installSafeArea(s.el, (i) => seen.push(i))
    assert.equal(s.writes, 4)

    // A rotation: the navigation bar leaves the bottom edge for the right one.
    setHostInsets({ top: 24, right: 48, bottom: 0, left: 0 })
    fire()
    assert.equal(s.seen.get("--dw-safe-right"), "48px", "the rotation was never published")
    assert.equal(s.seen.get("--dw-safe-bottom"), "0px", "the old bottom inset was left standing")
    assert.deepEqual(area.current(), { top: 24, right: 48, bottom: 0, left: 0 })
    assert.equal(seen.length, 2, "the canvas half was not told the screen had moved")

    // Nothing moved: nothing is written, and nothing is laid out again.
    const before = s.writes
    fire()
    assert.equal(s.writes, before, "an unchanged safe area was written again")
    assert.equal(seen.length, 2, "an unchanged safe area triggered a relayout")

    area.dispose()
    setHostInsets({ top: 0, right: 0, bottom: 0, left: 0 })
    fire()
    assert.equal(seen.length, 2, "the subscription outlived dispose()")
  })
})

test("the CSS and the canvas take the SAME measurement", () => {
  // This is the defect in one assertion. SIEGE's canvas half was right because
  // `mount.ts` used `safeInsets()`; its CSS half asked the browser and got
  // zero, and the two halves of one game disagreed about where the screen was.
  // There is now no way to ask twice: one call publishes and reports.
  withFakeWindow(() => {
    const s = spy()
    setHostInsets({ top: 24, right: 0, bottom: 48, left: 0 })
    let forTheCanvas: Insets = NO_INSETS
    const area = installSafeArea(s.el, (i) => {
      forTheCanvas = i
    })
    const forTheStylesheet: Insets = {
      top: Number.parseFloat(s.seen.get("--dw-safe-top") ?? "-1"),
      right: Number.parseFloat(s.seen.get("--dw-safe-right") ?? "-1"),
      bottom: Number.parseFloat(s.seen.get("--dw-safe-bottom") ?? "-1"),
      left: Number.parseFloat(s.seen.get("--dw-safe-left") ?? "-1"),
    }
    assert.deepEqual(forTheStylesheet, forTheCanvas)
    assert.deepEqual(forTheCanvas, area.current())
    area.dispose()
  })
})

test("safeVar is the one string a stylesheet may use, and it names the property first", () => {
  assert.equal(safeVar("top"), "var(--dw-safe-top, env(safe-area-inset-top, 0px))")
  for (const side of SIDES) {
    const v = safeVar(side)
    assert.ok(
      v.startsWith(`var(${SAFE_PREFIX}${side}, env(`),
      `${side}: the published property must come FIRST — the env() behind it is zero inside a ` +
        `pack frame, so a rule that reads it first reads zero`,
    )
    assert.ok(v.endsWith("0px))"), `${side}: the env() needs its own 0px fallback`)
  }
})

test("the host telling us is itself a change — the path the real numbers arrive by", () => {
  // The hole this closes. `onInsetsChange` used to listen for `resize` and
  // `orientationchange` only, and `setHostInsets` was a plain assignment — so
  // the ONE path by which the true insets reach a pack was the one path nothing
  // was told about. On a device the sequence is: the pack mounts and lays out
  // against the probe's zeros, the handshake completes, `game-host` writes the
  // real numbers, and nothing asks again until the child happens to rotate the
  // phone. On iPadOS a Split View resize pushes new insets without moving the
  // pack's box at all, so a ResizeObserver never fires either.
  //
  // No DOM here on purpose: in node there are no window events, so if the host
  // path did not notify, this test could not pass at all.
  const seen: Insets[] = []
  const stop = onInsetsChange((i) => seen.push(i))
  try {
    setHostInsets({ top: 24, right: 0, bottom: 48, left: 0 })
    assert.deepEqual(seen, [{ top: 24, right: 0, bottom: 48, left: 0 }], "the handshake told nobody")

    // A Split View resize: same box, different insets.
    setHostInsets({ top: 24, right: 48, bottom: 0, left: 0 })
    assert.equal(seen.length, 2, "a Split View change told nobody")

    // The same numbers again are not a change.
    setHostInsets({ top: 24, right: 48, bottom: 0, left: 0 })
    assert.equal(seen.length, 2, "an unchanged push caused a relayout")
  } finally {
    stop()
    setHostInsets(null)
  }
  // `stop()` runs before the reset in the same `finally`, so the reset is not
  // seen — and nothing after it is either.
  assert.equal(seen.length, 2)
  setHostInsets({ top: 99, right: 0, bottom: 0, left: 0 })
  assert.equal(seen.length, 2, "the subscription outlived its unsubscribe")
  setHostInsets(null)
})

test("installSafeArea republishes when the HOST sends insets after mount", () => {
  // The same hole, seen from the call every pack actually makes — and this is
  // the sequence on a real device, in order.
  const s = spy()
  const forTheCanvas: Insets[] = []
  const area = installSafeArea(s.el, (i) => forTheCanvas.push(i))
  try {
    // Mount: no host yet, and inside a pack frame the probe can only read zeros.
    assert.deepEqual(area.current(), NO_INSETS)
    assert.equal(s.seen.get("--dw-safe-bottom"), "0px")

    // The handshake lands.
    setHostInsets({ top: 24, right: 0, bottom: 48, left: 0 })
    assert.equal(
      s.seen.get("--dw-safe-bottom"),
      "48px",
      "the stylesheet never heard about the navigation bar",
    )
    assert.deepEqual(
      forTheCanvas.at(-1),
      { top: 24, right: 0, bottom: 48, left: 0 },
      "the canvas never heard about the navigation bar",
    )
    assert.deepEqual(area.current(), { top: 24, right: 0, bottom: 48, left: 0 })
  } finally {
    area.dispose()
    setHostInsets(null)
  }
})
