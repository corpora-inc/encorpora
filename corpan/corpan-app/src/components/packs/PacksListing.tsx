import { useEffect, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OfflineNotice } from "@/components/OfflineNotice"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useGamesStore, type InstalledGame } from "@/store/games"
import { useCatalogStore } from "@/store/catalog"
import { usePackUpdates } from "@/hooks/usePackUpdates"
import { PackCard } from "./PackCard"
import { PhrasePackDrawerTrigger } from "./PhrasePackDrawerTrigger"
import { RecentsSection } from "./RecentsSection"
import { SubscriptionOffer } from "./SubscriptionOffer"
import { RestorePurchases } from "./RestorePurchases"
import { useInstallContext } from "@/contentPacks/InstallContext"

export function PacksListing({
  showDevInstall = false,
  onLaunchGame,
}: {
  showDevInstall?: boolean
  onLaunchGame?: (game: InstalledGame) => void
}) {
  const { t } = useTranslation()
  const gamesMap = useGamesStore((s) => s.games)

  const catalog = useCatalogStore((s) => s.getCatalog())
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog)
  const isOnline = useOnlineStatus()
  const isFetching = useCatalogStore((s) => s.isFetching)
  const setDevMode = useCatalogStore((s) => s.setDevMode)
  const [manifestUrl, setManifestUrl] = useState("")

  // Sync dev mode from props into catalog store
  useEffect(() => {
    setDevMode(showDevInstall)
  }, [showDevInstall, setDevMode])

  const { installDevPack, isInstalling } = useInstallContext()

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

  const handleDevInstall = () => {
    if (!manifestUrl.trim()) return
    installDevPack(manifestUrl)
    setManifestUrl("")
  }


  return (
    <div className="space-y-6">

      {/* Subscription Offer — top of screen. Self-hides when not applicable. */}
      <SubscriptionOffer />

      {/* Restore Purchases (self-hides on non-IAP platforms). Lives with
          the subscription block — restoring is the natural sibling of
          offering. */}
      <RestorePurchases />

      {/* Recents — quick re-entry for packs the user has launched recently.
          Self-hides when no installed pack has ever been launched. */}
      <RecentsSection
        installedGames={installedGames}
        updates={updates}
        isOnline={isOnline}
        onLaunchGame={onLaunchGame}
      />

      {/* Installed Packs — single source of truth for everything on disk.
          Cards with an available update get a purple "update" badge and
          their action row swaps to [Update] [Open] [Remove]. No separate
          Updates section: a card showing up twice is just noise. */}
      <div className="space-y-3">
        <h4 className="text-base font-semibold">{t("packs.installed")}</h4>
        {installedGames.length === 0 ? (
          <div className="rounded-md border border-border bg-muted p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t("packs.emptyInstalled")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {installedGames.map((game) => {
              const catalogEntry = catalog.find((c) => c.id === game.id)
              const hasUpdate = updates.some((u) => u.game.id === game.id)
              // When the catalog has the entry, prefer ITS `name` /
              // `description` (and the `nameLocalized` / `descriptionLocalized`
              // maps that come with it) so the installed card renders the
              // same localized strings as the available card. Only fall
              // back to the persisted English `game.name` when the catalog
              // doesn't know this pack (offline + cache empty).
              const packForCard = catalogEntry
                ? {
                    ...catalogEntry,
                    id: game.id,
                    version: game.version ?? catalogEntry.version,
                    // **Always use the catalog's CDN manifestUrl** when
                    // available. `game.manifestUrl` is the LOCAL
                    // `corpan-pack://localhost/<id>/manifest.json` URL
                    // that Rust writes at install time — useful for
                    // OPENING an installed pack, but fatal for the
                    // Update button: passing the local URL to
                    // installPack() makes it skip the .zip download
                    // path entirely and just re-read the on-disk
                    // manifest, so the in-memory store gets "updated"
                    // to the same old version and nothing actually
                    // gets re-downloaded. Catalog URL wins.
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

      {/* Section 3: Discover New */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-semibold">{t("packs.available")}</h4>
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
        {!isOnline && availablePacks.length === 0 ? (
          <OfflineNotice
            title={t("offline.packCatalogTitle", {
              defaultValue: "Pack catalog needs internet",
            })}
            subtitle={t("offline.packCatalogSubtitle", {
              defaultValue:
                "Your installed packs still work. Reconnect to browse more.",
            })}
          />
        ) : availablePacks.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {catalog.length === 0 && isFetching
              ? t("common.loading")
              : t("packs.emptyAvailable")}
          </div>
        ) : (
          <>
            {!isOnline && (
              <OfflineNotice
                density="compact"
                title={t("offline.cachedSubtitle", {
                  defaultValue: "Showing your last cached results.",
                })}
              />
            )}
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
          </>
        )}
      </div>

      {/* Section 4: Developer Tools (clearly separated) */}
      {showDevInstall && (
        <div className="space-y-3 rounded-md border-2 border-dashed border-input bg-muted/50 p-4 mt-8">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">
              {t("packs.devUnlockTitle")}
            </div>
            <div className="text-xs text-muted-foreground">{t("packs.devIntro")}</div>
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
            <div className="text-xs font-semibold text-foreground">
              {t("packs.manifestTitle")}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("packs.manifestHint")}
            </div>
          </div>
          <input
            className="w-full rounded-md border border-input px-3 py-2 text-base bg-background"
            placeholder={t("packs.manifestPlaceholder")}
            value={manifestUrl}
            onChange={(event) => setManifestUrl(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleDevInstall} disabled={isInstalling} size="sm">
              {isInstalling ? t("packs.installing") : t("packs.install")}
            </Button>
          </div>
        </div>
      )}

      {/* Phrase-pack drawer trigger. The drawer itself lives at
          App.tsx level and is shared with the Stacks tab's
          PhrasePackToggleSection — same trigger component dropped into
          both panes. Self-hides when the catalog has zero phrase
          packs. */}
      <PhrasePackDrawerTrigger />
    </div>
  )
}
