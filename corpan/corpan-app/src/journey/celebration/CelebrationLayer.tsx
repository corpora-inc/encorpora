// src/journey/celebration/CelebrationLayer.tsx — ONE host-owned layer, 4
// juice tiers + intensity (feed-ux §1.5). Every provider (native renderer,
// pack round, reader chapter) gets feedback free. API is imperative via a
// tiny module-level emitter — no prop drilling.

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { useJourneyStore, type JuiceIntensity } from "../../store/journey.ts"
import { burst, clearParticles } from "./particles.ts"
import { playChime, playFlourish } from "./sounds.ts"

export type CelebrationTier = 0 | 1 | 2 | 3
export type MilestoneKind = "unitComplete" | "wordsLearned" | "streakDay" | "placementDone"

export interface CelebrationEvent {
  tier: CelebrationTier
  comboCount?: number
  milestone?: MilestoneKind
  milestoneValue?: number | string
  anchorEl?: HTMLElement
}

type ActiveMoment = CelebrationEvent & { id: number; settle: () => void }

const TIER_BUDGET_MS: Record<CelebrationTier, number> = { 0: 400, 1: 800, 2: 1600, 3: 1200 }

let seq = 0
let emit: ((m: ActiveMoment) => void) | null = null
let skipActive: (() => void) | null = null

/** Fire a celebration. Resolves when the moment ends (or is skipped). */
export function celebrate(e: CelebrationEvent): Promise<void> {
  if (!emit) return Promise.resolve()
  return new Promise<void>((resolve) => {
    emit?.({ ...e, id: ++seq, settle: resolve })
  })
}

/** A scroll gesture during celebration skips it (celebrate() races this). */
export function skipCelebration(): void {
  skipActive?.()
}

export function CelebrationLayer(): JSX.Element {
  const { t } = useTranslation()
  const intensity: JuiceIntensity = useJourneyStore((s) => s.juiceIntensity)
  const soundsEnabled = useJourneyStore((s) => s.soundsEnabled)
  const reducedMotion = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [moment, setMoment] = useState<ActiveMoment | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // reduced-motion always downgrades full → reduced (spec §1.5).
  const effective: JuiceIntensity =
    intensity === "full" && reducedMotion ? "reduced" : intensity
  const sounds = soundsEnabled && effective !== "minimal"

  useEffect(() => {
    emit = (m) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setMoment((prev) => {
        prev?.settle()
        return m
      })
      if (sounds) {
        if (m.tier === 0) playChime(m.comboCount ?? 0)
        else playFlourish(m.comboCount ?? 0)
      }
      if (m.tier >= 1 && effective === "full" && canvasRef.current && rootRef.current) {
        const canvas = canvasRef.current
        const rect = rootRef.current.getBoundingClientRect()
        canvas.width = rect.width
        canvas.height = rect.height
        const anchor = m.anchorEl?.getBoundingClientRect()
        const x = anchor ? anchor.left + anchor.width / 2 - rect.left : rect.width / 2
        const y = anchor ? anchor.top + anchor.height / 2 - rect.top : rect.height / 2
        burst(canvas, x, y, { count: m.tier >= 2 ? 60 : 28 })
      }
      timerRef.current = setTimeout(() => {
        setMoment((prev) => {
          if (prev?.id === m.id) {
            prev.settle()
            return null
          }
          return prev
        })
      }, TIER_BUDGET_MS[m.tier])
    }
    skipActive = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setMoment((prev) => {
        prev?.settle()
        return null
      })
    }
    return () => {
      emit = null
      skipActive = null
      if (timerRef.current) clearTimeout(timerRef.current)
      clearParticles()
    }
  }, [effective, sounds])

  const milestoneLabel = (m: ActiveMoment): string => {
    switch (m.milestone) {
      case "unitComplete":
        return t("journey.celebrate.unitComplete", { name: m.milestoneValue ?? "" })
      case "wordsLearned":
        return t("journey.celebrate.wordsLearned", { count: Number(m.milestoneValue ?? 0) })
      case "streakDay":
        return t("journey.celebrate.streakDay", { count: Number(m.milestoneValue ?? 0) })
      case "placementDone":
        return t("journey.celebrate.placementDone")
      default:
        return t("journey.celebrate.perfect")
    }
  }

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      <AnimatePresence>
        {moment && moment.tier === 1 && effective !== "minimal" && (
          <motion.div
            key={moment.id}
            className="absolute inset-x-0 top-[18%] flex justify-center"
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="rounded-full bg-[hsl(var(--journey-accent,262_80%_58%)/0.14)] px-4 py-1.5 text-sm font-semibold text-foreground shadow-sm">
              {moment.comboCount && moment.comboCount >= 5
                ? t("journey.celebrate.combo", { count: moment.comboCount })
                : t("journey.celebrate.perfect")}
            </div>
          </motion.div>
        )}
        {moment && moment.tier === 2 && (
          <motion.div
            key={moment.id}
            className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex flex-col items-center gap-2 px-8 text-center"
              initial={{ scale: effective === "minimal" ? 1 : 0.9 }}
              animate={{ scale: 1 }}
            >
              <div className="text-3xl">✦</div>
              <div className="text-xl font-bold text-foreground">{milestoneLabel(moment)}</div>
            </motion.div>
          </motion.div>
        )}
        {moment && moment.tier === 1 && effective === "minimal" && (
          <motion.div
            key={`min-${moment.id}`}
            className="absolute inset-x-0 top-[18%] flex justify-center text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {t("journey.celebrate.perfect")}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
