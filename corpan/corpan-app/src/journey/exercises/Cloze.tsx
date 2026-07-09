// src/journey/exercises/Cloze.tsx — fill the blank (feed-ux §4 row 4).
// mode 'bank' (token tiles from the W5 sampler) or 'type'. Tokenization via
// util/wordTokens.tokenizePhrase — the ONE tokenizer (R14 rule).

import { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { isRTL } from "../../util/convert"
import { normalizedEquals } from "../content/normalize.ts"
import { cardRng } from "../content/rng.ts"
import { tokenizePhrase } from "../../util/wordTokens"
import { clozeContext } from "./clozeContext.ts"
import { AnswerTiles, type Tile } from "./common/AnswerTiles.tsx"
import { AudioButton } from "./common/AudioButton.tsx"
import { ScaffoldHint } from "./common/ScaffoldHint.tsx"
import { TargetText } from "./common/TargetText.tsx"
import { hasClozeContext } from "./common/tokenGuards.ts"
import { TypeInput } from "./common/TypeInput.tsx"
import type { ExerciseProps } from "./types.ts"

const ANSWER_ID = "answer"

export function Cloze(props: ExerciseProps) {
  const { t } = useTranslation()
  const answer = props.items[0]
  const startedAt = useRef(Date.now())
  const [done, setDone] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const bank = props.spec.params?.mode !== "type"

  // Words-in-context: when the runtime blanked a WORD inside a real corpus
  // phrase, render that phrase (not the bare word) with the word blanked. The
  // graded item is still items[0] (the word), so the answer === the word.
  const ctx = useMemo(
    () => clozeContext(props.spec.params, props.spec.targetLang),
    [props.spec.params, props.spec.targetLang],
  )

  const plainWords = useMemo(
    () =>
      tokenizePhrase(answer.target.text, props.spec.targetLang)
        .filter((w) => w.isWord)
        .map((w) => w.text),
    [answer.target.text, props.spec.targetLang],
  )
  const words = ctx ? ctx.words : plainWords
  const rawIndex = ctx
    ? ctx.blankIndex
    : typeof props.spec.params?.blankIndex === "number"
      ? props.spec.params.blankIndex
      : 0
  const blankIndex = Math.min(Math.max(rawIndex, 0), Math.max(words.length - 1, 0))
  const blankWord = ctx ? ctx.blankWord : words[blankIndex] ?? answer.target.text
  const nativeLine = ctx ? ctx.native : answer.native?.text

  // Defense (contract): a cloze needs SURROUNDING context — blanking the only
  // word leaves a bare "____" with nothing to read ("completa el hueco" that is
  // just "jam"). Team 1 gates single-token kinds upstream and resolve.ts
  // supplies a context phrase when one exists, but a lone-word residual must
  // never render a context-free blank. Degrade to a flashcard reveal instead.
  const hasContext = hasClozeContext(words.length)

  const tiles = useMemo(() => {
    if (!bank) return []
    const out: Tile[] = (props.distractors?.distractors ?? []).map((d, i) => ({
      id: `d${i}`,
      text: d.text,
    }))
    const insertAt = Math.floor(cardRng(props.cardId)() * (out.length + 1))
    out.splice(insertAt, 0, { id: ANSWER_ID, text: blankWord })
    return out
  }, [props.cardId, bank, blankWord]) // eslint-disable-line react-hooks/exhaustive-deps

  const answered = done || picked !== null || props.mode === "review"

  const sentence = useMemo(() => {
    const parts: string[] = []
    for (let i = 0; i < words.length; i++) {
      parts.push(i === blankIndex && !answered ? "____" : words[i])
    }
    return parts.join(" ")
  }, [words, blankIndex, answered])

  const settle = (ok: boolean) => {
    if (ok) setDone(true)
    props.onOutcome({ correct: ok, latencyMs: Date.now() - startedAt.current })
  }

  // Degenerate input (no surrounding context): reveal, never a bare blank.
  if (!hasContext) {
    return (
      <div className="flex w-full flex-col items-center gap-6" data-testid="journey-cloze-degraded">
        {nativeLine ? (
          <div
            lang={props.spec.nativeLang}
            dir={props.spec.nativeLang && isRTL(props.spec.nativeLang) ? "rtl" : "ltr"}
            className="text-xl font-semibold text-foreground"
          >
            {nativeLine}
          </div>
        ) : null}
        <TargetText item={answer} lang={props.spec.targetLang} showRomanization={props.showRomanization} />
        <AudioButton speak={props.speak} lang={props.spec.targetLang} text={answer.target.ttsText} />
        {props.mode === "live" && !done ? (
          <button
            type="button"
            data-testid="journey-cloze-continue"
            onClick={() => settle(true)}
            className="min-h-12 w-full rounded-xl bg-[hsl(var(--journey-accent,262_80%_58%))] text-base font-semibold text-white"
          >
            {t("journey.exercise.continue")}
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="text-sm text-muted-foreground">{t("journey.exercise.fillTheBlank")}</div>
      <div
        lang={props.spec.targetLang}
        dir={isRTL(props.spec.targetLang) ? "rtl" : "ltr"}
        className="text-2xl font-semibold leading-relaxed text-foreground"
        data-testid="journey-cloze-sentence"
      >
        {sentence}
      </div>
      {nativeLine ? (
        <div
          lang={props.spec.nativeLang}
          dir={props.spec.nativeLang && isRTL(props.spec.nativeLang) ? "rtl" : "ltr"}
          className="text-sm text-muted-foreground"
        >
          {nativeLine}
        </div>
      ) : null}
      {bank ? (
        <AnswerTiles
          tiles={tiles.map((tile) => ({
            ...tile,
            state: answered ? (tile.id === ANSWER_ID ? "correct" : tile.id === picked ? "wrong" : null) : null,
          }))}
          lang={props.spec.targetLang}
          columns={2}
          disabled={answered && picked === ANSWER_ID}
          onPick={(id) => {
            if (props.mode === "review" || done) return
            setPicked(id)
            settle(id === ANSWER_ID)
          }}
        />
      ) : (
        <TypeInput
          lang={props.spec.targetLang}
          disabled={done || props.mode === "review"}
          hint={hint}
          onSubmit={(typed) => settle(normalizedEquals(typed, blankWord, props.spec.targetLang))}
        />
      )}
      {props.mode === "live" && props.scaffold.misses === 1 && !props.scaffold.hintUsed ? (
        <ScaffoldHint
          used={false}
          onUse={() => {
            setHint(blankWord.slice(0, 1))
            props.onHintUsed()
          }}
        />
      ) : null}
    </div>
  )
}
