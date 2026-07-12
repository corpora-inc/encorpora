// src/journey/exercises/common/AudioButton.tsx — play / replay / slow-replay.
// Replays are free and unmetered (feed-ux §7.2). Rate is the UI's call: the TTS
// backend plays faithfully at whatever rate we ask (no reshaping curve), so
// these constants ARE the request — but the ENGINE's own response is non-linear.
// Measured on-device (Google TTS): rate 1.0→1.00× duration, 0.7→1.19× (the app's
// default auto-play), 0.5→1.36×, 0.3→1.60×, 0.1→1.86× (saturates + gets choppy).
// So the turtle asks 0.3 to land a clear ~1.6× slow-down — plainly slower than
// both the 1.0 replay and the 0.7 auto-play, without the sub-0.2 choppiness.
const NORMAL_RATE = 1
const SLOW_RATE = 0.3

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Turtle, Volume2 } from "lucide-react"
import type { SpeakFn } from "../types.ts"

export function AudioButton(props: {
  speak: SpeakFn
  lang: string
  text: string
  slow?: boolean
  size?: "md" | "lg"
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const play = async (rate: number) => {
    if (busy) return
    setBusy(true)
    try {
      await props.speak(props.lang, props.text, { rate })
    } finally {
      setBusy(false)
    }
  }
  const big = props.size === "lg"
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void play(NORMAL_RATE)}
        aria-label={t("journey.exercise.listen")}
        data-testid="journey-audio-play"
        className={[
          "flex items-center justify-center rounded-full bg-[hsl(var(--journey-accent,262_80%_58%)/0.12)] text-foreground transition-transform active:scale-95",
          big ? "h-16 w-16" : "h-11 w-11",
        ].join(" ")}
      >
        <Volume2 className={big ? "h-7 w-7" : "h-5 w-5"} />
      </button>
      {props.slow !== false && (
        <button
          type="button"
          onClick={() => void play(SLOW_RATE)}
          aria-label={t("journey.exercise.listenSlow")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
        >
          <Turtle className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
