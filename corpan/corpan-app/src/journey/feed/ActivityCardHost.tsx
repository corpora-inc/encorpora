// src/journey/feed/ActivityCardHost.tsx — ActivitySpec → native renderer
// resolution + result plumbing (feed-ux §1.4). Owns the per-card lifecycle:
// retry state machine (§3.3), ActivityResult assembly (renderers report raw
// outcome + latency; host adds specId/durationMs/hintsUsed), CelebrationLayer
// trigger, then arms advance.

import { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type {
  ActivityItemResult,
  ActivityResult,
} from "../../contentPacks/activityContract"
import { celebrate } from "../celebration/CelebrationLayer.tsx"
import { playSoftMiss } from "../celebration/sounds.ts"
import { rendererFor } from "../exercises/index.ts"
import type { ExerciseMode, SpeakFn } from "../exercises/types.ts"
import { ResultStamp } from "../exercises/common/ResultStamp.tsx"
import { celebrationFor, settleOk, settleStamp } from "./settle.ts"
import type { FeedCard, RawOutcome, ScaffoldState } from "../types.ts"

const FAST_MS = 6000

export function ActivityCardHost(props: {
  card: Extract<FeedCard, { kind: "exercise" }>
  mode: ExerciseMode
  combo: number
  speak: SpeakFn
  showRomanization: boolean
  active: boolean
  onResult: (r: ActivityResult) => void
  onRequestAdvance: () => void
}) {
  const { t } = useTranslation()
  const { card } = props
  const prepared = card.prepared
  const startedAt = useRef(Date.now())
  const [scaffold, setScaffold] = useState<ScaffoldState>({ misses: 0, hintUsed: false })
  const [stamp, setStamp] = useState<"correct" | "incorrect" | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [settledOk, setSettledOk] = useState<boolean | null>(null)
  const doneRef = useRef(false)
  const hintsRef = useRef(0)

  // sttFallback renders the listen_type equivalent (§6.3) — the spec's
  // activityType was already swapped by the runtime mapping.
  const Renderer = rendererFor(prepared.spec.activityType)

  const settle = (outcome: RawOutcome, attempt: "first" | "retry" | "failed") => {
    if (doneRef.current) return
    doneRef.current = true
    const fraction =
      typeof outcome.correct === "number" ? outcome.correct : outcome.correct ? 1 : 0
    const itemOutcome =
      attempt === "failed" ? "fail" : attempt === "retry" || fraction < 1 ? "partial" : "pass"
    const perItem: ActivityItemResult[] =
      outcome.perItem ??
      prepared.items.map((i) => {
        const r: ActivityItemResult = {
          itemRef: i.ref,
          outcome: prepared.items.length > 1 ? itemOutcome : itemOutcome,
          latencyMs: outcome.latencyMs,
        }
        if (hintsRef.current > 0) r.hintsUsed = hintsRef.current
        if (outcome.detail) r.detail = outcome.detail
        return r
      })
    const score = attempt === "failed" ? 0 : attempt === "retry" ? Math.min(fraction, 0.7) : fraction
    const result: ActivityResult = {
      specId: prepared.spec.specId,
      score,
      perItem,
      durationMs: Date.now() - startedAt.current,
    }
    if (outcome.detail) result.detail = outcome.detail
    // Unscored cards (engine meta.unscored — debut intros) settle NEUTRALLY:
    // no correct/incorrect stamp, no "correcto". Acknowledging mere exposure
    // as a graded win is dishonest juice (W3). The Continue press just advances.
    const unscored = prepared.engine.meta.unscored === true
    const ok = settleOk(attempt, fraction)
    setSettledOk(ok)
    setStamp(settleStamp({ attempt, fraction, unscored }))
    props.onResult(result)
    if (props.mode === "live") {
      const deco = celebrationFor({
        attempt,
        fraction,
        unscored,
        fast: outcome.latencyMs <= FAST_MS,
        hintsUsed: hintsRef.current,
        combo: props.combo,
      })
      if (deco) void celebrate(deco)
      props.onRequestAdvance()
    }
  }

  const isMultiItem = prepared.items.length > 1 && prepared.spec.activityType === "match_pairs"

  const onOutcome = (outcome: RawOutcome) => {
    if (doneRef.current) return
    if (props.mode === "probe") {
      // placement probes: no hints, no retry, tier-0 stamp only (§1.9)
      settle(outcome, typeof outcome.correct === "boolean" && !outcome.correct ? "failed" : "first")
      return
    }
    const passed =
      typeof outcome.correct === "number" ? outcome.correct >= 0.6 : outcome.correct === true
    if (passed || isMultiItem) {
      settle(outcome, scaffold.misses === 0 ? "first" : "retry")
      return
    }
    // a miss
    if (scaffold.misses >= 1) {
      // second miss: show the answer plainly, speak it once, complete as fail
      // (§3.3 step 2).
      setScaffold((s) => ({ ...s, misses: 2 }))
      setShowAnswer(true)
      void props.speak(prepared.spec.targetLang, prepared.items[0].target.ttsText)
      settle(outcome, "failed")
      return
    }
    playSoftMiss()
    setStamp("incorrect")
    setTimeout(() => setStamp(null), 1200)
    setScaffold((s) => ({ ...s, misses: 1 }))
  }

  const scaffoldForChild: ScaffoldState = useMemo(
    () => ({ misses: props.mode === "live" ? scaffold.misses : 0, hintUsed: scaffold.hintUsed }),
    [scaffold, props.mode],
  )

  if (!Renderer) {
    // Unknown type — should have been dropped pre-mount; render nothing loud.
    console.warn("[journey] no renderer for", prepared.spec.activityType)
    return null
  }

  return (
    <div className="flex w-full flex-col items-center gap-4" data-testid={`journey-card-${prepared.spec.activityType}`}>
      <Renderer
        cardId={card.cardId}
        spec={prepared.spec}
        items={prepared.items}
        distractors={prepared.distractors}
        mode={props.mode}
        scaffold={scaffoldForChild}
        onOutcome={onOutcome}
        onHintUsed={() => {
          hintsRef.current += 1
          setScaffold((s) => ({ ...s, hintUsed: true }))
        }}
        speak={props.speak}
        showRomanization={props.showRomanization}
        active={props.active}
        review={props.mode === "review" ? { correct: settledOk ?? true } : null}
      />
      <div className="min-h-8">
        <ResultStamp state={stamp} />
      </div>
      {showAnswer ? (
        <div className="flex w-full flex-col items-center gap-1 rounded-xl bg-muted px-4 py-3 text-center">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("journey.exercise.answerWas")}
          </div>
          <div lang={prepared.spec.targetLang} className="text-lg font-semibold text-foreground">
            {prepared.items[0].target.text}
          </div>
          <div className="text-sm text-muted-foreground">{t("journey.exercise.comeBackNote")}</div>
        </div>
      ) : null}
    </div>
  )
}
