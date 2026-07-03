// src/journey/exercises/IntroEcho.tsx — new-item debut: show + hear + echo
// prompt (feed-ux §4 row 9). UNSCORED; the FSRS card is created at first
// scored exposure. Auto-plays on arrival, invites an aloud echo, Continue.

import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { isRTL } from "../../util/convert"
import { AudioButton } from "./common/AudioButton.tsx"
import { TargetText } from "./common/TargetText.tsx"
import type { ExerciseProps } from "./types.ts"

export function IntroEcho(props: ExerciseProps) {
  const { t } = useTranslation()
  const answer = props.items[0]
  const startedAt = useRef(Date.now())
  const playedRef = useRef(false)

  useEffect(() => {
    if (props.active && props.mode !== "review" && !playedRef.current) {
      playedRef.current = true
      startedAt.current = Date.now()
      void props.speak(props.spec.targetLang, answer.target.ttsText)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.active])

  const isWord = answer.kind === "word" || answer.kind === "char"

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="rounded-full bg-[hsl(var(--journey-accent,262_80%_58%)/0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground">
        {isWord ? t("journey.intro.newWord") : t("journey.intro.newPhrase")}
      </div>
      <TargetText item={answer} lang={props.spec.targetLang} showRomanization={props.showRomanization} />
      {answer.native ? (
        <div
          lang={props.spec.nativeLang}
          dir={props.spec.nativeLang && isRTL(props.spec.nativeLang) ? "rtl" : "ltr"}
          className="text-lg text-muted-foreground"
        >
          {answer.native.text}
        </div>
      ) : null}
      <AudioButton speak={props.speak} lang={props.spec.targetLang} text={answer.target.ttsText} size="lg" />
      <div className="text-sm text-muted-foreground">{t("journey.intro.listenAndEcho")}</div>
      {props.mode === "live" ? (
        <button
          type="button"
          data-testid="journey-intro-continue"
          onClick={() =>
            props.onOutcome({ correct: true, latencyMs: Date.now() - startedAt.current })
          }
          className="min-h-12 w-full rounded-xl bg-[hsl(var(--journey-accent,262_80%_58%))] text-base font-semibold text-white"
        >
          {t("journey.exercise.continue")}
        </button>
      ) : null}
    </div>
  )
}
