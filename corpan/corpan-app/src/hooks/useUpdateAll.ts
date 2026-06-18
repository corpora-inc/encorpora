import { useCallback } from "react"
import type { CatalogGame } from "@/contentPacks/catalog"
import { useGamesStore } from "@/store/games"
import { useCatalogStore } from "@/store/catalog"
import { useInstallContext } from "@/contentPacks/InstallContext"
import { usePackUpdates, type PackUpdate } from "@/hooks/usePackUpdates"

/**
 * Shared pack-update machinery. Surfaces the list of installed packs that have
 * updates plus a single `updateAll()` that re-downloads each one. Used by both
 * the Home "You have pack updates" CTA and the per-section "Update all" in
 * PacksSection so the two never drift.
 *
 * The catalog CDN `manifestUrl` MUST win over the local `corpan-pack://` URL
 * for an Update to actually re-fetch the zip (see PacksListing notes).
 */
export function useUpdateAll(): {
  updates: PackUpdate[]
  updateAll: () => Promise<void>
} {
  const gamesMap = useGamesStore((s) => s.games)
  const catalog = useCatalogStore((s) => s.getCatalog())
  const { installCatalogPack } = useInstallContext()

  const installedGames = Object.values(gamesMap)
  const updates = usePackUpdates(installedGames, catalog)

  const updateAll = useCallback(async () => {
    for (const u of updates) {
      const entry = catalog.find((c) => c.id === u.game.id)
      if (!entry) continue
      const pack: CatalogGame = {
        ...entry,
        id: u.game.id,
        version: u.update.version ?? entry.version,
        manifestUrl: entry.manifestUrl ?? u.game.manifestUrl,
      }
      await installCatalogPack(pack)
    }
  }, [updates, catalog, installCatalogPack])

  return { updates, updateAll }
}
