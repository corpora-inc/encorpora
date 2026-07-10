// src/journey/types.ts — surface-owned card descriptors + ports (feed-ux §2.4).
//
// The engine is the producer of session structure (R5): it emits EngineCards;
// runtime.ts maps EngineCard → FeedCard 1:1 and synthesizes ONLY `blockIntro`
// at modelNeeds run boundaries. The FeedCard discriminated union is
// surface-owned and canonical HERE.

import type {
  ActivityDetail,
  ActivityItemResult,
  ActivityResult,
  ActivitySpec,
} from "../contentPacks/activityContract.ts"
import type { CheckpointSummary, EngineCard } from "./engine/index.ts"
import type { ResolvedExample, ResolvedItem } from "./content/resolve.ts"
import type { DistractorSet } from "./content/distractors.ts"

export type RareVariant = "delight" | "etymology" | "timeCapsule" | "miniGame" | "storyChapter"

/** Everything a native renderer needs, resolved PRE-MOUNT (no loading gap). */
export interface PreparedExercise {
  spec: ActivitySpec
  /** The engine envelope this card was mapped from (result routing + meta). */
  engine: EngineCard
  /** Resolver output, spec order preserved. Never empty for a mounted card. */
  items: ResolvedItem[]
  /** Sampled distractors, or null when the type takes nothing from the sampler. */
  distractors: DistractorSet | null
  /** cloze: the 0-based blank index actually used (params override or seeded). */
  blankIndex?: number
  /** choice_pick/listen_type/cloze translation direction actually used. */
  direction?: "toNative" | "toTarget" | "targetOnly"
  /** speak_echo degraded to listen_type (§6.3) — results carry
   *  flags.sttUnavailable so the engine stops scheduling STT today. */
  sttFallback?: boolean
  /** Speak-first: an intro_echo/listen_type card upgraded to Whisper-graded
   *  speak_echo because STT is usable. Reverted (with the rest of the session)
   *  on an sttDeclined result so a learner who can't speak is never trapped. */
  sttUpgraded?: boolean
  /** words-in-context: a real corpus phrase carrying items[0] when it is a word
   *  the learner has met before. Feeds the post-answer enrichment line, the
   *  etymology gem's usage line, and the context-cloze form. Absent on first
   *  exposures / when no short containing phrase exists. */
  example?: ResolvedExample
}

export interface PackPoster {
  name: string
  imageUrl?: string
}

export type FeedCard =
  | { kind: "exercise"; cardId: string; spec: ActivitySpec; prepared: PreparedExercise; rare?: RareVariant }
  | { kind: "checkpoint"; cardId: string; engine: EngineCard; summary: CheckpointSummary }
  | {
      kind: "packActivity"
      cardId: string
      packId: string
      spec: ActivitySpec
      engine: EngineCard
      poster: PackPoster
      rare?: "miniGame" | "storyChapter"
    }
  | { kind: "capability"; cardId: string; capabilityId: string; spec: ActivitySpec; engine: EngineCard; prepared: PreparedExercise | null }
  | { kind: "blockIntro"; cardId: string; modelNeeds: ("stt" | "llm")[]; blockLen: number }
  | { kind: "welcomeBack"; cardId: string; retainedPct: number }
  | { kind: "jumpOffer"; cardId: string; engine: EngineCard }

export type FeedCardKind = FeedCard["kind"]

/** History-ring entry for scroll-back (read-only review, §3.4). */
export interface CompletedCard {
  card: FeedCard
  result: ActivityResult | null // null = presentation-only (blockIntro …)
  completedAt: number
  celebrationTier: 0 | 1 | 2 | 3
}

/** Renderer → host raw outcome (feed-ux §4). */
export interface RawOutcome {
  /** boolean for single-item cards; 0..1 fraction for multi-item cards. */
  correct: boolean | number
  perItem?: ActivityItemResult[]
  latencyMs: number
  detail?: ActivityDetail
}

/** Retry state machine, host-owned (§3.3). */
export interface ScaffoldState {
  /** 0 = clean, 1 = first miss (scaffold offered), 2 = answer shown. */
  misses: 0 | 1 | 2
  /** Scaffold consumed on this card (grades to Hard at best). */
  hintUsed: boolean
}

/** The one quota seam (R12). runtime.ts is the ONLY caller of note(). The
 *  production gate (quotas.ts `journey_daily` row) is W10; this port lets
 *  the surface build + test against the rule without owning the registry. */
export interface JourneyQuotaPort {
  /** One debit. Called for completed DEBUT cards + pack-anchor launches only. */
  note: () => void
  remaining: () => number
  limit: () => number
  /** True at the cap for a non-subscriber (gate dispatches corpan:daily-locked). */
  locked: () => boolean
}

/** Unlimited placeholder (subscribers / pre-W10 wiring). */
export function unlimitedQuota(): JourneyQuotaPort {
  return {
    note: () => {},
    remaining: () => Number.POSITIVE_INFINITY,
    limit: () => Number.POSITIVE_INFINITY,
    locked: () => false,
  }
}

export interface SessionStats {
  newCount: number
  reviewCount: number
  bestCombo: number
  combo: number
  cardsCompleted: number
  startedAt: number
}
