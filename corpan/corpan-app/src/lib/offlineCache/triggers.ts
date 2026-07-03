// src/lib/offlineCache/triggers.ts — the single wiring point for
// revalidation (offline-cache.md §3.3). Five triggers, one guard set, all
// coalescing in the shared single-flight map so simultaneous signals
// (online + foreground) cost at most one network call per key.
//
// W10 WIRING NOTE: call `installTriggers()` once from App.tsx (it replaces
// the inline catalog-refresh effect at App.tsx:242-274 when the stores
// migrate onto cachedFetch). Until then it can be installed alongside —
// registered resources revalidate here; the legacy stores keep their own
// loop. Explicit pull surfaces call `cachedFetch(resource, { force: true })`.

import { jitter } from "../../contentPacks/catalogFetch.ts"
import { revalidateAll } from "./jsonCache.ts"
import { enforceImageBudget, hydrateImageIndex, prefetchImages } from "./imageCache.ts"

/** Same cadence as the App.tsx catalog loop (App.tsx:48). The loop CHECKS
 *  staleness; per-resource TTLs decide whether anything hits the network. */
export const REVALIDATE_CHECK_INTERVAL_MS = 60_000

function guardsPass(): boolean {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false
  if (typeof navigator !== "undefined" && !navigator.onLine) return false
  return true
}

/** Phase-1 cover pre-warm: whenever the catalog store lands a new catalog,
 *  queue its cover art into the image cache so covers are on disk BEFORE the
 *  user ever goes offline — not only after they were once rendered. Lazy
 *  import keeps zustand out of this module's static graph (node tests). */
function installCoverPrefetch(): () => void {
  let unsubscribe: (() => void) | undefined
  let disposed = false
  void import("../../store/catalog.ts")
    .then(({ useCatalogStore }) => {
      if (disposed) return
      const prefetchFrom = (catalog: Array<{ imageUrl?: string }>) => {
        const urls = catalog
          .map((entry) => entry.imageUrl)
          .filter((u): u is string => typeof u === "string" && u.length > 0)
        if (urls.length > 0) prefetchImages(urls)
      }
      prefetchFrom(useCatalogStore.getState().catalog)
      unsubscribe = useCatalogStore.subscribe((state, prev) => {
        if (state.catalog !== prev.catalog) prefetchFrom(state.catalog)
      })
    })
    .catch((err) => console.warn("[offlineCache] cover prefetch wiring failed:", err))
  return () => {
    disposed = true
    unsubscribe?.()
  }
}

/** Install the foreground/online/interval/startup triggers + the cover
 *  pre-warm subscription. Returns an uninstall fn. Call once from the app
 *  shell (W10). */
export function installTriggers(): () => void {
  const uninstallPrefetch = installCoverPrefetch()
  // startup — after first paint, on an idle slot.
  const idle: (cb: () => void) => number =
    typeof requestIdleCallback === "function"
      ? (cb) => requestIdleCallback(() => cb()) as unknown as number
      : (cb) => window.setTimeout(cb, 0)
  idle(() => {
    void hydrateImageIndex()
    if (guardsPass()) revalidateAll("startup")
    void enforceImageBudget()
  })

  // app-foreground — visibilitychange→visible + window focus (the signals
  // proven by the existing App.tsx loop; on iOS/Android Tauri the WebView
  // fires visibilitychange on app resume).
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible" && guardsPass()) revalidateAll("foreground")
  }
  const onFocus = () => {
    if (guardsPass()) revalidateAll("foreground")
  }

  // connectivity-regained.
  const onOnline = () => {
    if (guardsPass()) {
      revalidateAll("online")
      void enforceImageBudget()
    }
  }

  // interval — recursive jittered setTimeout (never a synchronized fleet).
  let timer = 0
  const scheduleNext = () => {
    timer = window.setTimeout(() => {
      if (guardsPass()) revalidateAll("interval")
      scheduleNext()
    }, jitter(REVALIDATE_CHECK_INTERVAL_MS))
  }
  scheduleNext()

  document.addEventListener("visibilitychange", onVisibilityChange)
  window.addEventListener("focus", onFocus)
  window.addEventListener("online", onOnline)

  return () => {
    window.clearTimeout(timer)
    document.removeEventListener("visibilitychange", onVisibilityChange)
    window.removeEventListener("focus", onFocus)
    window.removeEventListener("online", onOnline)
    uninstallPrefetch()
  }
}
