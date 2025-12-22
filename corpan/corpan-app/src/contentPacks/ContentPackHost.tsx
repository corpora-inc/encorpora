import { useEffect, useMemo, useRef, useState } from "react"

import { createHostApi } from "./hostApi"
import type { ContentPackManifest, ContentPackModule } from "./types"

type LoadState = "idle" | "loading" | "ready" | "error"

type ContentPackHostProps = {
  id: string
  manifestUrl?: string
}

const DEV_RELOAD_INTERVAL_MS = 1200

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

const isLocalhostUrl = (rawUrl: string) => {
  try {
    const resolved = new URL(rawUrl, window.location.href)
    return (
      resolved.hostname === "localhost" ||
      resolved.hostname === "127.0.0.1" ||
      resolved.hostname.endsWith(".localhost")
    )
  } catch {
    return false
  }
}

const withCacheBust = (rawUrl: string, token?: string) => {
  if (!token) {
    return rawUrl
  }
  try {
    const url = new URL(rawUrl, window.location.href)
    url.searchParams.set("dev", token)
    return url.toString()
  } catch {
    const joiner = rawUrl.includes("?") ? "&" : "?"
    return `${rawUrl}${joiner}dev=${encodeURIComponent(token)}`
  }
}

const lookupGameModule = (primaryId: string, fallbackId: string) => {
  const registry = (globalThis as { CorpanGames?: Record<string, ContentPackModule> })
    .CorpanGames
  return registry?.[primaryId] ?? registry?.[fallbackId] ?? null
}

const waitForGameModule = async (
  primaryId: string,
  fallbackId: string,
  timeoutMs = 500
) => {
  const start = performance.now()
  let module = lookupGameModule(primaryId, fallbackId)
  while (!module && performance.now() - start < timeoutMs) {
    await new Promise(requestAnimationFrame)
    module = lookupGameModule(primaryId, fallbackId)
  }
  return module
}

export default function ContentPackHost({
  id,
  manifestUrl,
}: ContentPackHostProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loadState, setLoadState] = useState<LoadState>("idle")
  const [error, setError] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)

  const hostApi = useMemo(() => createHostApi(), [])

  useEffect(() => {
    let cancelled = false
    let activeModule: ContentPackModule | null = null
    let activeInstance: { unmount?: () => void } | void
    let devReloadTimer: number | null = null
    let lastManifestSignature = ""
    let isLoading = false

    const manifestRequestUrl =
      manifestUrl ?? `/games/${id}/manifest.json`
    const resolvedManifestUrl = new URL(
      manifestRequestUrl,
      window.location.href
    ).toString()
    const manifestFetchUrl = proxyUrlIfNeeded(resolvedManifestUrl)
    const shouldDevReload = isLocalhostUrl(resolvedManifestUrl)

    const cleanup = () => {
      if (devReloadTimer) {
        window.clearInterval(devReloadTimer)
        devReloadTimer = null
      }
      const instanceToUnmount = activeInstance
      activeModule = null
      activeInstance = undefined
      if (instanceToUnmount && typeof instanceToUnmount.unmount === "function") {
        queueMicrotask(() => {
          try {
            instanceToUnmount.unmount?.()
          } catch {
            // Avoid unmount errors from crashing the host UI.
          }
        })
      }
      if (hasLoadedRef.current) {
        hostApi.stopSpeech?.()
        hostApi.dispose?.()
        hasLoadedRef.current = false
      }
      clearInjectedAssets(id)
    }

    const updateManifestSignature = (manifest: ContentPackManifest) => {
      lastManifestSignature = JSON.stringify(manifest)
    }

    const checkForUpdate = async () => {
      if (cancelled || isLoading) {
        return
      }
      try {
        const res = await fetch(manifestFetchUrl, { cache: "no-store" })
        if (!res.ok) {
          return
        }
        const manifest = (await res.json()) as ContentPackManifest
        const signature = JSON.stringify(manifest)
        if (signature !== lastManifestSignature) {
          updateManifestSignature(manifest)
          void load()
        }
      } catch {
        // Ignore polling errors during dev reload.
      }
    }

    const load = async () => {
      if (isLoading) {
        return
      }
      isLoading = true
      setLoadState("loading")
      setError(null)
      cleanup()
      ;(globalThis as { __corpanHostActive?: boolean }).__corpanHostActive = true
      try {
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
        updateManifestSignature(manifest)
        const baseUrl = manifest.baseUrl
          ? new URL(manifest.baseUrl, resolvedManifestUrl).toString()
          : new URL(".", resolvedManifestUrl).toString()
        const devToken = shouldDevReload ? manifest.devRevision : undefined

        if (manifest.styles) {
          manifest.styles.forEach((style) => {
            const href = proxyUrlIfNeeded(
              withCacheBust(new URL(style, baseUrl).toString(), devToken)
            )
            loadStyle(href, id)
          })
        }

        const entryUrl = proxyUrlIfNeeded(
          withCacheBust(new URL(manifest.entry, baseUrl).toString(), devToken)
        )
        await loadScript(entryUrl, id, manifest.entryType ?? "script")

        activeModule = await waitForGameModule(manifest.id, id)
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
          hasLoadedRef.current = true
          if (shouldDevReload && !devReloadTimer) {
            devReloadTimer = window.setInterval(
              checkForUpdate,
              DEV_RELOAD_INTERVAL_MS
            )
          }
        }
      } finally {
        isLoading = false
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
  }, [hostApi, id, manifestUrl])

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
