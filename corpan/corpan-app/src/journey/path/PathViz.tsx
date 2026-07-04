// src/journey/path/PathViz.tsx — P0 arc → unit ribbon (feed-ux §1.10).
// NOT the constellation (P1, D11 out-of-scope). DOM/SVG-free: unit counts at
// P0 stay ≤ ~40 nodes. Node states: locked / current / practiced / mastered
// (hysteresis is engine-side; the UI just renders derived mastery).

import { useMemo } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { useTranslation } from "react-i18next"
import type { CourseGraph, SkillState } from "../engine/index.ts"

export type UnitNodeState = "locked" | "current" | "practiced" | "mastered"

export interface PathUnit {
  unitId: string
  arcId: string
  ordinal: number
  state: UnitNodeState
  mastery: number
}

export function computePathUnits(
  graph: CourseGraph,
  currentUnitId: string | null,
  skillState: (skillId: string) => SkillState,
): PathUnit[] {
  const currentOrdinal = graph.units.find((u) => u.unitId === currentUnitId)?.ordinal ?? 0
  return graph.units
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((u) => {
      let masterySum = 0
      let n = 0
      for (const skillId of u.skillIds) {
        try {
          masterySum += skillState(skillId).mastery
          n += 1
        } catch {
          /* unknown skill — render as zero */
        }
      }
      const mastery = n > 0 ? masterySum / n : 0
      const state: UnitNodeState =
        u.unitId === currentUnitId
          ? "current"
          : u.ordinal > currentOrdinal
            ? "locked"
            : mastery >= 0.8
              ? "mastered"
              : "practiced"
      return { unitId: u.unitId, arcId: u.arcId, ordinal: u.ordinal, state, mastery }
    })
}

export function PathViz(props: {
  graph: CourseGraph
  currentUnitId: string | null
  skillState: (skillId: string) => SkillState
  unitName?: (unitId: string) => string
  onReviewUnit?: (unitId: string) => void
}) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const units = useMemo(
    () => computePathUnits(props.graph, props.currentUnitId, props.skillState),
    [props.graph, props.currentUnitId, props.skillState],
  )
  const arcs = useMemo(() => {
    const byArc = new Map<string, PathUnit[]>()
    for (const u of units) {
      const list = byArc.get(u.arcId) ?? []
      list.push(u)
      byArc.set(u.arcId, list)
    }
    return [...byArc.entries()]
  }, [units])

  return (
    <div className="flex w-full max-w-[26rem] flex-col gap-6" data-testid="journey-path">
      <div className="text-lg font-bold text-foreground">{t("journey.path.title")}</div>
      {arcs.map(([arcId, arcUnits]) => (
        <div key={arcId} className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("journey.path.arc", { name: arcId })}
          </div>
          <div className="flex flex-col gap-1.5">
            {arcUnits.map((u) => (
              <button
                key={u.unitId}
                type="button"
                disabled={u.state === "locked" || u.state === "current"}
                onClick={() => props.onReviewUnit?.(u.unitId)}
                data-journey-unit={u.unitId}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-start ${
                  u.state === "locked"
                    ? "border-border/50 opacity-45"
                    : u.state === "current"
                      ? "border-[hsl(var(--journey-accent,262_80%_58%))] bg-[hsl(var(--journey-accent,262_80%_58%)/0.08)]"
                      : "border-border bg-card hover:bg-muted"
                }`}
              >
                <span className="relative flex h-6 w-6 items-center justify-center">
                  <span
                    className={`h-4 w-4 rounded-full ${
                      u.state === "mastered"
                        ? "bg-[hsl(var(--journey-accent,262_80%_58%))]"
                        : u.state === "current"
                          ? "bg-[hsl(var(--journey-accent,262_80%_58%)/0.5)]"
                          : u.state === "practiced"
                            ? "bg-[hsl(var(--journey-accent,262_80%_58%)/0.3)]"
                            : "bg-muted"
                    }`}
                  />
                  {u.state === "current" && !reduced ? (
                    <motion.span
                      className="absolute h-6 w-6 rounded-full border border-[hsl(var(--journey-accent,262_80%_58%))]"
                      animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0.2, 0.7] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    />
                  ) : null}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-foreground">
                    {props.unitName ? props.unitName(u.unitId) : u.unitId}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {u.state === "current"
                      ? t("journey.path.current")
                      : u.state === "locked"
                        ? t("journey.path.locked")
                        : u.state === "mastered"
                          ? t("journey.path.mastered")
                          : t("journey.path.review")}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
