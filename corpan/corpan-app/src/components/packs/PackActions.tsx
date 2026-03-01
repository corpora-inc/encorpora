import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useGamesStore, type InstalledGame } from "@/store/games"
import type { CatalogGame } from "@/contentPacks/catalog"
import { useInstallContext } from "@/contentPacks/InstallContext"

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
  const removeGame = useGamesStore((s) => s.removeGame)
  const { installCatalogPack, isInstalling } = useInstallContext()

  const handleInstall = () => {
    installCatalogPack(pack)
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
          {t("packs.get")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t("packs.offline")}
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
            disabled={isInstalling}
            className="flex-1"
            size="sm"
          >
            {isInstalling
              ? t("packs.updating")
              : t("packs.update")}
          </Button>
          <Button
            variant="outline"
            onClick={handleLaunch}
            size="sm"
          >
            {t("packs.open")}
          </Button>
        </div>
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
        disabled={isInstalling || isOffline}
        className="w-full"
        size="sm"
      >
        {isInstalling
          ? t("packs.installing")
          : t("packs.get")}
      </Button>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{pack.purchase?.priceLabel ?? t("packs.free")}</span>
        {isOffline ? <span>{t("packs.offline")}</span> : null}
      </div>
    </div>
  )
}
