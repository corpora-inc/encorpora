// src/journey/feed/CheckpointCard.tsx — the designed stopping point
// (feed-ux §1.6). Never auto-advances. Stopping is presented as a win.
// Two equal-weight buttons — identical size/variant, order swapped on RTL
// (document dir handles that: they're siblings in a flex row).

import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import type { CheckpointSummary } from "../engine/index.ts"
import type { SessionStats } from "../types.ts"

const DEEP_SESSION_MS = 25 * 60 * 1000

export function DailyRing(props: { done: number; goal: number }) {
  const { t } = useTranslation()
  const frac = Math.min(props.done / Math.max(props.goal, 1), 1)
  const overflow = props.done > props.goal
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <div className="relative flex h-20 w-20 items-center justify-center" aria-label={t("journey.checkpoint.dailyRing", { done: props.done, goal: props.goal })}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <motion.circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={overflow ? "stroke-[hsl(var(--journey-accent,262_80%_58%))] drop-shadow-[0_0_6px_hsl(var(--journey-accent,262_80%_58%)/0.7)]" : "stroke-[hsl(var(--journey-accent,262_80%_58%))]"}
          initial={{ strokeDasharray: c, strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - frac) }}
          transition={{ duration: 0.6 }}
        />
      </svg>
      <div className="absolute text-center text-xs font-semibold text-foreground">
        {props.done}/{props.goal}
      </div>
    </div>
  )
}

export function CheckpointCard(props: {
  summary: CheckpointSummary
  stats: SessionStats
  cardsToday: number
  dailyGoal: number
  unitName: string | null
  quotaRemaining: number
  quotaLimit: number
  streakDays: number
  nextTease: string | null
  onDone: () => void
  onKeepGoing: () => void
}) {
  const { t } = useTranslation()
  const deep = Date.now() - props.stats.startedAt >= DEEP_SESSION_MS
  const quotaFinite = Number.isFinite(props.quotaRemaining)
  const showQuotaLine = quotaFinite && props.quotaRemaining <= 10

  return (
    <div className="flex w-full max-w-[26rem] flex-col items-center gap-5 text-center" data-testid="journey-checkpoint">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {t("journey.checkpoint.title")}
      </div>
      <div className="text-lg font-semibold text-foreground">
        {t("journey.checkpoint.summary", {
          new: props.stats.newCount,
          reviews: props.stats.reviewCount,
          combo: props.stats.bestCombo,
        })}
      </div>
      <DailyRing done={props.cardsToday} goal={props.dailyGoal} />
      {props.unitName ? (
        <div className="text-sm text-muted-foreground">{props.unitName}</div>
      ) : null}
      {props.streakDays > 0 ? (
        <div className="text-sm font-medium text-foreground">
          {t("journey.checkpoint.streakTicked", { count: props.streakDays })}
        </div>
      ) : null}
      {deep ? (
        <div className="text-sm text-muted-foreground">{t("journey.checkpoint.deepSession")}</div>
      ) : null}
      {showQuotaLine ? (
        <div className="text-sm text-muted-foreground">
          {t("journey.quota.cardsLeft", { count: props.quotaRemaining })}
        </div>
      ) : null}
      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={props.onDone}
          data-testid="journey-checkpoint-done"
          className="min-h-12 flex-1 rounded-xl border border-border bg-card text-base font-semibold text-foreground hover:bg-muted"
        >
          {t("journey.checkpoint.done")}
        </button>
        <button
          type="button"
          onClick={props.onKeepGoing}
          data-testid="journey-checkpoint-continue"
          className="min-h-12 flex-1 rounded-xl border border-border bg-card text-base font-semibold text-foreground hover:bg-muted"
        >
          {t("journey.checkpoint.keepGoing")}
        </button>
      </div>
      {props.nextTease ? (
        <div className="text-xs text-muted-foreground">
          {t("journey.tease.next", { title: props.nextTease })}
        </div>
      ) : null}
    </div>
  )
}

/** Boss/arc-gate banner over an exercise card that belongs to a checkpoint
 *  BATCH (engine emits them as exercise cards with meta.checkpoint; the
 *  engine's pass_score gates advancement — the surface renders what arrives). */
export function BossBanner(props: { scope: "unit" | "arc"; index: number; count: number }) {
  const { t } = useTranslation()
  return (
    <div className="mb-4 flex items-center gap-2 rounded-full bg-[hsl(var(--journey-accent,262_80%_58%)/0.12)] px-3.5 py-1.5 text-xs font-semibold text-foreground" data-testid="journey-boss-banner">
      <span>
        {props.scope === "arc" ? t("journey.checkpoint.arcGate") : t("journey.checkpoint.boss")}
      </span>
      <span className="text-muted-foreground">
        {props.index + 1}/{props.count}
      </span>
    </div>
  )
}

export function BossCard(props: { index: number; count: number }) {
  return <BossBanner scope="unit" index={props.index} count={props.count} />
}

export function ArcGateCard(props: { index: number; count: number }) {
  return <BossBanner scope="arc" index={props.index} count={props.count} />
}
