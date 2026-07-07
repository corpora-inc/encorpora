// src/journey/placement/PlacementFlow.tsx — UX shell over the engine's
// 3-phase probe (feed-ux §1.9). Hard budget: ≤3 framing screens, ≤25 items.
// Offer → probe loop → result (incl. R10 above-content) → streak pact card.
// Abandoning mid-probe stores nothing; declining twice sets
// placementDeclined ("place me" stays available in the overflow menu).

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { setStreakEnabled } from "../../components/StreakChip"
import type { ActivityResult } from "../../contentPacks/activityContract"
import type { EngineCard, PlacementController, PlacementOutcome } from "../engine/index.ts"
import { celebrate } from "../celebration/CelebrationLayer.tsx"
import type { SpeakFn } from "../exercises/types.ts"
import { useJourneyStore, type CourseKey } from "../../store/journey.ts"
import type { FeedCard } from "../types.ts"
import type { JourneyRuntime } from "../runtime.ts"
import { PlacementCard } from "./PlacementCard.tsx"
import { PlacementResult } from "./PlacementResult.tsx"

type Phase =
  | { kind: "offer" }
  | { kind: "probe"; card: Extract<FeedCard, { kind: "exercise" }>; asked: number }
  | { kind: "result"; outcome: PlacementOutcome }
  | { kind: "pact" }

/** The CEFR band of the arc a start unit lives in — a concrete "where" for
 *  the result screen, derived from the graph (no engine-type change needed). */
function arcLabelFor(runtime: JourneyRuntime, startUnitId: string): string | null {
  const unit = runtime.graph.units.find((u) => u.unitId === startUnitId)
  if (!unit) return null
  return runtime.graph.arcs.find((a) => a.arcId === unit.arcId)?.cefr ?? null
}

export function PlacementFlow(props: {
  runtime: JourneyRuntime
  courseKey: CourseKey
  targetLangName: string
  speak: SpeakFn
  showRomanization: boolean
  unitName?: (unitId: string) => string
  onDone: () => void
  onDecline: () => void
}) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>({ kind: "offer" })
  const controllerRef = useRef<PlacementController | null>(null)
  const askedRef = useRef(0)
  const pactAnswered = useJourneyStore((s) => s.streakPactAnswered)
  const setPactAnswered = useJourneyStore((s) => s.setStreakPactAnswered)

  const showCard = useCallback(
    async (ec: EngineCard | undefined) => {
      const controller = controllerRef.current
      if (!controller) return
      while (ec) {
        const card = await props.runtime.prepareEngineCard(ec)
        if (card && card.kind === "exercise") {
          setPhase({ kind: "probe", card, asked: askedRef.current })
          return
        }
        // unpreparable probe (missing content) — skip to the next one
        controller.submit({ specId: ec.spec.specId, score: 0, perItem: [], durationMs: 0, abandoned: true })
        ec = controller.next()
      }
      finishProbes()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.runtime],
  )

  const finishProbes = useCallback(() => {
    const controller = controllerRef.current
    if (!controller) return
    const outcome = controller.finalize()
    controllerRef.current = null
    props.runtime.finishPlacement(outcome)
    void celebrate({ tier: 2, milestone: "placementDone" })
    setPhase({ kind: "result", outcome })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.runtime])

  const startProbe = useCallback(() => {
    const controller = props.runtime.startPlacement("probe")
    controllerRef.current = controller
    askedRef.current = 0
    void showCard(controller.next())
  }, [props.runtime, showCard])

  const startAsNew = useCallback(() => {
    const controller = props.runtime.startPlacement("zero-beginner")
    controllerRef.current = controller
    finishProbes()
  }, [props.runtime, finishProbes])

  const onProbeResult = useCallback(
    (r: ActivityResult) => {
      const controller = controllerRef.current
      if (!controller) return
      controller.submit(r)
      askedRef.current += 1
      const next = controller.next()
      if (next) void showCard(next)
      else finishProbes()
    },
    [showCard, finishProbes],
  )

  // Abandoning mid-probe stores nothing (unmount → abort).
  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [])

  const afterResult = () => {
    if (pactAnswered) props.onDone()
    else setPhase({ kind: "pact" })
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-5" data-testid="journey-placement">
      {phase.kind === "offer" ? (
        <div className="flex w-full max-w-[26rem] flex-col items-center gap-5 text-center">
          <div className="text-2xl font-bold text-foreground">{t("journey.placement.offerTitle")}</div>
          <div className="text-base text-muted-foreground">{t("journey.placement.offerBody")}</div>
          <div className="flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={startAsNew}
              data-testid="journey-placement-new"
              className="min-h-12 w-full rounded-xl border border-border bg-card text-base font-semibold text-foreground hover:bg-muted"
            >
              {t("journey.placement.startNew", { lang: props.targetLangName })}
            </button>
            <button
              type="button"
              onClick={startProbe}
              data-testid="journey-placement-placeme"
              className="min-h-12 w-full rounded-xl border border-border bg-card text-base font-semibold text-foreground hover:bg-muted"
            >
              {t("journey.placement.placeMe", { lang: props.targetLangName })}
            </button>
          </div>
          <button
            type="button"
            onClick={props.onDecline}
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            {t("journey.exercise.skipHint")}
          </button>
        </div>
      ) : phase.kind === "probe" ? (
        <PlacementCard
          card={phase.card}
          asked={phase.asked}
          speak={props.speak}
          showRomanization={props.showRomanization}
          onResult={onProbeResult}
        />
      ) : phase.kind === "result" ? (
        <PlacementResult
          outcome={phase.outcome}
          unitName={props.unitName}
          arcLabel={arcLabelFor(props.runtime, phase.outcome.startUnitId)}
          onContinue={afterResult}
        />
      ) : (
        <div className="flex w-full max-w-[26rem] flex-col items-center gap-5 text-center" data-testid="journey-pact">
          <div className="text-2xl font-bold text-foreground">{t("journey.streak.pactTitle")}</div>
          <div className="text-base text-muted-foreground">{t("journey.streak.pactBody")}</div>
          <div className="flex w-full gap-3">
            <button
              type="button"
              data-testid="journey-pact-decline"
              onClick={() => {
                setPactAnswered(true)
                props.onDone()
              }}
              className="min-h-12 flex-1 rounded-xl border border-border bg-card text-base font-semibold text-foreground hover:bg-muted"
            >
              {t("journey.streak.pactDecline")}
            </button>
            <button
              type="button"
              data-testid="journey-pact-accept"
              onClick={() => {
                setStreakEnabled(true)
                setPactAnswered(true)
                props.onDone()
              }}
              className="min-h-12 flex-1 rounded-xl border border-border bg-card text-base font-semibold text-foreground hover:bg-muted"
            >
              {t("journey.streak.pactAccept")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
