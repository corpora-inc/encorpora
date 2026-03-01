import { createContext, useCallback, useContext, useRef, useState } from "react"
import { installPack, isTauriRuntime } from "./install"
import { useInstallProgress } from "./installProgress"
import { useGamesStore, type InstalledGame } from "@/store/games"
import { InstallProgressDialog } from "@/components/packs/InstallProgressDialog"
import type { CatalogGame } from "./catalog"
import type { InstallSource } from "./install"

type InstallContextValue = {
  installCatalogPack: (pack: CatalogGame) => Promise<void>
  installDevPack: (manifestUrl: string) => Promise<void>
  isInstalling: boolean
}

const InstallContext = createContext<InstallContextValue | null>(null)

export function useInstallContext() {
  const ctx = useContext(InstallContext)
  if (!ctx) throw new Error("useInstallContext must be used within InstallProvider")
  return ctx
}

type RetryInfo =
  | { type: "catalog"; pack: CatalogGame }
  | { type: "dev"; manifestUrl: string }

export function InstallProvider({
  children,
  onLaunchGame,
}: {
  children: React.ReactNode
  onLaunchGame?: (game: InstalledGame) => void
}) {
  const { state, startListening, setComplete, setError, reset } =
    useInstallProgress()
  const addGame = useGamesStore((s) => s.addGame)
  const [installing, setInstalling] = useState(false)
  const retryRef = useRef<RetryInfo | null>(null)
  const lastInstalledGameRef = useRef<InstalledGame | null>(null)

  const isZipUrl = (url: string) => url.trim().endsWith(".zip")

  const doInstall = useCallback(
    async (
      manifestUrl: string,
      source: InstallSource,
      packName: string,
      expectedVersion?: string,
      expectedHash?: string,
      imageUrl?: string,
      description?: string,
    ) => {
      setInstalling(true)
      lastInstalledGameRef.current = null

      // Only start Tauri event listening for .zip installs on native
      const isNativeZip = isZipUrl(manifestUrl) && isTauriRuntime()
      if (isNativeZip) {
        // Extract pack ID from zip URL the same way install.ts does
        try {
          const url = new URL(manifestUrl, window.location.href)
          const filename = url.pathname.split("/").pop() || ""
          const packId = filename.replace(/\.zip$/, "").replace(/-/g, "_")
          if (packId) {
            startListening(packId, packName)
          }
        } catch {
          // If URL parsing fails, still start with a generic name
          startListening("unknown", packName)
        }
      } else {
        // For manifest-only installs, show a basic progress state
        startListening("manifest", packName)
      }

      try {
        const result = await installPack({
          manifestUrl,
          source,
          expectedVersion,
          expectedHash,
        })

        const game: InstalledGame = {
          id: result.packId,
          name: result.name ?? packName,
          manifestUrl: result.manifestUrl,
          version: result.version,
          description: description ?? result.description,
          imageUrl,
          source: result.source,
          installedAt: result.installedAt,
        }
        addGame(game)
        lastInstalledGameRef.current = game

        // For non-zip installs, manually mark complete since there are no Tauri events
        if (!isNativeZip) {
          setComplete()
        }
        // For zip installs, the Rust backend emits "complete" event
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error("[InstallContext] install failed", err)
        setError(message || "Install failed")
      } finally {
        setInstalling(false)
      }
    },
    [addGame, startListening, setComplete, setError]
  )

  const installCatalogPack = useCallback(
    async (pack: CatalogGame) => {
      if (!pack.manifestUrl) {
        setError("Missing manifest URL")
        return
      }
      retryRef.current = { type: "catalog", pack }
      await doInstall(
        pack.manifestUrl,
        "catalog",
        pack.name ?? pack.id,
        pack.version,
        undefined,
        pack.imageUrl,
        pack.description,
      )
    },
    [doInstall, setError]
  )

  const installDevPack = useCallback(
    async (manifestUrl: string) => {
      if (!manifestUrl.trim()) return
      retryRef.current = { type: "dev", manifestUrl }
      const packName = (() => {
        try {
          const url = new URL(manifestUrl, window.location.href)
          const segments = url.pathname.split("/").filter(Boolean)
          const name =
            segments.length > 1
              ? segments[segments.length - 2]
              : segments[0] || manifestUrl
          return name.replace(/[-_]/g, " ")
        } catch {
          return manifestUrl
        }
      })()
      await doInstall(manifestUrl, "manual", packName)
    },
    [doInstall]
  )

  const handleClose = useCallback(() => {
    reset()
    retryRef.current = null
    lastInstalledGameRef.current = null
  }, [reset])

  const handleRetry = useCallback(() => {
    const info = retryRef.current
    if (!info) return
    reset()
    if (info.type === "catalog") {
      installCatalogPack(info.pack)
    } else {
      installDevPack(info.manifestUrl)
    }
  }, [reset, installCatalogPack, installDevPack])

  const handleOpen = useCallback(() => {
    const game = lastInstalledGameRef.current
    if (game) {
      onLaunchGame?.(game)
    }
    handleClose()
  }, [onLaunchGame, handleClose])

  return (
    <InstallContext.Provider
      value={{ installCatalogPack, installDevPack, isInstalling: installing }}
    >
      {children}
      <InstallProgressDialog
        state={state}
        onClose={handleClose}
        onRetry={retryRef.current ? handleRetry : undefined}
        onOpen={lastInstalledGameRef.current && onLaunchGame ? handleOpen : undefined}
      />
    </InstallContext.Provider>
  )
}
