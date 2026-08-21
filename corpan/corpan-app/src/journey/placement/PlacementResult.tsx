// src/journey/placement/PlacementResult.tsx — where the learner was placed,
// concretely (feed-ux §1.9): the named frontier unit + its arc, plus the
// endowed-progress line. The R10 `above-content` case names the deepest unit
// honestly — no "coming soon" roadmap copy (house no-absolutes rules).

import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import type { PlacementOutcome } from "../engine/index.ts"

export function PlacementResult(props: {
  outcome: PlacementOutcome
  unitName?: (unitId: string) => string
  /** CEFR band of the start arc (e.g. "A1") — a concrete "where", or null. */
  arcLabel?: string | null
  onContinue: () => void
}) {
  const { t } = useTranslation()
  const { outcome } = props
  const above = outcome.record.outcome === "above-content"
  const unitLabel = props.unitName ? props.unitName(outcome.startUnitId) : outcome.startUnitId

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
          ? t("journey.placement.aboveFrontier", { unit: unitLabel })
          : t("journey.placement.doneBody", { unit: unitLabel })}
      </div>
      {props.arcLabel ? (
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("journey.path.arc", { name: props.arcLabel })}
        </div>
      ) : null}
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
