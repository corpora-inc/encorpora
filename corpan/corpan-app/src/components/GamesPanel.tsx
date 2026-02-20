import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
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
  showDevInstall = false,
  showCatalog = false,
  showPlatformPacks = false,
}: {
  onLaunchGame?: (game: InstalledGame) => void
  showDevInstall?: boolean
  showCatalog?: boolean
  showPlatformPacks?: boolean
}) {
  const { t } = useTranslation()
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
  const packsInfoUrl = "https://free2z.cash/corpora"

  const handleInstall = async () => {
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

  const refreshPlatformPacks = useCallback(async () => {
    if (!showPlatformPacks) {
      return
    }
    setPlatformLoading(true)
    setPlatformError(null)
    const packs = await listPlatformPacks()
    setPlatformPacks(packs)
    setPlatformLoading(false)
  }, [showPlatformPacks])

  const refreshCatalog = useCallback(async () => {
    if (!showCatalog) {
      return
    }
    setCatalogLoading(true)
    setCatalogError(null)
    const next = await fetchGameCatalog()
    setCatalog(next)
    setCatalogLoading(false)
  }, [showCatalog])

  useEffect(() => {
    if (showPlatformPacks) {
      void refreshPlatformPacks()
    }
  }, [refreshPlatformPacks])

  useEffect(() => {
    if (showCatalog) {
      void refreshCatalog()
    }
  }, [refreshCatalog])

  const handleLaunchPlatform = async (pack: PlatformPack) => {
    const manifest = await resolvePlatformPackManifestUrl(pack.id)
    if (!manifest) {
      setPlatformError(t("packs.installFailed"))
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
      setCatalogError(t("packs.installFailed"))
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
        description: result.description ?? entry.description,
        source: result.source,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[packs] catalog install failed", err)
      setCatalogError(
        message
          ? `${t("packs.installFailed")} ${message}`
          : t("packs.installFailed")
      )
    } finally {
      setCatalogInstalling(null)
    }
  }

  return (
    <div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{t("packs.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("packs.devIntro")}</p>
        <a
          className="text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
          href={packsInfoUrl}
          target="_blank"
          rel="noreferrer"
        >
          {t("packs.devLink")}
        </a>
      </div>

      {showCatalog ? (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold">{t("packs.available")}</h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={refreshCatalog}
              disabled={catalogLoading}
            >
              {t("packs.refresh")}
            </Button>
          </div>
          {catalogError ? (
            <div className="text-sm text-red-600">{catalogError}</div>
          ) : null}
          {availableCatalog.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {t("packs.emptyAvailable")}
            </div>
          ) : (
            availableCatalog.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-3 rounded-md border border-border bg-card/80 p-4"
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
                    {catalogInstalling === entry.id
                      ? t("packs.installing")
                      : t("packs.get")}
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    {entry.purchase?.priceLabel ?? t("packs.free")}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        <h4 className="text-base font-semibold">{t("packs.installed")}</h4>
        {games.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {t("packs.emptyInstalled")}
          </div>
        ) : (
          games.map((game) => (
            <div
              key={game.id}
              className="flex flex-col gap-3 rounded-md border border-border bg-card/80 p-4"
            >
              <div>
                <div className="text-base font-medium">{game.name}</div>
                <div className="text-xs text-muted-foreground">{game.id}</div>
                {game.version ? (
                  <div className="text-xs text-muted-foreground">
                    {t("packs.version", { version: game.version })}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onLaunchGame?.(game)}>
                  {t("packs.open")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeGame(game.id)}
                >
                  {t("packs.remove")}
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
                    {catalogInstalling === game.id
                      ? t("packs.updating")
                      : t("packs.update")}
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {showDevInstall ? (
        <div className="mt-6 space-y-3 rounded-md border border-border bg-card/70 p-4">
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
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
            placeholder="https://example.com/pack/manifest.json or .../pack.zip"
            value={manifestUrl}
            onChange={(event) => setManifestUrl(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleInstall} disabled={installing}>
              {installing ? t("packs.installing") : t("packs.install")}
            </Button>
          </div>
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
        </div>
      ) : null}

      {showPlatformPacks ? (
        <div className="mt-8 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold">{t("packs.available")}</h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={refreshPlatformPacks}
              disabled={platformLoading}
            >
              {t("packs.refresh")}
            </Button>
          </div>
          {platformError ? (
            <div className="text-sm text-red-600">{platformError}</div>
          ) : null}
          {platformPacks.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {t("packs.emptyAvailable")}
            </div>
          ) : (
            platformPacks.map((pack) => (
              <div
                key={pack.id}
                className="flex flex-col gap-3 rounded-md border border-border bg-card/80 p-4"
              >
                <div>
                  <div className="text-base font-medium">{pack.name}</div>
                  <div className="text-xs text-muted-foreground">{pack.id}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleLaunchPlatform(pack)}>
                    {t("packs.open")}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
