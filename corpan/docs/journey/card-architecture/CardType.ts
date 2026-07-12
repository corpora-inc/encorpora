// docs/journey/card-architecture/CardType.ts
//
// ILLUSTRATIVE interface sketch for CARD_ARCHITECTURE.md. This is a DESIGN
// ARTIFACT under docs/, not wired into the app and not type-checked by the
// build. Imports are shown as `import type` against the real modules so the
// intended shapes are unambiguous; a real implementation would live under
// src/journey/cards/. See CARD_ARCHITECTURE.md for the prose.

import type { ComponentType } from "react"
import type {
  ActivityDetail,
  ActivityItemResult,
  ActivityResult,
  ActivitySpec,
} from "../../../corpan-app/src/contentPacks/activityContract.ts"
import type { EngineCard } from "../../../corpan-app/src/journey/engine/index.ts"
import type {
  ResolveContext,
  ResolvedItem,
  Resolver,
  ResolverDeps,
} from "../../../corpan-app/src/journey/content/resolve.ts"
import type { AdvanceMode } from "../../../corpan-app/src/store/journey.ts"
import type { RawOutcome, ScaffoldState } from "../../../corpan-app/src/journey/types.ts"
import type { SpeakFn } from "../../../corpan-app/src/journey/exercises/types.ts"

// ---- injected context (mirrors the resolver's DI boundary — no hostApi here)

export interface CardContext {
  ctx: ResolveContext // { courseId, targetLang, nativeLang? }
  resolver: Resolver
  resolverDeps: ResolverDeps
  /** Replaces runtime.ts's sttUsable() closure — a resident Whisper model. */
  sttUsable: boolean
  /** Recency de-dup window (runtime.recentKeys()). */
  recentKeys: ReadonlySet<string>
  /** cardRng bound to this specId; salt keeps sub-draws independent + seeded. */
  rng: (salt: string) => () => number
  log: (event: string, data: Record<string, unknown>) => void
}

// ---- match() output: the typed params THIS CardType will render with

export interface CardMatch<P = Record<string, unknown>> {
  params: P
}

// ---- the prepared, mountable card (generalizes PreparedExercise)

export interface PreparedCard<P = Record<string, unknown>> {
  cardTypeId: string // registry key — the new render/advance discriminant
  cardId: string
  spec: ActivitySpec // final spec: chosen activityType + merged params
  engine: EngineCard // result routing + engine.meta (pool/strand/unscored/…)
  items: ResolvedItem[]
  /** Type-specific, opaque to the runtime; only this CardType reads it.
   *  choice_pick: { distractors, direction }; cloze: { blankIndex, … };
   *  glyph_choice: { answerGlyph, glyphDistractors }; speak_echo: { sttUpgraded }. */
  payload: P
}

// ---- advance (unchanged union from advanceRules.ts)

export type AdvanceRule =
  | { kind: "manual" }
  | { kind: "swipe" }
  | { kind: "button" }
  | { kind: "auto"; delayMs: number }

export interface AdvanceOpts {
  failed?: boolean
  listeningRun?: boolean
}

// ---- score mapping (default = today's ActivityCardHost.settle math)

export interface ActivityResultDraft {
  score: number
  perItem: ActivityItemResult[]
  detail?: ActivityDetail
}

// ---- no-reflow layout contract (see ActivityCardHost.tsx:181-197)

export interface CardLayout {
  feedback: "reserved-band" | "overlay-only"
  ownsContinue: boolean
  reservesStamp: boolean
}

// ---- runtime-facing flags that REPLACE the `card.kind === …` checks

export interface CardTypeMeta {
  engineIssued: boolean // results route to engine.applyResult
  presentationOnly: boolean // blockIntro / welcomeBack (no answer)
  provider: "native" | "pack" | "capability"
  metered: boolean // debits the daily gate on a debut completion (R12)
}

// ---- what the Component receives (superset of today's ExerciseProps)

export interface CardComponentProps<P = Record<string, unknown>> {
  card: PreparedCard<P>
  mode: "live" | "review" | "probe"
  scaffold: ScaffoldState
  active: boolean
  speak: SpeakFn
  showRomanization: boolean
  onOutcome: (o: RawOutcome) => void
  onHintUsed: () => void
  review?: { correct: boolean } | null
}

// ---- THE interface ---------------------------------------------------------

export interface CardType<P = Record<string, unknown>> {
  id: string
  /** Schedulable activityTypes this presentation may render. Absent ⇒ [id]. */
  presents?: string[]
  /** Precedence among candidates for one scheduled card. Higher wins. DATA. */
  priority: number

  /** Applicability + typed-param builder; null declines (fall through). */
  match(
    ec: EngineCard,
    answer: ResolvedItem,
    cx: CardContext,
  ): CardMatch<P> | null | Promise<CardMatch<P> | null>

  /** Resolve content + distractors into a mountable card; null ⇒ fall through. */
  prepare(
    ec: EngineCard,
    matched: CardMatch<P>,
    cx: CardContext,
  ): Promise<PreparedCard<P> | null>

  /** How the feed advances after settle (replaces the advanceRule switch). */
  advance(card: PreparedCard<P>, mode: AdvanceMode, opts?: AdvanceOpts): AdvanceRule

  /** RawOutcome → ActivityResult draft. Absent ⇒ DEFAULT_SCORE (host settle). */
  score?(outcome: RawOutcome, card: PreparedCard<P>): ActivityResultDraft

  Component: ComponentType<CardComponentProps<P>>
  layout: CardLayout
  meta: CardTypeMeta
}

// ---- the registry ----------------------------------------------------------

export interface CardRegistry {
  register(t: CardType): void
  get(id: string): CardType | null
  /** Candidates for a scheduled activityType, highest priority first. */
  candidatesFor(activityType: string): CardType[]
}

// Note: ActivityResult / ActivitySpec are the AUTHORITATIVE ABI
// (contentPacks/activityContract.ts). CardType is the in-process PROVIDER
// interface on top of that ABI; a pack's PackActivityDeclaration is the
// out-of-process provider. Both: ActivitySpec in, ActivityResult out.
export type { ActivityResult, ActivitySpec }
