// src/journey/celebration/CelebrationLayer.tsx — ONE host-owned layer, 4
// juice tiers + intensity (feed-ux §1.5). Every provider (native renderer,
// pack round, reader chapter) gets feedback free. API is imperative via a
// tiny module-level emitter — no prop drilling.
//
// The tier-1 correct is a big, springy PRAISE-WORD splash (fresh exclamation
// every time, from `praise.ts`) rendered ABOVE the card, plus a rotating,
// combo-weighted VISUAL EFFECT drawn by the pluggable registry in `effects/`.
// Escalation is the retention hook: calm at combo 1, fireworks by combo 10+.

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { useJourneyStore, type JuiceIntensity } from "../../store/journey.ts"
import { comboMomentum } from "../feed/cardTransition.ts"
import { burst, clearParticles } from "./particles.ts"
import { playChime, playFlourish } from "./sounds.ts"
import { fireHaptic, registerHapticGate, type HapticGate } from "./haptics.ts"
import { createPraiseSampler, type PraiseKey } from "./praise.ts"
import { createEffectPicker } from "./effects/registry.ts"
import type { EffectContext } from "./effects/types.ts"

export type CelebrationTier = 0 | 1 | 2 | 3
export type MilestoneKind = "unitComplete" | "wordsLearned" | "streakDay" | "placementDone"

export interface CelebrationEvent {
  tier: CelebrationTier
  /** Combo depth for this moment. settle.ts now supplies this on EVERY pass —
   *  it is the primary ESCALATION driver (combo 1 = gentle, combo 10+ = fireworks). */
  comboCount?: number
  /** A clean, fast, hint-free first try — BONUS gold flair on top of the
   *  combo-scaled base (not a gate; an ordinary pass still celebrates). */
  perfect?: boolean
  milestone?: MilestoneKind
  milestoneValue?: number | string
  anchorEl?: HTMLElement
}

type ActiveMoment = CelebrationEvent & { id: number; settle: () => void; praiseKey: PraiseKey }

const TIER_BUDGET_MS: Record<CelebrationTier, number> = { 0: 400, 1: 950, 2: 1600, 3: 1200 }

let seq = 0
let emit: ((m: ActiveMoment) => void) | null = null
let skipActive: (() => void) | null = null

/** Fire a celebration. Resolves when the moment ends (or is skipped). */
export function celebrate(e: CelebrationEvent): Promise<void> {
  if (!emit) return Promise.resolve()
  return new Promise<void>((resolve) => {
    emit?.({ ...e, id: ++seq, settle: resolve, praiseKey: "journey.celebrate.praise.perfect" })
  })
}

/** A scroll gesture during celebration skips it (celebrate() races this). */
export function skipCelebration(): void {
  skipActive?.()
}

/** Combo-warmed accent hue: purple when calm → amber-gold as the streak climbs. */
function warmHue(comboCount: number): number {
  const m = comboMomentum(comboCount)
  return Math.round(262 - (262 - 40) * m * 0.7)
}

export function CelebrationLayer() {
  const { t } = useTranslation()
  const intensity: JuiceIntensity = useJourneyStore((s) => s.juiceIntensity)
  const soundsEnabled = useJourneyStore((s) => s.soundsEnabled)
  const reducedMotion = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const effectHostRef = useRef<HTMLDivElement | null>(null)
  const [moment, setMoment] = useState<ActiveMoment | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Session-lived samplers: fresh praise word + non-repeating effect rotation.
  const praiseRef = useRef(createPraiseSampler())
  const pickerRef = useRef(createEffectPicker())
  // The teardown for the currently-running visual effect (nulled once run).
  const effectCleanupRef = useRef<(() => void) | null>(null)

  // reduced-motion always downgrades full → reduced (spec §1.5).
  const effective: JuiceIntensity =
    intensity === "full" && reducedMotion ? "reduced" : intensity
  const sounds = soundsEnabled && effective !== "minimal"

  // The haptic gate mirrors the sound/haptic setting (soundsEnabled) and honors
  // reduced-motion + minimal intensity (§3.2). Published to the module so the
  // miss path (playSoftMiss) can buzz with the same gate — no prop drilling.
  const hapticGate: HapticGate = {
    enabled: soundsEnabled,
    reducedMotion: !!reducedMotion,
    intensity: effective,
  }

  useEffect(() => {
    const tearDownEffect = () => {
      effectCleanupRef.current?.()
      effectCleanupRef.current = null
    }

    // Draw the shared particle canvas + one rotating registry effect for a
    // moment. Gated OUT for minimal (quiet text only). Combo ≥ 10 also fires a
    // confetti finale under the chosen effect — the fireworks payoff.
    const runVisuals = (m: ActiveMoment) => {
      if (effective === "minimal") return
      const canvas = canvasRef.current
      const host = effectHostRef.current
      const root = rootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      if (canvas) {
        canvas.width = rect.width
        canvas.height = rect.height
      }
      const anchor = m.anchorEl?.getBoundingClientRect()
      const cx = anchor ? anchor.left + anchor.width / 2 - rect.left : rect.width / 2
      // Sit the burst a touch above center so it reads behind the praise word.
      const cy = anchor ? anchor.top + anchor.height / 2 - rect.top : rect.height * 0.42
      const comboCount = m.comboCount ?? 0
      const perfect = m.perfect === true
      const mom = comboMomentum(comboCount)
      const ctx: EffectContext = {
        comboCount,
        perfect,
        tier: m.tier,
        reducedMotion: !!reducedMotion,
        intensity: effective,
        cx,
        cy,
        width: rect.width,
        height: rect.height,
        hue: warmHue(comboCount),
        canvas,
      }

      tearDownEffect()
      if (host) {
        const effect = pickerRef.current.pick(ctx)
        if (effect) {
          const cleanup = effect.render(host, ctx)
          effectCleanupRef.current = cleanup
          // Self-clean at the effect's own budget (independent of the splash).
          window.setTimeout(() => {
            if (effectCleanupRef.current === cleanup) tearDownEffect()
          }, effect.durationMs + 60)
        }
        // Deep-combo screen-shake — a Block-Blast punch. Transform-only (never
        // reflows), full-intensity + motion-allowed only, amplitude grows with
        // the streak. Applied to the effect host so the card stays put.
        if (effective === "full" && !reducedMotion && comboCount >= 6 && typeof host.animate === "function") {
          const amp = Math.min(3 + 7 * mom, 10)
          host.animate(
            [
              { transform: "translate(0px, 0px)" },
              { transform: `translate(${-amp}px, ${amp * 0.6}px)` },
              { transform: `translate(${amp * 0.8}px, ${-amp * 0.5}px)` },
              { transform: `translate(${-amp * 0.5}px, ${amp * 0.3}px)` },
              { transform: "translate(0px, 0px)" },
            ],
            { duration: 260, easing: "ease-out" },
          )
        }
      }

      // Escalation payoff: a milestone (tier ≥2) or a deep combo (≥8) earns a
      // confetti finale layered under the effect — density climbs with the streak.
      if (canvas && effective === "full" && (m.tier >= 2 || comboCount >= 8)) {
        burst(canvas, cx, cy, {
          colorful: true,
          count: m.tier >= 2 ? 120 : Math.round(60 + 60 * mom),
          power: 1.3,
        })
      }
      // BONUS gold sparkle for a clean fast first try — a distinct "premium"
      // shimmer on top of whatever the combo earned. (Reached only when
      // effective !== "minimal": runVisuals returns early for minimal.)
      if (canvas && perfect) {
        burst(canvas, cx, cy - 8, { count: 18, hue: 46, power: 0.9 })
      }
    }

    emit = (m) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      // Fresh praise word for a tier-1 correct (milestones use their own label).
      const withPraise: ActiveMoment =
        m.tier === 1 ? { ...m, praiseKey: praiseRef.current.next() } : m
      setMoment((prev) => {
        prev?.settle()
        return withPraise
      })
      // Sound BUILDS with the streak (a pass now fires every card — a full
      // flourish on every single answer would fatigue). Low combo = one gentle
      // chime; from combo 3 it blooms into the two-note ascending flourish, and
      // the pitch keeps climbing with the combo inside playChime/playFlourish.
      if (sounds) {
        const c = m.comboCount ?? 0
        if (m.tier === 0 || c <= 2) playChime(c)
        else playFlourish(c)
      }
      // Haptics: a `land` on any correct resolve; a richer `combo` tick at a
      // combo milestone (every 5th, carried on the event by settle.ts). Gated +
      // capability-checked inside fireHaptic — a no-op on desktop / when off.
      const isComboMilestone =
        typeof m.comboCount === "number" && m.comboCount >= 5 && m.comboCount % 5 === 0
      fireHaptic(isComboMilestone ? "combo" : "land", hapticGate)
      if (m.tier >= 1) runVisuals(withPraise)
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
      tearDownEffect()
      clearParticles()
      setMoment((prev) => {
        prev?.settle()
        return null
      })
    }
    // Publish the live gate so the miss path (playSoftMiss → fireHapticAmbient)
    // buzzes with the same reduced-motion + sound/haptic gating.
    registerHapticGate(hapticGate)
    return () => {
      emit = null
      skipActive = null
      registerHapticGate(null)
      if (timerRef.current) clearTimeout(timerRef.current)
      tearDownEffect()
      clearParticles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective, sounds, reducedMotion, soundsEnabled])

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

  const comboOf = (m: ActiveMoment) => m.comboCount ?? 0

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-[1065] overflow-hidden"
    >
      <canvas ref={canvasRef} className="absolute inset-0 z-0 h-full w-full" aria-hidden />
      {/* Imperative CSS-3D effect host — absolute children only, never reflows. */}
      <div
        ref={effectHostRef}
        className="absolute inset-0 z-10"
        aria-hidden
        style={{ transformStyle: "preserve-3d" }}
      />
      <AnimatePresence>
        {moment && moment.tier === 1 && effective !== "minimal" && (
          <PraiseSplash
            key={moment.id}
            label={
              // A "N in a row" streak callout every 5th card; a fresh praise word
              // otherwise (variety keeps the learner playing for the next word).
              moment.comboCount && moment.comboCount >= 5 && moment.comboCount % 5 === 0
                ? t("journey.celebrate.combo", { count: moment.comboCount })
                : t(moment.praiseKey)
            }
            combo={comboOf(moment)}
            perfect={moment.perfect === true}
          />
        )}
        {moment && moment.tier === 2 && (
          <motion.div
            key={moment.id}
            className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex flex-col items-center gap-2 px-8 text-center"
              initial={{ scale: effective === "minimal" ? 1 : 0.86, y: effective === "minimal" ? 0 : 10 }}
              animate={{ scale: 1, y: 0 }}
              transition={
                effective === "minimal"
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 420, damping: 16 }
              }
            >
              <div className="text-4xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">✦</div>
              <div className="text-xl font-bold text-foreground">{milestoneLabel(moment)}</div>
            </motion.div>
          </motion.div>
        )}
        {moment && moment.tier === 1 && effective === "minimal" && (
          <motion.div
            key={`min-${moment.id}`}
            className="absolute inset-x-0 top-[18%] z-20 flex justify-center text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {t(moment.praiseKey)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * The praise-word splash: springy, ABOVE the card, legible over any background
 * (gradient fill + dark stroke + glow). It ESCALATES: tasteful/small at combo 1
 * (it now fires on EVERY correct — it must not feel spammy), swelling toward a
 * bold explosion by combo 8-10+. A clean fast first-try (`perfect`) takes a
 * distinct GOLD accent as a bonus. Overlay-only — participates in no layout flow.
 */
function PraiseSplash(props: { label: string; combo: number; perfect?: boolean }) {
  const reduced = useReducedMotion()
  const m = comboMomentum(props.combo)
  // Perfect answers get a premium gold; otherwise the combo-warmed accent.
  const hue = props.perfect ? 44 : warmHue(props.combo)
  // Small at combo 1 (~2.1rem), growing to a bold ~3.8rem by deep combos —
  // the build-up IS the hook. Glow + stroke firm up with the streak too.
  const fontRem = 2.1 + 1.7 * m
  const glow = (0.3 + 0.55 * m) * (props.perfect ? 1.25 : 1)
  return (
    <div className="absolute inset-x-0 top-[34%] z-20 flex justify-center px-6">
      <motion.div
        initial={
          reduced
            ? { opacity: 0, scale: 1 }
            : { opacity: 0, scale: 0.5 + 0.1 * (1 - m), rotate: -5 + 3 * m }
        }
        animate={reduced ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.18 + 0.18 * m, y: -16 }}
        transition={
          reduced
            ? { duration: 0.15 }
            : // Snappier + bouncier as the combo climbs (a firmer "punch").
              { type: "spring", stiffness: 460 + 160 * m, damping: 15 - 3 * m, mass: 0.7 }
        }
        style={{
          fontSize: `clamp(1.9rem, ${fontRem}rem, 5rem)`,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          textAlign: "center",
          color: "transparent",
          backgroundImage: `linear-gradient(180deg, hsl(${hue} 95% 74%), hsl(${hue + 18} 88% 52%))`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextStroke: "2.5px rgba(20,10,40,0.42)",
          paintOrder: "stroke fill",
          filter: `drop-shadow(0 3px 14px rgba(0,0,0,0.4)) drop-shadow(0 0 ${22 + 16 * m}px hsl(${hue} 92% 60% / ${glow}))`,
        }}
      >
        {props.label}
      </motion.div>
    </div>
  )
}
