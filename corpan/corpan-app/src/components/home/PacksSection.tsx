// src/components/home/PacksSection.tsx
//
// The spacious "all packs" listing on Home — installed packs (with per-pack
// Update) + available catalog packs. Extracted from the retiring Packs tab
// (PacksListing) so Home is the single content surface. Subscription/restore,
// recents, dev-install, and the phrase-pack drawer trigger are surfaced
// elsewhere (Settings / Home directly), NOT here.

import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw, ArrowUpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OfflineNotice } from "@/components/OfflineNotice"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useGamesStore, type InstalledGame } from "@/store/games"
import { useCatalogStore } from "@/store/catalog"
import { usePackUpdates } from "@/hooks/usePackUpdates"
import { useInstallContext } from "@/contentPacks/InstallContext"
import { PackCard } from "@/components/packs/PackCard"
import type { CatalogGame } from "@/contentPacks/catalog"

export function PacksSection({
  onLaunchGame,
}: {
  onLaunchGame?: (game: InstalledGame) => void
}) {
  const { t } = useTranslation()
  const gamesMap = useGamesStore((s) => s.games)
  const catalog = useCatalogStore((s) => s.getCatalog())
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog)
  const isFetching = useCatalogStore((s) => s.isFetching)
  const lastFetched = useCatalogStore((s) => s.lastFetched)
  const isOnline = useOnlineStatus()
  const { installCatalogPack } = useInstallContext()

  const installedGames = useMemo(
    () => Object.values(gamesMap).sort((a, b) => a.name.localeCompare(b.name)),
    [gamesMap],
  )
  const updates = usePackUpdates(installedGames, catalog)
  const availablePacks = useMemo(
    () => catalog.filter((pack) => !gamesMap[pack.id]),
    [catalog, gamesMap],
  )

  // Fetch the catalog once if we don't have it yet (Home is always mounted, so
  // avoid a force-refresh on every launch — the manual refresh button forces).
  useEffect(() => {
    if (!lastFetched && !isFetching && isOnline) void fetchCatalog()
  }, [lastFetched, isFetching, isOnline, fetchCatalog])

  const handleRefresh = () => void fetchCatalog(true)

  /** The catalog CDN manifestUrl MUST win over the local corpan-pack:// URL for
   *  an Update to actually re-download the zip (see PacksListing notes). */
  const catalogPackForUpdate = (game: InstalledGame): CatalogGame | null => {
    const entry = catalog.find((c) => c.id === game.id)
    if (!entry) return null
    return {
      ...entry,
      id: game.id,
      version: updates.find((u) => u.game.id === game.id)?.update.version ?? entry.version,
      manifestUrl: entry.manifestUrl ?? game.manifestUrl,
    }
  }

  const handleUpdateAll = async () => {
    for (const u of updates) {
      const pack = catalogPackForUpdate(u.game)
      if (pack) await installCatalogPack(pack)
    }
  }

  return (
    <div className="space-y-8">
      {/* Installed packs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("packs.installed", { defaultValue: "Installed" })}
          </h2>
          {updates.length > 0 ? (
            <Button size="sm" variant="outline" className="h-8" onClick={handleUpdateAll}>
              <ArrowUpCircle className="mr-1.5 h-4 w-4" />
              {t("packs.updateAll", { defaultValue: "Update all ({{count}})", count: updates.length })}
            </Button>
          ) : null}
        </div>
        {installedGames.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("packs.emptyInstalled")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {installedGames.map((game) => {
              const catalogEntry = catalog.find((c) => c.id === game.id)
              const hasUpdate = updates.some((u) => u.game.id === game.id)
              const packForCard: CatalogGame = catalogEntry
                ? {
                    ...catalogEntry,
                    id: game.id,
                    version: game.version ?? catalogEntry.version,
                    manifestUrl: catalogEntry.manifestUrl ?? game.manifestUrl,
                    imageUrl: game.imageUrl ?? catalogEntry.imageUrl,
                  }
                : {
                    id: game.id,
                    name: game.name,
                    version: game.version ?? "",
                    manifestUrl: game.manifestUrl,
                    description: game.description,
                    imageUrl: game.imageUrl,
                  }
              return (
                <PackCard
                  key={game.id}
                  pack={packForCard}
                  installedGame={game}
                  badge={hasUpdate ? "update" : "installed"}
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

      {/* Available packs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("packs.available", { defaultValue: "Discover" })}
          </h2>
          {isOnline ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleRefresh}
              disabled={isFetching}
              aria-label={t("packs.refresh")}
              title={t("packs.refresh")}
            >
              <RefreshCw className={`h-4 w-4${isFetching ? " animate-spin" : ""}`} />
            </Button>
          ) : null}
        </div>
        {!isOnline && availablePacks.length === 0 ? (
          <OfflineNotice
            title={t("offline.packCatalogTitle", { defaultValue: "Pack catalog needs internet" })}
            subtitle={t("offline.packCatalogSubtitle", {
              defaultValue: "Your installed packs still work. Reconnect to browse more.",
            })}
          />
        ) : availablePacks.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {catalog.length === 0 && isFetching ? t("common.loading") : t("packs.emptyAvailable")}
          </div>
        ) : (
          <>
            {!isOnline ? (
              <OfflineNotice
                density="compact"
                title={t("offline.cachedSubtitle", { defaultValue: "Showing your last cached results." })}
              />
            ) : null}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          </>
        )}
      </div>
    </div>
  )
}
