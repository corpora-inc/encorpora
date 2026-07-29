// Nothing in this app is a document, and a document is the only thing that
// should scale.
//
// ── What actually goes wrong ─────────────────────────────────────────────────
// A child double-taps inside a running game on an iPhone. The page scales, the
// child's finger pans it, and the catalogue appears above the game. It reads
// like the game "leaking" — it is not. Two separate facts combine:
//
//   1. Page scale is a property of the TOP-LEVEL page. A pack runs in a
//      sandboxed, opaque-origin iframe, but an iframe has no viewport and no
//      scale of its own; the gesture recogniser lives on the WKWebView. So a
//      double tap on a game canvas scales the host document.
//   2. On iOS a `position: fixed` element is laid out against the LAYOUT
//      viewport, and WebKit does not reposition it continuously while a pan is
//      in flight. The stage is `fixed inset-0`. The ONLY way anything behind it
//      can come into view is for the document to be taller than the layout
//      viewport and to scroll. A catalogue of game cards always is.
//
// Fact 2 is the one this app fully owns, and it is a necessary condition: take
// the document's scroll away while a game is up and there is nothing behind the
// stage to pan to, whether or not the scale changed. That is `stageDocument`.
//
// ── What this file cannot do ─────────────────────────────────────────────────
// The tap guard below sees `touchstart`/`touchend` on the HOST document only.
// Touch events raised inside a cross-origin iframe are dispatched in the child
// realm and never cross the boundary — `window.parent` is not even readable
// from there. So the guard covers the exit chevron, the day-pass sheet and the
// catalogue, and it does NOT cover a tap that lands on a game. Preventing that
// one at source belongs to the pack document, which means the pack SDK, not
// here. `resetViewportScale` is the only lever in this file that reaches across
// the boundary at all, and it is a recovery rather than a prevention: it undoes
// a scale change after the fact instead of stopping the gesture.
//
// ── Why the viewport meta is not enough on its own ───────────────────────────
// `user-scalable=no, maximum-scale=1` is respected by WKWebView by default
// (unlike Safari, which has ignored it since iOS 10 —
// `WKWebViewConfiguration.ignoresViewportScaleLimits` is false unless someone
// sets it, and wry does not). It is kept, it is the first line, and it is
// asserted against `index.html` by the tests. It has been reported not to hold
// on a real iPhone, which is why none of what follows depends on it.

/** On `<html>` for exactly as long as a pack is on the stage. */
export const STAGED_CLASS = "dw-staged"

/**
 * The canonical viewport, duplicated from `index.html` because a string in a
 * document TypeScript never reads is a string that silently drifts. A test
 * asserts the two are the same.
 */
export const VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no"

/** The window WebKit joins two taps into one gesture in. */
export const DOUBLE_TAP_MS = 350

/**
 * How far a finger may travel and still have been a tap.
 *
 * Generous on purpose: this is a seven-year-old's finger on a game, not a
 * mouse. Too small and a slightly smeared double tap is not caught; too large
 * and a short flick of the catalogue is mistaken for one, which is why the
 * guard also checks the distance the finger travelled WITHIN each tap and
 * treats anything that moved as a drag rather than as a tap.
 */
export const TAP_SLOP_PX = 30

export type Point = { readonly x: number; readonly y: number }

function far(a: Point, b: Point): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) > TAP_SLOP_PX
}

export type TapGuard = {
  /** `touchstart`. `fingers` is `event.touches.length`. */
  start(fingers: number, point: Point, at: number): void
  /** `touchend`. True when this is the second tap of a double tap. */
  end(point: Point, at: number): boolean
}

/**
 * The classic double-tap guard, as a pure state machine.
 *
 * A tap is one finger that went down and came up in the same place. A double
 * tap is two of those, close together in time and in space. Everything else —
 * a scroll, a flick, a two-finger anything, a long press that drifted — is not
 * a tap and clears the pair, because the alternative is a guard that swallows
 * the tap at the end of a scroll.
 */
export function createTapGuard(): TapGuard {
  let down: { point: Point; at: number } | null = null
  let multi = false
  let previous: { point: Point; at: number } | null = null

  return {
    start(fingers, point, at) {
      if (fingers > 1) {
        // A pinch is not two taps, and neither half of it may be counted.
        multi = true
        down = null
        previous = null
        return
      }
      multi = false
      down = { point, at }
    },

    end(point, at) {
      const from = down
      down = null
      if (multi || from === null) {
        previous = null
        return false
      }
      // It moved: a scroll, a swipe, a joystick. Not a tap, and it ends any
      // pair in progress so the finger lifting is never the second of one.
      if (far(from.point, point)) {
        previous = null
        return false
      }

      const first = previous
      if (first !== null && at - first.at <= DOUBLE_TAP_MS && !far(first.point, point)) {
        // The pair is spent. A third tap opens a new one rather than pairing
        // with the second, which is what makes a child drumming on a button
        // cost one suppressed click per two taps and not every tap after the
        // first.
        previous = null
        return true
      }

      previous = { point, at }
      return false
    },
  }
}

type TouchPoint = { readonly clientX: number; readonly clientY: number }

/** The parts of a `TouchEvent` this file uses. Narrow so it can be faked. */
export type TouchEventLike = {
  readonly touches: { readonly length: number }
  readonly changedTouches: { readonly length: number; readonly [index: number]: TouchPoint }
  readonly timeStamp: number
  preventDefault(): void
}

export type Listener = (event: never) => void

export type GuardTarget = {
  addEventListener(type: string, listener: Listener, options?: unknown): void
  removeEventListener(type: string, listener: Listener, options?: unknown): void
}

/**
 * Register the guard on the host document. Returns a disposer.
 *
 * `touchend` MUST be registered non-passive: a passive listener's
 * `preventDefault()` is ignored, and iOS defaults touch listeners on the window
 * to passive. That single option is the whole difference between this working
 * and this being decoration, so there is a test for it.
 *
 * `gesturestart`/`gesturechange`/`gestureend` are WebKit's own, non-standard
 * and two-finger only: they are pinch, NOT double tap. They are here because
 * the invariant is "the host page never scales", not "the host page never
 * double-tap-zooms" — but nobody should expect them to fire for a double tap.
 */
export function installZoomGuard(
  target: GuardTarget,
  guard: TapGuard = createTapGuard(),
): () => void {
  const onStart = (event: TouchEventLike) => {
    const touch = event.changedTouches[0]
    if (!touch) return
    guard.start(event.touches.length, { x: touch.clientX, y: touch.clientY }, event.timeStamp)
  }

  const onEnd = (event: TouchEventLike) => {
    const touch = event.changedTouches[0]
    if (!touch) return
    if (guard.end({ x: touch.clientX, y: touch.clientY }, event.timeStamp)) event.preventDefault()
  }

  const onGesture = (event: { preventDefault(): void }) => event.preventDefault()

  const registered: [string, Listener, unknown][] = [
    ["touchstart", onStart as Listener, { passive: true }],
    ["touchend", onEnd as Listener, { passive: false }],
    ["gesturestart", onGesture as Listener, { passive: false }],
    ["gesturechange", onGesture as Listener, { passive: false }],
    ["gestureend", onGesture as Listener, { passive: false }],
  ]

  for (const [type, listener, options] of registered) {
    target.addEventListener(type, listener, options)
  }

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    for (const [type, listener, options] of registered) {
      target.removeEventListener(type, listener, options)
    }
  }
}

/**
 * Put the page back to scale 1.
 *
 * There is no API for this. Rewriting the viewport meta makes WebKit
 * re-evaluate it and clamp the current scale to the limits it finds, and
 * writing the SAME string is a no-op — so it goes out via a value that differs
 * textually while describing exactly the same viewport, then back to the
 * canonical one. Both strings pin minimum = initial = maximum = 1, so there is
 * no intermediate viewport a frame could be painted at.
 *
 * UNVERIFIED on a device. This is the only thing in this file that can undo a
 * zoom which began inside a pack's iframe, and it is a recovery: the scale
 * changes and then snaps back. Prevention there belongs to the pack.
 */
export function resetViewportScale(meta: { content: string }): void {
  meta.content = `${VIEWPORT_CONTENT}, minimum-scale=1`
  meta.content = VIEWPORT_CONTENT
}

export type VisualViewportLike = {
  readonly scale: number
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

/** Scale drift below this is float noise, not a zoom. */
const SCALE_TOLERANCE = 0.01

/**
 * Watch the visual viewport and undo any scale the page acquires.
 *
 * `visualViewport` is a property of the top-level page, so this sees a zoom
 * that a pack's iframe caused even though it never sees the touch that caused
 * it. Returns a disposer.
 */
export function watchScale(
  viewport: VisualViewportLike,
  meta: { content: string } | null,
): () => void {
  if (!meta) return () => {}
  const onResize = () => {
    if (Math.abs(viewport.scale - 1) > SCALE_TOLERANCE) resetViewportScale(meta)
  }
  viewport.addEventListener("resize", onResize)
  return () => viewport.removeEventListener("resize", onResize)
}

export type ClassList = { add(token: string): void; remove(token: string): void }
export type StageDocument = { readonly documentElement: { readonly classList: ClassList } }
export type StageWindow = { readonly scrollY: number; scrollTo(x: number, y: number): void }

/**
 * Take the host document's scroll away for as long as a pack is on the stage,
 * and give it back — at the same offset — when the pack leaves.
 *
 * This is the fix, not a hardening of it: with nothing to scroll, a scaled and
 * panned page has nowhere to pan to, so the catalogue behind the stage cannot
 * come into view even if the zoom itself happens.
 *
 * Scoped to a class that only exists while a game is running. `overflow:
 * hidden` on `html` unconditionally froze the catalogue once already; this is
 * why it is a class and not a rule.
 *
 * Restoring `scrollY` is not a nicety: `overflow: hidden` clamps the offset to
 * zero, so without this a child who scrolled to the bottom of the catalogue,
 * played a game and came back would be at the top.
 */
export function stageDocument(doc: StageDocument, win: StageWindow): () => void {
  const offset = win.scrollY
  doc.documentElement.classList.add(STAGED_CLASS)
  let released = false
  return () => {
    if (released) return
    released = true
    doc.documentElement.classList.remove(STAGED_CLASS)
    win.scrollTo(0, offset)
  }
}

// Applied at module load, like the theme: the host page must never scale, and
// there is no screen on which that is not true. Nothing here touches the pack
// iframe — see the note at the top of the file.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  installZoomGuard(window as unknown as GuardTarget)
  const viewport = (window as unknown as { visualViewport?: VisualViewportLike }).visualViewport
  if (viewport) watchScale(viewport, document.querySelector<HTMLMetaElement>('meta[name="viewport"]'))
}
