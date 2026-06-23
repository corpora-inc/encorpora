/**
 * DEV-ONLY screen wake lock. Keeps the device screen awake while Corpán is
 * foregrounded during development, so the CDP/screenshot debug loop doesn't
 * die every time the iPad's idle timer fires. Re-acquires on visibility
 * regain (iOS releases the lock when the page is hidden/backgrounded).
 *
 * Never runs in production builds (guarded by import.meta.env.DEV at the call
 * site) — we do NOT want to hold users' screens awake.
 */
export function installDevKeepAwake(): void {
  if (typeof navigator === "undefined") return
  const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<unknown> } }).wakeLock
  if (!wl) return

  let sentinel: { release?: () => Promise<void> } | null = null

  const acquire = async () => {
    if (document.visibilityState !== "visible") return
    try {
      sentinel = (await wl.request("screen")) as { release?: () => Promise<void> }
      // eslint-disable-next-line no-console
      console.info("[dev] screen wake lock acquired")
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[dev] wake lock request failed:", err)
    }
  }

  acquire()
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !sentinel) acquire()
    if (document.visibilityState !== "visible") sentinel = null
  })
}
