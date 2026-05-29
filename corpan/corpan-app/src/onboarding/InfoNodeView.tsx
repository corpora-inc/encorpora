import { motion } from "framer-motion"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useSettingsStore } from "@/store/settings"
import corpanMark from "@/assets/corpan-mark-trim.png"
import type { InfoNode, NodeCtx } from "./types"

/** A centered informational onboarding screen (title + subtitle + a Next disc).
 *  Same premium shell as the question view. Currently unused by the default
 *  graph, but the engine supports `info` nodes (e.g. future curricula intros). */
export function InfoNodeView({
  node,
  ctx,
  canBack,
  onAdvance,
  onBack,
}: {
  node: InfoNode
  ctx: NodeCtx
  canBack: boolean
  onAdvance: () => void
  onBack: () => void
}) {
  const dir = useSettingsStore((s) => s.dir)
  const t = ctx.t

  return (
    <section
      className="fixed inset-0 flex flex-col items-center justify-center bg-background px-6 text-center"
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
        <img src={corpanMark} alt="" aria-hidden="true" draggable={false}
          className="mb-5 select-none" style={{ height: 30, width: "auto", opacity: 0.9 }} />
        <h1 className="text-2xl font-bold text-foreground">{t(node.titleKey)}</h1>
        {node.subtitleKey ? (
          <p className="mt-2 text-sm text-muted-foreground">{t(node.subtitleKey)}</p>
        ) : null}
        <button
          type="button"
          onClick={onAdvance}
          aria-label={t("onboarding.continue")}
          className="mt-8 flex h-14 w-14 items-center justify-center rounded-full border border-purple-400 bg-black text-white shadow-lg transition hover:bg-gray-900"
        >
          <ArrowRight className="h-6 w-6 rtl:rotate-180" />
        </button>
      </motion.div>
    </section>
  )
}
