import { useState } from "react"
import { motion } from "framer-motion"
import {
  BookOpen,
  Headphones,
  Gamepad2,
  Mic,
  GraduationCap,
  Sparkles,
  Check,
  type LucideIcon,
} from "lucide-react"
import { OnboardingShell } from "./OnboardingShell"
import { Button } from "@/components/ui/button"
import type { NodeCtx, MultiQuestionNode } from "./types"

/** Icon names referenced (as strings) by graph multi-options → components. */
const ICONS: Record<string, LucideIcon> = {
  BookOpen,
  Headphones,
  Gamepad2,
  Mic,
  GraduationCap,
  Sparkles,
}

/**
 * A skippable multi-select onboarding screen ("What do you want to do?"). Tap
 * cards to toggle; Continue (always reachable in the pinned footer) commits the
 * set, Skip commits nothing. Renders through OnboardingShell for one look.
 */
export function MultiQuestionNodeView({
  node,
  ctx,
  canBack,
  onDone,
  onBack,
}: {
  node: MultiQuestionNode
  ctx: NodeCtx
  canBack: boolean
  /** Commit the chosen ids (empty array = skipped) and advance. */
  onDone: (selectedIds: string[]) => void
  onBack: () => void
}) {
  const vals = node.interpolate?.(ctx) ?? {}
  const t = ctx.t
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <OnboardingShell
      canBack={canBack}
      onBack={onBack}
      maxWidthClass="max-w-xl"
      footer={
        // No Skip: Continue with nothing selected IS "skip" (commits []). One
        // button keeps the footer identical to the screens before/after.
        <Button className="w-full !h-12" aria-label="Continue" onClick={() => onDone([...selected])}>
          {t("onboarding.continue")}
        </Button>
      }
    >
      <h1 className="text-center text-2xl font-bold text-foreground">
        {t(node.titleKey, vals)}
      </h1>
      {node.subtitleKey ? (
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t(node.subtitleKey, vals)}
        </p>
      ) : null}

      <div className="mt-7 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {node.options.map((o, i) => {
          const Icon = o.icon ? ICONS[o.icon] : undefined
          const on = selected.has(o.id)
          return (
            <motion.button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              aria-pressed={on}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: "easeOut", delay: 0.06 + i * 0.04 }}
              className={[
                "relative flex w-full items-start gap-3 rounded-xl border p-4 text-start transition-colors active:scale-[0.99]",
                on
                  ? "border-purple-400/70 bg-purple-500/[0.07] ring-1 ring-purple-400/35"
                  : "border-border bg-card hover:border-purple-400/50 hover:bg-accent/40",
              ].join(" ")}
            >
              {Icon ? (
                <Icon
                  className={on ? "h-5 w-5 shrink-0 text-purple-500" : "h-5 w-5 shrink-0 text-muted-foreground"}
                  aria-hidden
                />
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">{t(o.labelKey, vals)}</span>
                {o.descKey ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{t(o.descKey, vals)}</span>
                ) : null}
              </span>
              <span
                aria-hidden
                className={[
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  on ? "border-purple-500 bg-purple-500 text-white" : "border-border bg-background text-transparent",
                ].join(" ")}
              >
                <Check size={12} strokeWidth={3} />
              </span>
            </motion.button>
          )
        })}
      </div>
    </OnboardingShell>
  )
}
