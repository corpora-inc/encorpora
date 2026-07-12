// src/journey/exercises/ListenPick.tsx — hear it, pick what you heard
// (feed-ux §4 row 2). Audio auto-plays once on ARRIVAL (never on pre-mount);
// replay + 0.7× replay free.

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { cardRng } from "../content/rng.ts"
import { AnswerTiles, type Tile } from "./common/AnswerTiles.tsx"
import { AudioButton } from "./common/AudioButton.tsx"
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
    <div className="flex w-full flex-col items-center gap-6">
      <div className="text-sm text-muted-foreground">{t("journey.exercise.pickWhatYouHear")}</div>
      <AudioButton speak={props.speak} lang={props.spec.targetLang} text={answer.target.ttsText} size="lg" />
      {/* Concept image (imagepan) — reserved box (placeholder pre-answer so it
          can't spoil the answer), image swaps in place on answer: no reflow. */}
      {conceptImageSrc ? (
        <div
          className="flex h-32 w-full max-w-xs items-center justify-center overflow-hidden rounded-lg border border-border bg-muted sm:h-40"
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
          (empty) from mount, filled in place on answer so the tiles never
          shift when the target text appears. */}
      <ReservedSlot minH="min-h-7">
        {answered ? (
          <div lang={props.spec.targetLang} className="text-lg font-medium text-foreground">
            {answer.target.text}
          </div>
        ) : null}
      </ReservedSlot>
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
      {/* No-reflow: reserved hint slot held from mount (see ReservedSlot). */}
      {props.mode === "live" ? (
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
