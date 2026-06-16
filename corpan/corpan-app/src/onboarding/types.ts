import type { LandingIntent } from "@/store/landing"
import type { UserClass, AgeBand, GoalIntensity } from "@/store/settings"

/** Stable string node ids — never numeric, so inserting a node never
 *  renumbers others (the brittleness of the old wizard). */
export type NodeId = string

export type Journey = "enjoy" | "learn" | "polyglot" | "child"

/** Components the graph can host as `adapter` nodes. */
export type ComponentKey =
  | "welcome"
  | "pickPrimary"
  | "welcomePact"
  | "pickLearning"
  | "pickPhrasePacks"
  | "tts"
  | "finish"

/** Accumulated, non-persisted decisions. Flushed to the stores only at a
 *  terminal node (Back stays non-destructive). Things existing components
 *  already write eagerly (languages, voicePrefs, phrasePackIds) are NOT here. */
export type Draft = {
  journey?: Journey
  levels?: string[]
  rate?: number
  ageBand?: AgeBand
  goalIntensity?: GoalIntensity
  userClass?: UserClass
  landing?: LandingIntent
  preloadPacks?: string[]
  /** Interest tags from the multi-select ("What do you want to do?"), used to
   *  rank experiences. Empty/undefined = skipped (no interest signal). */
  interests?: string[]
  /** The single-choice final question ("Where should we begin?") — makes the
   *  DETERMINISTIC landing call (see resolveLanding). Interests still feed the
   *  broader Home "For you" recommendations. */
  whatToStart?: "read" | "study" | "playMusic" | "playGames" | "surprise"
  /** Set by the finish screen's "Explore on my own" escape — suppresses the
   *  best-fit auto-launch so the user lands on Home / the guided tour instead. */
  skipAutoLaunch?: boolean
}

/** Context handed to every node callback. */
/** Loosely-typed translate — the graph uses dynamic (runtime) keys, which the
 *  app's strictly-typed `t` rejects. Falls back to the key if missing. */
export type LooseT = (key: string, opts?: Record<string, string>) => string

export type NodeCtx = {
  draft: Draft
  patch: (p: Partial<Draft>) => void
  t: LooseT
  /** Active primary language (languages[0]) for `{{lang}}` interpolation. */
  primary: () => string
  /** Target languages chosen in PickLearning (languages after the primary). */
  targets: () => string[]
}

export type NextSpec = NodeId | ((ctx: NodeCtx) => NodeId)

export type InfoNode = {
  kind: "info"
  id: NodeId
  titleKey: string
  subtitleKey?: string
  next: NextSpec
  onEnter?: (ctx: NodeCtx) => void
}

export type QuestionOption = {
  id: string
  labelKey: string
  descKey?: string
  /** Side effect on choose — write to the draft. */
  apply?: (ctx: NodeCtx) => void
  next: NextSpec
}

export type QuestionNode = {
  kind: "question"
  id: NodeId
  titleKey: string
  subtitleKey?: string
  /** Values for i18n interpolation in title/subtitle/labels (e.g. {lang}). */
  interpolate?: (ctx: NodeCtx) => Record<string, string>
  options: QuestionOption[]
}

/** An option in a multi-select question. No per-option `next`/`apply` — the
 *  whole set is collected, then the node's `apply`/`next` run on Continue. */
export type MultiOption = {
  id: string
  labelKey: string
  descKey?: string
  /** lucide-react icon name resolved by the view (kept as a string so the
   *  graph stays import-free / data-only). */
  icon?: string
}

export type MultiQuestionNode = {
  kind: "multiQuestion"
  id: NodeId
  titleKey: string
  subtitleKey?: string
  interpolate?: (ctx: NodeCtx) => Record<string, string>
  options: MultiOption[]
  /** Apply the chosen option ids to the draft (e.g. write `interests`). */
  apply: (ctx: NodeCtx, selectedIds: string[]) => void
  next: NextSpec
}

export type AdapterNode = {
  kind: "adapter"
  id: NodeId
  component: ComponentKey
  next: NextSpec
  onEnter?: (ctx: NodeCtx) => void
}

export type TerminalNode = {
  kind: "terminal"
  id: NodeId
  /** Flush the draft to the stores, set landing, mark onboarded. */
  commit: (ctx: NodeCtx) => void
}

export type OnboardingNode =
  | InfoNode
  | QuestionNode
  | MultiQuestionNode
  | AdapterNode
  | TerminalNode

export type OnboardingGraph = Record<NodeId, OnboardingNode>

/** Props every adapter component accepts so the engine can drive navigation.
 *  Both optional → components fall back to their legacy `setStep` behavior
 *  when rendered outside the engine (keeps mid-migration safe). */
export type OnboardingStepProps = {
  onAdvance?: () => void
  onBack?: () => void
  /** Finish-screen only: advance to commit but suppress the best-fit
   *  auto-launch (the "Explore on my own" escape → land on Home/tour). */
  onAdvanceExplore?: () => void
}

export function resolveNext(spec: NextSpec, ctx: NodeCtx): NodeId {
  return typeof spec === "function" ? spec(ctx) : spec
}
