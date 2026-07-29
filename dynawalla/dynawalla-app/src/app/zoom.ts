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
//      double tap on a game canvas scales the HOST document.
//   2. On iOS a `position: fixed` element is laid out against the LAYOUT
//      viewport, and WebKit does not reposition it continuously while a pan is
//      in flight. The stage is `fixed inset-0`. The ONLY way anything behind it
//      can come into view is for the document to be taller than the layout
//      viewport and to scroll. A catalogue of game cards always is.
//
// Fact 2 is the one this app owns outright, and it is a necessary condition:
// take the document's scroll away while a game is up and there is nothing
// behind the stage to pan to, whether or not the scale changed. That is the
// document lock, and it is the fix.
//
// ── What this file cannot do ─────────────────────────────────────────────────
// Touch events raised inside a cross-origin iframe are dispatched in the child
// realm and never cross the boundary — `window.parent` is not even readable
// from there. So nothing here can see, let alone prevent, the tap that starts
// this. Preventing it at source belongs to the pack document, which means the
// pack SDK. `resetViewportScale` is the only lever in this file that reaches
// across the boundary at all, and it is a recovery rather than a prevention: it
// undoes a scale change after the fact instead of stopping the gesture.
//
// A `touchend` double-tap guard on the host window was written, tested and then
// deleted. It could only ever cover host chrome — the exit chevron, the sheets,
// the catalogue — where `touch-action: manipulation` on `body` already disables
// double-tap zoom per spec, and where `preventDefault()` on the second
// `touchend` also cancels the compatibility `click`. That is a parent tapping
// "Erase everything" twice in place, as that control is designed to be used,
// and the second press doing nothing. A guard whose only reachable surface is
// the one where it costs an activation is not worth its own code.
//
// ── Why the viewport meta is not enough on its own ───────────────────────────
// `user-scalable=no, maximum-scale=1` is respected by WKWebView by default
// (unlike Safari, which has ignored it since iOS 10 —
// `WKWebViewConfiguration.ignoresViewportScaleLimits` is false unless someone
// sets it, and wry does not). It is kept, it is the first line, and it is
// pinned to `index.html` by a test. It has been reported not to hold on a real
// iPhone, which is why nothing here depends on it.

/**
 * On `<html>` for as long as anything is covering the page.
 *
 * The class already existed, cut for the sheets, which want the same thing for
 * the same reason: a scrim is `position: fixed`, so a drag on it scrolls
 * whatever is behind it. The stage is the only caller today — the sheets have
 * yet to be wired to `documentLock` — but there is one class and one rule, and
 * the lock counts its holders so that when they are, a sheet closing over a
 * running game does not unlock the page under it.
 */
export const LOCKED_CLASS = "dw-locked"

/**
 * The canonical viewport, duplicated from `index.html` because a string in a
 * document TypeScript never reads is a string that silently drifts. A test
 * asserts the two are the same.
 */
export const VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no"

// ── the document lock ────────────────────────────────────────────────────────

export type ClassList = { add(token: string): void; remove(token: string): void }
export type LockDocument = { readonly documentElement: { readonly classList: ClassList } }
export type LockWindow = { readonly scrollY: number; scrollTo(x: number, y: number): void }

export type DocumentLock = {
  /** Take the lock. Returns the release, which is idempotent. */
  acquire(doc: LockDocument, win: LockWindow): () => void
  /** Test seam: how many holders there are right now. */
  holders(): number
}

/**
 * Take the host document's scroll away while something is covering it, and give
 * it back — at the same offset — when the last holder lets go.
 *
 * Counted, not a boolean: the stage and a sheet can both be up, and a sheet
 * closing must not hand the scroll back to a game that is still running. The
 * offset restored is the one captured when the FIRST holder took the lock,
 * because that is the last moment the page was really scrolled.
 *
 * Restoring it is not a nicety: `overflow: hidden` clamps the offset to zero, so
 * without this a child who scrolled to the bottom of the catalogue, played a
 * game and came back would be at the top.
 */
export function createDocumentLock(): DocumentLock {
  let held = 0
  let restore: { win: LockWindow; offset: number } | null = null
  let root: LockDocument | null = null

  return {
    holders: () => held,
    acquire(doc, win) {
      if (held === 0) {
        root = doc
        restore = { win, offset: win.scrollY }
        doc.documentElement.classList.add(LOCKED_CLASS)
      }
      held += 1

      let released = false
      return () => {
        if (released) return
        released = true
        held -= 1
        if (held > 0) return
        root?.documentElement.classList.remove(LOCKED_CLASS)
        restore?.win.scrollTo(0, restore.offset)
        root = null
        restore = null
      }
    },
  }
}

/** The one lock the app actually uses. */
export const documentLock = createDocumentLock()

// ── the pinch guard ──────────────────────────────────────────────────────────

export type Listener = (event: never) => void

export type GuardTarget = {
  addEventListener(type: string, listener: Listener, options?: unknown): void
  removeEventListener(type: string, listener: Listener, options?: unknown): void
}

/**
 * Refuse WebKit's pinch on the host document. Returns a disposer.
 *
 * `gesturestart`/`gesturechange`/`gestureend` are WebKit's own, non-standard,
 * and TWO-FINGER: they are pinch, and they are NOT double tap. They are here
 * because the invariant is "the host page never scales", not because they cover
 * the bug this file is named for — nobody should read them as doing that. Like
 * everything else here they stop at the iframe boundary.
 *
 * Registered non-passive, because a passive listener's `preventDefault()` is
 * ignored and reports nothing. That option is the whole difference between this
 * working and this being decoration, so there is a test for it.
 */
export function installPinchGuard(target: GuardTarget): () => void {
  const onGesture = (event: { preventDefault(): void }) => event.preventDefault()
  const types = ["gesturestart", "gesturechange", "gestureend"]
  const options = { passive: false }

  for (const type of types) target.addEventListener(type, onGesture as Listener, options)

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    for (const type of types) target.removeEventListener(type, onGesture as Listener, options)
  }
}

// ── the scale watchdog ───────────────────────────────────────────────────────

/**
 * Put the page back to scale 1.
 *
 * There is no API for this. Rewriting the viewport meta makes WebKit
 * re-evaluate it and clamp the current scale to the limits it finds, and
 * writing the SAME string is a no-op — so it goes out via a value that differs
 * textually first. The intermediate string is the STRICTER of the two: it adds
 * `minimum-scale=1`, so for the frame it is live the page cannot be scaled in
 * either direction, and the canonical string is then restored verbatim.
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
 * `visualViewport` is a property of the top-level page, so this sees a zoom a
 * pack's iframe caused even though it never sees the touch that caused it.
 * Returns a disposer.
 */
export function watchScale(
  viewport: VisualViewportLike,
  meta: { content: string } | null,
): () => void {
  if (!meta) {
    // The viewport meta is what stops the page scaling in the first place, and
    // without it there is nothing to write back either. Loud, because the whole
    // of this file is then inert and nothing else would say so.
    console.error("[zoom] no viewport meta: the page can scale and nothing can undo it")
    return () => {}
  }
  const onResize = () => {
    if (Math.abs(viewport.scale - 1) > SCALE_TOLERANCE) resetViewportScale(meta)
  }
  viewport.addEventListener("resize", onResize)
  return () => viewport.removeEventListener("resize", onResize)
}

// Applied at module load, like the theme: the host page must never scale, and
// there is no screen on which that is not true. Nothing here reaches into the
// pack iframe — see the note at the top of the file.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  installPinchGuard(window as unknown as GuardTarget)
  const viewport = (window as unknown as { visualViewport?: VisualViewportLike }).visualViewport
  if (viewport) watchScale(viewport, document.querySelector<HTMLMetaElement>('meta[name="viewport"]'))
}
