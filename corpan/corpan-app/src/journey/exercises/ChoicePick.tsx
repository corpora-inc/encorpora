// src/journey/exercises/ChoicePick.tsx — the MC workhorse (feed-ux §4 row 1).
// direction is a PARAM (toNative | toTarget | targetOnly), never a type.
// Distractor sets arrive pre-sampled + presentation-ordered from the W5
// sampler; the renderer only inserts the answer at a seeded position.

import { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { isRTL } from "../../util/convert"
import { cardRng } from "../content/rng.ts"
import { AnswerTiles, type Tile } from "./common/AnswerTiles.tsx"
import { ScaffoldHint } from "./common/ScaffoldHint.tsx"
import { TargetText } from "./common/TargetText.tsx"
import type { ExerciseProps } from "./types.ts"

export const ANSWER_TILE_ID = "answer"

export function buildChoiceTiles(props: ExerciseProps): Tile[] {
  const answer = props.items[0]
  const direction = props.spec.params?.direction === "toNative" ? "toNative" : "toTarget"
  const answerText =
    direction === "toNative" ? (answer.native?.text ?? answer.target.text) : answer.target.text
  const tiles: Tile[] = (props.distractors?.distractors ?? []).map((d, i) => ({
    id: `d${i}`,
    text: d.mode === "item" ? d.text : d.text,
  }))
  const insertAt = Math.floor(cardRng(props.cardId)() * (tiles.length + 1))
  tiles.splice(insertAt, 0, { id: ANSWER_TILE_ID, text: answerText })
  return tiles
}

export function ChoicePick(props: ExerciseProps) {
  const { t } = useTranslation()
  const answer = props.items[0]
  const direction = props.spec.params?.direction === "toNative" ? "toNative" : "toTarget"
  const answerLang =
    direction === "toNative" ? (props.spec.nativeLang ?? props.spec.targetLang) : props.spec.targetLang
  const promptItem = answer
  const startedAt = useRef(Date.now())
  const [picked, setPicked] = useState<string | null>(null)
  const [eliminated, setEliminated] = useState<string[]>([])

  const tiles = useMemo(() => buildChoiceTiles(props), [props.cardId]) // eslint-disable-line react-hooks/exhaustive-deps

  const disabled = props.mode === "review" || picked === ANSWER_TILE_ID

  const useScaffold = () => {
    // eliminate the worst-fit distractor (sampler's eliminationOrder head)
    const order = props.distractors?.eliminationOrder ?? []
    const next = order.find((i) => !eliminated.includes(`d${i}`))
    if (next !== undefined) {
      setEliminated((e) => [...e, `d${next}`])
      props.onHintUsed()
    }
  }

  const pick = (id: string) => {
    if (disabled) return
    setPicked(id)
    props.onOutcome({
      correct: id === ANSWER_TILE_ID,
      latencyMs: Date.now() - startedAt.current,
    })
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="text-sm text-muted-foreground">{t("journey.exercise.pickTranslation")}</div>
      {direction === "toNative" ? (
        <TargetText item={promptItem} lang={props.spec.targetLang} showRomanization={props.showRomanization} />
      ) : (
        <div
          lang={props.spec.nativeLang}
          dir={props.spec.nativeLang && isRTL(props.spec.nativeLang) ? "rtl" : "ltr"}
          className="text-3xl font-semibold text-foreground"
          data-testid="journey-prompt-text"
        >
          {promptItem.native?.text ?? promptItem.target.text}
        </div>
      )}
      <AnswerTiles
        tiles={tiles.map((tile) => ({
          ...tile,
          eliminated: eliminated.includes(tile.id),
          state:
            props.mode === "review" || picked
              ? tile.id === ANSWER_TILE_ID
                ? "correct"
                : tile.id === picked
                  ? "wrong"
                  : null
              : null,
        }))}
        lang={answerLang}
        disabled={disabled}
        onPick={pick}
      />
      {props.mode === "live" && props.scaffold.misses === 1 && !props.scaffold.hintUsed ? (
        <ScaffoldHint used={false} onUse={useScaffold} />
      ) : null}
    </div>
  )
}
