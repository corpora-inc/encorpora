// src/components/tour/OnboardingTour.tsx
//
// A gentle, skippable guided tour shown once right after onboarding (reached
// via the `{kind:"tour"}` landing intent). It introduces the top-ranked
// experiences one at a time — "what it is" + Try it / Maybe later — so a new
// user isn't dumped on Home not knowing what Earthgate / Parlometron / etc.
// are. "Try it" launches (built-in / installed) or gets (catalog) the pack and
// ends the tour; the last card / Skip lands on Home. Renders through
// OnboardingShell so it matches the onboarding visual system.

import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { LucideIcon } from "lucide-react"
import {
  Brain, Mic, BookOpen, Radio, Gamepad2, PenTool, Sparkles, Citrus, Package,
  ArrowRight, Download,
} from "lucide-react"
import { useSettingsStore } from "@/store/settings"
import { useCatalogStore } from "@/store/catalog"
import { useGamesStore, type InstalledGame } from "@/store/games"
import { useInstallContext } from "@/contentPacks/InstallContext"
import { rankHomeExperiences } from "@/components/home/recommend"
import { OnboardingShell } from "@/onboarding/OnboardingShell"
import { Button } from "@/components/ui/button"
import { trackPackRecommended, trackPackKept, trackPackDiscarded } from "@/util/analytics"

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

/** How many top experiences to introduce. */
const TOUR_LEN = 5

export function OnboardingTour({
  onLaunchPhrase,
  onClose,
}: {
  onLaunchPhrase: () => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const interests = useSettingsStore((s) => s.interests)
  const userClass = useSettingsStore((s) => s.userClass)
  const ageBand = useSettingsStore((s) => s.ageBand)
  const languages = useSettingsStore((s) => s.languages)
  const catalog = useCatalogStore((s) => s.getCatalog())
  const games = useGamesStore((s) => s.games)
  const { installCatalogPack, launchGame } = useInstallContext()

  const loc = (m: Record<string, string> | undefined, fb: string | undefined) =>
    m?.[i18n.language] ?? m?.[i18n.language.split("-")[0]] ?? fb
  const tk = t as unknown as (key: string, opts?: Record<string, unknown>) => string

  const cards = useMemo(() => {
    const installedIds = new Set(Object.keys(games))
    const ranked = rankHomeExperiences(
      { interests, userClass, ageBand, userLanguages: languages },
      catalog,
      installedIds,
    ).slice(0, TOUR_LEN)
    const byId = new Map(catalog.map((g) => [g.id, g]))
    return ranked.map((meta) => {
      const cg = byId.get(meta.id)
      const installedGame = games[meta.id] as InstalledGame | undefined
      const installed = meta.id === "phrase_main" || !!installedGame
      const onClick =
        meta.id === "phrase_main"
          ? onLaunchPhrase
          : installedGame
            ? () => launchGame?.(installedGame)
            : cg
              ? () => void installCatalogPack(cg)
              : () => {}
      return {
        id: meta.id,
        name: loc(cg?.nameLocalized, cg?.name) ?? tk(meta.nameKey),
        blurb: loc(cg?.descriptionLocalized, cg?.description) ?? tk(meta.blurbKey, { defaultValue: "" }),
        imageUrl: cg?.imageUrl,
        Icon: EXP_ICON[meta.id] ?? Package,
        installed,
        onClick,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, games, interests, userClass, ageBand, i18n.language])

  const [idx, setIdx] = useState(0)
  const card = cards[idx]

  // No experiences to introduce (offline cold start) → straight to Home.
  if (!card) {
    onClose()
    return null
  }

  const tryIt = () => {
    trackPackRecommended("tour", card.id, idx)
    trackPackKept(card.id, "tour")
    card.onClick()
    onClose()
  }
  const later = () => {
    trackPackDiscarded(card.id, "tour")
    if (idx + 1 < cards.length) setIdx((i) => i + 1)
    else onClose()
  }

  const Icon = card.Icon

  return (
    <OnboardingShell
      showMark
      maxWidthClass="max-w-md"
      headerAction={
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          {t("common.skip", { defaultValue: "Skip" })}
        </button>
      }
      footer={
        <div className="flex w-full flex-col items-center gap-2">
          <Button className="w-full !h-12" onClick={tryIt}>
            {card.installed ? t("home.tryIt", { defaultValue: "Try it" }) : t("home.get", { defaultValue: "Get" })}
            {card.installed ? (
              <ArrowRight className="ml-1.5 h-4 w-4 rtl:rotate-180" />
            ) : (
              <Download className="ml-1.5 h-4 w-4" />
            )}
          </Button>
          <button
            type="button"
            onClick={later}
            className="text-sm text-muted-foreground/80 underline-offset-4 transition hover:text-foreground hover:underline"
          >
            {t("tour.maybeLater", { defaultValue: "Maybe later" })}
          </button>
        </div>
      }
    >
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("tour.progress", { defaultValue: "{{n}} of {{total}}", n: idx + 1, total: cards.length })}
      </div>
      <span className="mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-purple-500/12">
        {card.imageUrl ? (
          <img src={card.imageUrl} alt="" aria-hidden="true" draggable={false} className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-9 w-9 text-purple-400" />
        )}
      </span>
      <h1 className="text-center text-2xl font-bold text-foreground">{card.name}</h1>
      {card.blurb ? (
        <p className="mt-2 text-center text-sm text-muted-foreground">{card.blurb}</p>
      ) : null}
    </OnboardingShell>
  )
}
