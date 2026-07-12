// src/journey/cards/WordEnrichment.tsx — post-answer word depth as a compact
// (?) HINT that opens an OVERLAY, never an inline block. The exercise layout is
// never displaced: the chip lives in the already-reserved feedback row and the
// explanation floats above the card (fixed, z-[1200]) — matching the phrase
// pop-in sheet. Renders nothing when the word carries no example/paragraph, so
// a bare word settles with no affordance at all.
//
// The paragraph is native-safe (selectWordParagraph): an ES→EN learner reads
// the Spanish explanation, never the English etymology.

import { useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { HelpCircle, X } from "lucide-react"
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
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const model = wordEnrichment(props.item, props.example, {
    targetLang: props.targetLang,
    nativeLang: props.nativeLang,
  })
  if (!model) return null

  const meaningLang = model.meaning?.lang ?? props.nativeLang ?? props.targetLang

  return (
    <>
      {/* Icon-only (?) — compact, collision-free beside the centered stamp; the
          meaning label rides the aria-label (no extra on-screen string). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("journey.word.meaningShow")}
        title={t("journey.word.meaningShow")}
        data-testid="journey-word-meaning-toggle"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-muted/50 text-muted-foreground transition-colors hover:bg-muted active:bg-muted"
      >
        <HelpCircle className="h-4 w-4 text-[hsl(var(--journey-accent,262_80%_58%))]" aria-hidden />
      </button>

      {createPortal(
        // Portal to <body>: feed cards animate on a transformed motion.div, which
        // would make a `fixed` descendant position relative to the CARD (and clip
        // it). Portaling escapes the transform so the sheet floats over the whole
        // viewport at z-[1200] — same layer as the phrase pop-in.
        <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[1200] flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="journey-word-meaning"
          >
            <button
              type="button"
              aria-label={t("journey.popin.close")}
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="relative max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
              initial={reduced ? { opacity: 0 } : { y: "100%" }}
              animate={reduced ? { opacity: 1 } : { y: 0 }}
              exit={reduced ? { opacity: 0 } : { y: "100%" }}
              transition={reduced ? { duration: 0.15 } : { type: "spring", stiffness: 320, damping: 32 }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("journey.popin.close")}
                className="absolute end-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mx-auto flex w-full max-w-[28rem] flex-col gap-4 text-start">
                <div className="flex flex-col gap-0.5">
                  <div
                    lang={props.targetLang}
                    dir={isRTL(props.targetLang) ? "rtl" : "ltr"}
                    className="text-2xl font-bold leading-tight text-foreground"
                  >
                    {model.word}
                  </div>
                  {model.gloss ? (
                    <div
                      lang={props.nativeLang}
                      dir={props.nativeLang && isRTL(props.nativeLang) ? "rtl" : "ltr"}
                      className="text-base text-muted-foreground"
                    >
                      {model.gloss}
                    </div>
                  ) : null}
                </div>

                {model.example ? (
                  <div className="flex flex-col gap-0.5 rounded-lg bg-muted/40 px-3 py-2.5">
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

                {model.meaning ? (
                  <p
                    lang={meaningLang}
                    dir={isRTL(meaningLang) ? "rtl" : "ltr"}
                    className="text-[0.95rem] leading-relaxed text-foreground"
                  >
                    {model.meaning.paragraph}
                  </p>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
