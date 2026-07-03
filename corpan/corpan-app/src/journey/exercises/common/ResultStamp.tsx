// src/journey/exercises/common/ResultStamp.tsx — correct/incorrect stamp
// morph (feeds CelebrationLayer tier 0). Gentle on misses — no harsh red
// flash (feed-ux §3.3).

import { AnimatePresence, motion } from "framer-motion"
import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"

export function ResultStamp(props: { state: "correct" | "incorrect" | null }) {
  const { t } = useTranslation()
  return (
    <AnimatePresence>
      {props.state && (
        <motion.div
          key={props.state}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-2"
          data-testid={`journey-stamp-${props.state}`}
        >
          {props.state === "correct" ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Check className="h-5 w-5" />
            </span>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <X className="h-5 w-5" />
            </span>
          )}
          <span className="text-sm font-medium text-muted-foreground">
            {props.state === "correct"
              ? t("journey.exercise.correct")
              : t("journey.exercise.incorrect")}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
