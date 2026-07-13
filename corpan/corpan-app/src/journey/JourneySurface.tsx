// src/journey/JourneySurface.tsx — the full-screen surface root (feed-ux
// §1.1). Overlay SIBLING of HomeHub at z-1050: above Home, below the pack
// overlay (z-1100) so a pack anchor card stacks on the still-mounted feed.
//
// W10 wiring (App.tsx, exact):
//   const deps = buildJourneyDeps(...)            // engine+resolver+quota
//   {journeyOpen ? <ErrorBoundary onError={close}><JourneySurface
//      deps={deps} capabilityHost={capHost} speak={speakWithStackPrefsFn}
//      dir={dir()} showRomanization={stack.showRomanization}
//      dailyGoal={SESSION_SHAPES[goalIntensity].dailyGoal}
//      onLaunchPack={(packId, spec) => handleLaunchGame(gameById(packId), { activity: spec })}
//      /></ErrorBoundary> : null}
//   Exit rides `corpan:journey-exit` (dispatched here; App closes the surface).

import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { X } from "lucide-react"
import type { ActivitySpec } from "../contentPacks/activityContract"
import type { CapabilityHostApi } from "@shared/capabilities/core"
import { CelebrationLayer } from "./celebration/CelebrationLayer.tsx"
import { FeedScroller } from "./feed/FeedScroller.tsx"
import { JourneyChrome } from "./JourneyChrome.tsx"
import { PathViz } from "./path/PathViz.tsx"
import { PlacementFlow } from "./placement/PlacementFlow.tsx"
import { CapabilityPopIn } from "../components/capability/CapabilityPopIn.tsx"
import { setPopInCapabilityHost } from "../components/capability/popinBus.ts"
import type { SpeakFn } from "./exercises/types.ts"
import { displayStreak, type StreakPorts } from "./streakV2.ts"
import { useJourneyStore } from "../store/journey.ts"
import { useJourneyRuntime, type JourneyRuntime, type JourneyRuntimeDeps } from "./runtime.ts"

/** goalIntensity → session shape (feed-ux §3.7). Tunable constants, ONE place.
 *  `newPerDay` seeds the engine's intake throttle for a fresh course — an
 *  intensive learner starts able to introduce far more new items per session
 *  (the throttle still adapts to backlog and the debt-brake still zeroes it
 *  under a review debt; this only lifts the artificial starting cap). */
export const SESSION_SHAPES = {
  casual: { dailyGoal: 10, checkpointCadence: 8, newPerDay: 8 },
  daily: { dailyGoal: 20, checkpointCadence: 10, newPerDay: 12 },
  intensive: { dailyGoal: 40, checkpointCadence: 12, newPerDay: 40 },
} as const

export type GoalIntensityKey = keyof typeof SESSION_SHAPES

export const JOURNEY_EXIT_EVENT = "corpan:journey-exit"

export interface JourneySurfaceProps {
  deps: JourneyRuntimeDeps
  speak: SpeakFn
  dir?: "ltr" | "rtl"
  showRomanization?: boolean
  dailyGoal?: number
  targetLangName?: string
  unitName?: (unitId: string) => string
  capabilityHost?: CapabilityHostApi | null
  streakPorts?: StreakPorts
  onLaunchPack?: (packId: string, spec: ActivitySpec) => void
  /** Debug/test seam: observe the live runtime once the session starts. */
  onRuntimeReady?: (runtime: JourneyRuntime) => void
}

export function JourneySurface(props: JourneySurfaceProps) {
  const { t } = useTranslation()
  const { runtime, ready, needsPlacement, error } = useJourneyRuntime(props.deps)
  const [placementOpen, setPlacementOpen] = useState<boolean | null>(null)
  const [pathOpen, setPathOpen] = useState(false)
  const courseKey = props.deps.courseKey
  const meta = useJourneyStore((s) => s.byCourse[courseKey])

  // capability host for speak_echo / pop-in mounts
  useEffect(() => {
    setPopInCapabilityHost(props.capabilityHost ?? null)
    return () => setPopInCapabilityHost(null)
  }, [props.capabilityHost])

  // Freeze Home's scroller exactly like activeGame does (§1.1), and lock the
  // background from scrolling under this fixed overlay (the phantom-scrollbar
  // report) — same pattern as the paywall overlays.
  useEffect(() => {
    document.body.setAttribute("data-experience-active", "journey")
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.removeAttribute("data-experience-active")
      document.body.style.overflow = prevOverflow
    }
  }, [])

  useEffect(() => {
    if (ready && placementOpen === null) setPlacementOpen(needsPlacement)
  }, [ready, needsPlacement, placementOpen])

  useEffect(() => {
    if (ready && runtime) props.onRuntimeReady?.(runtime)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, runtime])

  const exit = useCallback(() => {
    void runtime?.endSession("quit")
    window.dispatchEvent(new CustomEvent(JOURNEY_EXIT_EVENT))
  }, [runtime])

  const snapshot = useMemo(() => {
    if (!ready || !runtime) return null
    try {
      return runtime.snapshot()
    } catch {
      return null
    }
  }, [ready, runtime])

  const unitLabel = snapshot?.position.unitId
    ? props.unitName
      ? props.unitName(snapshot.position.unitId)
      : snapshot.position.unitId
    : null

  const dailyGoal = props.dailyGoal ?? SESSION_SHAPES.daily.dailyGoal
  const cardsToday = meta?.cardsToday.count ?? 0
  const streakDays = displayStreak(courseKey, props.streakPorts)

  return (
    <div className="fixed inset-0 z-[1050] flex flex-col bg-background" dir={props.dir ?? "ltr"} data-testid="journey-surface">
      {error ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="text-lg font-semibold text-foreground">{t("journey.feed.loadError")}</div>
          <button
            type="button"
            onClick={exit}
            className="min-h-11 rounded-xl border border-border bg-card px-5 text-sm font-medium text-foreground"
          >
            {t("journey.chrome.home")}
          </button>
        </div>
      ) : !ready || !runtime ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {t("journey.feed.loading")}
        </div>
      ) : placementOpen ? (
        <PlacementFlow
          runtime={runtime}
          courseKey={courseKey}
          targetLangName={props.targetLangName ?? props.deps.ctx.targetLang}
          speak={props.speak}
          showRomanization={props.showRomanization ?? true}
          unitName={props.unitName}
          onDone={() => setPlacementOpen(false)}
          onDecline={() => {
            runtime.declinePlacement()
            setPlacementOpen(false)
          }}
        />
      ) : (
        <>
          <JourneyChrome
            courseKey={courseKey}
            unitName={unitLabel}
            progressFrac={dailyGoal > 0 ? (cardsToday % dailyGoal) / dailyGoal : 0}
            streakPorts={props.streakPorts}
            onHome={exit}
            onOpenPath={() => setPathOpen(true)}
            onRedoPlacement={() => setPlacementOpen(true)}
          />
          <div
            className="relative min-h-0 flex-1"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
          >
            <FeedScroller
              runtime={runtime}
              courseKey={courseKey}
              speak={props.speak}
              showRomanization={props.showRomanization ?? true}
              dailyGoal={dailyGoal}
              unitName={unitLabel}
              streakDays={streakDays}
              onExit={exit}
              onLaunchPack={props.onLaunchPack}
            />
          </div>
        </>
      )}
      <CelebrationLayer />
      <CapabilityPopIn />

      <AnimatePresence>
        {pathOpen && runtime ? (
          <motion.div
            className="absolute inset-0 z-[1070] flex flex-col bg-background"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            style={{ paddingTop: "max(var(--safe-top), 0.5rem)" }}
          >
            <div className="flex h-11 items-center justify-between px-3">
              <div className="text-sm font-semibold text-foreground">{t("journey.path.title")}</div>
              <button
                type="button"
                onClick={() => setPathOpen(false)}
                aria-label={t("journey.popin.close")}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div
              className="flex flex-1 justify-center overflow-y-auto px-5 py-4"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
            >
              <PathViz
                graph={runtime.graph}
                currentUnitId={snapshot?.position.unitId ?? null}
                skillState={(id) => runtime.skillState(id)}
                unitName={props.unitName}
                onReviewUnit={(unitId) => {
                  // Tap-to-review (W10/W4 fix c): enqueue the unit's seen
                  // items as replays and return to the feed. No-op taps
                  // (nothing reviewable) keep the path open.
                  if (runtime.requestUnitReview(unitId)) setPathOpen(false)
                }}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
