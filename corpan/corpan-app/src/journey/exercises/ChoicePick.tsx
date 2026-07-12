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
import { buildGlyphTiles, GLYPH_ANSWER_TILE_ID } from "./glyphs.ts"
import { AnswerTiles, type Tile } from "./common/AnswerTiles.tsx"
import { AudioButton } from "./common/AudioButton.tsx"
import { ConceptImage } from "./common/ConceptImage.tsx"
import { ImageTiles } from "./common/ImageTiles.tsx"
import { ReservedSlot } from "./common/ReservedSlot.tsx"
import { ScaffoldHint } from "./common/ScaffoldHint.tsx"
import { TargetText } from "./common/TargetText.tsx"
import type { ExerciseProps } from "./types.ts"

export const ANSWER_TILE_ID = "answer"

/** Picture-choice (media:'image') — a word card whose OPTIONS are pictures
 *  (word → picture), OR whose PROMPT is a picture (image → word, imagePrompt).
 *  L1-free: the meaning is the picture. Ships inert until imagepan is installed. */
const isImageMode = (props: ExerciseProps): boolean => props.spec.params?.media === "image"
const isImagePrompt = (props: ExerciseProps): boolean => props.spec.params?.imagePrompt === true
const promptImageSrc = (props: ExerciseProps): string =>
  typeof props.spec.params?.promptImageSrc === "string" ? props.spec.params.promptImageSrc : ""
const promptImageAlt = (props: ExerciseProps): string =>
  typeof props.spec.params?.promptAlt === "string" ? props.spec.params.promptAlt : ""

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

  const imageMode = isImageMode(props)
  const imagePrompt = isImagePrompt(props)
  const glyphMode = props.spec.params?.media === "glyph"
  // Picture OPTIONS only in the word→picture form; the image→word form uses the
  // ordinary word tiles below (its picture is the PROMPT, not the options).
  const imageOptions = imageMode && !imagePrompt
  const tiles = useMemo(() => buildChoiceTiles(props), [props.cardId]) // eslint-disable-line react-hooks/exhaustive-deps
  const imageTiles = useMemo(
    () => (imageOptions ? buildImageTiles(props.spec.params, props.cardId) : []),
    [imageOptions, props.cardId], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const glyphTiles = useMemo(
    () => (glyphMode ? buildGlyphTiles(props.spec.params, props.cardId) : []),
    [glyphMode, props.cardId], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Hear the target once on arrival (never on pre-mount). Word→picture is
  // hear+read → tap the matching picture; the audio-prompt listening form hears
  // it too. Image→word is silent by design: the WORD is the answer, so playing
  // it would give the tiles away.
  useEffect(() => {
    // Audio-first (FIRST_PRINCIPLES.md): play the target whenever it IS the
    // prompt — the audio-fallback mode, glyph, word→picture options, AND the
    // toNative comprehension form (see+hear the target, pick the meaning). A
    // toTarget card (prompt is the learner's native language) OR an image→word
    // card (the picture is the prompt, the WORD is the answer) stays silent.
    const wantsAudio =
      imageOptions ||
      glyphMode ||
      faces.promptMode === "audio" ||
      faces.promptLang === props.spec.targetLang
    if (wantsAudio && props.active && props.mode !== "review" && !playedRef.current) {
      playedRef.current = true
      void props.speak(props.spec.targetLang, answer.target.ttsText)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.active, faces.promptMode, imageOptions, glyphMode])

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

  const answered = props.mode === "review" || picked !== null

  // ---- Word → picture: target word prompt (heard + read) + a 2×2 grid of
  // picture options. No instruction caption (word + pictures is self-evident;
  // "intuitive, not explainy") — which also means ZERO new i18n copy.
  if (imageOptions && imageTiles.length > 0) {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <TargetText item={answer} lang={props.spec.targetLang} showRomanization={props.showRomanization} />
          <AudioButton speak={props.speak} lang={props.spec.targetLang} text={answer.target.ttsText} />
        </div>
        <ImageTiles
          tiles={imageTiles}
          answerId={ANSWER_TILE_ID}
          picked={picked}
          answered={answered}
          disabled={disabled}
          onPick={pick}
        />
      </div>
    )
  }

  // ---- Image → word: picture PROMPT + a grid of WORD options (from the text
  // sampler). The picture carries the meaning; the learner taps the target word.
  // No caption, no pre-answer audio (the word is the answer) — ZERO new copy.
  if (imagePrompt && promptImageSrc(props)) {
    return (
      <div className="flex w-full flex-col items-center gap-6">
        <ConceptImage src={promptImageSrc(props)} alt={promptImageAlt(props)} size="prompt" />
        <AnswerTiles
          tiles={tiles.map((tile) => ({
            ...tile,
            state: answered ? (tile.id === ANSWER_TILE_ID ? "correct" : tile.id === picked ? "wrong" : null) : null,
          }))}
          lang={props.spec.targetLang}
          columns={2}
          disabled={disabled}
          onPick={pick}
        />
      </div>
    )
  }

  // ---- Numeral GLYPH choice (FIRST_PRINCIPLES.md): HEAR the target number,
  // tap the universal digit. Audio is the hero (auto-plays on arrival, big
  // replay); the written word is revealed only AFTER answering, so the beat is
  // pure listening comprehension, not reading. Language-neutral — no L1 text.
  if (glyphMode && glyphTiles.length > 0) {
    const revealed = props.mode === "review" || picked !== null
    return (
      <div className="flex w-full flex-col items-center gap-8">
        <AudioButton speak={props.speak} lang={props.spec.targetLang} text={answer.target.ttsText} size="lg" />
        <div
          className="grid w-full max-w-xs grid-cols-2 gap-3"
          role="listbox"
          data-testid="journey-glyph-tiles"
        >
          {glyphTiles.map((tile) => {
            const state = revealed
              ? tile.id === GLYPH_ANSWER_TILE_ID
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
                className={[
                  // Squared-off 8px corners (design standard), big tabular digit.
                  "flex aspect-square items-center justify-center rounded-lg border text-5xl font-bold tabular-nums transition-all active:scale-[0.97]",
                  state === "correct"
                    ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-500"
                    : state === "wrong"
                      ? "border-red-500/60 bg-red-500/10 text-red-400"
                      : "border-border bg-card text-foreground hover:bg-muted",
                ].join(" ")}
              >
                {tile.glyph}
              </button>
            )
          })}
        </div>
        {revealed ? (
          <div lang={props.spec.targetLang} className="text-lg font-medium text-muted-foreground">
            {answer.target.text}
          </div>
        ) : null}
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
        // Comprehension form (toNative): the target is the hero AND it is heard.
        // Audio auto-plays on arrival (see effect above); this gives a
        // first-class, repeatable replay / slow-replay so listening is central,
        // not a one-shot the learner can miss (FIRST_PRINCIPLES.md — hear always).
        <div className="flex flex-col items-center gap-4">
          <TargetText item={answer} lang={props.spec.targetLang} showRomanization={props.showRomanization} />
          <AudioButton speak={props.speak} lang={props.spec.targetLang} text={answer.target.ttsText} />
        </div>
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
      {/* No-reflow: the hint offer lives in a reserved slot held from mount, so
          it fills in place on a first miss and never shoves the tiles. */}
      {props.mode === "live" ? (
        <ReservedSlot minH="min-h-9">
          {props.scaffold.misses === 1 && !props.scaffold.hintUsed ? (
            <ScaffoldHint used={false} onUse={useScaffold} />
          ) : null}
        </ReservedSlot>
      ) : null}
    </div>
  )
}
