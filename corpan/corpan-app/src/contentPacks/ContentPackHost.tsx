import { useEffect, useMemo, useRef, useState } from "react"

import { createHostApi } from "./hostApi"
import type { ContentPackManifest, ContentPackModule } from "./types"

type LoadState = "idle" | "loading" | "ready" | "error"

type ContentPackHostProps = {
  id: string
}

const loadScript = (src: string) =>
  new Promise<HTMLScriptElement>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.dataset.corpGame = "true"
    script.onload = () => resolve(script)
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })

const loadStyle = (href: string) => {
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = href
  link.dataset.corpGame = "true"
  document.head.appendChild(link)
  return link
}

const clearInjectedAssets = () => {
  document
    .querySelectorAll("script[data-corp-game], link[data-corp-game]")
    .forEach((node) => node.remove())
}

export default function ContentPackHost({ id }: ContentPackHostProps) {
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
      clearInjectedAssets()
    }

    const load = async () => {
      setLoadState("loading")
      setError(null)
      cleanup()

      const res = await fetch(`/games/${id}/manifest.json`, {
        cache: "no-store",
      })
      if (!res.ok) {
        throw new Error(`Missing content pack: ${id}`)
      }
      const manifest = (await res.json()) as ContentPackManifest

      if (manifest.styles) {
        manifest.styles.forEach((style) => {
          const href = `/games/${id}/${style}`
          loadStyle(href)
        })
      }

      await loadScript(`/games/${id}/${manifest.entry}`)

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
