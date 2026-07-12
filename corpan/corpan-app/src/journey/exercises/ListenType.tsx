// src/journey/exercises/ListenType.tsx — dictation (feed-ux §4 row 3).
// Compare via the per-language normalizer (normalize.ts — ONE normalizer,
// shared with the distractor sampler). Keyboard is the floor.

import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { normalizedEquals } from "../content/normalize.ts"
import { tokenizePhrase } from "../../util/wordTokens"
import { AudioButton } from "./common/AudioButton.tsx"
import { ReservedSlot } from "./common/ReservedSlot.tsx"
import { ScaffoldHint } from "./common/ScaffoldHint.tsx"
import { TypeInput } from "./common/TypeInput.tsx"
import type { ExerciseProps } from "./types.ts"

export function ListenType(props: ExerciseProps) {
  const { t } = useTranslation()
  const answer = props.items[0]
  const startedAt = useRef(Date.now())
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const playedRef = useRef(false)

  useEffect(() => {
    if (props.active && props.mode !== "review" && !playedRef.current) {
      playedRef.current = true
      startedAt.current = Date.now()
      void props.speak(props.spec.targetLang, answer.target.ttsText)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.active])

  const submit = (typed: string) => {
    if (done) return
    const ok = normalizedEquals(typed, answer.target.text, props.spec.targetLang)
    if (ok) setDone(true)
    props.onOutcome({ correct: ok, latencyMs: Date.now() - startedAt.current })
  }

  const revealFirstWord = () => {
    const words = tokenizePhrase(answer.target.text, props.spec.targetLang)
      .filter((w) => w.isWord)
      .map((w) => w.text)
    setHint(words[0] ?? answer.target.text.slice(0, 1))
    props.onHintUsed()
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="text-sm text-muted-foreground">{t("journey.exercise.typeWhatYouHear")}</div>
      <AudioButton speak={props.speak} lang={props.spec.targetLang} text={answer.target.ttsText} size="lg" />
      {/* No-reflow: a reserved line for the answer reveal — present (empty) from
          mount, filled in place once solved so the input never shifts. */}
      <ReservedSlot minH="min-h-8">
        {props.mode === "review" || done ? (
          <div lang={props.spec.targetLang} className="text-xl font-semibold text-foreground">
            {answer.target.text}
          </div>
        ) : null}
      </ReservedSlot>
      <TypeInput
        lang={props.spec.targetLang}
        disabled={done || props.mode === "review"}
        hint={hint}
        onSubmit={submit}
      />
      {/* No-reflow: reserved hint slot held from mount (see ReservedSlot). */}
      {props.mode === "live" ? (
        <ReservedSlot minH="min-h-9">
          {props.scaffold.misses === 1 && !props.scaffold.hintUsed ? (
            <ScaffoldHint used={false} onUse={revealFirstWord} />
          ) : null}
        </ReservedSlot>
      ) : null}
    </div>
  )
}
