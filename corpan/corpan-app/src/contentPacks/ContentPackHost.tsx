import { useEffect, useMemo, useRef, useState } from "react"

import { createHostApi } from "./hostApi"
import type {
  ContentPackManifest,
  ContentPackModule,
  ContentPackEntitlementSnapshot,
  PackLaunchEntry,
} from "./types"
import { useEntitlementStore } from "@/store/entitlements"
import {
  isContentPackProtocolUrl,
  isLocalhostUrl,
  isPrivateNetworkUrl,
  shouldDevReloadManifest,
} from "./devReload"

type LoadState = "idle" | "loading" | "ready" | "error"

type ContentPackHostProps = {
  id: string
  manifestUrl?: string
  /** Optional deep-link target passed into the pack's mount initialState. */
  entry?: PackLaunchEntry
}

// `ContentPackEntitlementSnapshot` now lives in ./types (shared with the typed
// `HostApi.entitlement` seam) so the global and the typed snapshot never drift.

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

const injectedAssetNodes = (id: string) =>
  Array.from(
    document.querySelectorAll(
      `script[data-corp-game-id="${id}"], link[data-corp-game-id="${id}"], style[data-corp-game-id="${id}"]`
    )
  )

// `isContentPackProtocolUrl` documents the `corpan-pack` custom URI-scheme
// protocol handler (reachable at `corpan-pack://localhost/...` on
// macOS/iOS/Linux and `http://corpan-pack.localhost/...` on Android/Windows).
// Installed-pack URLs are emitted in the platform-correct form by the native
// `content_packs_*` commands; these must be command-fetched + inlined (the
// WebView can't `fetch()` the scheme). It now lives in ./devReload alongside
// the URL classifiers so the dev-reload scoping that depends on it is
// unit-testable without React. Re-exported here as it is used throughout.

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
  const subscription = useEntitlementStore((s) => s.subscription)
  const lastEntitlementRefresh = useEntitlementStore((s) => s.lastRefreshed)
  const subjectId = useEntitlementStore((s) => s.subjectId)
  const entitlementToken = useEntitlementStore((s) => s.entitlementToken)
  const entitlementSnapshot = useMemo<ContentPackEntitlementSnapshot>(
    () => ({
      plus: subscription.active,
      subjectId,
      entitlementToken,
      subscription: {
        active: subscription.active,
        plan: subscription.plan,
        expiresAt: subscription.expiresAt,
        autoRenew: subscription.autoRenew,
      },
      checkedAt: lastEntitlementRefresh,
    }),
    [
      lastEntitlementRefresh,
      entitlementToken,
      subjectId,
      subscription.active,
      subscription.autoRenew,
      subscription.expiresAt,
      subscription.plan,
    ]
  )
  const entitlementSnapshotRef = useRef(entitlementSnapshot)

  useEffect(() => {
    entitlementSnapshotRef.current = entitlementSnapshot
    const scope = globalThis as typeof globalThis & {
      __CORPAN_PLUS?: boolean
      __CORPAN_ENTITLEMENT?: ContentPackEntitlementSnapshot
      __CORPAN_HOST_CAPS?: { dailyLock?: boolean }
    }
    scope.__CORPAN_PLUS = entitlementSnapshot.plus
    scope.__CORPAN_ENTITLEMENT = entitlementSnapshot
    // Advertise host capabilities to OTA packs (which may run in older apps).
    // `dailyLock` = this host renders the gate-v2 DailyLockOverlay, so packs may
    // hard-block at the daily cap. Absent in pre-0.18.1 hosts → packs degrade to
    // the soft nag instead of freezing behind an overlay that won't appear.
    scope.__CORPAN_HOST_CAPS = { ...scope.__CORPAN_HOST_CAPS, dailyLock: true }
    window.dispatchEvent(
      new CustomEvent("corpan:entitlement-changed", {
        detail: entitlementSnapshot,
      })
    )
  }, [entitlementSnapshot])

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
    // Dev-reload polling is ONLY for packs served from the local Vite `/packs`
    // dev middleware — never for an installed `corpan-pack://` catalog pack
    // (its `localhost`/`*.localhost` host LOOKS local but it's immutable on
    // disk). Polling an installed pack is what raced the deferred React-root
    // teardown against a fresh mount on `tauri ios dev` over LAN → the
    // "createRoot already called" + detached-node NotFoundError crash. See
    // ./devReload for the full root cause.
    const shouldDevReload = shouldDevReloadManifest(
      resolvedManifestUrl,
      import.meta.env.DEV
    )
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
          const isCorpanPack = isContentPackProtocolUrl(sourceUrl)

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

    // Resolves once the previous pack instance has been FULLY torn down
    // (React root unmounted + injected assets removed). `load()` awaits this
    // before mounting a fresh instance so a deferred (rAF) unmount can never
    // overlap a new `mount()`/`createRoot()` on the same container. Plain
    // component-unmount callers ignore the promise — they just fire-and-forget.
    const cleanup = (): Promise<void> => {
      if (devReloadTimer) {
        window.clearInterval(devReloadTimer)
        devReloadTimer = null
      }
      if (retryTimer) {
        window.clearTimeout(retryTimer)
        retryTimer = null
      }
      // Idempotent: snapshot the instance and clear our handle up front so a
      // second cleanup() (StrictMode double-invoke / overlapping reload) is a
      // no-op rather than unmounting/clearing assets twice.
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
      if (hasLoadedRef.current) {
        hostApi.stopSpeech?.()
        hostApi.dispose?.()
        hasLoadedRef.current = false
      }
      if (shouldDevReload) {
        ; (globalThis as { __corpanPerf?: boolean }).__corpanPerf = false
      }
      // ORDERING + TIMING are the whole point of this teardown:
      //   1. DEFER the pack's React-root unmount past the current render. A bare
      //      queueMicrotask runs before the next frame while React may still be
      //      committing → "synchronously unmount a root while React was already
      //      rendering" → detached DOM → NotFoundError → black screen on reload.
      //      requestAnimationFrame waits until the current render/commit unwinds.
      //   2. Only AFTER the pack has unmounted do we remove its injected scripts/
      //      styles. Clearing them first would yank stylesheets out from under a
      //      still-mounted tree (flash/half-rendered teardown). The pack root is
      //      detached together with the host container by React, so the unmount
      //      itself is the safe moment to drop the orphaned <script>/<style>.
      // Snapshot the CURRENT injected nodes now, so the deferred clear removes
      // exactly THIS pack instance's assets and never the fresh ones a
      // subsequent load() (which runs concurrently after this synchronous
      // cleanup) may have injected by the time the frame fires.
      const staleAssets = injectedAssetNodes(id)
      const finishTeardown = () => {
        try {
          instanceToUnmount?.unmount?.()
        } catch {
          // Avoid unmount errors from crashing the host UI.
        }
        staleAssets.forEach((node) => node.remove())
      }
      if (instanceToUnmount && typeof instanceToUnmount.unmount === "function") {
        // Past the current render, then clear assets once the unmount has run.
        // The returned promise resolves AFTER finishTeardown runs so a reloading
        // load() can await the unmount before mounting a fresh instance — this
        // is what closes the deferred-unmount-vs-fresh-mount race that caused
        // "createRoot() already called" + NotFoundError on `tauri ios dev`.
        return new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            finishTeardown()
            resolve()
          })
        })
      }
      // Nothing to unmount — still clear this instance's injected assets.
      staleAssets.forEach((node) => node.remove())
      return Promise.resolve()
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
      // AWAIT the prior instance's teardown before we mount a fresh one. cleanup()
      // defers the React-root unmount to a requestAnimationFrame (so we never
      // unmount mid-render → NotFoundError); awaiting its promise guarantees that
      // deferred unmount has actually run before this load reaches `mount()`/
      // `createRoot()`, eliminating the window where two roots share the
      // container. `isLoading` is already true, so any concurrent load()/
      // checkForUpdate() is a no-op while we wait — the loads serialize.
      await cleanup()
      if (cancelled) {
        isLoading = false
        return
      }
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
        const isLocalInstall = isContentPackProtocolUrl(baseUrl)
        const devToken = isLocalInstall ? undefined : (manifest.devRevision || manifest.version)

        // corpan-pack URLs (either platform form) must be fetched via Tauri
        // commands and injected inline — the WebView can't fetch() the scheme,
        // and on Android the entry would otherwise load over an http.localhost
        // <script src> we'd rather keep as the proven inline path. Direct asset
        // URLs (<img>, fonts, audio) still resolve against the same protocol
        // handler natively, which is the whole point of the platform-correct base.
        const useInlineLoad = isLocalInstall

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

        // Belt-and-suspenders: the awaited cleanup() above has already unmounted
        // any prior pack root, but if a previous teardown left DOM behind (a
        // pack whose unmount threw, an async chunk that committed late) the new
        // pack's `createRoot(container)` would hit React's "container already
        // passed to createRoot" warning + a detached-node NotFoundError. Start
        // every fresh mount from an empty container so createRoot always sees a
        // pristine node. Safe because we only reach here once the prior instance
        // is fully torn down (or there was none).
        if (containerRef.current.firstChild) {
          containerRef.current.replaceChildren()
        }

        activeInstance = activeModule.mount(containerRef.current, hostApi, {
          stackConfig: hostApi.getStackConfig(),
          isPlus: entitlementSnapshotRef.current.plus,
          entitlement: entitlementSnapshotRef.current,
          // Addressability groundwork: a deep-linked entry/route, when present.
          ...(entry ? { entryId: entry.entryId, source: entry.source, route: entry.route } : {}),
          // First-run reader seed: auto-download a default book's preview
          // narrations for the user's stack (the instant "wow").
          ...(entry?.seedBookId ? { seedBookId: entry.seedBookId } : {}),
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
  }, [hostApi, id, manifestUrl, entry?.entryId, entry?.source, entry?.route, entry?.seedBookId])

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
