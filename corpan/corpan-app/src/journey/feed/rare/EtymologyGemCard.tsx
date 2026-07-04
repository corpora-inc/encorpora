// src/journey/feed/rare/EtymologyGemCard.tsx — wordpan-backed typographic
// gem (feed-ux §1.7): the ~50-word explanation paragraph for a word the
// learner just learned, served THROUGH the resolver (word extras). Exposure
// only — unscored, counts as input strand (the engine issued it unscored).

import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { isRTL } from "../../../util/convert"
import type { ResolvedItem } from "../../content/resolve.ts"

export function EtymologyGemCard(props: {
  item: ResolvedItem
  targetLang: string
  nativeLang?: string
  onContinue: (latencyMs: number) => void
}) {
  const { t } = useTranslation()
  const startedAt = useRef(Date.now())
  const extras = props.item.extras?.kind === "word" ? props.item.extras : null
  const paragraph = extras?.explanationNative ?? extras?.explanationTarget ?? null
  const paragraphLang = extras?.explanationNative ? (props.nativeLang ?? props.targetLang) : props.targetLang

  return (
    <div className="flex w-full max-w-[26rem] flex-col items-center gap-5 text-center" data-testid="journey-rare-gem">
      <div className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--journey-accent,262_80%_58%))]">
        {t("journey.rare.etymologyGem")}
      </div>
      <div
        lang={props.targetLang}
        dir={isRTL(props.targetLang) ? "rtl" : "ltr"}
        className="text-4xl font-bold text-foreground"
      >
        {props.item.target.text}
      </div>
      {paragraph ? (
        <p
          lang={paragraphLang}
          dir={isRTL(paragraphLang) ? "rtl" : "ltr"}
          className="text-start text-base leading-relaxed text-foreground"
        >
          {paragraph}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t("journey.rare.delight.didYouNotice")}</p>
      )}
      <button
        type="button"
        onClick={() => props.onContinue(Date.now() - startedAt.current)}
        data-testid="journey-gem-continue"
        className="min-h-12 w-full rounded-xl bg-[hsl(var(--journey-accent,262_80%_58%))] text-base font-semibold text-white"
      >
        {t("journey.exercise.continue")}
      </button>
    </div>
  )
}
