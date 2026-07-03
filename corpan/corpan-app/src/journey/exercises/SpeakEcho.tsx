// src/journey/exercises/SpeakEcho.tsx — thin host mounting the cap-pronounce
// capability module (feed-ux §4 row 8; capability-modules.md §4.1).
//
// Pre-mounts with startPaused (D7), resume() on card-active, pause() on
// scroll-away, and maps the capability's settled ActivityResult into the
// renderer contract with the R3 stt envelope. Grading floors (never below
// Hard when overallScore ≥ 0.45) are ENGINE rules — the raw evidence passes
// through untouched. Mic release is the capability's dispose() duty.
//
// STT-unavailable specs never reach this renderer in the feed (the runtime
// swaps them to listen_type, §6.3); if availability degrades mid-mount the
// capability itself reports flags.sttUnavailable.

import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import type { ActivityResult as ContractResult } from "../../contentPacks/activityContract"
import type { CapabilityHandle } from "@shared/capabilities/core"
import { loadCapability } from "../capabilities/registry.ts"
import { popInCapabilityHost } from "../popin/popinBus.ts"
import type { ExerciseProps } from "./types.ts"

export function SpeakEcho(props: ExerciseProps) {
  const { t } = useTranslation()
  const answer = props.items[0]
  const containerRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<CapabilityHandle | null>(null)
  const startedAt = useRef(Date.now())
  const settledRef = useRef(false)

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
          modelPolicy: "installed-only",
          maxAttempts:
            typeof props.spec.params?.maxAttempts === "number" ? props.spec.params.maxAttempts : 2,
          startPaused: true,
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

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="text-sm text-muted-foreground">{t("journey.exercise.speakNow")}</div>
      {props.mode === "review" ? (
        <div lang={props.spec.targetLang} className="text-2xl font-semibold text-foreground">
          {answer.target.text}
        </div>
      ) : (
        <div ref={containerRef} className="min-h-56 w-full" data-testid="journey-speak-echo" />
      )}
    </div>
  )
}
