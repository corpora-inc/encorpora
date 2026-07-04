// src/journey/JourneyOverlay.tsx — the App-shell wrapper around
// JourneySurface (W10 item 8). Builds the PRODUCTION JourneyRuntimeDeps
// asynchronously (buildJourneyDeps — pack install/load + engine + resolver +
// quota + analytics + STT probes), then renders the surface per the
// JourneySurface.tsx header recipe. App.tsx mounts this as a full-screen
// SIBLING overlay of HomeHub in the activeGame state-machine pattern; exit
// rides `corpan:journey-exit` (dispatched by the surface; App closes us).
//
// The pack overlay (z-1100) stacks ABOVE the still-mounted surface (z-1050)
// when a pack-anchor card launches, so returning from the pack lands back on
// the feed — exactly the readers-over-Home pattern.

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ActivitySpec } from "../contentPacks/activityContract"
import { useSettingsStore } from "../store/settings"
import { speakWithStackPrefs } from "../util/speakWithStackPrefs"
import {
  JOURNEY_EXIT_EVENT,
  JourneySurface,
  SESSION_SHAPES,
  type GoalIntensityKey,
} from "./JourneySurface.tsx"
import { journeyStreakPorts, buildJourneyDeps, type BuiltJourney } from "./runtimeWiring.ts"
import type { SpeakFn } from "./exercises/types.ts"

/** The user's journey target: first stack language after the primary
 *  (languages[0] = native/UI per the SINGLE_LANGUAGE_RULE convention). A
 *  single-language stack studies its only language. */
export function journeyTargetLang(languages: string[]): string {
  return languages[1] ?? languages[0] ?? "en"
}

export function JourneyOverlay(props: {
  onLaunchPack?: (packId: string, spec: ActivitySpec) => void
}) {
  const { t } = useTranslation()
  const stackId = useSettingsStore((s) => s.activeStackId)
  const languages = useSettingsStore((s) => s.languages)
  const dir = useSettingsStore((s) => s.dir)
  const showRomanization = useSettingsStore((s) => s.showRomanization)
  const rate = useSettingsStore((s) => s.rate)
  const goalIntensity = useSettingsStore((s) => s.goalIntensity)
  const shape = SESSION_SHAPES[(goalIntensity ?? "daily") as GoalIntensityKey] ?? SESSION_SHAPES.daily

  const [built, setBuilt] = useState<BuiltJourney | null>(null)
  const [error, setError] = useState<string | null>(null)

  const targetLang = journeyTargetLang(languages)
  const nativeLang = languages[0]

  useEffect(() => {
    let cancelled = false
    buildJourneyDeps({
      stackId: stackId || "default",
      targetLang,
      ...(nativeLang && nativeLang !== targetLang ? { nativeLang } : {}),
      checkpointCadence: shape.checkpointCadence,
    })
      .then((b) => {
        if (!cancelled) setBuilt(b)
      })
      .catch((err: unknown) => {
        console.warn("[journey] deps build failed:", err)
        if (!cancelled) setError(String(err))
      })
    return () => {
      cancelled = true
    }
    // Rebuild only per overlay mount — App unmounts us on exit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exit = () => window.dispatchEvent(new CustomEvent(JOURNEY_EXIT_EVENT))

  if (error) {
    return (
      <div
        className="fixed inset-0 z-[1050] flex flex-col items-center justify-center gap-4 bg-background px-8 text-center"
        dir={dir()}
        data-testid="journey-overlay-error"
      >
        <div className="text-lg font-semibold text-foreground">{t("journey.feed.loadError")}</div>
        <button
          type="button"
          onClick={exit}
          className="min-h-11 rounded-xl border border-border bg-card px-5 text-sm font-medium text-foreground"
        >
          {t("journey.chrome.home")}
        </button>
      </div>
    )
  }

  if (!built) {
    return (
      <div
        className="fixed inset-0 z-[1050] flex items-center justify-center bg-background text-sm text-muted-foreground"
        dir={dir()}
        data-testid="journey-overlay-loading"
      >
        {t("journey.feed.loading")}
      </div>
    )
  }

  const speak: SpeakFn = (lang, text, opts) =>
    speakWithStackPrefs(lang, text, opts?.rate ?? rate)

  const base = built.targetLang.split("-")[0]
  const targetLangName = t(`languages.${built.targetLang}`, {
    defaultValue: t(`languages.${base}`, { defaultValue: built.targetLang }),
  })

  return (
    <JourneySurface
      deps={built.deps}
      capabilityHost={built.capabilityHost}
      speak={speak}
      dir={dir()}
      showRomanization={showRomanization}
      dailyGoal={shape.dailyGoal}
      targetLangName={targetLangName}
      streakPorts={journeyStreakPorts()}
      onLaunchPack={props.onLaunchPack}
    />
  )
}
