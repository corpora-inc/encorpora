import { z } from "zod"
import { LanguageCode, PlayerId } from "./ids"
import { ChallengeToolId } from "./challengeTool"
import { XpEvent } from "./economy"

/**
 * A ChallengeSpec is the data-only, serializable description of one challenge
 * instance. It is issued by an NPC (parsed tool-call) or a player duel and run
 * locally on each client; the result is normalized and reconciled.
 */
export const ChallengeMode = z.enum(["solo", "duel", "coop"])
export type ChallengeMode = z.infer<typeof ChallengeMode>

export const ChallengeSpec = z.object({
  toolId: ChallengeToolId,
  challengeId: z.string().min(1),
  language: LanguageCode,
  nativeLanguage: LanguageCode.optional(),
  level: z.string().optional(), // CEFR
  entryIds: z.array(z.number().int()).optional(), // corpus entries, resolved via HostApi
  params: z.record(z.string(), z.unknown()).optional(),
  mode: ChallengeMode,
})
export type ChallengeSpec = z.infer<typeof ChallengeSpec>

export const ChallengeResult = z.object({
  challengeId: z.string().min(1),
  toolId: ChallengeToolId,
  playerId: PlayerId,
  score: z.number().min(0).max(1), // normalized
  detail: z.record(z.string(), z.number()),
  xp: z.array(XpEvent),
  completedAt: z.number(),
  offline: z.boolean(),
  /** HMAC for offline anti-cheat reconciliation. */
  sig: z.string().optional(),
})
export type ChallengeResult = z.infer<typeof ChallengeResult>

/**
 * Rewards a challenge grants on completion. `items` are opaque Item ids — the
 * Item model + inventory are owned by the economy agent; a challenge only
 * *awards* ids (chosen by difficulty × score). XP/coins are non-negative.
 */
export const ChallengeReward = z.object({
  xp: z.number().int().nonnegative(),
  coins: z.number().int().nonnegative(),
  items: z.array(z.string()),
})
export type ChallengeReward = z.infer<typeof ChallengeReward>

/**
 * The result returned to the game from {@link runChallenge}: a normalized
 * {@link ChallengeResult} plus the concrete {@link ChallengeReward} the game
 * hands to the economy/inventory layer. Kept as a superset so existing
 * `ChallengeResult` consumers (server reconciliation) stay unaffected.
 */
export const ChallengeResultPlus = ChallengeResult.extend({
  rewards: ChallengeReward,
  /**
   * How the run ENDED. "completed" = the player finished it (a real score —
   * even a low one — celebrates + may advance the quest). "aborted" = the
   * player BAILED (X / ESC / backdrop tap) — NOT a win: no reward reveal, no
   * win juice, no `markStepBeaten`. Additive + optional so existing consumers
   * (server reconciliation) are unaffected; absent ⇒ treat as "completed" for
   * back-compat. `runChallenge` always sets it.
   */
  outcome: z.enum(["completed", "aborted"]).optional(),
})
export type ChallengeResultPlus = z.infer<typeof ChallengeResultPlus>

/* ------------------------------------------------------------------ *
 * Runtime interfaces (carry functions → plain TS, not Zod schemas).
 * These describe how a challenge tool is registered, built and mounted.
 * ------------------------------------------------------------------ */

/** Context handed to a tool when it builds a spec (quest/scene driven). */
export interface ChallengeContext {
  language: LanguageCode
  nativeLanguage?: LanguageCode
  level?: string
  domain?: string
  mode: ChallengeMode
  /** corpus entry ids pre-selected by the Quest, if any */
  entryIds?: number[]
}

/** Callbacks a mounted challenge uses to report back to the world. */
export interface ChallengeHost {
  onComplete: (result: ChallengeResult) => void
  onCancel: () => void
  /** speak a phrase via the host TTS (uiCode, text) */
  speak?: (uiCode: string, text: string) => Promise<void>
}

export interface ChallengeHandle {
  unmount: () => void
}

/** A registered microgame the world can lazily mount into an overlay. */
export interface ChallengeTool {
  id: ChallengeToolId
  buildSpec: (ctx: ChallengeContext) => Promise<ChallengeSpec>
  mount: (
    container: HTMLElement,
    spec: ChallengeSpec,
    host: ChallengeHost,
  ) => ChallengeHandle
}
