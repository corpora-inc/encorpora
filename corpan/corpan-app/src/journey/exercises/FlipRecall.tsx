// src/journey/exercises/FlipRecall.tsx — a flashcard flip (feed-ux §4 row 7).
// NO self-assessment (contract #5): prompt (meaning) → tap to reveal (target
// face + audio) → Continue. The outcome is verdict-less; the engine grades it
// Good-clamped. Faces come from faces.flipFaces — prompt and reveal are never
// the same language when a native face exists (contract #2).

import { useRef, useState } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { isRTL } from "../../util/convert"
import { flipFaces, type Direction } from "./faces.ts"
import { AudioButton } from "./common/AudioButton.tsx"
import { ReservedSlot } from "./common/ReservedSlot.tsx"
import { TargetText } from "./common/TargetText.tsx"
import type { ExerciseProps } from "./types.ts"

const directionOf = (d: unknown): Direction =>
  d === "toNative" ? "toNative" : d === "targetOnly" ? "targetOnly" : "toTarget"

export function FlipRecall(props: ExerciseProps) {
  const { t } = useTranslation()
  const answer = props.items[0]
  const startedAt = useRef(Date.now())
  const [flipped, setFlipped] = useState(props.mode === "review")
  const doneRef = useRef(false)
  const faces = flipFaces(
    answer,
    directionOf(props.spec.params?.direction),
    props.spec.targetLang,
    props.spec.nativeLang,
  )

  const reveal = () => {
    if (flipped) return
    setFlipped(true)
    if (faces.revealIsTarget) void props.speak(props.spec.targetLang, answer.target.ttsText)
  }

  const settle = () => {
    if (doneRef.current) return
    doneRef.current = true
    // Verdict-less: revealing + continuing is the completion. No "did you get
    // it?" — the engine grades this Good-clamped (contract #5).
    props.onOutcome({ correct: true, latencyMs: Date.now() - startedAt.current })
  }

  // Concept picture (imagepan) as the MEANING of the reveal. Wired by the
  // runtime only when a picture exists; absent → today's plain text reveal.
  // The image = meaning, so it must NOT show before the flip (that would spoil
  // the recall) — but its box is RESERVED up front (a subtle placeholder) so
  // revealing swaps the image in place with zero layout jump.
  const conceptImageSrc =
    typeof props.spec.params?.conceptImageSrc === "string" ? props.spec.params.conceptImageSrc : ""
  const conceptImageAlt =
    typeof props.spec.params?.conceptImageAlt === "string" ? props.spec.params.conceptImageAlt : ""
  const hasImage = conceptImageSrc.length > 0

  const promptFace = faces.promptIsTarget ? (
    <TargetText item={answer} lang={props.spec.targetLang} showRomanization={props.showRomanization} />
  ) : (
    <div
      lang={faces.promptLang}
      dir={isRTL(faces.promptLang) ? "rtl" : "ltr"}
      className="text-3xl font-semibold text-foreground"
      data-testid="journey-flip-prompt"
    >
      {faces.promptText}
    </div>
  )

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="text-sm text-muted-foreground">{t("journey.exercise.flipToReveal")}</div>
      {promptFace}
      {hasImage ? (
        <div
          className="flex h-40 w-full max-w-xs items-center justify-center overflow-hidden rounded-lg border border-border bg-muted sm:h-48"
          data-testid="journey-flip-image"
        >
          {flipped ? (
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
      {!flipped ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={reveal}
          data-testid="journey-flip"
          className="min-h-24 w-full rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:bg-muted"
        >
          {t("journey.exercise.flipToReveal")}
        </motion.button>
      ) : (
        <motion.div
          initial={props.mode === "review" ? false : { rotateX: -80, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          className="flex min-h-24 w-full flex-col items-center justify-center gap-3 rounded-2xl bg-muted px-4 py-5"
          data-testid="journey-flip-reveal"
        >
          {faces.revealIsTarget ? (
            <>
              <TargetText item={answer} lang={props.spec.targetLang} showRomanization={props.showRomanization} size="md" />
              <AudioButton speak={props.speak} lang={props.spec.targetLang} text={answer.target.ttsText} />
            </>
          ) : (
            <div
              lang={faces.revealLang}
              dir={isRTL(faces.revealLang) ? "rtl" : "ltr"}
              className="text-2xl font-semibold text-foreground"
            >
              {faces.revealText}
            </div>
          )}
        </motion.div>
      )}
      {/* No-reflow: the Continue lives in a reserved slot held from mount, so
          the reveal-then-Continue beat never shifts the prompt/flip above it. */}
      {props.mode === "live" ? (
        <ReservedSlot minH="min-h-12">
          {flipped && !doneRef.current ? (
            <button
              type="button"
              onClick={settle}
              data-testid="journey-flip-continue"
              className="min-h-12 w-full rounded-xl bg-[hsl(var(--journey-accent,262_80%_58%))] text-base font-semibold text-white"
            >
              {t("journey.exercise.continue")}
            </button>
          ) : null}
        </ReservedSlot>
      ) : null}
    </div>
  )
}
