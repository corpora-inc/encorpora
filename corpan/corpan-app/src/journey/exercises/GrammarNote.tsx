// src/journey/exercises/GrammarNote.tsx — composite (feed-ux §4 row 10):
// L1 note panel + one embedded micro-drill (cloze | word_order) graded as
// the node's item. The note copy comes resolved from the course pack's
// strings table (L1-selected by the resolver, §2.8).

import { useTranslation } from "react-i18next"
import { isRTL } from "../../util/convert"
import { Cloze } from "./Cloze.tsx"
import { WordOrder } from "./WordOrder.tsx"
import type { ExerciseProps } from "./types.ts"

export function GrammarNote(props: ExerciseProps) {
  const { t } = useTranslation()
  const node = props.items[0]
  const extras = node.extras?.kind === "grammarNode" ? node.extras : null
  const nativeLang = props.spec.nativeLang
  const drill = (props.spec.params?.drill ?? {}) as {
    activityType?: string
    params?: Record<string, unknown>
  }
  const drillType = drill.activityType === "word_order" ? "word_order" : "cloze"

  // The drill exercises the node's exemplar phrase; the resolver supplies it
  // as items[1] when present, else the node itself carries an exemplar face.
  const drillItems = props.items.length > 1 ? props.items.slice(1) : props.items
  const drillProps: ExerciseProps = {
    ...props,
    items: drillItems,
    spec: {
      ...props.spec,
      activityType: drillType,
      params: { ...(drill.params ?? {}), ...(drillType === "cloze" ? { mode: "bank", blankIndex: props.spec.params?.blankIndex ?? 0 } : {}) },
    },
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="w-full rounded-2xl border border-border bg-card p-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("journey.grammar.noteLabel")}
        </div>
        <div className="mb-1 text-lg font-semibold text-foreground">
          {extras?.title ?? node.target.text}
        </div>
        <div className="text-sm leading-relaxed text-foreground" data-testid="journey-grammar-note">
          {extras?.note ?? ""}
        </div>
        {extras?.contrastiveNote ? (
          <div
            className="mt-3 border-t border-border/60 pt-3"
            data-testid="journey-grammar-contrastive"
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--journey-accent,262_80%_58%))]">
              {t("journey.grammar.contrastLabel")}
            </div>
            <div
              lang={nativeLang}
              dir={nativeLang && isRTL(nativeLang) ? "rtl" : "ltr"}
              className="text-sm leading-relaxed text-muted-foreground"
            >
              {extras.contrastiveNote}
            </div>
          </div>
        ) : null}
      </div>
      <div className="w-full">
        <div className="mb-2 text-sm font-medium text-muted-foreground">{t("journey.grammar.tryIt")}</div>
        {drillType === "word_order" ? <WordOrder {...drillProps} /> : <Cloze {...drillProps} />}
      </div>
    </div>
  )
}
