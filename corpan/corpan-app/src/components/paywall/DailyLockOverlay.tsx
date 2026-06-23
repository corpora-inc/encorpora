import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePaywallStore, type PaywallSurface } from "@/store/paywall"
import { useSettingsStore } from "@/store/settings"
import { trackDailyLockShown, trackDailyLockUpgradeTapped } from "@/util/analytics"
import { getPackStreak } from "@shared/streak"
import corpanMark from "@/assets/corpan-mark-trim.png"

/**
 * The ONE universal "you did your N today ✓" daily-cap lock — the positive,
 * scarcity-framed face of gate v2. Shown when a pack hits its hard daily quota
 * (the shared monetization gate dispatches `corpan:daily-locked`). NOT an error:
 * a satisfying green check + a live countdown to local-midnight reset + a single
 * "Go further, faster with Corpán Plus" upsell into the universal paywall.
 *
 * Mirrors PaywallSheet's immersive dark shell + Corpán mark + scoped palette so
 * the two conversion surfaces read as one brand. The lock is "soft-dismissible"
 * (Maybe later) but the pack stays gated until reset or subscribe — dismiss only
 * closes the overlay; it does not unlock.
 */

export type DailyLockContext = {
  packId: string
  surface: PaywallSurface
  doneToday: number
  /** The configured daily cap (the "N {{unit}} for today" count). */
  limit: number
  /** Next local-midnight ISO string (from the gate). */
  resetAt: string
  unitLabel: string
}

type ThemeStyle = CSSProperties & Record<`--${string}`, string>

// Same near-black + Corpán-purple palette the paywall sheet uses.
const LOCK_PALETTE: ThemeStyle = {
  color: "#ECEAF6",
  "--foreground": "#ECEAF6",
  "--primary": "#A879F7",
  "--primary-foreground": "#0C0A14",
  "--border": "rgba(236,234,246,0.16)",
  "--muted-foreground": "rgba(236,234,246,0.62)",
}

/** Accomplishment green for the check (a warm, confident success, not error). */
const ACCOMPLISH = "#34D399"

/** Format ms-until-reset as "13h 47m" / "47m" / "<1m" (no seconds churn). */
function formatCountdown(ms: number): { h: number; m: number } {
  const total = Math.max(0, ms)
  const h = Math.floor(total / 3_600_000)
  const m = Math.floor((total % 3_600_000) / 60_000)
  return { h, m }
}

export function DailyLockOverlay({
  context,
  onClose,
}: {
  context: DailyLockContext
  onClose: () => void
}) {
  const { t } = useTranslation()
  const dir = useSettingsStore((s) => s.dir)
  const reduceMotion = useReducedMotion()

  const resetMs = useMemo(() => {
    const ts = new Date(context.resetAt).getTime()
    return Number.isFinite(ts) ? ts : Date.now()
  }, [context.resetAt])

  // The CURRENT pack's visit streak (consecutive days opened) — recorded at the
  // pack-enter boundary, so by the time the cap is hit today's visit is counted.
  // Drives the "come back tomorrow to keep it going" framing.
  const streakDays = useMemo(
    () => getPackStreak(context.packId).current,
    [context.packId],
  )

  // Live countdown — tick once a minute (we only render h/m, so per-second is
  // wasteful and battery-hostile). Seed `now` immediately so the first paint is
  // correct.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  // Analytics: one shown event per surfacing.
  useEffect(() => {
    trackDailyLockShown(context.packId, context.surface)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.packId, context.surface])

  // Lock background scroll while up.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Escape dismisses (stays locked).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const { h, m } = formatCountdown(resetMs - now)
  const countdownText =
    h > 0
      ? t("dailyLock.countdownHm", { defaultValue: "{{h}}h {{m}}m", h, m })
      : m > 0
        ? t("dailyLock.countdownM", { defaultValue: "{{m}}m", m })
        : t("dailyLock.countdownSoon", { defaultValue: "any moment" })

  const streakLine =
    streakDays >= 2
      ? t("dailyLock.streakActive", {
          defaultValue: "{{days}}-day streak — come back tomorrow to keep it going.",
          days: streakDays,
        })
      : t("dailyLock.streakStart", {
          defaultValue: "Come back tomorrow to keep your streak going.",
        })

  const upgrade = () => {
    trackDailyLockUpgradeTapped(context.packId)
    // Hand off to the ONE universal paywall.
    usePaywallStore.getState().openPaywall({
      surface: context.surface,
      packId: context.packId,
    })
    onClose()
  }

  const fade = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.18 } }
    : {
        initial: { opacity: 0, y: 20, scale: 0.985 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 14, scale: 0.99 },
        transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
      }

  // The check pops in (scale/draw) unless reduced motion.
  const checkAnim = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
    : {
        initial: { opacity: 0, scale: 0.5 },
        animate: { opacity: 1, scale: 1 },
        transition: { delay: 0.08, type: "spring" as const, stiffness: 320, damping: 18 },
      }

  return (
    <AnimatePresence>
      <motion.div
        key="corpan-daily-lock"
        role="dialog"
        aria-modal="true"
        aria-label={t("dailyLock.title", {
          defaultValue: "That's your {{count}} {{unit}} for today — nicely done",
          count: context.limit,
          unit: context.unitLabel,
        })}
        dir={dir()}
        className="fixed inset-0 z-[1400] overflow-y-auto no-scrollbar"
        style={{ ...LOCK_PALETTE, WebkitOverflowScrolling: "touch" }}
        initial={fade.initial}
        animate={fade.animate}
        exit={fade.exit}
        transition={fade.transition}
      >
        {/* Immersive backdrop — a faint GREEN aura up top (accomplishment) over
            the same near-black well as the paywall. Tap the surround = dismiss. */}
        <button
          type="button"
          aria-label={t("dailyLock.closeAria", { defaultValue: "Dismiss" })}
          onClick={onClose}
          className="fixed inset-0 -z-10 cursor-default"
          style={{
            backgroundColor: "#07070A",
            backgroundImage:
              "radial-gradient(120% 70% at 50% -10%, rgba(52,211,153,0.16), transparent 60%)," +
              "radial-gradient(100% 60% at 50% 115%, rgba(98,66,168,0.16), transparent 60%)," +
              "linear-gradient(to bottom, #0C0A14, #07070A 55%, #050507)",
          }}
        />

        <div
          className="relative flex min-h-full flex-col items-center justify-center px-6"
          style={{
            paddingTop: "max(env(safe-area-inset-top), 3.5rem)",
            paddingBottom: "max(env(safe-area-inset-bottom), 2rem)",
            paddingInlineStart: "max(env(safe-area-inset-left), 1.5rem)",
            paddingInlineEnd: "max(env(safe-area-inset-right), 1.5rem)",
          }}
        >
          <div className="w-full max-w-md md:max-w-lg">
            <div className="flex flex-col items-center text-center">
              {/* Big, satisfying green check in a soft halo. */}
              <motion.div
                initial={checkAnim.initial}
                animate={checkAnim.animate}
                transition={checkAnim.transition}
                className="flex items-center justify-center rounded-full"
                style={{
                  height: 88,
                  width: 88,
                  backgroundColor: "rgba(52,211,153,0.12)",
                  boxShadow: "0 0 0 1px rgba(52,211,153,0.30), 0 8px 40px rgba(52,211,153,0.25)",
                }}
              >
                <Check
                  strokeWidth={3}
                  style={{ height: 44, width: 44, color: ACCOMPLISH }}
                />
              </motion.div>

              {/* Accomplishment headline + understated brand-voice line. */}
              <h2
                className="mt-6 font-semibold tracking-tight"
                style={{
                  fontSize: "clamp(22px, 5.2vw, 30px)",
                  lineHeight: 1.18,
                  color: "var(--foreground)",
                }}
              >
                {t("dailyLock.title", {
                  defaultValue: "That's your {{count}} {{unit}} for today — nicely done",
                  count: context.limit,
                  unit: context.unitLabel,
                })}
              </h2>
              <p
                className="mt-2.5 text-[color:var(--muted-foreground)]"
                style={{ fontSize: "clamp(13px, 3.4vw, 15px)", lineHeight: 1.5, maxWidth: "32ch" }}
              >
                {streakLine}
              </p>

              {/* Live countdown to reset — scarcity, calmly stated. */}
              <div
                className="mt-6 inline-flex items-center gap-2 rounded-lg px-3.5 py-2"
                style={{
                  backgroundColor: "rgba(236,234,246,0.06)",
                  border: "1px solid var(--border)",
                }}
              >
                <span
                  aria-hidden
                  className="inline-block rounded-full"
                  style={{ height: 7, width: 7, backgroundColor: ACCOMPLISH }}
                />
                <span
                  className="tabular-nums"
                  style={{ fontSize: "clamp(13px, 3.4vw, 15px)", color: "var(--foreground)" }}
                >
                  {t("dailyLock.resetIn", {
                    defaultValue: "Resets in {{time}}",
                    time: countdownText,
                  })}
                </span>
              </div>
            </div>

            {/* Upsell → the universal paywall, then a quiet dismiss. */}
            <div className="mt-8">
              <Button className="w-full !h-12" onClick={upgrade}>
                {t("dailyLock.cta", {
                  defaultValue: "Continue now with Corpán Plus",
                })}
              </Button>
              <button
                type="button"
                onClick={onClose}
                className="mx-auto mt-4 block text-xs text-[color:var(--muted-foreground)] underline underline-offset-2 transition-colors hover:text-[color:var(--foreground)]"
              >
                {t("dailyLock.dismiss", { defaultValue: "Maybe later" })}
              </button>
            </div>

            {/* The Corpán mark, quiet at the foot — ties to the paywall shell. */}
            <div className="mt-8 flex justify-center">
              <img
                src={corpanMark}
                alt="Corpán"
                draggable={false}
                className="select-none"
                style={{ height: 26, width: "auto", opacity: 0.5 }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
