// Idle scheduling.
//
// The next problem is generated while the child is reading the current one, so
// nothing generates on the answer path. `requestIdleCallback` is the right
// instrument and it is not universal: Safari only shipped it in 16.4 and this app
// promises iOS 16.0. A `setTimeout(…, 0)` fallback runs after the current task
// and after paint, which is the property that actually matters — it is a worse
// scheduler, not a missing one.
//
// A seam, not a wrapper for its own sake: the tests drive `runIdle` with a
// recording scheduler and assert that generation happened *there* and not inside
// the commit handler.

export type IdleScheduler = (run: () => void) => () => void

const timeoutScheduler: IdleScheduler = (run) => {
  const handle = setTimeout(run, 0)
  return () => clearTimeout(handle)
}

/** The platform's idle scheduler, resolved at call time so a test can stub it. */
export function idleScheduler(): IdleScheduler {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback
  const cancel = (globalThis as { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback
  if (typeof ric !== "function") return timeoutScheduler
  return (run) => {
    // A timeout, because an idle callback with no deadline can be starved
    // indefinitely on a busy WebView and the deck must not go empty.
    const handle = ric(run, { timeout: 200 })
    return () => {
      if (typeof cancel === "function") cancel(handle)
    }
  }
}
