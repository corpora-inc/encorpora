// src/journey/cards/WordEnrichment.tsx — post-answer word depth (feed-ux
// words-in-context + wordpan meaning). Shown once a WORD card settles: the word
// inside a real corpus phrase, plus a tap-to-expand meaning/etymology snippet.
// Additive — renders nothing when there is nothing richer to show, so a word
// with neither an example nor a wordpan paragraph settles exactly as before.

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { isRTL } from "../../util/convert"
import type { ResolvedExample, ResolvedItem } from "../content/resolve.ts"
import { wordEnrichment } from "./wordEnrichment.ts"

export function WordEnrichment(props: {
  item: ResolvedItem
  example?: ResolvedExample | null
  targetLang: string
  nativeLang?: string
}) {
  const { t } = useTranslation()
  const model = wordEnrichment(props.item, props.example, {
    targetLang: props.targetLang,
    nativeLang: props.nativeLang,
  })
  // When the meaning is the ONLY enrichment (no in-context example — e.g. a
  // number like "one"), expand it by default so the card carries real content
  // instead of a lone collapsed toggle that reads as an empty box.
  const [open, setOpen] = useState(!!model && !model.example && !!model.explanation)
  if (!model) return null

  return (
    <div
      className="flex w-full max-w-[26rem] flex-col gap-2 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-start"
      data-testid="journey-word-enrichment"
    >
      {model.example ? (
        <div className="flex flex-col gap-0.5" data-testid="journey-word-example">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("journey.word.inContext")}
          </div>
          <div
            lang={model.example.targetLang}
            dir={isRTL(model.example.targetLang) ? "rtl" : "ltr"}
            className="text-base leading-snug text-foreground"
          >
            {model.example.target}
          </div>
          {model.example.native ? (
            <div
              lang={model.example.nativeLang}
              dir={model.example.nativeLang && isRTL(model.example.nativeLang) ? "rtl" : "ltr"}
              className="text-sm text-muted-foreground"
            >
              {model.example.native}
            </div>
          ) : null}
        </div>
      ) : null}

      {model.explanation ? (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            data-testid="journey-word-meaning-toggle"
            className="text-[0.65rem] font-semibold uppercase tracking-wide text-[hsl(var(--journey-accent,262_80%_58%))]"
          >
            {open ? t("journey.word.meaningHide") : t("journey.word.meaningShow")}
          </button>
          {open ? (
            <p
              lang={model.explanation.lang}
              dir={isRTL(model.explanation.lang) ? "rtl" : "ltr"}
              className="mt-1 text-sm leading-relaxed text-foreground"
              data-testid="journey-word-meaning"
            >
              {model.explanation.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
