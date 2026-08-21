// src/components/ui/OfflineImage.tsx — the drop-in replacement for every raw
// <img> whose src may be remote (offline-cache.md §4). Binding rules:
// NEVER a broken-image icon or an empty box — cached pixels, remote pixels,
// or the caller's glyph fallback, in that order. Stale beats empty.

import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react"
import { useCachedImage } from "@/lib/offlineCache"
import { repairImage } from "@/lib/offlineCache/imageCache.ts"

export function OfflineImage({
  src,
  fallback = null,
  alt = "",
  ...imgProps
}: {
  /** Remote https URL, bundled asset import, or undefined. */
  src?: string
  /** Rendered when no pixels are available (offline miss / load error).
   *  Callers pass their existing lucide glyph. */
  fallback?: ReactNode
  alt?: string
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">): ReactNode {
  const { src: resolvedSrc, state } = useCachedImage(src)
  // Load-error ladder, reset whenever the source changes:
  //   cached copy errored (file drift) → repair + try the remote copy
  //   remote copy errored → glyph fallback
  const [errorStage, setErrorStage] = useState<"none" | "cached-failed" | "failed">("none")

  useEffect(() => {
    setErrorStage("none")
  }, [src])

  if (!src || state === "fallback" || errorStage === "failed") return fallback
  // First-ever lookup: the glyph renders instantly in the same box (no
  // layout shift, no broken-image flash) while the index resolves.
  if (state === "resolving") return fallback

  const cachedFailed = errorStage === "cached-failed"
  const displaySrc = cachedFailed ? src : resolvedSrc
  if (!displaySrc) return fallback
  const online = typeof navigator === "undefined" ? true : navigator.onLine
  if (cachedFailed && !online) return fallback

  return (
    <img
      {...imgProps}
      src={displaySrc}
      alt={alt}
      onError={() => {
        if (state === "cached" && !cachedFailed) {
          // Index row points at a missing/corrupt file: drop + re-fetch,
          // and fall through to the remote URL for this render.
          void repairImage(src)
          setErrorStage("cached-failed")
        } else {
          setErrorStage("failed")
        }
      }}
    />
  )
}
