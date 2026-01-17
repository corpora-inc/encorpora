import { useMemo } from "react"
import { compareVersions, getUpdateType, type CatalogGame, type UpdateType } from "@/contentPacks/catalog"
import type { InstalledGame } from "@/store/games"

export type PackUpdate = {
  game: InstalledGame
  update: CatalogGame
  type: UpdateType
}

/**
 * Hook to detect available updates for installed packs
 */
export function usePackUpdates(
  installedGames: InstalledGame[],
  catalog: CatalogGame[]
): PackUpdate[] {
  return useMemo(() => {
    const catalogMap = new Map(catalog.map((c) => [c.id, c]))
    const updates: PackUpdate[] = []

    for (const game of installedGames) {
      const remote = catalogMap.get(game.id)
      if (!remote?.version || !game.version) continue

      const cmp = compareVersions(remote.version, game.version)
      if (cmp > 0) {
        const updateType = getUpdateType(remote.version, game.version)
        if (updateType) {
          updates.push({
            game,
            update: remote,
            type: updateType,
          })
        }
      }
    }

    return updates
  }, [installedGames, catalog])
}
