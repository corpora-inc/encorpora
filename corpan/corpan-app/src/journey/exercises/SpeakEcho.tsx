// src/journey/exercises/SpeakEcho.tsx — thin host mounting the cap-pronounce
// capability module (feed-ux §4 row 8; capability-modules.md §4.1).
//
// The capability renders the FULL parlometron surface itself — readable target
// phrase, live waveform, per-word pronunciation pills, overall %-score banner,
// "heard you say" playback. Our only jobs here are:
//   1. THEME it. cap-pronounce ships light-theme defaults and reads its colors
//      from --capPron-* custom properties (styles.css). The parlometron pack
//      maps its own --pc-* theme onto those; Journey must do the same or the
//      target renders near-black on the dark feed card (the "unreadable phrase /
//      blank box" bug). We map --capPron-* → Journey's design tokens so the
//      speak card IS parlometron-grade by construction — same per-word feedback,
//      same score, same readability.
//   2. Give the learner an unmistakable Continue after they've had a go, and let
//      them re-record as many times as they like — the cap-pronounce mic stays
//      live between attempts, so "Try again" is simply speaking again. Continue
//      settles with the best attempt (never trapped by a low score).
//
// Pre-mounts with startPaused (D7), resume() on card-active, pause() on
// scroll-away. Mic release is the capability's dispose() duty.
//
// STT three-state policy (V0.2-PLAN contract #4): whisper UNSUPPORTED specs
// never reach this renderer (the runtime swaps them to listen_type, §6.3).
// SUPPORTED but model-not-installed DOES reach here — modelPolicy
// "offer-install" makes cap-pronounce show an inline install offer; on
// decline it settles flags.sttDeclined and the runtime stops scheduling
// speak cards this session. If availability degrades mid-mount the capability
// reports flags.sttUnavailable.

import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ActivityResult as ContractResult } from "../../contentPacks/activityContract"
import type { CapabilityHandle } from "@shared/capabilities/core"
import { loadCapability } from "../capabilities/registry.ts"
import { popInCapabilityHost } from "../../components/capability/popinBus.ts"
import type { ExerciseProps } from "./types.ts"

/** Journey design tokens → cap-pronounce theme variables. Mapping the whole
 *  --capPron-* surface onto the app's oklch tokens (dark-mode aware for free —
 *  the tokens already flip) is what makes the phrase readable and the per-word
 *  pills / score banner render on-brand instead of light-theme-on-dark. */
const CAP_PRON_THEME: React.CSSProperties = {
  ["--capPron-bg" as string]: "transparent",
  ["--capPron-fg" as string]: "hsl(var(--foreground))",
  ["--capPron-muted" as string]: "hsl(var(--muted-foreground))",
  ["--capPron-card" as string]: "hsl(var(--card))",
  ["--capPron-border" as string]: "hsl(var(--border))",
  ["--capPron-accent" as string]: "hsl(var(--journey-accent, 262 80% 58%))",
  ["--capPron-accent-hover" as string]: "hsl(var(--journey-accent, 262 80% 58%))",
  ["--capPron-accent-soft" as string]: "hsl(var(--journey-accent, 262 80% 58%) / 0.16)",
  // Verdict colors read the same in light + dark; keep the parlometron palette.
  ["--capPron-good" as string]: "#16a34a",
  ["--capPron-okay" as string]: "#d97706",
  ["--capPron-bad" as string]: "#dc2626",
  // The phrase is the hero of the card — size it up from the capability default.
  ["--capPron-target-size" as string]: "clamp(1.75rem, 6vw, 2.5rem)",
}

export function SpeakEcho(props: ExerciseProps) {
  const { t } = useTranslation()
  const answer = props.items[0]
  const containerRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<CapabilityHandle | null>(null)
  const startedAt = useRef(Date.now())
  const settledRef = useRef(false)
  // Revealed once the learner has had at least one scored go — surfaces the
  // inline Continue (and the "speak again to retry" cue). Before that, the card
  // is a clean call to speak, nothing else.
  const [attempted, setAttempted] = useState(false)

  const finish = () => {
    // Settle with the best attempt so far. dispose() settles the capability's
    // one-shot result (best attempt wins) then tears down — SpeakEcho's result
    // .then() maps it into onOutcome, and the feed advances (speak_echo is a
    // button-advance card once scored). Never traps a low score.
    handleRef.current?.dispose()
    handleRef.current = null
  }

  useEffect(() => {
    const host = popInCapabilityHost()
    const container = containerRef.current
    if (!host || !container || props.mode === "review") return
    let disposed = false
    void loadCapability("cap-pronounce").then((mod) => {
      if (disposed) return
      const handle = mod.mount(container, host, {
        ...props.spec,
        activityType: "cap-pronounce",
        params: {
          text: answer.target.text,
          lang: props.spec.targetLang,
          romanization: props.showRomanization ? answer.target.romanization : undefined,
          nativeText: answer.native?.text,
          // Runtime (contract #4) mounts speak_echo even when whisper is
          // SUPPORTED but the model isn't installed — the capability shows an
          // inline install offer; decline emits flags.sttDeclined.
          modelPolicy: "offer-install",
          // A great score must DWELL, not app-advance instantly (R4): the
          // learner sees their feedback and taps Continue (or the 12-attempt
          // backstop below). User-initiated advance always wins (turbo-scroll).
          settleOnTopBand: false,
          // The learner controls when they're done via the inline Continue, so
          // the round stays open for unlimited re-records (parlometron's retry
          // loop). A generous cap only backstops a runaway; Continue is the
          // real finish.
          maxAttempts:
            typeof props.spec.params?.maxAttempts === "number"
              ? props.spec.params.maxAttempts
              : 12,
          startPaused: true,
          // Reveal our Continue the moment a real attempt lands (silent
          // no-speech attempts don't count — nothing was said yet).
          onAttempt: (v: { overall: number; band: "top" | "mid" | "low"; silent: boolean }) => {
            if (!v.silent) setAttempted(true)
          },
        },
      })
      handleRef.current = handle
      if (props.active) handle.resume()
      void handle.result.then((result: ContractResult) => {
        if (settledRef.current || disposed) return
        settledRef.current = true
        const overall = result.detail?.stt?.overallScore ?? result.score
        props.onOutcome({
          correct: overall,
          perItem: result.perItem.length > 0 ? result.perItem : undefined,
          latencyMs: Date.now() - startedAt.current,
          detail: result.detail,
        })
      })
    })
    return () => {
      disposed = true
      handleRef.current?.dispose() // MUST release audio at teardown (iOS mic rule)
      handleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.cardId, props.mode])

  useEffect(() => {
    if (props.active) handleRef.current?.resume()
    else handleRef.current?.pause()
  }, [props.active])

  if (props.mode === "review") {
    return (
      <div className="flex w-full flex-col items-center gap-4">
        <div lang={props.spec.targetLang} className="text-2xl font-semibold text-foreground">
          {answer.target.text}
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {/* The cap-pronounce surface: readable target phrase, live waveform,
          per-word pills + overall %-score, "heard you say" playback — the full
          parlometron feedback, themed to Journey. `.capPron-flow` roots it in
          normal document flow so the root grows with its content (a long phrase
          + full pill rows never clip); min-height keeps a stable card. */}
      <div
        ref={containerRef}
        style={CAP_PRON_THEME}
        className="capPron-flow relative w-full rounded-lg border border-border/60 bg-card/40"
        data-testid="journey-speak-echo"
      />
      {/* After a real attempt: an unmistakable Continue (speak again to retry —
          the mic above stays live). A low score never traps the learner; this
          button always moves them on. Squared-off, on-brand, matches the
          intro_echo / flip_recall Continue affordance. */}
      {attempted ? (
        <div className="flex w-full flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={finish}
            data-testid="journey-speak-continue"
            className="min-h-12 w-full max-w-sm rounded-xl bg-[hsl(var(--journey-accent,262_80%_58%))] text-base font-semibold text-white"
          >
            {t("journey.exercise.continue")}
          </button>
          {/* The mic above stays live — speaking again simply re-scores, no
              extra affordance needed. Reuse the existing "Try again" string as
              the quiet cue (no new locale key → the i18n gate stays green). */}
          <span className="text-xs text-muted-foreground">
            {t("journey.exercise.retry")}
          </span>
        </div>
      ) : null}
    </div>
  )
}
