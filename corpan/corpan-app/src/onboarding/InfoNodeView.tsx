import { ArrowRight } from "lucide-react"
import { OnboardingShell } from "./OnboardingShell"
import type { InfoNode, NodeCtx } from "./types"

/** A centered informational onboarding screen (title + subtitle + Next disc),
 *  rendered through OnboardingShell for visual consistency. */
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
  const t = ctx.t
  return (
    <OnboardingShell canBack={canBack} onBack={onBack}>
      <h1 className="text-center text-2xl font-bold text-foreground">{t(node.titleKey)}</h1>
      {node.subtitleKey ? (
        <p className="mt-2 text-center text-sm text-muted-foreground">{t(node.subtitleKey)}</p>
      ) : null}
      <button
        type="button"
        onClick={onAdvance}
        aria-label={t("onboarding.continue")}
        className="mt-8 flex h-14 w-14 items-center justify-center rounded-full border border-purple-400 bg-black text-white shadow-lg transition hover:bg-gray-900"
      >
        <ArrowRight className="h-6 w-6 rtl:rotate-180" />
      </button>
    </OnboardingShell>
  )
}
