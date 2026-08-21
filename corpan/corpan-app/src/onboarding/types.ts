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
  whatToStart?: "read" | "study" | "playMusic" | "playGames" | "surprise" | "journey"
  /** Set by the finish screen's "Explore on my own" escape — suppresses the
   *  best-fit auto-launch so the user lands on Home / the guided tour instead. */
  skipAutoLaunch?: boolean
  /** Journey opt-in (W10): the learner path's guided-daily-path question.
   *  True ⇒ commit lands the user in the Journey feed. */
  journeyOptIn?: boolean
  /** The onboarding placement-offer answer: "zero-beginner" pre-declines the
   *  in-surface probe offer (start at unit 1); "probe" leaves it to the
   *  surface's PlacementFlow (real probe cards need the live engine). */
  journeyPlacement?: "zero-beginner" | "probe"
  /** Set once `pickPhrasePacks` silently auto-advances because the starter
   *  catalog was already fully installed (CTO feedback: that case should
   *  skip the step, not show a "you already have these" message). The draft
   *  survives Back (see `journeyOptIn`'s note above), so this flag is what
   *  stops the step from re-skipping itself the instant Back lands on it —
   *  without it, Back → pickPhrasePacks → auto-advance → tts would trap the
   *  user in a forward-bounce loop. On a guarded re-entry the step renders
   *  its normal (pre-existing) "already installed" fallback instead. */
  phrasePacksAutoSkipped?: boolean
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
  /** Optional async availability gate. When present and it resolves `false`,
   *  the option renders disabled (with `unavailableKey` as a sub-note) instead
   *  of a dead-end tap. Optimistic: the option stays enabled while the check is
   *  in flight and if the check throws — the flow is never blocked on a slow
   *  network. Used by `journeyOptIn`'s guided path to avoid offering a Journey
   *  with no course pack for the target language. */
  available?: (ctx: NodeCtx) => Promise<boolean>
  /** Localized note shown under the option when `available` resolves false. */
  unavailableKey?: string
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
  /** pickPhrasePacks only: mirrors `Draft.phrasePacksAutoSkipped` — read by
   *  the step to decide whether it's already silently skipped itself once
   *  (survives its own unmount/remount across Back, since the draft isn't
   *  reset by Back; see the field's doc in `Draft`). */
  phrasePacksAutoSkipped?: boolean
  /** pickPhrasePacks only: record that the silent auto-skip happened, so a
   *  Back re-entry renders the fallback UI instead of bouncing forward again. */
  markPhrasePacksAutoSkipped?: () => void
}

export function resolveNext(spec: NextSpec, ctx: NodeCtx): NodeId {
  return typeof spec === "function" ? spec(ctx) : spec
}
