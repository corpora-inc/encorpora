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
import { endUtterance, waitForActiveUtterance } from "../../util/audioManager.ts"
import { rendererFor } from "../exercises/index.ts"
import type { ExerciseMode, SpeakFn } from "../exercises/types.ts"
import { ResultStamp } from "../exercises/common/ResultStamp.tsx"
import { WordEnrichment } from "../cards/WordEnrichment.tsx"
import { celebrationFor, isSingleShotSettle, settleOk, settleStamp, singleShotAttempt } from "./settle.ts"
import type { FeedCard, RawOutcome, ScaffoldState } from "../types.ts"

const FAST_MS = 6000

// Explicit-completion cards (advanceRules.ts "button" rule): the learner's
// Continue press IS the advance request — contract #6(a) ("that press
// advances immediately in every mode", the historical "Continuar does
// nothing" bug). Treat it exactly like a user-initiated swipe: request the
// advance immediately, no waitForActiveUtterance() gate. FeedScroller's
// requestAdvance mirrors this by calling doAdvance({ userInitiated: true })
// for the same set of activity types. Keep this list in sync with
// advanceRules.ts's `button` cases.
const EXPLICIT_ADVANCE_TYPES = new Set(["speak_echo", "intro_echo", "flip_recall"])

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
  // Whisper accuracy 0..100 for a spoken settle — surfaced beside the stamp as a
  // quick confidence read (vibes). Null for tap/type cards.
  const [confidence, setConfidence] = useState<number | null>(null)
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
    // A spoken settle carries a Whisper accuracy in the stt envelope — surface
    // it as a 0..100 confidence read beside the stamp (only for scored speech).
    const sttScore = outcome.detail?.stt?.overallScore
    setConfidence(
      !unscored && prepared.spec.activityType === "speak_echo" && typeof sttScore === "number"
        ? Math.round(sttScore * 100)
        : null,
    )
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
      if (deco) {
        // Clear stale utterance tracking before the chime check. sounds.ts's
        // ttsSpeaking() gate (wave-1 audio manager) drops the celebration
        // chime whenever isUtteranceActive() reads true — but that flag is an
        // ESTIMATE (word-count based, no true onend on native TTS; see
        // audioManager.ts), so it can outlive the card's own mount-autoplay
        // prompt (choice_pick toNative/audio-fallback, listen_pick, image/
        // glyph modes all autoplay on arrival) by seconds. A learner who
        // answers correctly while that stale estimate is still "active" got a
        // visual splash but NO chime — read as "no celebration" on a device.
        // The prompt has already served its purpose the instant the learner
        // commits an answer, so it can never legitimately gate THIS card's
        // reward chime; clearing it here is a no-op for genuinely-relevant
        // audio, since the reward speak() below registers its own fresh
        // utterance right after.
        endUtterance()
        void celebrate(deco)
      }
      // Tune the ears on EVERY exercise: on a scored pass, speak the target
      // aloud as the reward + reinforcement — the learner hears what they just
      // got right (word-order, cloze, choice, etc. all gain this in one place,
      // not per-card). speak_echo owns the mic + its own audio, so skip it; an
      // unscored debut already auto-played on arrival.
      if (ok && !unscored && prepared.spec.activityType !== "speak_echo") {
        void props.speak(prepared.spec.targetLang, prepared.items[0].target.ttsText)
      }
      if (EXPLICIT_ADVANCE_TYPES.has(prepared.spec.activityType)) {
        // The Continue press that got us into settle() IS the user's
        // deliberate advance — turbo-scroll instant, same as a swipe. Do NOT
        // wait for any live utterance (a stale IntroEcho autoplay/replay or
        // FlipRecall reveal-speak would otherwise stall this press up to
        // ~2s, on top of another ~2s in FeedScroller's doAdvance).
        props.onRequestAdvance()
      } else {
        // APP-initiated advance: let a just-fired reward (or answer-reveal)
        // utterance actually finish — bounded — before asking the host to move
        // on. Cutting it mid-word read as the app rushing the learner off their
        // own correct answer. A no-op (instant) when nothing is playing, so
        // cards with no reward speech advance exactly as before. A USER-
        // initiated forward swipe/tap stays instant (FeedScroller's
        // onForwardGesture keeps its unconditional stopSpeech) — this only
        // guards the app-driven request-advance path.
        void waitForActiveUtterance().then(() => props.onRequestAdvance())
      }
    }
  }

  const isMultiItem = prepared.items.length > 1 && prepared.spec.activityType === "match_pairs"
  // speak_echo owns its OWN retry loop inside the cap-pronounce round, so its
  // onOutcome is a FINAL, single-shot decision — see isSingleShotSettle.
  const singleShot = isSingleShotSettle(prepared.spec.activityType)

  const onOutcome = (outcome: RawOutcome) => {
    if (doneRef.current) return
    if (props.mode === "probe") {
      // placement probes: no hints, no retry, tier-0 stamp only (§1.9)
      settle(outcome, typeof outcome.correct === "boolean" && !outcome.correct ? "failed" : "first")
      return
    }
    const passed =
      typeof outcome.correct === "number" ? outcome.correct >= 0.6 : outcome.correct === true
    if (singleShot) {
      // Best-attempt score already reflects the learner's practice; grade it
      // straight through in one shot. No scaffold retry, never trapped.
      const fraction =
        typeof outcome.correct === "number" ? outcome.correct : outcome.correct ? 1 : 0
      settle(outcome, singleShotAttempt(fraction))
      return
    }
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
      {/* Feedback row: the stamp stays centered; the word (?) hint rides the
          trailing edge of this ALREADY-reserved min-h-8 band, absolutely
          positioned so it never adds height — the exercise never reflows. The
          hint shows BEFORE and after answering (most useful during the
          exercise); it opens its explanation in a Drawer, never inline. */}
      <div className="relative flex min-h-8 w-full items-center justify-center">
        <ResultStamp state={stamp} confidence={confidence} />
        {props.mode !== "probe" && prepared.items[0]?.kind === "word" ? (
          <div className="absolute end-0 top-1/2 -translate-y-1/2">
            <WordEnrichment
              item={prepared.items[0]}
              example={prepared.example}
              targetLang={prepared.spec.targetLang}
              nativeLang={prepared.spec.nativeLang}
            />
          </div>
        ) : null}
      </div>
      {/* Answer reveal on a double-miss FAIL. No-reflow invariant (see
          exercises/common/ReservedSlot.tsx): this is a FLOATING toast pinned to
          the card frame's lower area (overlay, rule (d)) — it participates in NO
          layout flow, so the prompt + tiles stay exactly where they were when
          the learner missed (never a new panel that shoves the card up). The
          correct answer is already shown in-place by the exercise (a green tile
          / an in-place reveal); this only adds the gentle "come back" note.
          Anchors to FeedCardFrame's relative root; bottom-16 clears the feed's
          bottom affordances (chevron / skip hint). */}
      {showAnswer ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 z-10 flex justify-center px-5">
          <div className="flex max-w-full flex-col items-center gap-1 rounded-lg bg-muted/95 px-4 py-3 text-center shadow-lg backdrop-blur">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("journey.exercise.answerWas")}
            </div>
            <div lang={prepared.spec.targetLang} className="text-lg font-semibold text-foreground">
              {prepared.items[0].target.text}
            </div>
            <div className="text-sm text-muted-foreground">{t("journey.exercise.comeBackNote")}</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
