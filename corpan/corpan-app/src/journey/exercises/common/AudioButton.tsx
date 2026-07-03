// src/journey/exercises/common/AudioButton.tsx — play / replay / slow-replay
// (0.7×). Replays are free and unmetered (feed-ux §7.2).

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
        onClick={() => void play(1)}
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
          onClick={() => void play(0.7)}
          aria-label={t("journey.exercise.listenSlow")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
        >
          <Turtle className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
