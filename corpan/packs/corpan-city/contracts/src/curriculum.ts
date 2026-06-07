import { z } from "zod"
import { LearnerPair, PathId, QuestId, SceneId } from "./ids"

/**
 * A LearningPath (per learner-pair) composes Scenes + Quests into ordered
 * Levels. "Finishing a level" = complete its quests OR hit an XP threshold OR
 * earn a badge. Paths can be hand-authored curricula or generated per pair.
 */

export const LevelCompletion = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("allQuestsComplete") }),
  z.object({ kind: z.literal("xpThreshold"), xp: z.number().positive() }),
  z.object({ kind: z.literal("badgeEarned"), badge: z.string().min(1) }),
])
export type LevelCompletion = z.infer<typeof LevelCompletion>

export const LevelSpec = z.object({
  id: z.string().min(1),
  index: z.number().int().nonnegative(),
  sceneId: SceneId,
  questIds: z.array(QuestId).min(1),
  completion: LevelCompletion,
})
export type LevelSpec = z.infer<typeof LevelSpec>

export const LearningPath = z.object({
  id: PathId,
  learnerPair: LearnerPair,
  levels: z.array(LevelSpec),
})
export type LearningPath = z.infer<typeof LearningPath>

export const LevelState = z.object({
  pathId: PathId,
  levelIndex: z.number().int().nonnegative(),
  xp: z.number().nonnegative(),
  complete: z.boolean(),
})
export type LevelState = z.infer<typeof LevelState>
