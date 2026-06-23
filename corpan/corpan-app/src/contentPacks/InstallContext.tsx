import { createContext, useCallback, useContext, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { installPack, isTauriRuntime } from "./install"
import { useInstallProgress } from "./installProgress"
import { useGamesStore, type InstalledGame } from "@/store/games"
import { InstallProgressDialog } from "@/components/packs/InstallProgressDialog"
import type { CatalogGame } from "./catalog"
import type { PhrasePackCatalogEntry } from "./phrasePackCatalog"
import { resolveLocalized } from "./localized"
import type { InstallSource } from "./install"

export type BatchInstallProgress = {
  /** 1-based index of the pack currently installing. */
  current: number
  /** Total packs in the batch. */
  total: number
  /** id of the pack currently being installed. */
  packId: string
  /** Display name of the pack currently being installed. */
  packName: string
}

export type BatchInstallResult = {
  /** Pack ids that installed cleanly. */
  installed: string[]
  /** Pack ids that failed, with their error message. */
  failed: Array<{ id: string; error: string }>
}

type InstallContextValue = {
  installCatalogPack: (pack: CatalogGame) => Promise<void>
  installDevPack: (manifestUrl: string) => Promise<void>
  /**
   * Install many packs sequentially. Uses the underlying `installPack`
   * helper directly (so phrase-pack registration via
   * `phrasePackRegister.ts` still fires per-pack) but bypasses the
   * single-install progress dialog — callers render their own UI from
   * `batchProgress` if they want a "Installing 2 of 4…" indicator.
   * Resolves with per-pack outcomes; never throws on individual failure.
   */
  installPackBatch: (packs: PhrasePackCatalogEntry[]) => Promise<BatchInstallResult>
  /** Current batch progress, or null when no batch is running. */
  batchProgress: BatchInstallProgress | null
  isInstalling: boolean
  /**
   * Launch an already-installed pack. Mirrors the `onLaunchGame` prop
   * given to `<InstallProvider>` so any descendant (Settings, the
   * first-run discover panel, etc.) can route a "tap Open" through the
   * same handler the install dialog uses on completion.
   */
  launchGame?: (game: InstalledGame) => void
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
  const { i18n } = useTranslation()
  const addGame = useGamesStore((s) => s.addGame)
  const [installing, setInstalling] = useState(false)
  const [batchProgress, setBatchProgress] = useState<BatchInstallProgress | null>(null)
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
      // Resolve the pack's name + description into the active UI
      // language so the install progress dialog (and the persisted
      // InstalledGame record's `name`) show the user-facing string they
      // actually saw on the pack card.
      const lang = i18n.language || "en"
      const localizedName = resolveLocalized(
        pack.nameLocalized,
        pack.name ?? pack.id,
        lang,
      )
      const localizedDescription = resolveLocalized(
        pack.descriptionLocalized,
        pack.description ?? "",
        lang,
      )
      await doInstall(
        pack.manifestUrl,
        "catalog",
        localizedName,
        pack.version,
        undefined,
        pack.imageUrl,
        localizedDescription || pack.description,
      )
    },
    [doInstall, setError, i18n.language]
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

  const installPackBatch = useCallback(
    async (packs: PhrasePackCatalogEntry[]): Promise<BatchInstallResult> => {
      const installed: string[] = []
      const failed: Array<{ id: string; error: string }> = []
      if (packs.length === 0) {
        return { installed, failed }
      }
      setInstalling(true)
      const lang = i18n.language || "en"
      try {
        for (let i = 0; i < packs.length; i += 1) {
          const pack = packs[i]
          setBatchProgress({
            current: i + 1,
            total: packs.length,
            packId: pack.id,
            packName: resolveLocalized(
              pack.nameLocalized,
              pack.name,
              lang,
            ),
          })
          const downloadUrl = pack.zipUrl
          if (!downloadUrl) {
            failed.push({ id: pack.id, error: "missing zipUrl" })
            continue
          }
          try {
            await installPack({
              manifestUrl: downloadUrl,
              source: "catalog",
              expectedVersion: pack.version,
            })
            installed.push(pack.id)
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.error(
              `[InstallContext] batch install failed for ${pack.id}:`,
              err,
            )
            failed.push({ id: pack.id, error: message })
          }
        }
      } finally {
        setBatchProgress(null)
        setInstalling(false)
      }
      return { installed, failed }
    },
    [i18n.language],
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
      value={{
        installCatalogPack,
        installDevPack,
        installPackBatch,
        batchProgress,
        isInstalling: installing,
        launchGame: onLaunchGame,
      }}
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
