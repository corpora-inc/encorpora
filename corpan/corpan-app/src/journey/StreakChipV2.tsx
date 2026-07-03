// src/journey/StreakChipV2.tsx — journey-aware streak chip (feed-ux §1.8).
// Extends StreakChip semantics, never forks them: governed by the same
// corpan-streak-enabled consent key; renders flame + count + rest-day dots;
// nothing at streak 0. Copy discipline: "{{count}} days" — no loss framing.

import { useTranslation } from "react-i18next"
import { Flame } from "lucide-react"
import { isStreakEnabled } from "../components/StreakChip"
import { useJourneyStore, type CourseKey } from "../store/journey.ts"
import { displayStreak, type StreakPorts } from "./streakV2.ts"

export function StreakChipV2(props: { courseKey: CourseKey; ports?: StreakPorts }) {
  const { t } = useTranslation()
  // subscribe so completions re-render the chip
  const tokens = useJourneyStore((s) => s.byCourse[props.courseKey]?.restDayTokens ?? 0)
  useJourneyStore((s) => s.learningDays.length)
  const streak = displayStreak(props.courseKey, props.ports)

  if (!isStreakEnabled() || streak <= 0) return null

  return (
    <div
      className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
      title={t("journey.streak.days", { count: streak })}
      aria-label={t("journey.streak.days", { count: streak })}
      data-testid="journey-streak-chip"
    >
      <Flame className="h-3.5 w-3.5 text-orange-500" />
      <span>{streak}</span>
      {tokens > 0 ? (
        <span className="flex items-center gap-0.5" title={t("journey.streak.restDayEarned")}>
          {Array.from({ length: tokens }).map((_, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          ))}
        </span>
      ) : null}
    </div>
  )
}
