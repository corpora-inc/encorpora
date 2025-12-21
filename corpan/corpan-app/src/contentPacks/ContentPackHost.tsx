import { useEffect, useMemo, useRef, useState } from "react"

import { createHostApi } from "./hostApi"
import type { ContentPackManifest, ContentPackModule } from "./types"

type LoadState = "idle" | "loading" | "ready" | "error"

type ContentPackHostProps = {
  id: string
  manifestUrl?: string
}

const loadScript = (src: string, id: string, type: "script" | "module") =>
  new Promise<HTMLScriptElement>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.dataset.corpGame = "true"
    script.dataset.corpGameId = id
    if (type === "module") {
      script.type = "module"
    }
    script.onload = () => resolve(script)
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })

const loadStyle = (href: string, id: string) => {
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = href
  link.dataset.corpGame = "true"
  link.dataset.corpGameId = id
  document.head.appendChild(link)
  return link
}

const clearInjectedAssets = (id: string) => {
  document
    .querySelectorAll(
      `script[data-corp-game-id="${id}"], link[data-corp-game-id="${id}"]`
    )
    .forEach((node) => node.remove())
}

const proxyUrlIfNeeded = (rawUrl: string) => {
  try {
    const resolved = new URL(rawUrl, window.location.href)
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return resolved.toString()
    }
    if (
      resolved.hostname.endsWith(".localhost") &&
      resolved.hostname.startsWith("corpan-pack")
    ) {
      return resolved.toString()
    }
    if (resolved.origin === window.location.origin) {
      return resolved.toString()
    }
    return `/game-proxy?url=${encodeURIComponent(resolved.toString())}`
  } catch {
    return rawUrl
  }
}

export default function ContentPackHost({
  id,
  manifestUrl,
}: ContentPackHostProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loadState, setLoadState] = useState<LoadState>("idle")
  const [error, setError] = useState<string | null>(null)

  const hostApi = useMemo(() => createHostApi(), [])

  useEffect(() => {
    let cancelled = false
    let activeModule: ContentPackModule | null = null
    let activeInstance: { unmount?: () => void } | void

    const cleanup = () => {
      if (activeInstance && typeof activeInstance.unmount === "function") {
        activeInstance.unmount()
      }
      activeModule = null
      activeInstance = undefined
      clearInjectedAssets(id)
    }

    const load = async () => {
      setLoadState("loading")
      setError(null)
      cleanup()

      const manifestRequestUrl =
        manifestUrl ?? `/games/${id}/manifest.json`
      const resolvedManifestUrl = new URL(
        manifestRequestUrl,
        window.location.href
      ).toString()
      const manifestFetchUrl = proxyUrlIfNeeded(resolvedManifestUrl)
      const res = await fetch(manifestFetchUrl, {
        cache: "no-store",
      })
      if (!res.ok) {
        throw new Error(`Missing content pack: ${id}`)
      }
      const manifest = (await res.json()) as ContentPackManifest
      if (!manifest.id || !manifest.entry) {
        throw new Error(`Invalid manifest for ${id}`)
      }
      const baseUrl = manifest.baseUrl
        ? new URL(manifest.baseUrl, resolvedManifestUrl).toString()
        : new URL(".", resolvedManifestUrl).toString()

      if (manifest.styles) {
        manifest.styles.forEach((style) => {
          const href = proxyUrlIfNeeded(new URL(style, baseUrl).toString())
          loadStyle(href, id)
        })
      }

      const entryUrl = proxyUrlIfNeeded(new URL(manifest.entry, baseUrl).toString())
      await loadScript(entryUrl, id, manifest.entryType ?? "script")

      activeModule =
        window.CorpanGames?.[manifest.id] ?? window.CorpanGames?.[id] ?? null
      if (!activeModule || typeof activeModule.mount !== "function") {
        throw new Error(`Content pack did not register: ${id}`)
      }

      if (!containerRef.current) {
        throw new Error("Content pack container missing")
      }

      activeInstance = activeModule.mount(containerRef.current, hostApi, {
        stackConfig: hostApi.getStackConfig(),
      })

      if (!cancelled) {
        setLoadState("ready")
      }
    }

    load().catch((err: unknown) => {
      if (cancelled) {
        return
      }
      const message = err instanceof Error ? err.message : "Load failed"
      setError(message)
      setLoadState("error")
    })

    return () => {
      cancelled = true
      cleanup()
    }
  }, [hostApi, id])

  return (
    <div className="relative h-full w-full bg-black text-white">
      <div
        ref={containerRef}
        className="h-full w-full"
        aria-label={`Content pack ${id}`}
      />
      {loadState === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 text-sm uppercase tracking-[0.2em]">
          Loading {id}...
        </div>
      )}
      {loadState === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 text-center">
          <div>
            <div className="text-lg font-semibold">Load failed</div>
            <div className="mt-2 text-sm text-white/70">{error}</div>
          </div>
        </div>
      )}
    </div>
  )
}
