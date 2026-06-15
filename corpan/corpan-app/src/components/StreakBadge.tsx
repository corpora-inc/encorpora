import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Flame } from "lucide-react"
import { getPackStreak, type StreakChangedDetail } from "@shared/streak"

/**
 * A small, dignified per-pack visit-streak badge (consecutive local days a pack
 * was opened). Shown to ALL users — it's retention, never a gate. Squared 8px
 * corners + a subtle spark glyph + the day count; renders nothing below 2 days
 * so 0/1 never clutters a tile. Subscribes to `corpan:streak-changed` so it
 * updates live when the host records a visit.
 */
export function StreakBadge({ packId, className }: { packId: string; className?: string }) {
  const { t } = useTranslation()
  const [days, setDays] = useState(() => getPackStreak(packId).current)

  useEffect(() => {
    setDays(getPackStreak(packId).current)
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<StreakChangedDetail>).detail
      if (detail?.packId === packId) setDays(detail.current)
    }
    window.addEventListener("corpan:streak-changed", onChanged)
    return () => window.removeEventListener("corpan:streak-changed", onChanged)
  }, [packId])

  // Hide at 0/1 — a streak only reads as one once it's a streak.
  if (days < 2) return null

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-foreground${
        className ? ` ${className}` : ""
      }`}
      aria-label={t("streakBadge.label", "{{days}}-day streak", { days })}
    >
      <Flame aria-hidden className="h-3.5 w-3.5 text-orange-500" />
      {days}
    </span>
  )
}
