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
import { buildImageTiles } from "./imageChoice.ts"
import { AnswerTiles, type Tile } from "./common/AnswerTiles.tsx"
import { AudioButton } from "./common/AudioButton.tsx"
import { ScaffoldHint } from "./common/ScaffoldHint.tsx"
import { TargetText } from "./common/TargetText.tsx"
import type { ExerciseProps } from "./types.ts"

export const ANSWER_TILE_ID = "answer"

/** Picture-choice (media:'image') — a word card whose OPTIONS are pictures.
 *  L1-free: the prompt is the target word (read + heard), the learner taps the
 *  matching picture. Ships inert until the imagepan pack is installed. */
const isImageChoice = (props: ExerciseProps): boolean => props.spec.params?.media === "image"

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

  const imageMode = isImageChoice(props)
  const tiles = useMemo(() => buildChoiceTiles(props), [props.cardId]) // eslint-disable-line react-hooks/exhaustive-deps
  const imageTiles = useMemo(
    () => (imageMode ? buildImageTiles(props.spec.params, props.cardId) : []),
    [imageMode, props.cardId], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Listening form / picture-choice: hear the target once on arrival (never on
  // pre-mount). Picture-choice is hear+read → tap the matching picture.
  useEffect(() => {
    const wantsAudio = imageMode || faces.promptMode === "audio"
    if (wantsAudio && props.active && props.mode !== "review" && !playedRef.current) {
      playedRef.current = true
      void props.speak(props.spec.targetLang, answer.target.ttsText)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.active, faces.promptMode, imageMode])

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

  // ---- Picture-choice: target word prompt + a 2×2 grid of picture options.
  // Intentionally no instruction caption (word + pictures is self-evident;
  // "intuitive, not explainy") — which also means ZERO new i18n copy.
  if (imageMode && imageTiles.length > 0) {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <TargetText item={answer} lang={props.spec.targetLang} showRomanization={props.showRomanization} />
          <AudioButton speak={props.speak} lang={props.spec.targetLang} text={answer.target.ttsText} />
        </div>
        <div
          className="grid w-full max-w-md grid-cols-2 gap-2"
          role="listbox"
          data-testid="journey-image-tiles"
        >
          {imageTiles.map((tile) => {
            const state =
              props.mode === "review" || picked
                ? tile.id === ANSWER_TILE_ID
                  ? "correct"
                  : tile.id === picked
                    ? "wrong"
                    : null
                : null
            return (
              <button
                key={tile.id}
                type="button"
                disabled={disabled}
                onClick={() => pick(tile.id)}
                data-journey-tile={tile.id}
                aria-label={tile.alt}
                className={[
                  // Squared-off 8px corners (design standard), aspect-square tiles.
                  "aspect-square overflow-hidden rounded-lg border p-2 transition-all active:scale-[0.97]",
                  state === "correct"
                    ? "border-emerald-500/70 bg-emerald-500/10"
                    : state === "wrong"
                      ? "border-red-500/60 bg-red-500/10"
                      : "border-border bg-card hover:bg-muted",
                ].join(" ")}
              >
                {/* corpan-pack:// is a local scheme an <img> loads directly. */}
                <img src={tile.imageSrc} alt={tile.alt} className="h-full w-full object-contain" />
              </button>
            )
          })}
        </div>
      </div>
    )
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
