import { useTranslation } from "react-i18next"
import type { CatalogGame } from "@/contentPacks/catalog"
import { localizePack } from "@/contentPacks/localized"
import type { InstalledGame } from "@/store/games"
import { PackBadge, type BadgeVariant } from "./PackBadge"
import { PackScreenshot } from "./PackScreenshot"
import { PackActions, type PackActionState } from "./PackActions"
import { StreakBadge } from "@/components/StreakBadge"

export function PackCard({
  pack: rawPack,
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
  const { t, i18n } = useTranslation()
  const pack = localizePack(rawPack, i18n.language || "en")

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card/80 p-4 shadow-sm transition-shadow hover:shadow-md h-full min-w-[280px]">
      {/* Text content grows — ONLY the header + description live here, so a
          longer/shorter description never shifts the asset below. */}
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
          <div className="flex items-center gap-1.5">
            {/* Per-pack visit streak (installed packs only) — retention, never a
                gate. Hidden below 2 days so it never clutters. */}
            {installedGame && <StreakBadge packId={installedGame.id} />}
            {badge && <PackBadge variant={badge} />}
          </div>
        </div>

        {/* Description */}
        {pack.description && (
          <p className="text-sm text-muted-foreground">{pack.description}</p>
        )}
      </div>

      {/* Pinned to the bottom: the screenshot sits directly above the actions
          so the asset + buttons stay aligned across cards regardless of how
          many rows the description takes. */}
      <div className="mt-3 flex flex-col gap-3">
        {pack.imageUrl && (
          <PackScreenshot src={pack.imageUrl} alt={pack.name} type="image" />
        )}
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
