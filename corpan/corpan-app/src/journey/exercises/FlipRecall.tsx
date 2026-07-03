// src/journey/exercises/FlipRecall.tsx — show prompt → recall → flip →
// self-verdict (feed-ux §4 row 7). Self-report caps at Good engine-side;
// "Not yet" = fail and enters the §3.3 step-2 flow directly (no scaffold
// retry for self-graded cards).

import { useRef, useState } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { isRTL } from "../../util/convert"
import { TargetText } from "./common/TargetText.tsx"
import type { ExerciseProps } from "./types.ts"

export function FlipRecall(props: ExerciseProps) {
  const { t } = useTranslation()
  const answer = props.items[0]
  const startedAt = useRef(Date.now())
  const [flipped, setFlipped] = useState(props.mode === "review")
  const [verdict, setVerdict] = useState<"knew" | "not" | null>(null)
  const toNative = props.spec.params?.direction !== "toTarget"

  const settle = (knew: boolean) => {
    if (verdict) return
    setVerdict(knew ? "knew" : "not")
    props.onOutcome({
      correct: knew,
      latencyMs: Date.now() - startedAt.current,
      detail: knew ? undefined : { selfReport: "never-learned" },
    })
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="text-sm text-muted-foreground">{t("journey.exercise.flipToReveal")}</div>
      {toNative ? (
        <TargetText item={answer} lang={props.spec.targetLang} showRomanization={props.showRomanization} />
      ) : (
        <div
          lang={props.spec.nativeLang}
          dir={props.spec.nativeLang && isRTL(props.spec.nativeLang) ? "rtl" : "ltr"}
          className="text-3xl font-semibold text-foreground"
        >
          {answer.native?.text ?? answer.target.text}
        </div>
      )}
      {!flipped ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => setFlipped(true)}
          data-testid="journey-flip"
          className="min-h-24 w-full rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:bg-muted"
        >
          {t("journey.exercise.flipToReveal")}
        </motion.button>
      ) : (
        <motion.div
          initial={{ rotateX: -80, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          className="flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl bg-muted px-4 py-5"
        >
          {toNative ? (
            <div
              lang={props.spec.nativeLang}
              dir={props.spec.nativeLang && isRTL(props.spec.nativeLang) ? "rtl" : "ltr"}
              className="text-2xl font-semibold text-foreground"
            >
              {answer.native?.text ?? answer.target.text}
            </div>
          ) : (
            <TargetText item={answer} lang={props.spec.targetLang} showRomanization={props.showRomanization} size="md" />
          )}
        </motion.div>
      )}
      {flipped && props.mode === "live" && !verdict ? (
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={() => settle(false)}
            data-testid="journey-flip-not"
            className="min-h-12 flex-1 rounded-xl border border-border bg-card text-base font-medium text-foreground hover:bg-muted"
          >
            {t("journey.exercise.didntKnow")}
          </button>
          <button
            type="button"
            onClick={() => settle(true)}
            data-testid="journey-flip-knew"
            className="min-h-12 flex-1 rounded-xl bg-[hsl(var(--journey-accent,262_80%_58%))] text-base font-semibold text-white"
          >
            {t("journey.exercise.knewIt")}
          </button>
        </div>
      ) : null}
    </div>
  )
}
