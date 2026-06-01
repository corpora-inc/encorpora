import { useEffect, useMemo, useRef, useState } from "react"

import { createHostApi } from "./hostApi"
import type { ContentPackManifest, ContentPackModule } from "./types"

type LoadState = "idle" | "loading" | "ready" | "error"

type ContentPackHostProps = {
  id: string
  manifestUrl?: string
  /** Optional deep-link target passed into the pack's mount initialState. */
  entry?: { entryId?: number; source?: string; route?: string }
}

const DEV_RELOAD_INTERVAL_MS = 20000  // Poll every 2s for faster dev iteration

const loadScript = async (
  src: string,
  id: string,
  type: "script" | "module",
  inline?: boolean,
  baseUrl?: string,
  contentRevision?: string
) => {
  if (inline) {
    // Inline mode: fetch content and inject as text
    console.log(`[loadScript] Fetching inline script from: ${src}`)
    const { fetchContentPackText } = await import("./native")
    const content = await fetchContentPackText(src)
    console.log(`[loadScript] Fetched ${content.length} bytes, injecting inline`)
    return new Promise<HTMLScriptElement>((resolve, reject) => {
      const script = document.createElement("script")
      script.textContent = content
      script.async = true
      script.dataset.corpGame = "true"
      script.dataset.corpGameId = id
      if (baseUrl) {
        script.dataset.corpGameBaseUrl = baseUrl
      }
      if (contentRevision) {
        script.dataset.corpGameContentRevision = contentRevision
      }
      script.dataset.corpGameSrc = src
      if (type === "module") {
        script.type = "module"
      }
      script.onload = () => resolve(script)
      script.onerror = () => reject(new Error(`Failed to load ${src}`))
      document.head.appendChild(script)
      // Trigger onload manually for inline scripts
      script.onload?.(new Event('load'))
    })
  }

  // URL mode: load via src attribute
  console.log(`[loadScript] Loading script via src: ${src}`)
  return new Promise<HTMLScriptElement>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.dataset.corpGame = "true"
    script.dataset.corpGameId = id
    if (baseUrl) {
      script.dataset.corpGameBaseUrl = baseUrl
    }
    if (contentRevision) {
      script.dataset.corpGameContentRevision = contentRevision
    }
    script.dataset.corpGameSrc = src
    if (type === "module") {
      script.type = "module"
    }
    script.onload = () => {
      console.log(`[loadScript] Script loaded successfully: ${src}`)
      resolve(script)
    }
    script.onerror = (err) => {
      console.error(`[loadScript] Script load error: ${src}`, err)
      reject(new Error(`Failed to load ${src}`))
    }
    document.head.appendChild(script)
  })
}

const loadStyle = async (href: string, id: string, inline?: boolean) => {
  if (inline) {
    // Inline mode: fetch content and inject as <style>
    console.log(`[loadStyle] Fetching inline style from: ${href}`)
    const { fetchContentPackText } = await import("./native")
    const content = await fetchContentPackText(href)
    console.log(`[loadStyle] Fetched ${content.length} bytes, injecting inline`)
    const style = document.createElement("style")
    style.textContent = content
    style.dataset.corpGame = "true"
    style.dataset.corpGameId = id
    document.head.appendChild(style)
    return style
  }

  // URL mode: load via href attribute
  console.log(`[loadStyle] Loading style via href: ${href}`)
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
      `script[data-corp-game-id="${id}"], link[data-corp-game-id="${id}"], style[data-corp-game-id="${id}"]`
    )
    .forEach((node) => node.remove())
}

const proxyUrlIfNeeded = (rawUrl: string) => {
  try {
    const resolved = new URL(rawUrl, window.location.href)
    if (!import.meta.env.DEV) {
      return resolved.toString()
    }
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

const isPrivateNetworkUrl = (rawUrl: string) => {
  try {
    const resolved = new URL(rawUrl, window.location.href)
    const host = resolved.hostname
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return true
    }
    if (host.endsWith(".localhost") || host.endsWith(".local")) {
      return true
    }
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (ipv4) {
      const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
      if (a === 10 || a === 127) return true
      if (a === 192 && b === 168) return true
      if (a === 172 && b >= 16 && b <= 31) return true
      if (a === 169 && b === 254) return true
      return false
    }
    return host.startsWith("fe80:") || host.startsWith("fd") || host.startsWith("fc")
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
  entry,
}: ContentPackHostProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loadState, setLoadState] = useState<LoadState>("idle")
  const [error, setError] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)

  const hostApi = useMemo(() => createHostApi(id), [id])

  useEffect(() => {
    let cancelled = false
    let activeModule: ContentPackModule | null = null
    let activeInstance: { unmount?: () => void } | void
    let devReloadTimer: number | null = null
    let retryTimer: number | null = null
    let lastManifestSignature = ""
    let isLoading = false

    const manifestRequestUrl =
      manifestUrl ?? `/packs/${id}/manifest.json`
    const resolvedManifestUrl = new URL(
      manifestRequestUrl,
      window.location.href
    ).toString()
    const shouldDevReload =
      isLocalhostUrl(resolvedManifestUrl) || isPrivateNetworkUrl(resolvedManifestUrl)
    let activeManifestSourceUrl = resolvedManifestUrl

    const getManifestSourceUrls = () => {
      const urls = [activeManifestSourceUrl, resolvedManifestUrl]
      try {
        const base = new URL(resolvedManifestUrl, window.location.href)
        if (
          (base.protocol === "http:" || base.protocol === "https:") &&
          isPrivateNetworkUrl(resolvedManifestUrl) &&
          !isLocalhostUrl(resolvedManifestUrl)
        ) {
          const localhost = new URL(base.toString())
          localhost.hostname = "localhost"
          urls.push(localhost.toString())
          const loopback = new URL(base.toString())
          loopback.hostname = "127.0.0.1"
          urls.push(loopback.toString())
        }
      } catch {
        // Ignore invalid manifest URL fallbacks.
      }
      return Array.from(new Set(urls))
    }

    const getManifestFetchCandidates = (token?: string) => {
      const sourceUrls = getManifestSourceUrls()
      return sourceUrls.map((sourceUrl) => {
        const fetchUrl = proxyUrlIfNeeded(withCacheBust(sourceUrl, token))
        return { sourceUrl, fetchUrl }
      })
    }

    const fetchManifest = async (token?: string) => {
      const candidates = getManifestFetchCandidates(token)
      let lastError: unknown
      for (const { sourceUrl, fetchUrl } of candidates) {
        try {
          let manifest: ContentPackManifest
          const isCorpanPack = sourceUrl.startsWith('corpan-pack://')

          console.log(`[fetchManifest] Fetching sourceUrl=${sourceUrl}, isCorpanPack=${isCorpanPack}`)

          // Always use Tauri command - this app only runs in Tauri
          if (isCorpanPack) {
            console.log(`[fetchManifest] Using Tauri command for corpan-pack URL`)
            const { fetchContentPackText } = await import("./native")
            const text = await fetchContentPackText(sourceUrl)
            manifest = JSON.parse(text) as ContentPackManifest
          } else if (!import.meta.env.DEV) {
            // Production: use Tauri for all fetches
            console.log(`[fetchManifest] Using Tauri command for production`)
            const { fetchContentPackText } = await import("./native")
            const text = await fetchContentPackText(sourceUrl)
            manifest = JSON.parse(text) as ContentPackManifest
          } else {
            // Dev mode: use browser fetch for HTTP URLs only
            console.log(`[fetchManifest] Using browser fetch for dev mode`)
            const res = await fetch(fetchUrl, { cache: "no-store" })
            if (!res.ok) {
              lastError = new Error(`Missing content pack: ${id}`)
              continue
            }
            manifest = (await res.json()) as ContentPackManifest
          }
          return { manifest, sourceUrl }
        } catch (err) {
          console.error(`[fetchManifest] Error fetching manifest:`, err)
          lastError = err
        }
      }
      throw lastError ?? new Error(`Missing content pack: ${id}`)
    }

    const cleanup = () => {
      if (devReloadTimer) {
        window.clearInterval(devReloadTimer)
        devReloadTimer = null
      }
      if (retryTimer) {
        window.clearTimeout(retryTimer)
        retryTimer = null
      }
      const instanceToUnmount = activeInstance
      activeModule = null
      activeInstance = undefined
      try {
        window.dispatchEvent(
          new CustomEvent("corpan:host-dispose", { detail: { id } })
        )
      } catch {
        // Ignore host-dispose dispatch failures.
      }
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
      if (shouldDevReload) {
        ; (globalThis as { __corpanPerf?: boolean }).__corpanPerf = false
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
        const { manifest, sourceUrl } = await fetchManifest(
          shouldDevReload ? String(Date.now()) : undefined
        )
        const signature = JSON.stringify(manifest)
        if (signature !== lastManifestSignature) {
          updateManifestSignature(manifest)
          activeManifestSourceUrl = sourceUrl
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
        ; (globalThis as { __corpanHostActive?: boolean }).__corpanHostActive = true
      if (shouldDevReload) {
        ; (globalThis as { __corpanPerf?: boolean }).__corpanPerf = true
      }
      try {
        console.log(`[ContentPackHost] Loading pack ${id}, manifestUrl=${manifestUrl}`)
        const { manifest, sourceUrl } = await fetchManifest(
          shouldDevReload ? String(Date.now()) : undefined
        )
        console.log(`[ContentPackHost] Fetched manifest:`, { manifest, sourceUrl })
        if (!manifest.id || !manifest.entry) {
          throw new Error(`Invalid manifest for ${id}`)
        }
        updateManifestSignature(manifest)
        activeManifestSourceUrl = sourceUrl
        const baseUrl = manifest.baseUrl
          ? new URL(manifest.baseUrl, activeManifestSourceUrl).toString()
          : new URL(".", activeManifestSourceUrl).toString()
        const isLocalInstall = baseUrl.startsWith('corpan-pack://')
        const devToken = isLocalInstall ? undefined : (manifest.devRevision || manifest.version)

        // corpan-pack:// URLs must be fetched via Tauri commands and injected inline
        const useInlineLoad = baseUrl.startsWith('corpan-pack://')

        console.log(`[ContentPackHost] baseUrl=${baseUrl}, useInlineLoad=${useInlineLoad}, entry=${manifest.entry}, styles=${JSON.stringify(manifest.styles)}`)

        if (manifest.styles) {
          for (const style of manifest.styles) {
            const href = proxyUrlIfNeeded(
              withCacheBust(new URL(style, baseUrl).toString(), devToken)
            )
            console.log(`[ContentPackHost] Loading style: ${href}, inline=${useInlineLoad}`)
            await loadStyle(href, id, useInlineLoad)
            console.log(`[ContentPackHost] Style loaded: ${href}`)
          }
        }

        const entryUrl = proxyUrlIfNeeded(
          withCacheBust(new URL(manifest.entry, baseUrl).toString(), devToken)
        )
        console.log(`[ContentPackHost] Loading script: ${entryUrl}, inline=${useInlineLoad}`)
        await loadScript(entryUrl, id, manifest.entryType ?? "script", useInlineLoad, baseUrl, devToken)
        console.log(`[ContentPackHost] Script loaded: ${entryUrl}`)

        activeModule = await waitForGameModule(manifest.id, id)
        if (!activeModule || typeof activeModule.mount !== "function") {
          throw new Error(`Content pack did not register: ${id}`)
        }

        if (!containerRef.current) {
          throw new Error("Content pack container missing")
        }

        activeInstance = activeModule.mount(containerRef.current, hostApi, {
          stackConfig: hostApi.getStackConfig(),
          // Addressability groundwork: a deep-linked entry/route, when present.
          ...(entry ? { entryId: entry.entryId, source: entry.source, route: entry.route } : {}),
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
      } catch (err) {
        if (cancelled) {
          return
        }
        const message =
          err instanceof Error ? err.message : "Failed to load content pack"
        setError(message)
        setLoadState("error")
        if (shouldDevReload && !retryTimer) {
          retryTimer = window.setTimeout(() => {
            retryTimer = null
            void load()
          }, DEV_RELOAD_INTERVAL_MS)
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
  }, [hostApi, id, manifestUrl, entry?.entryId, entry?.source, entry?.route])

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
