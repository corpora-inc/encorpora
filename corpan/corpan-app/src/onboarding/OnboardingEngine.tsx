import { useLayoutEffect, useRef } from "react"
import { useOnboardingGraph } from "./useOnboardingGraph"
import { QuestionNodeView } from "./QuestionNodeView"
import { MultiQuestionNodeView } from "./MultiQuestionNodeView"
import { InfoNodeView } from "./InfoNodeView"
import { ONBOARDING_COMPONENTS } from "./registry"

/**
 * Data-driven onboarding. Replaces the hardcoded-index OnboardingWizard.
 * Walks ONBOARDING_GRAPH; renders adapter components (the existing heavy
 * screens) or the centered question/info views, and commits at the terminal.
 */
export function OnboardingEngine() {
  const g = useOnboardingGraph()
  const node = g.node
  const committed = useRef(false)

  // Terminal: flush the draft + mark onboarded (App then swaps to Home). A
  // LAYOUT effect (not a passive one) so `setOnboarded(true)` + the landing
  // intent are flushed BEFORE the browser paints the empty terminal — App swaps
  // straight to Home + the razzle overlay in the same frame, with no blank/Home
  // flash between the final question and the animation. Guard against
  // StrictMode's double invocation.
  useLayoutEffect(() => {
    if (node?.kind === "terminal" && !committed.current) {
      committed.current = true
      node.commit(g.makeCtx())
    }
  }, [node, g])

  if (!node) return null

  switch (node.kind) {
    case "adapter": {
      const Comp = ONBOARDING_COMPONENTS[node.component]
      const ctx = g.makeCtx()
      return (
        <Comp
          key={node.id}
          onAdvance={g.advance}
          onBack={g.canBack ? g.back : undefined}
          // Finish screen's "Explore on my own" escape: flag the draft so
          // commitDraft skips the best-fit auto-launch, then advance to commit.
          onAdvanceExplore={() => {
            ctx.patch({ skipAutoLaunch: true })
            g.advance()
          }}
          // pickPhrasePacks' silent-skip guard — see Draft.phrasePacksAutoSkipped.
          // `ctx.patch` writes through the graph's persistent draft ref (not
          // React state), so this survives the step's own unmount on Back.
          phrasePacksAutoSkipped={ctx.draft.phrasePacksAutoSkipped}
          markPhrasePacksAutoSkipped={() => ctx.patch({ phrasePacksAutoSkipped: true })}
        />
      )
    }
    case "question":
      return (
        <QuestionNodeView
          key={node.id}
          node={node}
          ctx={g.makeCtx()}
          canBack={g.canBack}
          onChoose={g.choose}
          onBack={g.back}
        />
      )
    case "multiQuestion":
      return (
        <MultiQuestionNodeView
          key={node.id}
          node={node}
          ctx={g.makeCtx()}
          canBack={g.canBack}
          onDone={(ids) => g.chooseMulti(node, ids)}
          onBack={g.back}
        />
      )
    case "info":
      return (
        <InfoNodeView
          key={node.id}
          node={node}
          ctx={g.makeCtx()}
          canBack={g.canBack}
          onAdvance={g.advance}
          onBack={g.back}
        />
      )
    case "terminal":
      return null // committing; App swaps to the Home shell
  }
}
