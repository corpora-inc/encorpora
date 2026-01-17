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
      {/* Consumer-friendly intro */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Discover and install games and experiences to practice your languages.
        </p>
        {!isOnline && (
          <div className="flex items-center gap-2 text-sm text-orange-600">
            <span>⚠️ Offline - showing installed packs only</span>
          </div>
        )}
      </div>

      {/* Section 1: Updates Available */}
      {updates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold text-purple-700">
              Updates Available ({updates.length})
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
        <h4 className="text-base font-semibold">Your Packs</h4>
        {installedGames.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No packs installed yet. Browse available packs below to get started!
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
                    version: game.version ?? "unknown",
                    manifestUrl: game.manifestUrl,
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
          <h4 className="text-base font-semibold">{t("packs.available")}</h4>
          {isOnline && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefresh}
              disabled={isFetching}
              className="text-xs"
            >
              {isFetching ? "⟳ Refreshing..." : "⟳ Refresh"}
            </Button>
          )}
        </div>
        {availablePacks.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {catalog.length === 0 ? (
              <div>
                Loading packs...
                {!isOnline && " (offline - connect to internet to see available packs)"}
              </div>
            ) : (
              t("packs.emptyAvailable")
            )}
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
              🛠️ Developer Tools
            </div>
            <div className="text-xs text-gray-600">
              Install custom packs from URL (for developers and testers)
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            placeholder="https://example.com/pack/manifest.json or .../pack.zip"
            value={manifestUrl}
            onChange={(event) => setManifestUrl(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleDevInstall} disabled={installing} size="sm">
              {installing ? t("packs.installing") : t("packs.install")}
            </Button>
            <a
              href="https://free2z.cash/corpora"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Learn More
            </a>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
      )}
    </div>
  )
}
