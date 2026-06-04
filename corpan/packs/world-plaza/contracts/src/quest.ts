import { z } from "zod"
import { LearnerPair, PlayerId, QuestId } from "./ids"
import { ChallengeToolId } from "./challengeTool"

/**
 * A Quest is a per-player, data-driven goal that is ORTHOGONAL to the Scene and
 * that reprograms how the NPCs (Qwen3) teach. Its `promptProgram` compiles into
 * each NPC's system prompt + content selection. "A quest is, mostly, how Qwen3
 * works with this user." Quests are templates parameterized by learnerPair +
 * domain, so they can be stamped out toward all 2,450 ordered language pairs.
 */

export const QuestObjective = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("earnBadge"), badge: z.string().min(1) }),
  z.object({ kind: z.literal("xpThreshold"), xp: z.number().positive() }),
  z.object({ kind: z.literal("completeDialogues"), count: z.number().int().positive() }),
  z.object({
    kind: z.literal("completeChallenges"),
    toolId: ChallengeToolId,
    count: z.number().int().positive(),
  }),
])
export type QuestObjective = z.infer<typeof QuestObjective>

/**
 * How a step is COMPLETED — so every step has an action the game can actually
 * deliver (the #26 fix: a "cross the bridge" step with no completable action left
 * the player stuck). Default "talk".
 *   - "talk"     — walk to the objective NPC, Begin the challenge, win → advance.
 *   - "traverse" — walk TO/ACROSS the step's anchor (a trigger volume at the
 *                  anchor fires advance on arrival). "Cross the bridge / take the
 *                  ferry." No challenge, no item — reaching the spot IS the action.
 *   - "find"     — reach the marked spot to pick up the step's item, then advance
 *                  (a pickup at the anchor). "Find the pass."
 * `traverse`/`find` steps are satisfied by REACHING the anchor (the engine's
 * beaten flag, set by the proximity trigger) — NOT by an inventory rule — so they
 * are always completable by playing.
 */
export const QuestStepKind = z.enum(["talk", "traverse", "find"])
export type QuestStepKind = z.infer<typeof QuestStepKind>

export const QuestStep = z.object({
  id: z.string().min(1),
  label: z.string(),
  anchorId: z.string().optional(),
  toolId: ChallengeToolId.optional(),
  done: z.boolean().optional(),
  /**
   * How this step completes (see {@link QuestStepKind}). Optional → "talk".
   * Additive: existing quests parse unchanged and behave as talk-challenge steps.
   */
  kind: QuestStepKind.optional(),
  /**
   * Corpus entry ids this step is ABOUT. Pinning them into the challenge's
   * `ChallengeSpec.entryIds` makes the micro-game drill the exact words the quest
   * step concerns — so "help me finish this letter" teaches the step's vocab.
   * Optional: a step without it falls back to random corpus selection.
   */
  entryIds: z.array(z.number()).optional(),
})
export type QuestStep = z.infer<typeof QuestStep>

export const Scaffold = z.enum(["beginner", "intermediate", "advanced"])
export type Scaffold = z.infer<typeof Scaffold>

/** Compiles → an NPC's Qwen3 system prompt + RAG sources + content + tools. */
export const QuestPromptProgram = z.object({
  /** slots: {persona},{target},{native},{domain},{scaffold},{objective} */
  personaTemplate: z.string().min(1),
  scaffold: Scaffold,
  ragSources: z.array(z.string()).optional(),
  contentSelector: z.object({
    levels: z.array(z.string()).optional(),
    domains: z.array(z.string()).optional(),
    languageCodes: z.array(z.string()).optional(),
  }),
  toolWhitelist: z.array(ChallengeToolId),
})
export type QuestPromptProgram = z.infer<typeof QuestPromptProgram>

export const QuestRewards = z.object({
  xp: z.number().nonnegative(),
  coins: z.number().nonnegative().optional(),
  badge: z.string().optional(),
  grant: z.array(z.string()).optional(),
})
export type QuestRewards = z.infer<typeof QuestRewards>

export const Quest = z.object({
  id: QuestId,
  title: z.string().min(1),
  narrative: z.string(), // e.g. "Marietta, GA → Guadalajara"
  learnerPair: LearnerPair,
  domain: z.string().min(1), // 'travel' | 'music' | 'business' | ...
  objective: QuestObjective,
  steps: z.array(QuestStep),
  promptProgram: QuestPromptProgram,
  rewards: QuestRewards,
  /**
   * The 2–3 quests the completion interlude offers as the NEXT choice (a small
   * data-driven quest GRAPH). ADDITIVE + optional: a quest without it parses
   * unchanged, and the catalog falls back to "every other known quest" so the
   * next-quest picker is never empty. Ids are resolved against the quest catalog;
   * unknown ids are noisy-skipped.
   */
  nextQuestIds: z.array(QuestId).optional(),
})
export type Quest = z.infer<typeof Quest>

export const QuestState = z.object({
  questId: QuestId,
  playerId: PlayerId,
  stepDone: z.record(z.string(), z.boolean()),
  xp: z.number().nonnegative(),
  complete: z.boolean(),
})
export type QuestState = z.infer<typeof QuestState>
