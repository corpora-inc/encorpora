// src/journey/cards/WordEnrichment.tsx — word depth as a compact (?) HINT that
// opens the shared vaul Drawer, never an inline block. The exercise layout is
// never displaced: the chip lives in the already-reserved feedback row and the
// explanation floats in a bottom Drawer (big grab band, swipe-down, tap-scrim to
// close — inherited from the shared component). The (?) is available BEFORE and
// after answering (a hint is most useful during the exercise). Renders nothing
// when the word carries no example/paragraph.
//
// The paragraph is native-safe (selectWordParagraph): an ES→EN learner reads the
// Spanish explanation or nothing — never the English etymology.

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { HelpCircle } from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
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

      {/* Shared vaul Drawer: grab band + swipe-down + tap-scrim close for free,
          and it portals above the feed's transformed cards on its own. */}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent data-testid="journey-word-meaning">
          <DrawerHeader className="pb-1">
            <DrawerTitle
              lang={props.targetLang}
              dir={isRTL(props.targetLang) ? "rtl" : "ltr"}
              className="text-2xl leading-tight"
            >
              {model.word}
            </DrawerTitle>
            {model.gloss ? (
              <DrawerDescription
                lang={props.nativeLang}
                dir={props.nativeLang && isRTL(props.nativeLang) ? "rtl" : "ltr"}
                className="text-base"
              >
                {model.gloss}
              </DrawerDescription>
            ) : null}
          </DrawerHeader>

          <div className="max-h-[70vh] overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex w-full max-w-[28rem] flex-col gap-4 text-start">
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
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
