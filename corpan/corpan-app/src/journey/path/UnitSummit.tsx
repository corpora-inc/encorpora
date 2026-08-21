// src/journey/path/UnitSummit.tsx — unit-complete milestone view (feed-ux
// §1.10; tier-2 celebration target).

import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"

export function UnitSummit(props: { unitName: string; onContinue: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex w-full max-w-[26rem] flex-col items-center gap-5 text-center" data-testid="journey-unit-summit">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-5xl">
        ⛰️
      </motion.div>
      <div className="text-2xl font-bold text-foreground">
        {t("journey.celebrate.unitComplete", { name: props.unitName })}
      </div>
      <button
        type="button"
        onClick={props.onContinue}
        className="min-h-12 w-full rounded-xl bg-[hsl(var(--journey-accent,262_80%_58%))] text-base font-semibold text-white"
      >
        {t("journey.exercise.continue")}
      </button>
    </div>
  )
}
