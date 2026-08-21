// journey/engine/index.ts — the PUBLIC barrel (engine.md §1.2). Nothing else
// in the app may deep-import engine internals (boundary rule §8.1).

export {
  createJourneyEngine,
  createMemoryPersistence,
  itemCardCodec,
  JOURNEY_FSRS_PARAMS,
  type JourneyEngine,
} from "./engine.ts"
export { systemClock, type Clock } from "./clock.ts"
export type { Scheduler, SchedulerGrade } from "./scheduler.ts"
export type { PlacementController } from "./placement.ts"
export type { JourneyPersistence, ItemCardRecord } from "./persistence/types.ts"
export type { MixerTelemetry } from "./mixer.ts"
export {
  CardFlags,
  type ActivitySpec,
  type ActivityResult,
  type ActivityItemResult,
  type ItemRef,
  type ItemCard,
  type ReviewLogEntry,
  type SkillScalars,
  type SkillState,
  type CourseState,
  type PlacementRecord,
  type SessionState,
  type IssuedCard,
  type PoolTag,
  type Strand,
  type CourseGraph,
  type ActivityTemplate,
  type RecipeSlot,
  type EngineKey,
  type RecoveryReport,
  type EngineCard,
  type CheckpointSummary,
  type FeedConstraints,
  type InterludeProvider,
  type ApplyOutcome,
  type DayRollover,
  type CourseSnapshot,
  type ProbeResult,
  type PlacementOutcome,
} from "./types.ts"
