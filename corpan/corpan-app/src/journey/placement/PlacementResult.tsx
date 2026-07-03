// src/journey/placement/PlacementResult.tsx — frontier + endowed progress
// (feed-ux §1.9), including the R10 `above-content` outcome with HONEST copy
// (house no-absolutes rules: state what the course covers, no hedging spin).

import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import type { PlacementOutcome } from "../engine/index.ts"

export function PlacementResult(props: {
  outcome: PlacementOutcome
  unitName?: (unitId: string) => string
  onContinue: () => void
}) {
  const { t } = useTranslation()
  const { outcome } = props
  const above = outcome.record.outcome === "above-content"
  const unitLabel = props.unitName
    ? props.unitName(outcome.startUnitId)
    : outcome.startUnitId

  return (
    <div className="flex w-full max-w-[26rem] flex-col items-center gap-5 text-center" data-testid="journey-placement-result">
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-4xl">
        {above ? "🧭" : "📍"}
      </motion.div>
      <div className="text-2xl font-bold text-foreground">
        {above ? t("journey.placement.aboveTitle") : t("journey.placement.doneTitle")}
      </div>
      <div className="text-base text-muted-foreground">
        {above
          ? t("journey.placement.aboveBody")
          : t("journey.placement.doneBody", { unit: unitLabel })}
      </div>
      {!above && outcome.unlockedSkills.length > 0 ? (
        <div className="rounded-xl bg-[hsl(var(--journey-accent,262_80%_58%)/0.1)] px-4 py-2.5 text-sm font-medium text-foreground">
          {t("journey.placement.prelit", { count: outcome.unlockedSkills.length })}
        </div>
      ) : null}
      <button
        type="button"
        onClick={props.onContinue}
        data-testid="journey-placement-continue"
        className="min-h-12 w-full rounded-xl bg-[hsl(var(--journey-accent,262_80%_58%))] text-base font-semibold text-white"
      >
        {t("journey.exercise.continue")}
      </button>
    </div>
  )
}
