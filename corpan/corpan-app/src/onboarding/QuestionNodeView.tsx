import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import { useSettingsStore } from "@/store/settings"
import corpanMark from "@/assets/corpan-mark-trim.png"
import type { NodeCtx, QuestionNode, QuestionOption } from "./types"

/**
 * A single-question onboarding screen — vertically centered, premium, no
 * stepper. Single-select: tapping a card advances immediately (snappy, like
 * PickPrimary). Matches the onboarding canvas (bg-background, ear-mark crown).
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
  const dir = useSettingsStore((s) => s.dir)
  const vals = node.interpolate?.(ctx) ?? {}
  const t = ctx.t

  return (
    <section
      className="fixed inset-0 flex flex-col items-center justify-center bg-background px-5"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)",
      }}
      dir={dir()}
    >
      {canBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={t("onboarding.back")}
          className="absolute start-4 top-[calc(env(safe-area-inset-top)+0.75rem)] flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground transition"
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mx-auto flex w-full max-w-md flex-col items-center"
      >
        <img
          src={corpanMark}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="mb-5 select-none"
          style={{ height: 30, width: "auto", opacity: 0.9 }}
        />
        <h1 className="text-center text-2xl font-bold text-foreground">
          {t(node.titleKey, vals)}
        </h1>
        {node.subtitleKey ? (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {t(node.subtitleKey, vals)}
          </p>
        ) : null}

        <div className="mt-7 flex w-full flex-col gap-3">
          {node.options.map((o, i) => (
            <motion.button
              key={o.id}
              type="button"
              onClick={() => onChoose(o)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: "easeOut", delay: 0.06 + i * 0.05 }}
              className="w-full rounded-xl border border-border bg-card p-4 text-start transition-colors hover:border-purple-400/60 hover:bg-accent/40 active:scale-[0.99]"
            >
              <div className="font-semibold text-foreground">{t(o.labelKey, vals)}</div>
              {o.descKey ? (
                <div className="mt-0.5 text-xs text-muted-foreground">{t(o.descKey, vals)}</div>
              ) : null}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
