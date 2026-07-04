// src/journey/exercises/common/ScaffoldHint.tsx — the retry scaffold frame
// (feed-ux §3.3). ONE scaffold per card, type-appropriate content supplied
// by the renderer; using it grades to Hard at best (host accounts hints).

import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Lightbulb } from "lucide-react"

export function ScaffoldHint(props: { children?: React.ReactNode; onUse?: () => void; used: boolean }) {
  const { t } = useTranslation()
  if (!props.used && props.onUse) {
    return (
      <button
        type="button"
        onClick={props.onUse}
        data-testid="journey-scaffold-offer"
        className="flex items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-sm text-muted-foreground hover:bg-muted"
      >
        <Lightbulb className="h-4 w-4" />
        {t("journey.exercise.hint")}
      </button>
    )
  }
  if (!props.used) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-muted px-3.5 py-2 text-sm text-foreground"
      data-testid="journey-scaffold-content"
    >
      {props.children}
    </motion.div>
  )
}
