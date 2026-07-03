// src/lib/offlineCache/useCachedImage.ts — React binding over the image
// cache. Thin on purpose: ALL state-machine behavior lives in the testable
// peekImageDisplay / resolveImageDisplay pair (imageCache.ts), which the
// node test suite covers without a DOM.

import { useEffect, useState } from "react"
import {
  peekImageDisplay,
  resolveImageDisplay,
  type ImageDisplay,
} from "./imageCache.ts"
import type { CachedImageState } from "./types.ts"

/** Resolve a display URL for an image, cache-first. Synchronous fast path:
 *  warm mirror lookups render the local copy on the FIRST paint (no flash);
 *  cold lookups start at "resolving" (render your glyph fallback — never a
 *  broken image) and settle async. */
export function useCachedImage(url?: string): { src?: string; state: CachedImageState } {
  const [display, setDisplay] = useState<ImageDisplay>(() => peekImageDisplay(url))

  useEffect(() => {
    let cancelled = false
    const fast = peekImageDisplay(url)
    setDisplay(fast)
    if (fast.state === "resolving") {
      void resolveImageDisplay(url).then((resolved) => {
        if (!cancelled) setDisplay(resolved)
      })
    }
    return () => {
      cancelled = true
    }
  }, [url])

  return display
}
