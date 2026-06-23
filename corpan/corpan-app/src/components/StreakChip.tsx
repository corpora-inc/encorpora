import { useTranslation } from "react-i18next"
import { Flame } from "lucide-react"
import { useProgressStore } from "@/store/progress"

const STREAK_ENABLED_KEY = "corpan-streak-enabled"

/** Opt-in: the streak chip is off by default (no Duolingo-style nagging). */
export function isStreakEnabled(): boolean {
  try {
    return localStorage.getItem(STREAK_ENABLED_KEY) === "true"
  } catch {
    return false
  }
}

export function setStreakEnabled(on: boolean): void {
  try {
    localStorage.setItem(STREAK_ENABLED_KEY, on ? "true" : "false")
  } catch {
    /* ignore */
  }
}

/**
 * A small, dignified streak chip. Opt-in (hidden unless enabled in Settings)
 * and silent — no loss-aversion popups, no reminders. Renders nothing when
 * disabled or when there's no active streak.
 */
export function StreakChip() {
  const { t } = useTranslation()
  const streak = useProgressStore((s) => s.streakDays())

  if (!isStreakEnabled() || streak <= 0) return null

  return (
    <div
      className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
      title={t("streak.title", "{{count}}-day streak", { count: streak })}
      aria-label={t("streak.title", "{{count}}-day streak", { count: streak })}
    >
      <Flame className="h-3.5 w-3.5 text-orange-500" />
      <span>{streak}</span>
    </div>
  )
}
