// src/journey/feed/WelcomeBackCard.tsx — re-entry arc opener (feed-ux §1;
// the engine emits the welcomeBack signal on a ≥7-day gap). Honest framing:
// retained strength, warm-up invitation, zero guilt.

import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"

export function WelcomeBackCard(props: { retainedPct: number; onContinue: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex w-full max-w-[26rem] flex-col items-center gap-5 text-center" data-testid="journey-welcome-back">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-4xl"
      >
        👋
      </motion.div>
      <div className="text-2xl font-bold text-foreground">{t("journey.welcomeBack.title")}</div>
      <div className="text-base text-muted-foreground">
        {t("journey.welcomeBack.body", { pct: props.retainedPct })}
      </div>
      <button
        type="button"
        onClick={props.onContinue}
        data-testid="journey-welcome-continue"
        className="min-h-12 w-full rounded-xl bg-[hsl(var(--journey-accent,262_80%_58%))] text-base font-semibold text-white"
      >
        {t("journey.exercise.continue")}
      </button>
    </div>
  )
}
