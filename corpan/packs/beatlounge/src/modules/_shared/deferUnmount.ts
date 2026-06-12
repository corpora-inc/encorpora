/**
 * beatlounge — deferred, idempotent React-root teardown.
 *
 * Calling `root.unmount()` synchronously while React is still rendering/committing
 * (which is exactly what the host's teardown can trigger on a pack reload) throws
 * "Attempted to synchronously unmount a root while React was already rendering" and
 * detaches DOM mid-commit → `NotFoundError: removeChild` → black screen.
 *
 * `makeDeferredUnmount(root)` returns an `unmount()` that is:
 *   (a) ONCE-ONLY — a guard flag means disposing twice is a no-op, and
 *   (b) DEFERRED past the current render — the actual `root.unmount()` runs on a
 *       microtask, AFTER React's current render/commit unwinds, wrapped in try/catch.
 *
 * Every module index + the pack root use this so teardown is uniform and safe.
 */

import type { Root } from "react-dom/client"

/**
 * Build a once-only, deferred `unmount()` for a React root. Pass an optional
 * `before` callback to run synchronous, idempotent cleanup (controllers,
 * subscriptions) right when teardown is requested — its throw is contained so a
 * failing dispose never blanks the screen, and the deferred `root.unmount()`
 * still runs.
 */
export const makeDeferredUnmount = (
  root: Root,
  before?: () => void
): (() => void) => {
  let unmounted = false
  return () => {
    if (unmounted) return
    unmounted = true
    if (before) {
      try {
        before()
      } catch (err) {
        console.warn("[beatlounge] teardown cleanup threw (continuing):", err)
      }
    }
    // Defer past the current React render/commit; bare-call would interrupt it.
    Promise.resolve().then(() => {
      try {
        root.unmount()
      } catch {
        /* root container already detached */
      }
    })
  }
}
