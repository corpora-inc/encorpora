import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { LucideIcon } from "lucide-react"
import {
  Settings as SettingsIcon,
  Brain,
  Mic,
  BookOpen,
  Radio,
  Gamepad2,
  PenTool,
  Sparkles,
  Citrus,
  Package,
  ArrowRight,
  Download,
} from "lucide-react"
import { useSettingsStore } from "@/store/settings"
import { useCatalogStore } from "@/store/catalog"
import { useGamesStore, type InstalledGame } from "@/store/games"
import { useInstallContext } from "@/contentPacks/InstallContext"
import { StreakChip } from "@/components/StreakChip"
import { SubscriptionOffer } from "@/components/packs/SubscriptionOffer"
import { Button } from "@/components/ui/button"
import { getPlatformTopPaddingButtons } from "@/util/browser"
import corpanMark from "@/assets/corpan-mark-trim.png"
import { recommend } from "./recommend"
import type { CatalogGame } from "@/contentPacks/catalog"

/** Working name for the built-in phrase experience. Was surfaced as a generic
 *  "Continue learning" CTA — it's actually a distinct, named experience.
 *  Rename freely (e.g. "Phlip"); it's one constant + the i18n key. */
const PHRASE_NAME = "Phrase Flip"

/** Per-experience icon — gives the grid a real identity instead of generic
 *  tiles. Falls back to a package glyph for anything unmapped. */
const EXP_ICON: Record<string, LucideIcon> = {
  phrase_main: Brain,
  pronunciation_coach: Mic,
  earthgate_reader: BookOpen,
  stargate_reader: Sparkles,
  world_radio: Radio,
  hover_runner: Gamepad2,
  hanzipan: PenTool,
  juice_squeeze: Citrus,
}

type GridExp = {
  key: string
  name: string
  Icon: LucideIcon
  installed: boolean
  onClick: () => void
}

/**
 * The Home hub — post-onboarding root. A featured "brains" experience (the
 * phrase flipper) crowns a responsive grid of peer experiences (readers,
 * pronunciation, radio, games). Fills the width on iPad/desktop; pack
 * management lives in Settings → Packs.
 */
export function HomeHub({
  onSettings,
  onLaunchPhrase,
  updateCount = 0,
}: {
  onSettings: () => void
  onLaunchPhrase: () => void
  updateCount?: number
}) {
  const { t, i18n } = useTranslation()
  const dir = useSettingsStore((s) => s.dir)
  const userClass = useSettingsStore((s) => s.userClass)
  const catalog = useCatalogStore((s) => s.getCatalog())
  const games = useGamesStore((s) => s.games)
  const { installCatalogPack, launchGame } = useInstallContext()

  const installedIds = useMemo(() => new Set(Object.keys(games)), [games])

  const localizedName = (g: { name: string; nameLocalized?: Record<string, string> }) =>
    g.nameLocalized?.[i18n.language] ?? g.name

  const grid: GridExp[] = useMemo(() => {
    // Installed experiences first (most-recently launched first), then
    // recommended-not-installed. Phrase is featured separately, never here.
    const installed = (Object.values(games) as InstalledGame[])
      .filter((g) => g.id !== "phrase_main")
      .sort((a, b) => (b.lastLaunchedAt ?? b.installedAt) - (a.lastLaunchedAt ?? a.installedAt))
      .map<GridExp>((g) => ({
        key: g.id,
        name: localizedName(g),
        Icon: EXP_ICON[g.id] ?? Package,
        installed: true,
        onClick: () => launchGame?.(g),
      }))

    const recommended = recommend(catalog, { userClass, installedIds })
      .slice(0, 9)
      .map<GridExp>((g: CatalogGame) => ({
        key: g.id,
        name: localizedName(g),
        Icon: EXP_ICON[g.id] ?? Package,
        installed: false,
        onClick: () => void installCatalogPack(g),
      }))

    return [...installed, ...recommended]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, catalog, userClass, installedIds, i18n.language])

  return (
    <div
      className="fixed inset-0 overflow-y-auto overscroll-contain bg-background"
      style={{
        WebkitOverflowScrolling: "touch",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
      dir={dir()}
    >
      {/* Chrome */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        style={{ paddingTop: `calc(env(safe-area-inset-top) + 0.5rem)`, paddingBottom: "0.5rem" }}
      >
        <div className="flex items-center gap-2">
          <img src={corpanMark} alt="" aria-hidden="true" draggable={false} style={{ height: 26, width: "auto" }} />
          <span className="font-semibold text-foreground" style={{ letterSpacing: "0.03em" }}>Corpán</span>
        </div>
        <div className="flex items-center gap-2" style={{ marginTop: getPlatformTopPaddingButtons() - 8 }}>
          <StreakChip />
          <div className="relative">
            <Button
              variant="default"
              size="lg"
              className="h-10 w-12 rounded-md shadow-sm bg-background border border-border hover:bg-accent transition"
              aria-label="Settings"
              onClick={onSettings}
            >
              <SettingsIcon className="text-muted-foreground h-5 w-5" />
            </Button>
            {updateCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-xs font-semibold text-white">
                {updateCount}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pb-24 pt-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
        {/* Featured experience — the phrase flipper (the "brains"). */}
        <button
          type="button"
          onClick={onLaunchPhrase}
          className="group w-full overflow-hidden rounded-2xl border border-purple-400/40 bg-gradient-to-br from-purple-500/[0.14] to-purple-500/[0.03] p-5 md:p-7 text-start transition hover:border-purple-400/70 active:scale-[0.995]"
        >
          <div className="flex items-center gap-4 md:gap-5">
            <span className="flex h-14 w-14 md:h-16 md:w-16 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15">
              <Brain className="h-7 w-7 md:h-8 md:w-8 text-purple-400" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xl md:text-2xl font-bold text-foreground">{PHRASE_NAME}</div>
              <div className="text-sm md:text-base text-muted-foreground">{t("home.phraseFlipDesc")}</div>
            </div>
            <ArrowRight className="h-6 w-6 shrink-0 text-purple-400 transition group-hover:translate-x-0.5 rtl:rotate-180" />
          </div>
        </button>

        {/* Experiences grid — peers, width-filling on iPad/desktop. */}
        {grid.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("home.experiences")}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {grid.map((e) => (
                <button
                  key={e.key}
                  type="button"
                  onClick={e.onClick}
                  className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 text-start transition hover:border-purple-400/50 hover:bg-accent/30 active:scale-[0.98]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10">
                    <e.Icon className="h-5 w-5 text-purple-400" />
                  </span>
                  <span className="line-clamp-2 min-h-[2.5rem] w-full text-sm font-semibold text-foreground">
                    {e.name}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                    {e.installed ? (
                      <>{t("home.open")} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" /></>
                    ) : (
                      <>{t("home.get")} <Download className="h-3.5 w-3.5" /></>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Plus — monetization. Spans the grid width (not the default narrow
            card cap) so it reads as part of the page. Self-hides when
            subscribed / on free tier. */}
        <section className="mt-8">
          <SubscriptionOffer wrapperClassName="w-full" />
        </section>
      </main>
    </div>
  )
}

export type { InstalledGame }
