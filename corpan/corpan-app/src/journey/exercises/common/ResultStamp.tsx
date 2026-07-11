// src/journey/exercises/common/ResultStamp.tsx — correct/incorrect stamp
// morph (feeds CelebrationLayer tier 0). Gentle on misses — no harsh red
// flash (feed-ux §3.3).

import { AnimatePresence, motion } from "framer-motion"
import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"

export function ResultStamp(props: {
  state: "correct" | "incorrect" | null
  /** Whisper accuracy 0..100 for a speak_echo settle — a quick confidence read
   *  beside the ✓/✗ (feed-ux vibes). Omit for non-spoken cards. */
  confidence?: number | null
}) {
  const { t } = useTranslation()
  const hasConfidence = typeof props.confidence === "number"
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
          {hasConfidence ? (
            // A glanceable accuracy read, revealed a beat AFTER the ✓/✗ lands so
            // the eye catches the verdict first, then the confidence resolves in
            // — the signature "you nailed it" moment (§3.6). Locale-neutral "NN%"
            // (no new string). A strong read (≥80) fills with the accent color;
            // a softer read stays muted — the fill carries the meaning, not copy.
            <motion.span
              key="conf"
              data-testid="journey-stamp-confidence"
              className={
                "rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums " +
                ((props.confidence as number) >= 80
                  ? "bg-[hsl(var(--journey-accent,262_80%_58%)/0.16)] text-foreground"
                  : "bg-muted text-muted-foreground")
              }
              initial={{ opacity: 0, scale: 0.8, x: -4 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ delay: 0.18, type: "spring", stiffness: 380, damping: 26 }}
              aria-label={`${Math.round(props.confidence as number)}%`}
            >
              {Math.round(props.confidence as number)}%
            </motion.span>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
