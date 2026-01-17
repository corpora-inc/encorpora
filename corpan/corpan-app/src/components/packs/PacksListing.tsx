import { useEffect, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useGamesStore, type InstalledGame } from "@/store/games"
import { useCatalogStore } from "@/store/catalog"
import { usePackUpdates } from "@/hooks/usePackUpdates"
import { PackCard } from "./PackCard"
import { installPack } from "@/contentPacks/install"

export function PacksListing({
  showDevInstall = false,
  onLaunchGame,
}: {
  showDevInstall?: boolean
  onLaunchGame?: (game: InstalledGame) => void
}) {
  const { t } = useTranslation()
  const gamesMap = useGamesStore((s) => s.games)
  const addGame = useGamesStore((s) => s.addGame)

  const catalog = useCatalogStore((s) => s.getCatalog())
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog)
  const isOnline = useCatalogStore((s) => s.isOnline)
  const lastFetched = useCatalogStore((s) => s.lastFetched)
  const isFetching = useCatalogStore((s) => s.isFetching)
  const [manifestUrl, setManifestUrl] = useState("")
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const installedGames = useMemo(() => {
    return Object.values(gamesMap).sort((a, b) => a.name.localeCompare(b.name))
  }, [gamesMap])

  const updates = usePackUpdates(installedGames, catalog)

  const availablePacks = useMemo(() => {
    return catalog.filter((pack) => !gamesMap[pack.id])
  }, [catalog, gamesMap])

  // Fetch catalog on mount
  useEffect(() => {
    fetchCatalog()
  }, [fetchCatalog])

  const handleRefresh = async () => {
    await fetchCatalog(true) // Force refresh
  }

  const handleDevInstall = async () => {
    if (!manifestUrl.trim()) {
      setError(t("packs.manifestHint"))
      return
    }
    setInstalling(true)
    setError(null)
    try {
      const result = await installPack({
        manifestUrl,
        source: "manual",
      })
      addGame({
        id: result.packId,
        name: result.name ?? result.packId,
        manifestUrl: result.manifestUrl,
        version: result.version,
        source: result.source,
      })
      setManifestUrl("")
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[packs] manual install failed", err)
      setError(
        message
          ? `${t("packs.installFailed")} ${message}`
          : t("packs.installFailed")
      )
    } finally {
      setInstalling(false)
    }
  }

  const lastUpdatedText = useMemo(() => {
    if (!lastFetched) return null
    const minutes = Math.floor((Date.now() - lastFetched) / 60000)
    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }, [lastFetched])

  return (
    <div className="space-y-6">
      {/* Header with network status and refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{t("packs.title")}</h3>
          {!isOnline && (
            <span className="text-xs text-muted-foreground">(Offline)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdatedText && (
            <span className="text-xs text-muted-foreground">
              {lastUpdatedText}
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isFetching || !isOnline}
          >
            {isFetching ? "Refreshing..." : t("packs.refresh")}
          </Button>
        </div>
      </div>

      {/* Section 1: Updates Available */}
      {updates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold text-orange-700">
              Updates Available ({updates.length})
            </h4>
          </div>
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {updates.map(({ game, update }) => (
              <PackCard
                key={game.id}
                pack={update}
                installedGame={game}
                badge="update"
                state="update"
                isOffline={!isOnline}
                onLaunch={onLaunchGame}
                updateVersion={update.version}
              />
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Installed Packs */}
      <div className="space-y-3">
        <h4 className="text-base font-semibold">{t("packs.installed")}</h4>
        {installedGames.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {t("packs.emptyInstalled")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {installedGames.map((game) => {
              const catalogEntry = catalog.find((c) => c.id === game.id)
              const hasUpdate = updates.some((u) => u.game.id === game.id)

              return (
                <PackCard
                  key={game.id}
                  pack={catalogEntry ?? {
                    id: game.id,
                    name: game.name,
                    version: game.version ?? "unknown",
                    manifestUrl: game.manifestUrl,
                  }}
                  installedGame={game}
                  badge={hasUpdate ? undefined : "installed"}
                  state={hasUpdate ? "update" : "installed"}
                  isOffline={!isOnline}
                  onLaunch={onLaunchGame}
                  updateVersion={
                    hasUpdate
                      ? updates.find((u) => u.game.id === game.id)?.update.version
                      : undefined
                  }
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Section 3: Discover New */}
      <div className="space-y-3">
        <h4 className="text-base font-semibold">{t("packs.available")}</h4>
        {availablePacks.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {t("packs.emptyAvailable")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {availablePacks.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                badge="new"
                state="available"
                isOffline={!isOnline}
                onLaunch={onLaunchGame}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section 4: Dev Tools */}
      {showDevInstall && (
        <div className="space-y-3 rounded-md border border-gray-200 bg-white/70 p-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold">{t("packs.manifestTitle")}</div>
            <div className="text-xs text-muted-foreground">
              {t("packs.manifestHint")}
            </div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div className="font-medium">Two install options:</div>
              <div className="ml-2">
                • <span className="font-mono">manifest.json</span> - Web play (always latest version)
              </div>
              <div className="ml-2">
                • <span className="font-mono">.zip</span> - Offline download (install once, works offline)
              </div>
            </div>
          </div>
          <input
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            placeholder="https://example.com/pack/manifest.json or .../pack.zip"
            value={manifestUrl}
            onChange={(event) => setManifestUrl(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleDevInstall} disabled={installing}>
              {installing ? t("packs.installing") : t("packs.install")}
            </Button>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
      )}

      {/* Info link */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{t("packs.devIntro")}</p>
        <a
          className="text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
          href="https://free2z.cash/corpora"
          target="_blank"
          rel="noreferrer"
        >
          {t("packs.devLink")}
        </a>
      </div>
    </div>
  )
}
