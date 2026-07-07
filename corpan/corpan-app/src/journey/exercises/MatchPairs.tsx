// src/journey/exercises/MatchPairs.tsx — match the pairs (feed-ux §4 row 6).
// Multi-item card (4–6 pairs): `perItem` outcome per pair; each wrong pairing
// counts one miss against that pair's item only; the card completes when all
// pairs match. Columns come from faces.matchColumns (contract #2): the text
// axis is ALWAYS target↔native — the right side never falls back to target
// text (that was the EN→EN pairs bug).

import { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Volume2 } from "lucide-react"
import { isRTL } from "../../util/convert"
import { matchColumns, type MatchSide } from "./faces.ts"
import type { ActivityItemResult } from "../../contentPacks/activityContract"
import type { ExerciseProps, ResolvedItem } from "./types.ts"

export function MatchPairs(props: ExerciseProps) {
  const { t } = useTranslation()
  const startedAt = useRef(Date.now())
  const audioAxis = props.spec.params?.axis === "text-audio"
  const items = props.items
  const [left, setLeft] = useState<string | null>(null)
  const [matched, setMatched] = useState<string[]>([])
  const [wrongFlash, setWrongFlash] = useState<string | null>(null)
  const missesRef = useRef(new Map<string, number>())
  const doneRef = useRef(false)

  const columns = useMemo(
    () =>
      matchColumns(
        items,
        audioAxis ? "text-audio" : "text-text",
        props.cardId,
        props.spec.targetLang,
        props.spec.nativeLang,
      ),
    [items, audioAxis, props.cardId, props.spec.targetLang, props.spec.nativeLang],
  )

  const usable = useMemo(() => {
    const keep = new Set(columns.usableKeys)
    return items.filter((i) => keep.has(i.key))
  }, [items, columns.usableKeys])

  const byKey = useMemo(() => {
    const m = new Map<string, ResolvedItem>()
    for (const i of usable) m.set(i.key, i)
    return m
  }, [usable])

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    const perItem: ActivityItemResult[] = usable.map((i) => {
      const misses = missesRef.current.get(i.key) ?? 0
      return {
        itemRef: i.ref,
        outcome: misses === 0 ? "pass" : misses === 1 ? "partial" : "fail",
        latencyMs: Date.now() - startedAt.current,
      }
    })
    const passed = perItem.filter((p) => p.outcome === "pass").length
    props.onOutcome({
      correct: passed / Math.max(usable.length, 1),
      perItem,
      latencyMs: Date.now() - startedAt.current,
    })
  }

  const pickLeft = (side: MatchSide) => {
    if (matched.includes(side.key) || props.mode === "review") return
    setLeft(side.key)
    if (side.audio) {
      const item = byKey.get(side.key)
      if (item) void props.speak(props.spec.targetLang, item.target.ttsText)
    }
  }

  const pickRight = (side: MatchSide) => {
    if (!left || matched.includes(side.key) || props.mode === "review") return
    if (side.key === left) {
      const next = [...matched, side.key]
      setMatched(next)
      setLeft(null)
      if (next.length === usable.length) finish()
    } else {
      missesRef.current.set(left, (missesRef.current.get(left) ?? 0) + 1)
      setWrongFlash(side.key)
      setTimeout(() => setWrongFlash(null), 350)
      setLeft(null)
    }
  }

  const leftDir = isRTL(columns.leftLang) ? "rtl" : "ltr"
  const rightDir = isRTL(columns.rightLang) ? "rtl" : "ltr"
  const review = props.mode === "review"

  const tileCls = (state: "idle" | "selected" | "matched" | "wrong") =>
    [
      "min-h-12 flex-1 rounded-xl border px-3 py-2.5 text-start text-base font-medium transition-colors",
      state === "matched"
        ? "border-emerald-500/50 bg-emerald-500/10 text-muted-foreground"
        : state === "selected"
          ? "border-[hsl(var(--journey-accent,262_80%_58%))] bg-[hsl(var(--journey-accent,262_80%_58%)/0.1)] text-foreground"
          : state === "wrong"
            ? "border-red-500/50 bg-red-500/10 text-foreground"
            : "border-border bg-card text-foreground hover:bg-muted",
    ].join(" ")

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="text-sm text-muted-foreground">{t("journey.exercise.matchPairs")}</div>
      <div className="flex w-full gap-3" data-testid="journey-match-grid">
        <div className="flex flex-1 flex-col gap-2" dir={leftDir} lang={columns.leftLang}>
          {columns.left.map((s) => (
            <button
              key={s.key}
              type="button"
              lang={columns.leftLang}
              disabled={review || matched.includes(s.key)}
              onClick={() => pickLeft(s)}
              data-journey-pair-left={s.key}
              className={tileCls(matched.includes(s.key) || review ? "matched" : left === s.key ? "selected" : "idle")}
            >
              {s.audio ? (
                <span className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4" /> {matched.includes(s.key) || review ? s.label : "•••"}
                </span>
              ) : (
                s.label
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-2" dir={rightDir} lang={columns.rightLang}>
          {columns.right.map((s) => (
            <button
              key={s.key}
              type="button"
              lang={columns.rightLang}
              disabled={review || matched.includes(s.key)}
              onClick={() => pickRight(s)}
              data-journey-pair-right={s.key}
              className={tileCls(
                matched.includes(s.key) || review ? "matched" : wrongFlash === s.key ? "wrong" : "idle",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
