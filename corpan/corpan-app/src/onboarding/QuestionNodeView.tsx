import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { OnboardingShell } from "./OnboardingShell"
import type { NodeCtx, QuestionNode, QuestionOption } from "./types"

/**
 * A single-question onboarding screen. Tapping a card advances immediately
 * (single-select). Renders through OnboardingShell for one consistent look.
 */
export function QuestionNodeView({
  node,
  ctx,
  canBack,
  onChoose,
  onBack,
}: {
  node: QuestionNode
  ctx: NodeCtx
  canBack: boolean
  onChoose: (o: QuestionOption) => void
  onBack: () => void
}) {
  const vals = node.interpolate?.(ctx) ?? {}
  const t = ctx.t

  // Optional per-option availability gate (e.g. journeyOptIn's guided path needs
  // a course pack for the target language). Optimistic: an option is treated as
  // available until its check resolves false — a slow/failed check never blocks
  // the flow (fix 3, the JourneyOverlay retry, catches the rare miss). Keyed by
  // node.id so it re-runs per screen but not on every ctx re-creation.
  const [unavailable, setUnavailable] = useState<Record<string, boolean>>({})
  useEffect(() => {
    setUnavailable({})
    let cancelled = false
    for (const o of node.options) {
      if (!o.available) continue
      o.available(ctx)
        .then((ok) => {
          if (!cancelled && !ok) setUnavailable((m) => ({ ...m, [o.id]: true }))
        })
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
    // ctx is re-created each render; the availability answer depends only on the
    // node, so gate the effect on node.id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id])

  return (
    <OnboardingShell canBack={canBack} onBack={onBack}>
      <h1 className="text-center text-2xl font-bold text-foreground">
        {t(node.titleKey, vals)}
      </h1>
      {node.subtitleKey ? (
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t(node.subtitleKey, vals)}
        </p>
      ) : null}

      <div className="mt-7 flex w-full flex-col gap-3">
        {node.options.map((o, i) => {
          const isDisabled = unavailable[o.id] === true
          return (
            <motion.button
              key={o.id}
              type="button"
              disabled={isDisabled}
              aria-disabled={isDisabled}
              onClick={() => onChoose(o)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: "easeOut", delay: 0.06 + i * 0.05 }}
              className="w-full rounded-xl border border-border bg-card p-4 text-start transition-colors hover:border-purple-400/60 hover:bg-accent/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-card disabled:active:scale-100"
            >
              <div className="font-semibold text-foreground">{t(o.labelKey, vals)}</div>
              {o.descKey ? (
                <div className="mt-0.5 text-xs text-muted-foreground">{t(o.descKey, vals)}</div>
              ) : null}
              {isDisabled && o.unavailableKey ? (
                <div className="mt-1 text-xs text-muted-foreground">{t(o.unavailableKey, vals)}</div>
              ) : null}
            </motion.button>
          )
        })}
      </div>
    </OnboardingShell>
  )
}
