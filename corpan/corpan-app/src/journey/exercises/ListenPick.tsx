// src/journey/exercises/ListenPick.tsx — hear it, pick what you heard
// (feed-ux §4 row 2). Audio auto-plays once on ARRIVAL (never on pre-mount);
// replay + 0.7× replay free.

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { isRTL } from "../../util/convert"
import { cardRng } from "../content/rng.ts"
import { buildImageTiles } from "./imageChoice.ts"
import { AnswerTiles, type Tile } from "./common/AnswerTiles.tsx"
import { AudioButton } from "./common/AudioButton.tsx"
import { ImageTiles } from "./common/ImageTiles.tsx"
import { ReservedSlot } from "./common/ReservedSlot.tsx"
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

  // FLAGSHIP — HEAR → pick the picture (media:'image'): audio auto-plays the
  // target, the learner taps the matching picture from a 2×2 grid (no written
  // word until answered). Options are the concept's sibling pictures — the text
  // sampler is not consulted. Degrades to the text tiles below if the concept
  // shipped too few pictures to fill a grid.
  const imageMode = props.spec.params?.media === "image"
  const imageTiles = useMemo(
    () => (imageMode ? buildImageTiles(props.spec.params, props.cardId) : []),
    [imageMode, props.cardId], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const pictures = imageMode && imageTiles.length > 0

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

  // Concept picture (imagepan) — revealed WITH the written answer so the meaning
  // lands as an image. Wired by the runtime only when one exists; absent → the
  // plain text reveal. Hidden until answered (it would spoil "pick what you
  // hear"), but its box is RESERVED up front so revealing never reflows.
  const conceptImageSrc =
    typeof props.spec.params?.conceptImageSrc === "string" ? props.spec.params.conceptImageSrc : ""
  const conceptImageAlt =
    typeof props.spec.params?.conceptImageAlt === "string" ? props.spec.params.conceptImageAlt : ""

  const disabled = props.mode === "review" || picked === ANSWER_ID

  const pick = (id: string) => {
    if (disabled) return
    setPicked(id)
    props.onOutcome({ correct: id === ANSWER_ID, latencyMs: Date.now() - startedAt.current })
  }

  const answered = picked !== null || props.mode === "review"

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="text-sm text-muted-foreground">{t("journey.exercise.pickWhatYouHear")}</div>
      <AudioButton speak={props.speak} lang={props.spec.targetLang} text={answer.target.ttsText} size="lg" />
      {/* Concept image (imagepan) — the TEXT-path enrichment box (reserved,
          placeholder pre-answer so it can't spoil the answer; the image swaps in
          place on answer → no reflow). Skipped in pictures mode, where the
          OPTIONS themselves are the imagery. */}
      {!pictures && conceptImageSrc ? (
        <div
          className="flex h-24 w-full max-w-[10rem] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted sm:h-32"
          data-testid="journey-listen-image"
        >
          {answered ? (
            <img
              src={conceptImageSrc}
              alt={conceptImageAlt}
              className="h-full w-full object-contain"
            />
          ) : (
            <div aria-hidden className="h-full w-full bg-muted/60" />
          )}
        </div>
      ) : null}
      {/* No-reflow: a reserved line for the "what you heard" reveal — present
          (empty) from mount, filled in place on answer so the tiles never shift.
          Shown in BOTH modes: the target confirms WHAT you heard; the native
          gloss confirms the MEANING ("Where are you from?" → "¿De dónde eres?").
          Omitted when native == target (same-language edge). */}
      <ReservedSlot minH="min-h-14">
        {answered ? (
          <div className="flex flex-col items-center gap-0.5">
            <div lang={props.spec.targetLang} className="text-lg font-medium text-foreground">
              {answer.target.text}
            </div>
            {answer.native && answer.native.text !== answer.target.text ? (
              <div
                lang={props.spec.nativeLang}
                dir={props.spec.nativeLang && isRTL(props.spec.nativeLang) ? "rtl" : "ltr"}
                className="text-sm text-muted-foreground"
              >
                {answer.native.text}
              </div>
            ) : null}
          </div>
        ) : null}
      </ReservedSlot>
      {/* FLAGSHIP pictures mode: HEAR → tap the matching picture (no written word
          until the reveal above). Text mode: pick the written word. */}
      {pictures ? (
        <ImageTiles
          tiles={imageTiles}
          answerId={ANSWER_ID}
          picked={picked}
          answered={answered}
          disabled={disabled}
          onPick={pick}
        />
      ) : (
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
      )}
      {/* No-reflow: reserved hint slot held from mount (see ReservedSlot). Text
          mode only — picture options have no distractor-elimination scaffold. */}
      {!pictures && props.mode === "live" ? (
        <ReservedSlot minH="min-h-9">
          {props.scaffold.misses === 1 && !props.scaffold.hintUsed ? (
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
        </ReservedSlot>
      ) : null}
    </div>
  )
}
