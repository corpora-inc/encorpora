import { useEffect, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw } from "lucide-react"
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
    console.log("[PacksListing] Mounting, fetching catalog")
    console.log("[PacksListing] Current catalog:", catalog)
    // Force fetch to ensure we get production URLs even if cached
    fetchCatalog(true)
  }, [])

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
        description: result.description,
        imageUrl: result.imageUrl,
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


  return (
    <div className="space-y-6">

      {/* Section 1: Updates Available */}
      {updates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold text-purple-700">
              {t("packs.updates")}
              <span className="ml-2 text-sm font-medium text-purple-500">
                ({updates.length})
              </span>
            </h4>
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
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
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t("packs.emptyInstalled")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {installedGames.map((game) => {
              const catalogEntry = catalog.find((c) => c.id === game.id)
              const hasUpdate = updates.some((u) => u.game.id === game.id)

              return (
                <PackCard
                  key={game.id}
                  pack={catalogEntry ?? {
                    id: game.id,
                    name: game.name,
                    version: game.version ?? "",
                    manifestUrl: game.manifestUrl,
                    description: game.description,
                    imageUrl: game.imageUrl,
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold">{t("packs.available")}</h4>
            {!isOnline && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                {t("packs.offline")}
              </span>
            )}
          </div>
          {isOnline && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleRefresh}
              disabled={isFetching}
              aria-label={t("packs.refresh")}
              title={t("packs.refresh")}
            >
              <RefreshCw
                className={`h-4 w-4${isFetching ? " animate-spin" : ""}`}
              />
            </Button>
          )}
        </div>
        {availablePacks.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {catalog.length === 0 && isFetching
              ? t("common.loading")
              : t("packs.emptyAvailable")}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
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

      {/* Section 4: Developer Tools (clearly separated) */}
      {showDevInstall && (
        <div className="space-y-3 rounded-md border-2 border-dashed border-gray-300 bg-gray-50/50 p-4 mt-8">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-gray-700">
              {t("packs.devUnlockTitle")}
            </div>
            <div className="text-xs text-gray-600">{t("packs.devIntro")}</div>
            <a
              href="https://free2z.cash/corpora"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              {t("packs.devLink")}
            </a>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-gray-700">
              {t("packs.manifestTitle")}
            </div>
            <div className="text-xs text-gray-600">
              {t("packs.manifestHint")}
            </div>
          </div>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            placeholder={t("packs.manifestPlaceholder")}
            value={manifestUrl}
            onChange={(event) => setManifestUrl(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleDevInstall} disabled={installing} size="sm">
              {installing ? t("packs.installing") : t("packs.install")}
            </Button>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
      )}
    </div>
  )
}
