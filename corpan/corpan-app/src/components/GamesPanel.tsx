import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useGamesStore, type InstalledGame } from "@/store/games"
import {
  listPlatformPacks,
  resolvePlatformPackManifestUrl,
  type PlatformPack,
} from "@/contentPacks/platformPacks"
import {
  compareVersions,
  fetchGameCatalog,
  type CatalogGame,
} from "@/contentPacks/catalog"
import { installPack } from "@/contentPacks/install"

export function GamesPanel({
  onLaunchGame,
}: {
  onLaunchGame?: (game: InstalledGame) => void
}) {
  const gamesMap = useGamesStore((s) => s.games)
  const games = useMemo(() => {
    return Object.values(gamesMap).sort((a, b) => a.name.localeCompare(b.name))
  }, [gamesMap])
  const addGame = useGamesStore((s) => s.addGame)
  const removeGame = useGamesStore((s) => s.removeGame)

  const [manifestUrl, setManifestUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)
  const [platformPacks, setPlatformPacks] = useState<PlatformPack[]>([])
  const [platformError, setPlatformError] = useState<string | null>(null)
  const [platformLoading, setPlatformLoading] = useState(false)
  const [catalog, setCatalog] = useState<CatalogGame[]>([])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogInstalling, setCatalogInstalling] = useState<string | null>(null)

  const handleInstall = async () => {
    if (!manifestUrl.trim()) {
      setError("Enter a manifest URL.")
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
      const message = err instanceof Error ? err.message : "Install failed"
      setError(message)
    } finally {
      setInstalling(false)
    }
  }

  const refreshPlatformPacks = useCallback(async () => {
    setPlatformLoading(true)
    setPlatformError(null)
    const packs = await listPlatformPacks()
    setPlatformPacks(packs)
    setPlatformLoading(false)
  }, [])

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true)
    setCatalogError(null)
    const next = await fetchGameCatalog()
    setCatalog(next)
    setCatalogLoading(false)
  }, [])

  useEffect(() => {
    void refreshPlatformPacks()
  }, [refreshPlatformPacks])

  useEffect(() => {
    void refreshCatalog()
  }, [refreshCatalog])

  const handleLaunchPlatform = async (pack: PlatformPack) => {
    const manifest = await resolvePlatformPackManifestUrl(pack.id)
    if (!manifest) {
      setPlatformError("Unable to resolve manifest for this pack.")
      return
    }
    onLaunchGame?.({
      id: pack.id,
      name: pack.name,
      manifestUrl: manifest,
      version: pack.version,
      source: "platform",
      installedAt: Date.now(),
    })
  }

  const catalogMap = useMemo(
    () => new Map(catalog.map((entry) => [entry.id, entry])),
    [catalog]
  )
  const availableCatalog = useMemo(
    () => catalog.filter((entry) => !gamesMap[entry.id]),
    [catalog, gamesMap]
  )
  const getUpdateForGame = (game: InstalledGame) => {
    const entry = catalogMap.get(game.id)
    if (!entry || !entry.version || !game.version) {
      return null
    }
    if (compareVersions(entry.version, game.version) > 0) {
      return entry
    }
    return null
  }

  const handleCatalogInstall = async (entry: CatalogGame) => {
    if (!entry.manifestUrl) {
      setCatalogError("Catalog entry is missing a manifest URL.")
      return
    }
    setCatalogInstalling(entry.id)
    setCatalogError(null)
    try {
      const result = await installPack({
        manifestUrl: entry.manifestUrl,
        source: "catalog",
        expectedVersion: entry.version,
      })
      addGame({
        id: result.packId,
        name: result.name ?? entry.name ?? result.packId,
        manifestUrl: result.manifestUrl,
        version: result.version,
        source: result.source,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Install failed"
      setCatalogError(message)
    } finally {
      setCatalogInstalling(null)
    }
  }

  return (
    <div className="mt-6">
      <Separator className="my-5" />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Games</h3>
        <p className="text-sm text-muted-foreground">
          Install a game from a manifest URL, then launch it in full-screen.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-semibold">Available games</h4>
          <Button
            size="sm"
            variant="ghost"
            onClick={refreshCatalog}
            disabled={catalogLoading}
          >
            {catalogLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
        {catalogError ? (
          <div className="text-sm text-red-600">{catalogError}</div>
        ) : null}
        {availableCatalog.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No games available right now.
          </div>
        ) : (
          availableCatalog.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white/80 p-4"
            >
              <div>
                <div className="text-base font-medium">{entry.name}</div>
                <div className="text-xs text-muted-foreground">{entry.id}</div>
                {entry.description ? (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {entry.description}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleCatalogInstall(entry)}
                  disabled={catalogInstalling === entry.id}
                >
                  {catalogInstalling === entry.id ? "Installing..." : "Get"}
                </Button>
                <div className="text-xs text-muted-foreground">
                  {entry.purchase?.priceLabel ?? "Free"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 space-y-3">
        <input
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          placeholder="https://example.com/corpan-game/manifest.json"
          value={manifestUrl}
          onChange={(event) => setManifestUrl(event.target.value)}
        />
        <Button
          variant="outline"
          onClick={handleInstall}
          disabled={installing}
        >
          {installing ? "Installing..." : "Install game"}
        </Button>
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </div>

      <div className="mt-6 space-y-3">
        {games.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No games installed yet.
          </div>
        ) : (
          games.map((game) => (
            <div
              key={game.id}
              className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white/80 p-4"
            >
              <div>
                <div className="text-base font-medium">{game.name}</div>
                <div className="text-xs text-muted-foreground">
                  {game.id}
                </div>
                {game.version ? (
                  <div className="text-xs text-muted-foreground">
                    Version {game.version}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => onLaunchGame?.(game)}
                >
                  Launch
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeGame(game.id)}
                >
                  Remove
                </Button>
                {getUpdateForGame(game) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleCatalogInstall(getUpdateForGame(game) as CatalogGame)
                    }
                    disabled={catalogInstalling === game.id}
                  >
                    {catalogInstalling === game.id ? "Updating..." : "Update"}
                  </Button>
                ) : null}
              </div>
              {getUpdateForGame(game) ? (
                <div className="text-xs text-muted-foreground">
                  Update available: {game.version} →{" "}
                  {getUpdateForGame(game)?.version}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-semibold">Purchased packs</h4>
          <Button
            size="sm"
            variant="ghost"
            onClick={refreshPlatformPacks}
            disabled={platformLoading}
          >
            {platformLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          iOS/Android purchases will appear here when running on device.
        </p>
        {platformError ? (
          <div className="text-sm text-red-600">{platformError}</div>
        ) : null}
        {platformPacks.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No platform packs detected.
          </div>
        ) : (
          platformPacks.map((pack) => (
            <div
              key={pack.id}
              className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white/80 p-4"
            >
              <div>
                <div className="text-base font-medium">{pack.name}</div>
                <div className="text-xs text-muted-foreground">{pack.id}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => handleLaunchPlatform(pack)}>
                  Launch
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
