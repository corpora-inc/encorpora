// src/journey/celebration/ComboCounter.tsx — tiny combo pill (feed-ux §1.5).
// Grows on tier-1 combos; hidden below 2.

import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"

export function ComboCounter(props: { combo: number }) {
  const { t } = useTranslation()
  if (props.combo < 2) return null
  return (
    <motion.div
      key={props.combo}
      initial={{ scale: 0.8 }}
      animate={{ scale: 1 }}
      className="rounded-full bg-[hsl(var(--journey-accent,262_80%_58%)/0.12)] px-2.5 py-0.5 text-xs font-semibold text-foreground"
      aria-label={t("journey.celebrate.combo", { count: props.combo })}
    >
      ×{props.combo}
    </motion.div>
  )
}
