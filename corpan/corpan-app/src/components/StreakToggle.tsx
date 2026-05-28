import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Switch } from "@/components/ui/switch"
import { isStreakEnabled, setStreakEnabled } from "@/components/StreakChip"

/**
 * Opt-in toggle for the reading streak chip. Off by default — Corpán doesn't
 * push streaks on anyone. When on, a small dignified day-count appears in the
 * header (no reminders, no loss-aversion popups).
 */
export function StreakToggle() {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState<boolean>(() => isStreakEnabled())

  useEffect(() => {
    setEnabled(isStreakEnabled())
  }, [])

  const handleChange = (next: boolean) => {
    setEnabled(next)
    setStreakEnabled(next)
  }

  return (
    <div className="w-full space-y-2 py-3">
      <div className="flex gap-3 items-center">
        <label
          htmlFor="toggle-streak"
          className="text-foreground text-sm font-medium select-none"
          style={{ minWidth: 0, flex: 1 }}
        >
          {t("settings.showStreak", { defaultValue: "Show reading streak" })}
        </label>
        <Switch
          id="toggle-streak"
          checked={enabled}
          onCheckedChange={handleChange}
          className="transition-colors"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t("settings.showStreakHint", {
          defaultValue:
            "A small day-count in the header. On-device only, no reminders or notifications.",
        })}
      </p>
    </div>
  )
}
