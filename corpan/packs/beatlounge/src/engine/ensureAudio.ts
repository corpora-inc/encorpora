/**
 * beatlounge — gesture-gated AudioContext resume.
 *
 * A browser only lets you resume a suspended AudioContext from a REAL user
 * gesture (pointer/key handler). Calling `ctx.resume()` / `Tone.start()` inside
 * an async `useEffect` or on mount fails silently and spams the console with
 * `The AudioContext was not allowed to start ... must be resumed (or created)
 * after a user gesture`. The transport's own `start()` is gesture-driven and
 * fine; this helper is the ONE place a view should resume from a pointer handler.
 *
 * Call `ensureAudio(ctx)` synchronously from inside a pointer/click handler. It
 * returns a promise but does NOT need to be awaited at the call site (the resume
 * is the side effect we want). Off-gesture callers must NOT use this — they
 * should let the next real gesture do the resume.
 */
export const ensureAudio = (ctx: AudioContext): Promise<void> => {
  if (ctx.state === "running") return Promise.resolve()
  // Resume directly on the gesture call stack so the browser honors it.
  return ctx.resume().catch(() => {
    /* the next real gesture will resume it */
  })
}
