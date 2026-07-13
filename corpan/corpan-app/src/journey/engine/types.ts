// journey/engine/types.ts — every serialized + API type (engine.md §2).
//
// The engine re-declares NOTHING from the activity contract (R3): wire
// shapes come in type-only from contentPacks/activityContract.ts. CourseGraph
// mirrors engine.md §2.6 and is structurally identical to the loader output
// in src/util/journeyPack.ts (W6) — the engine consumes the plain object, it
// never imports the loader.

import type { ActivitySpec, ItemRef } from "../../contentPacks/activityContract.ts"
import type { Rng } from "./rng.ts"

// re-exported for consumers of the barrel
export type { ActivitySpec, ActivityResult, ActivityItemResult, ItemRef } from "../../contentPacks/activityContract.ts"

// ------------------------------------------------------------------ ItemCard

/** Per-item FSRS + engine state (engine.md §2.1). Lazy-created at first
 *  SCORED exposure. Persisted as one DocStore doc per item, doc id = itemId
 *  (= itemRefKey(ref), the ONE colon-form contract key — R2). */
export interface ItemCard {
  itemId: string
  fsrs: {
    s: number                  // stability (days)
    d: number                  // difficulty 1..10 (0 while state is New)
    due: number                // epoch DAY (local; int)
    last: number               // epoch day of last review (0 = never)
    reps: number
    lapses: number
    state: 0 | 1 | 2 | 3       // ts-fsrs State: New|Learning|Review|Relearning
    /** Consecutive PERFECT completions (score ≥ 0.95, no hints — mirrors the
     *  runtime combo). At RETIRE_PERFECT_STREAK the card is RETIRED (breadth-
     *  first: a twice-nailed item stops recycling so unseen material leads).
     *  Reset to 0 on any miss/lapse. Optional for backward-compat: an older
     *  persisted card with no counter decodes to 0 (persistence/types.ts). */
    perfect?: number
  }
  flags: number                // CardFlags bitfield
  form: 0 | 1 | 2              // highest form PASSED
}

export const CardFlags = {
  PriorKnown: 1,
  PlacementSeeded: 2,
  Leech: 4,
  Suspended: 8,
  /** RETIRED (R-A): reached RETIRE_PERFECT_STREAK perfect completions. Excluded
   *  from the DUE/FUN/REPAIR pools + continuation-revisit + debt backlog so
   *  mastered items stop being served forever; a genuine FSRS forget/lapse
   *  clears it (rare long-interval return at most). */
  Retired: 16,
} as const

// -------------------------------------------------------- review-log read model

/** Pure read projection of one graded item inside an activity_result event
 *  (engine.md §2.2 — the shared local-analytics AppendLog is the ONE review
 *  history; the engine only projects it for recovery/optimizer reads). */
export interface ReviewLogEntry {
  itemId: string
  ts: number
  day: number                  // epoch day (scheduling truth)
  grade: 1 | 2 | 3 | 4
  activityType: string
  latencyMs?: number
  specId: string
}

// ------------------------------------------------------------------ SkillState

/** PERSISTED per-skill scalars (engine.md §2.3). */
export interface SkillScalars {
  skillId: string
  accEwma: number
  placedAt?: number
  legendaryAt?: number
  announcedLevel: 0 | 1 | 2 | 3 | 4 | 5
  demotedAt?: number
}

/** DERIVED view — never persisted. */
export interface SkillState extends SkillScalars {
  coverage: number
  strength: number
  mastery: number
  level: 0 | 1 | 2 | 3 | 4 | 5
}

// ------------------------------------------------------------------ CourseState

export interface CourseState {
  courseId: string
  schemaVersion: number

  theta: number
  thetaK: number
  resultCount: number

  position: {
    arcId: string
    unitId: string
    unitOrdinal: number
  }

  newPerDay: number
  newIntroducedToday: number
  dailyCapacityEwma: number
  backlogRing: number[]
  lastThrottleAdjustDay: number

  strandTally: { day: number; secs: [number, number, number, number] }[]

  placement?: PlacementRecord
  firstWeek?: { results: number; correct: number; cruiseSessions: number }
  jump: { lastOfferedDay: number; consecutiveCruiseSessions: number }

  lesson: { unitId: string; lessonIndex: number; slotIndex: number } | null
  checkpointsPassed: Record<string, number>

  sessionCounter: number
  lastTickDay: number
  lastActiveDay: number
  latencyBaselines: Record<string, { logMean: number; n: number }>

  // -- engine-internal persisted extras (not in the §2.4 core, additive) --
  /** Scored results today (backlogRing "active day" + capacity EWMA input). */
  scoredToday: number
  /** Sessions started today + smoothed sessions/active-day (soft-backlog
   *  throughput = capacity / sessionsPerDayEwma, engine.md §5.3.2). */
  sessionsToday: number
  sessionsPerDayEwma: number
  /** Rolling week window for the throttle-up cruise-share check (§4.6.4). */
  sessionsWeek: number
  cruiseSessionsWeek: number
  /** Leech substitutes promoted into NEW (adaptivity §6.4b). */
  leechSubstitutes: string[]
  /** Last two activity types served per LEECH-flagged item (presentation swap). */
  leechTypes: Record<string, string[]>
  /** Items boosted to the head of NEW after a failed jump (§5.9). */
  newBoost: string[]
  /** One legendary attempt per skill per local day (§5.8). */
  legendaryAttempt: Record<string, number>
  /** Pending week-one check result surfaced by tickDay. */
  placementCheckPending?: "offer-rewind" | "offer-jump"
}

export interface PlacementRecord {
  theta: number
  se: number
  day: number
  asked: { itemId: string; b: number; correct: boolean }[]
  outcome: "placed" | "skipped-zero-beginner" | "above-content"
}

// ------------------------------------------------------------------ SessionState

export type PoolTag =
  | "due" | "replay" | "new" | "repair" | "trickle" | "fun"
  | "probe" | "jump" | "scaffold" | "checkpoint"
export type Strand = "input" | "output" | "language" | "fluency"

/** Everything the engine needs to grade a result that the D2 wire shape
 *  omits (engine.md §2.5). */
export interface IssuedCard {
  specId: string
  activityType: string
  itemIds: string[]
  form: 0 | 1 | 2
  guessable: boolean
  isReplay: boolean
  pool: PoolTag
  strand: Strand
  estSec: number
  modelNeeds: ("stt" | "llm" | "tts")[]
  issuedAtMs: number
  /** Unscored presentation (new-item intro card / cadence checkpoint face). */
  unscored?: boolean
  /** Checkpoint batch membership (engine.md §5.10). */
  checkpointId?: string
  /** Jump/legendary gauntlet membership. */
  gauntletId?: string
}

export interface CheckpointRun {
  checkpointId: string
  scope: "unit" | "arc"
  passScore: number
  count: number
  resolved: number
  scoreSum: number
  weakSkillIds: Set<string>
}

export interface GauntletRun {
  kind: "jump" | "legendary"
  id: string
  skillIds: string[]           // skipped skills (jump) or the one skill (legendary)
  layers: number
  mistakesAllowed: number
  count: number
  resolved: number
  mistakes: number
  failedItemIds: string[]
}

export interface SessionState {
  sessionId: string
  rng: Rng
  startedDay: number
  scored: number
  openerServed: boolean
  jumpOfferedThisSession: boolean

  flow: { window: { score: number; latencyZ: number }[]; mode: "cruise" | "normal" | "struggle" }
  last40: { activityType: string; strand: Strand; itemIds: string[] }[]

  replayQueue: { itemId: string; notBeforeEmitIndex: number; form: 0 | 1 | 2; failures: number }[]
  /** Frustration guard (§4.4): an item is replayed at most ONCE per session. */
  replayedItems: Set<string>
  /** Debut ladder step 2: recognition cards owed after an intro card, with
   *  the same gap discipline as replays (engine.md §5.4 debut pattern). */
  pendingDebutRecognitions: { itemId: string; notBeforeEmitIndex: number }[]
  emitIndex: number
  lastEmit: Map<string, number>

  issued: Map<string, IssuedCard>
  debuts: Map<string, 0 | 1 | 2>

  // -- session-internal extras (never persisted; additive to §2.5) --
  /** Struggle re-teach pending (engine.md §5.3.1). */
  scaffoldItemId: string | null
  /** activityType of the previous batch's LAST emitted card — the §5.4
   *  same-type-adjacency seed across the batch seam (W10/W4 fix b). */
  lastBatchTailType: string | null
  /** Cadence checkpoints emitted so far this session (§5.4 step 3.5). */
  cadenceEmitted: number
  /** FUN (strong-known variety) cards served this session — VARIETY telemetry
   *  only. The feed is infinite (doom-scroll to fluency): once the day's real
   *  work is done, the eager learner keeps getting fresh FRONTIER material (next
   *  reachable units) plus a bounded rotating fun garnish. Fun no longer drives
   *  a wind-down/shutdown — it is capped per batch (MAX_FUN_PER_10), never for
   *  the whole session. This counter is retained for debug/telemetry. */
  funServedSession: number
  /** Checkpoint batches attempted this session (one boss attempt/session). */
  bossAttempted: Set<string>
  /** Active unit-boss / arc-gate tally. */
  checkpointRun: CheckpointRun | null
  /** Active jump/legendary gauntlet tally. */
  gauntletRun: GauntletRun | null
  /** Flow modes observed per scored card (cruise-dominance bookkeeping). */
  modeTally: { cruise: number; normal: number; struggle: number }

  // -- interlude cadence bookkeeping (PREMIUM_SCROLL §2.2/§2.3) --
  /** emitIndex of the last interlude slot (game OR reader), or -1 if none yet.
   *  Enforces the "never two interludes back-to-back" floor + the minimum-gap
   *  between spikes. */
  lastInterludeEmit: number
  /** emitIndex of the last GAME interlude specifically (its own ~1-in-12–18
   *  cadence). -1 if none yet. */
  lastGameInterludeEmit: number
  /** emitIndex of the last READER interlude specifically (its own ~1-in-20–30
   *  cadence). -1 if none yet. */
  lastReaderInterludeEmit: number
  /** emitIndex of the last emitted checkpoint (cadence "Punto de control" OR a
   *  boss/arc checkpoint slot), or -1 if none yet. Enforces the "never several
   *  checkpoints back-to-back" floor (CHECKPOINT_BACK_TO_BACK_FLOOR) across
   *  batches — mirrors lastInterludeEmit. */
  lastCheckpointEmit: number
}

// ------------------------------------------------------------------ CourseGraph

/** Input contract to the D6 pack loader — plain JSON-serializable
 *  (engine.md §2.6; structural twin of util/journeyPack.ts CourseGraph). */
export interface CourseGraph {
  courseId: string
  /** BCP-47 target language from `pack_meta.target_lang` (authoritative —
   *  correct casing, e.g. "pt-BR"). Optional here so hand-built fixtures keep
   *  compiling; when absent the GraphIndex falls back to the courseId
   *  derivation, which loses casing (W10 item 15). */
  targetLang?: string
  arcs: { arcId: string; ordinal: number; cefr: "A0" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2" }[]
  units: { unitId: string; arcId: string; ordinal: number; skillIds: string[] }[]
  skills: Record<string, {
    skillId: string
    prereqs: string[]
    itemIds: string[]
    b: number
    unitId: string
  }>
  items: Record<string, {
    itemId: string
    ref: ItemRef
    skillIds: string[]
    b: number
    introOrder: number
    importance: number
    probe?: boolean
    substituteIds?: string[]
    textLen: number
    kind: ItemRef["kind"]
  }>
  activityTemplates: ActivityTemplate[]
  lessonRecipes: Record<string, {
    recipeId: string
    estMinutes: number
    slots: RecipeSlot[]
  }>
  unitLessons: Record<string, { lessonIndex: number; recipeId: string; params?: Record<string, unknown> }[]>
  checkpoints: {
    checkpointId: string
    scope: "unit" | "arc"
    unitId?: string
    arcId?: string
    recipeId: string
    passScore: number
    params?: Record<string, unknown>
  }[]
  rareCards: {
    rareCardId: string
    cardType: "delight" | "minigame" | "etymology" | "story"
    rarityWeight: number
    minUnitOrdinal?: number
    provider?: string
    itemId?: string
    coverageGate?: number
    params?: Record<string, unknown>
  }[]
}

export interface ActivityTemplate {
  activityType: string
  itemKind: ItemRef["kind"]
  form: 0 | 1 | 2
  strand: Strand
  guessable: boolean
  estSec: number
  modelNeeds: ("stt" | "llm" | "tts")[]
  provider: "native" | string
  funWeight?: number
}

export interface RecipeSlot {
  slotType: string
  activityTypes: string[]
  itemSelector: "due" | "new" | "unit" | "known" | "grammar-node" | "l1-phoneme" | "rare" | "none"
  params?: Record<string, unknown>
  optional: boolean
}

// ------------------------------------------------------------------ engine API

export interface EngineKey { stackId: string; courseId: string }

export interface RecoveryReport {
  corruptCards: number
  rebuiltFromLog: number
  reseeded: number
  courseStateLost: boolean
  skillsLost: boolean
}

/** engine.md §4.2 — the engine's envelope around the spec (R5). */
export interface EngineCard {
  spec: ActivitySpec
  meta: {
    pool: PoolTag
    strand: Strand
    form: 0 | 1 | 2
    estSec: number
    provider: "native" | string
    celebration: "normal" | "rare"
    /** Presentation-only card (debut intro / cadence face / offer): the
     *  engine grades it to no evidence (apply.ts) — surfaces read THIS
     *  instead of inferring presentation-ness from activityType (W10/W4). */
    unscored?: boolean
    rareVariant?: "delight" | "etymology" | "timeCapsule" | "miniGame" | "storyChapter"
    checkpoint?: {
      checkpointId: string
      scope: "unit" | "arc"
      passScore: number
      index: number
      count: number
      summary: CheckpointSummary
    }
    coolDownCandidate: boolean
    /** Set on a scheduled INTERLUDE pack card (PREMIUM_SCROLL §2.2/§2.3): a
     *  game spike vs a reader breath. Drives the compact InterludePoster's cue/
     *  icon (game vs reader) independently of the rare-variant path. */
    interludeKind?: "game" | "reader"
  }
}

export interface CheckpointSummary {
  unitId?: string
  arcId?: string
  skillIds: string[]
  itemCount: number
  passScore: number
}

/** An installed pack that can serve as a Journey interlude (PREMIUM_SCROLL
 *  §2.2/§2.3). Built at wiring time from the catalog `activities` declarations
 *  of installed packs (activity-contract.md §4.3) — the mixer picks among these
 *  by `kind` (a game spike vs a reader breath) instead of any hardcoded
 *  provider. `activityType` is the namespaced `<packId>:<name>` the launched
 *  ActivitySpec carries; `provider` is the packId (== the FeedCard's packId). */
export interface InterludeProvider {
  provider: string
  kind: "game" | "reader"
  activityType: string
  itemKinds: string[]
  estSec: number
}

export interface FeedConstraints {
  availableProviders: string[]
  /** Installed interlude-capable packs, game + reader. Absent/empty ⇒ the
   *  mixer schedules NO pack interludes (native-only feed). */
  interludes?: InterludeProvider[]
  /** The learner's CURRENT combo (runtime-owned; feeds the interlude
   *  variety engine — a hot combo prefers a reader breath, a cold stretch a
   *  game spike). Absent ⇒ treated as 0. */
  combo?: number
  modelsAvailable?: ("stt" | "llm" | "tts")[]
  excludeActivityTypes?: string[]
  timeboxSec?: number
  checkpointCadence?: number
  /** True only when a Whisper model is actually INSTALLED on disk (not merely
   *  supported-but-missing). The mixer up-weights the output (speaking) strand
   *  so installing STT visibly increases live speaking (§ speak-first). */
  sttInstalled?: boolean
}

export interface ApplyOutcome {
  grades: { itemId: string; grade: 1 | 2 | 3 | 4 | "forget" }[]
  /** Per-item evidence for the ONE activity_result event the runtime records
   *  via recordLocal() (engine.md §4.4, R15). */
  items: {
    ref: string
    outcome: "pass" | "partial" | "fail"
    grade: 1 | 2 | 3 | 4
    latencyMs?: number
    hintsUsed?: number
    predictedRecall?: number
    b?: number
    theta?: number
  }[]
  replaysQueued: string[]
  skillTransitions: { skillId: string; from: number; to: number }[]
  checkpoint?: { checkpointId: string; passed: boolean; score: number }
  flowMode: "cruise" | "normal" | "struggle"
  celebrationHint: "fail" | "pass" | "streak" | "levelup"
}

export interface DayRollover {
  day: number
  announcements: { skillId: string; from: number; to: number }[]
  newPerDay: number
  debtBrakeActive: boolean
  placementCheck?: "offer-rewind" | "offer-jump"
}

export interface CourseSnapshot {
  theta: number
  position: CourseState["position"]
  dueCount: number
  newRemainingToday: number
  flowMode: "cruise" | "normal" | "struggle"
  strandShares: [number, number, number, number]
  jumpAvailable: boolean
  debtBrakeActive: boolean
  newPerDay: number
}

// ------------------------------------------------------------------ placement

export interface ProbeResult { itemId: string; correct: boolean; latencyMs: number }

export interface PlacementOutcome {
  record: PlacementRecord
  unlockedSkills: string[]
  frontier: string[]
  startUnitId: string
  /** Concrete summary for the placement result UI (feed-ux §1.9, defect #9):
   *  where the learner landed and how much they skipped past. Pure,
   *  graph-derived — the surface maps ids → localized titles. */
  placement: PlacementSummary
}

export interface PlacementSummary {
  /** R10: routed to the end of shipped content (above the ceiling). */
  aboveContent: boolean
  arcId: string
  arcOrdinal: number
  cefr: string
  unitId: string
  unitOrdinal: number
  /** Units before the placed unit — skipped past by placement. */
  unitsSkipped: number
  /** Skills unlocked / pre-lit — skipped past by placement. */
  skillsSkipped: number
}
