// src/journey/feed/FeedCardFrame.tsx — the card frame (feed-ux §1.3/§3.1):
// settled checkmark stamp, "viewed earlier" chip in review mode, and the
// why-this-card long-press transparency popover (§3.1, engagement §2.9.7).
//
// (File name: the spec calls this FeedCard.tsx; renamed to avoid colliding
// with the FeedCard TYPE in types.ts — same component, same duties.)

import { useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Check } from "lucide-react"
import type { FeedCard } from "../types.ts"

const WHY_PRESS_MS = 500

export function FeedCardFrame(props: {
  card: FeedCard
  settled: boolean
  review: boolean
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const [why, setWhy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reason = (): string => {
    const c = props.card
    if (c.kind !== "exercise") return t("journey.exercise.whyGuided")
    const pool = c.prepared.engine.meta.pool
    if (pool === "new") return t("journey.exercise.whyNew")
    if (pool === "due" || pool === "replay") return t("journey.exercise.whyReview")
    if (pool === "repair") return t("journey.exercise.whyRepair")
    return t("journey.exercise.whyGuided")
  }

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center px-5 py-6"
      onPointerDown={() => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setWhy(true), WHY_PRESS_MS)
      }}
      onPointerUp={() => {
        if (timer.current) clearTimeout(timer.current)
      }}
      onPointerLeave={() => {
        if (timer.current) clearTimeout(timer.current)
      }}
    >
      <motion.div
        className="mx-auto flex w-full max-w-[40rem] flex-1 flex-col items-center justify-center"
        animate={{ scale: props.settled ? 0.98 : 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
      >
        {props.review ? (
          <div className="mb-3 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {t("journey.exercise.reviewedEarlier")}
          </div>
        ) : null}
        {props.children}
      </motion.div>
      <AnimatePresence>
        {props.settled && !props.review && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute end-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          >
            <Check className="h-5 w-5" />
          </motion.div>
        )}
        {why && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => setWhy(false)}
            className="absolute inset-x-6 bottom-8 rounded-xl border border-border bg-card px-4 py-3 text-start text-sm text-foreground shadow-lg"
          >
            <span className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("journey.exercise.whyThisCard")}
            </span>
            {reason()}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
