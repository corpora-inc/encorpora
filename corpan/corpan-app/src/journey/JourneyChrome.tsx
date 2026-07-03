// src/journey/JourneyChrome.tsx — thin top ribbon (feed-ux §1.2): progress
// toward next checkpoint (goal-gradient), unit line, StreakChipV2, Home
// button, and the ⋯ overflow menu (power-user levers live here and ONLY
// here — never as feed interruptions).

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Home, MoreHorizontal, X } from "lucide-react"
import { StreakChipV2 } from "./StreakChipV2.tsx"
import { useJourneyStore, type CourseKey } from "./store.ts"
import type { StreakPorts } from "./streakV2.ts"

export function JourneyChrome(props: {
  courseKey: CourseKey
  unitName: string | null
  progressFrac: number
  streakPorts?: StreakPorts
  onHome: () => void
  onOpenPath: () => void
  onRedoPlacement: () => void
}) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const advanceMode = useJourneyStore((s) => s.advanceMode)
  const setAdvanceMode = useJourneyStore((s) => s.setAdvanceMode)
  const juice = useJourneyStore((s) => s.juiceIntensity)
  const setJuice = useJourneyStore((s) => s.setJuiceIntensity)
  const sounds = useJourneyStore((s) => s.soundsEnabled)
  const setSounds = useJourneyStore((s) => s.setSoundsEnabled)

  return (
    <div className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-3">
      <button
        type="button"
        onClick={props.onHome}
        aria-label={t("journey.chrome.home")}
        data-testid="journey-home"
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <Home className="h-4.5 w-4.5" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-[hsl(var(--journey-accent,262_80%_58%))]"
            animate={{ width: `${Math.round(Math.min(props.progressFrac, 1) * 100)}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        {props.unitName ? (
          <div className="truncate text-[11px] leading-tight text-muted-foreground">{props.unitName}</div>
        ) : null}
      </div>
      <StreakChipV2 courseKey={props.courseKey} ports={props.streakPorts} />
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label={t("journey.chrome.menu")}
        data-testid="journey-menu"
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <MoreHorizontal className="h-4.5 w-4.5" />
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-[1080] flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button type="button" aria-label={t("journey.popin.close")} className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
            <motion.div
              className="relative rounded-t-2xl border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="text-base font-semibold text-foreground">{t("journey.settings.title")}</div>
                <button type="button" onClick={() => setMenuOpen(false)} aria-label={t("journey.popin.close")} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <Row label={t("journey.settings.advanceMode")}>
                  <Segmented
                    value={advanceMode}
                    options={[
                      { v: "swipe", label: t("journey.settings.advanceSwipe") },
                      { v: "auto", label: t("journey.settings.advanceAuto") },
                    ]}
                    onChange={(v) => setAdvanceMode(v as "swipe" | "auto")}
                  />
                </Row>
                <Row label={t("journey.settings.celebration")}>
                  <Segmented
                    value={juice}
                    options={[
                      { v: "full", label: t("journey.settings.celebrationFull") },
                      { v: "reduced", label: t("journey.settings.celebrationReduced") },
                      { v: "minimal", label: t("journey.settings.celebrationMinimal") },
                    ]}
                    onChange={(v) => setJuice(v as "full" | "reduced" | "minimal")}
                  />
                </Row>
                <Row label={t("journey.settings.sounds")}>
                  <Segmented
                    value={sounds ? "on" : "off"}
                    options={[
                      { v: "on", label: t("journey.settings.soundsOn") },
                      { v: "off", label: t("journey.settings.soundsOff") },
                    ]}
                    onChange={(v) => setSounds(v === "on")}
                  />
                </Row>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      props.onOpenPath()
                    }}
                    className="min-h-11 flex-1 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted"
                  >
                    {t("journey.settings.viewPath")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      props.onRedoPlacement()
                    }}
                    className="min-h-11 flex-1 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted"
                  >
                    {t("journey.settings.redoPlacement")}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Row(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{props.label}</div>
      {props.children}
    </div>
  )
}

function Segmented(props: {
  value: string
  options: { v: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-border">
      {props.options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => props.onChange(o.v)}
          className={`min-h-10 flex-1 px-2 text-sm ${
            props.value === o.v
              ? "bg-[hsl(var(--journey-accent,262_80%_58%))] font-semibold text-white"
              : "bg-card text-foreground hover:bg-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
