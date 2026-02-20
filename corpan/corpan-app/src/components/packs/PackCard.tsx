import { useTranslation } from "react-i18next"
import type { CatalogGame } from "@/contentPacks/catalog"
import type { InstalledGame } from "@/store/games"
import { PackBadge, type BadgeVariant } from "./PackBadge"
import { PackScreenshot } from "./PackScreenshot"
import { PackActions, type PackActionState } from "./PackActions"

export function PackCard({
  pack,
  installedGame,
  badge,
  state,
  isOffline,
  onLaunch,
  updateVersion,
}: {
  pack: CatalogGame
  installedGame?: InstalledGame
  badge?: BadgeVariant
  state: PackActionState
  isOffline: boolean
  onLaunch?: (game: InstalledGame) => void
  updateVersion?: string
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card/80 p-4 shadow-sm transition-shadow hover:shadow-md h-full min-w-[280px]">
      {/* Content area that grows */}
      <div className="flex flex-col gap-3 flex-1">
        {/* Header with name and badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="text-base font-semibold">{pack.name}</h3>
            {pack.version && (
              <p className="text-xs text-muted-foreground">
                {t("packs.version", { version: pack.version })}
              </p>
            )}
          </div>
          {badge && <PackBadge variant={badge} />}
        </div>

        {/* Description */}
        {pack.description && (
          <p className="text-sm text-muted-foreground">{pack.description}</p>
        )}

        {/* Screenshot/Video */}
        {pack.imageUrl && (
          <PackScreenshot
            src={pack.imageUrl}
            alt={pack.name}
            type="image"
          />
        )}
      </div>

      {/* Actions stuck to bottom */}
      <div className="mt-3">
        <PackActions
          pack={pack}
          state={state}
          installedGame={installedGame}
          isOffline={isOffline}
          onLaunch={onLaunch}
          updateVersion={updateVersion}
        />
      </div>
    </div>
  )
}
