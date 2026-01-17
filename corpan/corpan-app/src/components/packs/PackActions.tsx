import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { installPack } from "@/contentPacks/install"
import { useGamesStore, type InstalledGame } from "@/store/games"
import type { CatalogGame } from "@/contentPacks/catalog"

export type PackActionState = "available" | "installed" | "update" | "offline"

export function PackActions({
  pack,
  state,
  installedGame,
  isOffline,
  onLaunch,
  updateVersion,
}: {
  pack: CatalogGame
  state: PackActionState
  installedGame?: InstalledGame
  isOffline: boolean
  onLaunch?: (game: InstalledGame) => void
  updateVersion?: string
}) {
  const { t } = useTranslation()
  const addGame = useGamesStore((s) => s.addGame)
  const removeGame = useGamesStore((s) => s.removeGame)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInstall = async () => {
    console.log("[PackActions] handleInstall called for pack:", pack.id)
    console.log("[PackActions] manifestUrl:", pack.manifestUrl)

    if (!pack.manifestUrl) {
      setError(t("packs.installFailed"))
      return
    }

    setInstalling(true)
    setError(null)

    try {
      console.log("[PackActions] Calling installPack with URL:", pack.manifestUrl)
      const result = await installPack({
        manifestUrl: pack.manifestUrl,
        source: "catalog",
        expectedVersion: pack.version,
      })
      console.log("[PackActions] Install successful:", result)

      addGame({
        id: result.packId,
        name: result.name ?? pack.name ?? result.packId,
        manifestUrl: result.manifestUrl,
        version: result.version,
        imageUrl: pack.imageUrl,
        source: result.source,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("[packs] install failed", err)
      setError(
        message
          ? `${t("packs.installFailed")} ${message}`
          : t("packs.installFailed")
      )
    } finally {
      setInstalling(false)
    }
  }

  const handleRemove = () => {
    if (installedGame) {
      removeGame(installedGame.id)
    }
  }

  const handleLaunch = () => {
    if (installedGame) {
      onLaunch?.(installedGame)
    }
  }

  if (state === "offline") {
    return (
      <div className="space-y-2">
        <Button disabled className="w-full" size="sm">
          {t("packs.install")} (Offline)
        </Button>
        <p className="text-xs text-muted-foreground">
          Requires internet connection
        </p>
      </div>
    )
  }

  if (state === "update" && updateVersion) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            onClick={handleInstall}
            disabled={installing}
            className="flex-1"
            size="sm"
          >
            {installing
              ? t("packs.updating")
              : `Update to ${updateVersion}`}
          </Button>
          <Button
            variant="outline"
            onClick={handleLaunch}
            size="sm"
          >
            {t("packs.open")}
          </Button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  if (state === "installed" && installedGame) {
    return (
      <div className="flex gap-2">
        <Button
          onClick={handleLaunch}
          className="flex-1"
          size="sm"
        >
          {t("packs.open")}
        </Button>
        <Button
          variant="ghost"
          onClick={handleRemove}
          size="sm"
        >
          {t("packs.remove")}
        </Button>
      </div>
    )
  }

  // Available (not installed)
  return (
    <div className="space-y-2">
      <Button
        onClick={handleInstall}
        disabled={installing || isOffline}
        className="w-full"
        size="sm"
      >
        {installing
          ? t("packs.installing")
          : isOffline
            ? "Download (Offline)"
            : t("packs.get")}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-muted-foreground">
        {pack.purchase?.priceLabel ?? t("packs.free")}
      </p>
    </div>
  )
}
