// src/journey/exercises/ChoicePick.tsx — the MC workhorse (feed-ux §4 row 1).
// direction is a PARAM (toNative | toTarget | targetOnly), never a type.
// Face resolution lives in faces.ts (contract #2/#3): the prompt and the
// option tiles are NEVER the same language for a translation card; a missing
// native face degrades to a listening form, never target-vs-target.

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { isRTL } from "../../util/convert"
import { cardRng } from "../content/rng.ts"
import { choiceAnswerText, choicePickFaces, type Direction } from "./faces.ts"
import { AnswerTiles, type Tile } from "./common/AnswerTiles.tsx"
import { AudioButton } from "./common/AudioButton.tsx"
import { ScaffoldHint } from "./common/ScaffoldHint.tsx"
import { TargetText } from "./common/TargetText.tsx"
import type { ExerciseProps } from "./types.ts"

export const ANSWER_TILE_ID = "answer"

const directionOf = (props: ExerciseProps): Direction =>
  props.spec.params?.direction === "toNative"
    ? "toNative"
    : props.spec.params?.direction === "targetOnly"
      ? "targetOnly"
      : "toTarget"

export function buildChoiceTiles(props: ExerciseProps): Tile[] {
  const answer = props.items[0]
  const faces = choicePickFaces(answer, directionOf(props), props.spec.targetLang, props.spec.nativeLang)
  const answerText = choiceAnswerText(answer, faces)
  const tiles: Tile[] = (props.distractors?.distractors ?? []).map((d, i) => ({
    id: `d${i}`,
    text: d.text,
  }))
  const insertAt = Math.floor(cardRng(props.cardId)() * (tiles.length + 1))
  tiles.splice(insertAt, 0, { id: ANSWER_TILE_ID, text: answerText })
  return tiles
}

export function ChoicePick(props: ExerciseProps) {
  const { t } = useTranslation()
  const answer = props.items[0]
  const faces = useMemo(
    () => choicePickFaces(answer, directionOf(props), props.spec.targetLang, props.spec.nativeLang),
    [answer, props.spec.targetLang, props.spec.nativeLang, props.spec.params?.direction],
  )
  const startedAt = useRef(Date.now())
  const [picked, setPicked] = useState<string | null>(null)
  const [eliminated, setEliminated] = useState<string[]>([])
  const playedRef = useRef(false)

  const tiles = useMemo(() => buildChoiceTiles(props), [props.cardId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listening form: hear the target once on arrival (never on pre-mount).
  useEffect(() => {
    if (faces.promptMode === "audio" && props.active && props.mode !== "review" && !playedRef.current) {
      playedRef.current = true
      void props.speak(props.spec.targetLang, answer.target.ttsText)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.active, faces.promptMode])

  const disabled = props.mode === "review" || picked === ANSWER_TILE_ID

  const useScaffold = () => {
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
      <div className="text-sm text-muted-foreground">
        {faces.promptMode === "audio"
          ? t("journey.exercise.pickWhatYouHear")
          : t("journey.exercise.pickTranslation")}
      </div>
      {faces.promptMode === "audio" ? (
        <AudioButton speak={props.speak} lang={props.spec.targetLang} text={answer.target.ttsText} size="lg" />
      ) : faces.promptLang === props.spec.targetLang ? (
        <TargetText item={answer} lang={props.spec.targetLang} showRomanization={props.showRomanization} />
      ) : (
        <div
          lang={faces.promptLang}
          dir={isRTL(faces.promptLang) ? "rtl" : "ltr"}
          className="text-3xl font-semibold text-foreground"
          data-testid="journey-prompt-text"
        >
          {faces.promptText}
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
        lang={faces.optionLang}
        disabled={disabled}
        onPick={pick}
      />
      {props.mode === "live" && props.scaffold.misses === 1 && !props.scaffold.hintUsed ? (
        <ScaffoldHint used={false} onUse={useScaffold} />
      ) : null}
    </div>
  )
}
