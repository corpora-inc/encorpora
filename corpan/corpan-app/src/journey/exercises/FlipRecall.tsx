// src/journey/exercises/FlipRecall.tsx — a flashcard flip (feed-ux §4 row 7).
// NO self-assessment (contract #5): prompt (meaning) → tap to reveal (target
// face + audio) → Continue. The outcome is verdict-less; the engine grades it
// Good-clamped. Faces come from faces.flipFaces — prompt and reveal are never
// the same language when a native face exists (contract #2).

import { useRef, useState } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { RotateCw } from "lucide-react"
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
      {promptFace}
      {/* ONE tappable flashcard: tap the CARD ITSELF (not a little phrase) and
          it flips in 3D to reveal the target word + its picture + audio. Front =
          "toca para revelar"; back = the meaning. No separate button, no empty
          placeholder box above it. */}
      <div className="w-full max-w-xs" style={{ perspective: "1200px" }}>
        <motion.div
          className="relative h-52 w-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={props.mode === "review" ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 26 }}
        >
          {/* FRONT — the whole face is the tap target */}
          <button
            type="button"
            onClick={reveal}
            disabled={flipped}
            data-testid="journey-flip"
            style={{ backfaceVisibility: "hidden" }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 text-sm text-muted-foreground active:scale-[0.99]"
          >
            <RotateCw className="h-6 w-6 opacity-50" />
            {t("journey.exercise.flipToReveal")}
          </button>
          {/* BACK — the revealed meaning: picture + target word + audio */}
          <div
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-muted px-4 py-4"
            data-testid="journey-flip-reveal"
          >
            {hasImage ? (
              <img
                src={conceptImageSrc}
                alt={conceptImageAlt}
                className="h-24 w-auto max-w-[8rem] rounded-lg object-contain"
              />
            ) : null}
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
          </div>
        </motion.div>
      </div>
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
