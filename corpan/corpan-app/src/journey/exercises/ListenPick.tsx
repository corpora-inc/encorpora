// src/journey/exercises/ListenPick.tsx — hear it, pick what you heard
// (feed-ux §4 row 2). Audio auto-plays once on ARRIVAL (never on pre-mount);
// replay + 0.7× replay free.

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { cardRng } from "../content/rng.ts"
import { AnswerTiles, type Tile } from "./common/AnswerTiles.tsx"
import { AudioButton } from "./common/AudioButton.tsx"
import { ScaffoldHint } from "./common/ScaffoldHint.tsx"
import type { ExerciseProps } from "./types.ts"

const ANSWER_ID = "answer"

export function ListenPick(props: ExerciseProps) {
  const { t } = useTranslation()
  const answer = props.items[0]
  const startedAt = useRef(Date.now())
  const [picked, setPicked] = useState<string | null>(null)
  const [eliminated, setEliminated] = useState<string[]>([])
  const playedRef = useRef(false)
  const hideText = props.spec.params?.hideTextUntilAnswer !== false

  const tiles = useMemo(() => {
    const out: Tile[] = (props.distractors?.distractors ?? []).map((d, i) => ({
      id: `d${i}`,
      text: d.mode === "item" ? d.text : d.text,
    }))
    const insertAt = Math.floor(cardRng(props.cardId)() * (out.length + 1))
    out.splice(insertAt, 0, { id: ANSWER_ID, text: answer.target.text })
    return out
  }, [props.cardId]) // eslint-disable-line react-hooks/exhaustive-deps

  // auto-play once when the card becomes current (§3.1 arrive)
  useEffect(() => {
    if (props.active && props.mode !== "review" && !playedRef.current) {
      playedRef.current = true
      startedAt.current = Date.now()
      void props.speak(props.spec.targetLang, answer.target.ttsText)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.active])

  const disabled = props.mode === "review" || picked === ANSWER_ID

  const pick = (id: string) => {
    if (disabled) return
    setPicked(id)
    props.onOutcome({ correct: id === ANSWER_ID, latencyMs: Date.now() - startedAt.current })
  }

  const answered = picked !== null || props.mode === "review"

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="text-sm text-muted-foreground">{t("journey.exercise.pickWhatYouHear")}</div>
      <AudioButton speak={props.speak} lang={props.spec.targetLang} text={answer.target.ttsText} size="lg" />
      {!hideText || answered ? (
        <div lang={props.spec.targetLang} className="text-lg font-medium text-foreground">
          {answered ? answer.target.text : null}
        </div>
      ) : null}
      <AnswerTiles
        tiles={tiles.map((tile) => ({
          ...tile,
          eliminated: eliminated.includes(tile.id),
          state: answered ? (tile.id === ANSWER_ID ? "correct" : tile.id === picked ? "wrong" : null) : null,
        }))}
        lang={props.spec.targetLang}
        disabled={disabled}
        onPick={pick}
      />
      {props.mode === "live" && props.scaffold.misses === 1 && !props.scaffold.hintUsed ? (
        <ScaffoldHint
          used={false}
          onUse={() => {
            const order = props.distractors?.eliminationOrder ?? []
            const next = order.find((i) => !eliminated.includes(`d${i}`))
            if (next !== undefined) {
              setEliminated((e) => [...e, `d${next}`])
              props.onHintUsed()
            }
          }}
        />
      ) : null}
    </div>
  )
}
