# Journey Engine — Implementation Spec

**Status: v1.0 implementable spec. Elaborates ARCHITECTURE `D4` (engine) and `D5` (storage).**
**Design source: `research/adaptivity.md` (adopted wholesale per D4). Strand math: `research/pedagogy.md` §12. Storage: `specs/storage-analytics.md` §3.7 (normative for `EnginePersistence` — R15).**
**Verified against the code and the published `ts-fsrs@5.4.1` package on 2026-07-03.**

Decisions in ARCHITECTURE.md are settled; this document only pins down what they left
open. Every deviation or interpretation is listed in §9 (Decisions taken here).

---

## 0. Scope and ground rules

The engine is the adaptive core of Journey: FSRS-6 scheduling, derived skill mastery,
one Elo/1PL ability scalar θ, adaptive placement, the feed mixer, and daily throttling.

Hard rules (enforced by tests, §8.1):

1. **Pure TS.** No module under `corpan-app/src/journey/engine/` may reference `window`,
   `document`, `localStorage`, `indexedDB`, `navigator`, Tauri APIs, or React —
   **no exceptions**. The impure persistence edge lives OUTSIDE the engine, in
   `src/journey/persistence.ts`, which wires the `EnginePersistence` adapter defined
   normatively in `specs/storage-analytics.md` §3.7 (R15). Type-only imports
   (`import type`) from `contentPacks/types.ts` (incl. `activityContract.ts`) and from
   `@/lib/storage` (the `DocStore`/`AppendLog`/`KVStore` interfaces) are permitted
   (erased at compile time).
2. **No wall clock in core.** `Date.now()` / `new Date()` are banned everywhere in the
   engine except `clock.ts` (which provides the production `Clock`). All core logic
   takes time from an injected `Clock`.
3. **No unseeded randomness.** `Math.random()` is banned. All sampling flows through an
   injected PRNG seeded from `(stackId, courseId, sessionCounter)` (adaptivity.md §7).
4. **Erasable-syntax-only TS.** The repo's test runner is
   `node --experimental-strip-types --test 'src/**/*.test.ts'` (`corpan-app/package.json:13`),
   which cannot execute TS `enum` / `namespace` / parameter properties. Use union types
   and `const` objects. (ts-fsrs ships compiled JS enums — importing them is fine.)
5. **The engine mints every `ActivitySpec` it grades.** Grade derivation may rely on
   issued-spec metadata (form, guessability, replay status) retained in `SessionState`;
   the D2 `ActivityResult` wire shape stays minimal.

Out of scope here: feed React surface (D7 spec), course-pack SQLite schema + builder
(D6 spec), the hostApi/SDK contract plumbing (D2 spec), quota wiring (D9). This spec
defines the engine's *interfaces to* each of those.

---

## 1. Module layout, dependencies, ts-fsrs

### 1.1 File layout

```
corpan-app/src/journey/engine/
├── index.ts               # public barrel: createJourneyEngine, types, JOURNEY_FSRS_PARAMS,
│                          #   createMemoryPersistence, itemCardCodec
├── types.ts               # every serialized + API type in §2 (single source of truth)
├── constants.ts           # all tunable numbers (quotas, thresholds, windows) — one file,
│                          #   so simulation sweeps patch exactly one module
├── clock.ts               # Clock interface, epochDay(), systemClock (only Date.now() here)
├── rng.ts                 # Rng interface, mulberry32 impl, seed derivation, weightedPick
├── graph.ts               # CourseGraph read model + derived indexes (prereq closure,
│                          #   item→skills, skill→items, unit order, probe bank)
├── scheduler.ts           # Scheduler interface wrapping ts-fsrs — the ONLY file that
│                          #   imports "ts-fsrs"
├── grading.ts             # toGrade(): ActivityResult × IssuedCard × ItemCard → Grade (§4.4)
├── latency.ts             # expectedLatency baselines (EWMA of log-latency) + seeds
├── mastery.ts             # derived SkillState + SkillIndex memoization (§2.4)
├── theta.ts               # Elo/1PL update, K decay, b() aggregation for multi-item results
├── flow.ts                # session flow controller: cruise|normal|struggle (§5.6)
├── forms.ts               # form-ladder state machine (§5.5)
├── strands.ts             # strand accounting: 2-week tally + last-40 window + stage
│                          #   ratio targets (pedagogy §12.1) + deficit computation
├── pools.ts               # DUE/REPLAY/NEW/REPAIR/TRICKLE/FUN pool construction (§5.2)
├── lessons.ts             # lesson/checkpoint layer: recipe-slot filling, checkpoint
│                          #   batches, pass_score gating, welcomeBack + rare rolls (§5.10)
├── mixer.ts               # nextFeedItems: slot sampler + constraints + model batching (§5)
├── placement.ts           # 3-phase adaptive probe controller + finalize (§4.3)
├── leech.ts               # leech detect / presentation-swap / suspend+substitute (§5.7)
├── daily.ts               # tickDay: rollover, newPerDay throttle, debt-brake accounting,
│                          #   level-transition announcements (§4.6)
├── apply.ts               # applyResult update pipeline (§4.4) — composes scheduler,
│                          #   grading, mastery, theta, flow, leech
├── engine.ts              # JourneyEngine facade: owns EngineState, orchestrates
│                          #   persistence staging/flush, lazy tickDay
├── persistence/
│   ├── types.ts           # re-exports EnginePersistence (normative home:
│                          #   specs/storage-analytics.md §3.7) + ItemCardRecord codec (§3)
│   ├── memory.ts          # in-memory DocStore/AppendLog/KVStore fakes (tests + simulation)
│   └── recover.ts         # pure engine-level recovery ladder (§3.5)
└── sim/                   # simulation harness (§7) — dev-only, never bundled by the app
    ├── learner.ts         # synthetic learner memory/latency models + personas
    ├── runner.ts          # day-loop simulator (drives the real engine + memory adapter)
    ├── metrics.ts         # review-load curves, time-to-arc, starvation/livelock checks
    ├── report.ts          # pass/fail gate evaluation + markdown/JSON report
    └── cli.ts             # node entry point for Spark runs (impure: fs/process OK here)
```

### 1.2 Dependency graph (imports point downward; no cycles)

```
engine.ts ──► apply.ts ──► grading.ts, scheduler.ts, mastery.ts, theta.ts, flow.ts,
   │                        leech.ts, latency.ts
   ├────────► mixer.ts ──► pools.ts, lessons.ts, forms.ts, strands.ts, flow.ts, rng.ts
   ├────────► placement.ts ──► theta.ts, graph.ts, rng.ts
   ├────────► daily.ts ──► mastery.ts, strands.ts
   ├────────► persistence/types.ts   (interface only)
   └────────► graph.ts, clock.ts, types.ts, constants.ts

scheduler.ts ──► ts-fsrs            (sole external dependency)
persistence/recover.ts ──► types.ts, scheduler.ts (log-replay rebuild)
sim/* ──► engine.ts + persistence/memory.ts  (uses the real public API only)

(the IMPURE adapter wiring — real DocStore/AppendLog/KVStore instances — lives in
src/journey/persistence.ts, OUTSIDE engine/**; see §3.1 / storage-analytics.md §3.7)
```

`index.ts` exports: `createJourneyEngine`, `createMemoryPersistence`, `itemCardCodec`,
`JOURNEY_FSRS_PARAMS`, `systemClock`, and all public types.
Nothing else in the app may deep-import engine internals (boundary test, §8.1).

### 1.3 ts-fsrs — pin and config (verbatim)

Add to `corpan-app/package.json` dependencies, **exact pin, no caret**:

```json
"ts-fsrs": "5.4.1"
```

(5.4.1 is the latest release, 2026-05-22; the 5.x line implements FSRS-6 with 21
parameters. Verified on npm 2026-07-03: `dist-tags.latest = 5.4.1`. Upgrades require
re-running the simulation gate, §7.)

`scheduler.ts` — the only ts-fsrs import in the codebase:

```ts
import {
  fsrs, generatorParameters, createEmptyCard, default_w,
  Rating, State, StrategyMode, GenSeedStrategyWithCardId,
  type Card, type Grade, type FSRSParameters, type RecordLogItem,
} from "ts-fsrs"

/** Journey FSRS-6 configuration — adaptivity.md §1.3, verbatim.
 *  default_w (ts-fsrs 5.4.1) === the 21 FSRS-6 weights:
 *  [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
 *   1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
 *   1.8729, 0.5425, 0.0912, 0.0658, 0.1542]
 *  A unit test asserts this equality so a ts-fsrs upgrade that silently
 *  changes defaults fails loudly (§8.2 T-sched-1). */
export const JOURNEY_FSRS_PARAMS: FSRSParameters = generatorParameters({
  request_retention: 0.90,   // internal pace knob later; never user-visible
  maximum_interval: 365,     // course content churns; ts-fsrs default 36500 is wrong for us
  w: default_w,
  enable_fuzz: true,         // ±small% interval noise; prevents due-date clumping
  enable_short_term: true,   // REQUIRED: same-session replay uses the w17–w19 path
  learning_steps: [],        // the feed IS the intra-session pacing (adaptivity §1.3);
  relearning_steps: [],      //   [] = "managed by FSRS" per ts-fsrs docs
})

export function createScheduler(): Scheduler {
  const f = fsrs(JOURNEY_FSRS_PARAMS)
  // Deterministic fuzz: default seed strategy mixes review_time.getTime() (ms) into
  // the seed — non-reproducible. GenSeedStrategyWithCardId seeds from
  // (card.cardId + reps): deterministic given card state. We attach cardId (fnv1a32
  // of itemId) to every CardInput we hand ts-fsrs. Satisfies adaptivity §1.3
  // "deterministic seed = hash(itemId)".
  f.useStrategy(StrategyMode.SEED, GenSeedStrategyWithCardId("cardId"))
  return wrap(f)
}
```

The `Scheduler` interface (so FSRS-7 / a WASM optimizer swap is invisible to the app —
adaptivity §7):

```ts
export type SchedulerGrade = 1 | 2 | 3 | 4          // Rating.Again..Easy, Manual excluded

export interface Scheduler {
  /** Create a new card. `seed` variant used for priorKnown seeding (§4.3). */
  emptyCard(nowDay: number): ItemCard["fsrs"]
  /** Apply one graded review. Handles same-day (short-term) path automatically. */
  next(card: ItemCard, nowMs: number, grade: SchedulerGrade): { fsrs: ItemCard["fsrs"]; log: ReviewLogEntry["fsrs"] }
  /** Closed-form retrievability at `nowMs` (power curve, w20 decay). */
  retrievability(card: ItemCard, nowMs: number): number
  /** "I never learned this" → reset to New (ts-fsrs forget()). */
  forget(card: ItemCard, nowMs: number): ItemCard["fsrs"]
  /** Rebuild memory state from a review-log slice (corruption recovery, §3.5). */
  replay(entries: ReviewLogEntry[], nowMs: number): ItemCard["fsrs"] | undefined
}
```

`wrap()` converts between our compact `ItemCard` (§2.1, day-granular ints) and ts-fsrs
`Card` (Date-based): `toFsrsCard` attaches `cardId`, expands epoch-days to local-midnight
`Date`s; `fromFsrsCard` collapses back. **Clock-jump guards** (adaptivity §7): elapsed
days clamped to `[0, 365]` before calling `f.next`; a negative elapsed (clock moved
backwards) is treated as same-day.

---

## 2. Types (canonical — these go in `engine/types.ts` verbatim)

### 2.1 ItemCard — the only heavy table

```ts
/** Per-item FSRS + engine state. Lazy-created at first SCORED exposure
 *  (intro cards are unscored presentations — adaptivity §5.3). ~64B logical;
 *  25k items ≈ 1.6MB serialized. Persisted as one DocStore doc per item (§3.1). */
export interface ItemCard {
  itemId: string               // course-pack item id = itemRefKey(ref) — the ONE
                               //   colon-form contract helper (R2; table in
                               //   activity-contract.md §1)
  fsrs: {
    s: number                  // stability (days)
    d: number                  // difficulty 1..10
    due: number                // epoch DAY (local; int — day granularity on purpose)
    last: number               // epoch day of last review (0 = never)
    reps: number               // uint16
    lapses: number             // uint16
    state: 0 | 1 | 2 | 3       // ts-fsrs State: New|Learning|Review|Relearning
  }
  flags: number                // bitfield, see CardFlags
  form: 0 | 1 | 2              // highest form PASSED: recognition|cuedRecall|production
}

export const CardFlags = {
  PriorKnown: 1,               // seeded as known (placement / "already knew" / jump)
  PlacementSeeded: 2,          // created by placement/jump trickle, not natural intro
  Leech: 4,                    // §5.7
  Suspended: 8,                // leech-suspended; substitute serves instead
} as const
```

### 2.2 Review history — the shared local-analytics AppendLog (one source, R15)

The engine keeps **no private review-log table**. The review history IS the local
analytics `AppendLog` (`specs/storage-analytics.md` §3.5/§4): one `activity_result`
event per graded `applyResult`, in the shared app-wide log. One writer (the runtime's
`recordLocal()` path, fed by `ApplyOutcome` — §4.4), two readers: this engine
(corruption-recovery replay §3.5, future fsrs-browser weight optimization) and the
storage-analytics aggregation queries. **No second copy.** Ring capacity, pruning, and
durability policy are owned by storage-analytics.md (namespace registry §3.8), not here.

For recovery/optimizer reads the engine projects `ActivityResultEvent.items` rows into
a compact in-memory shape (never persisted by the engine):

```ts
/** Pure read projection of one graded item inside an activity_result event. */
export interface ReviewLogEntry {
  itemId: string               // event item `ref` (serialized ItemRef)
  ts: number                   // event envelope ts (audit only, never scheduling input)
  day: number                  // epoch day derived from envelope `day` (scheduling truth)
  grade: 1 | 2 | 3 | 4
  activityType: string         // form is recovered via the ACTIVITY_TYPES registry (R4)
  latencyMs?: number
  specId: string               // joins back to the issued ActivitySpec
}
```

`scheduler.replay()` rebuilds S/D/state from the grade+day sequence alone (sequential
`next()` calls), so post-review FSRS state does not need to ride the event.

### 2.3 SkillState — derived, with explicit memoization

Stored truth per skill is **three scalars + timestamps**; everything else recomputes
from ItemCards (adaptivity §2.2: "mastery is never stored as truth").

```ts
/** PERSISTED per-skill scalars (few hundred rows/course — one storage record). */
export interface SkillScalars {
  skillId: string
  accEwma: number              // recall-level (form ≥ 1) accuracy EWMA, α = 0.3
  placedAt?: number            // epoch day, if unlocked via placement/jump (provisional)
  legendaryAt?: number         // epoch day Legendary challenge passed
  announcedLevel: 0|1|2|3|4|5  // last level ANNOUNCED to the UI (hysteresis, §4.6)
  demotedAt?: number           // epoch day of last demotion (feeds REPAIR pool)
}

/** DERIVED view — what every consumer reads. Never persisted. */
export interface SkillState extends SkillScalars {
  coverage: number             // |seen ∩ I(s)| / |I(s)|
  strength: number             // mean R(now) over seen items of s
  mastery: number              // coverage × strength ∈ [0,1]
  level: 0|1|2|3|4|5           // Locked|Unlocked|Learning|Practiced|Mastered|Legendary
}
```

**Memoization (mastery.ts).** `SkillIndex` is built once per `load()` from the
CourseGraph: `skillToItems: Map<string, string[]>`, `itemToSkills: Map<string, string[]>`
(an item in k skills counts in each — adaptivity §8.2). The cache:

```ts
interface SkillCacheEntry { value: SkillState; day: number; seq: number }
// cache: Map<skillId, SkillCacheEntry>
// dirtySeq: Map<skillId, number>  — bumped by applyResult for every skill of every
//                                   touched item, and by placement/jump finalize.
```

`getSkillState(skillId, nowMs)` recomputes iff
`cache.seq !== dirtySeq.get(skillId)` **or** `cache.day !== epochDay(nowMs)`
(retrievability decays with time, so any day rollover invalidates `strength`).
Recompute is O(|items(s)|) with closed-form R — a full-course recompute of ~300 skills
× ~80 items is <10ms; per-result invalidation touches ≤ a handful of skills.
`level` is derived inside the same recompute from the D4/adaptivity §6.2 table
(thresholds in `constants.ts` verbatim):

| Level | Enter when |
|---|---|
| 1 Unlocked | all DAG prerequisites ≥ 3 (Practiced) |
| 2 Learning | first ItemCard of the skill exists |
| 3 Practiced | coverage ≥ 0.8 ∧ strength ≥ 0.7 ∧ accEwma ≥ 0.75 |
| 4 Mastered | coverage ≥ 0.95 ∧ strength ≥ 0.9 ∧ accEwma ≥ 0.85 ∧ every seen item form ≥ 1 |
| 5 Legendary | dedicated challenge passed (§5.8) |
| demote → 2 | strength < 0.5 ∨ accEwma < 0.5 (also how wrong placement self-heals) |

`level` computes fresh on every read; **announcement** of a transition (celebration,
path viz) happens at most once per local day via `announcedLevel` in `tickDay` (§4.6).

### 2.4 CourseState — one struct per (stack, course)

```ts
export interface CourseState {
  courseId: string             // "journey_en" (underscore-canonical pack id, R1)
  schemaVersion: number        // = ENGINE_SCHEMA (constants.ts); bump ⇒ migrate (§3.4)

  // ---- ability scalar (adaptivity §2.3) ----
  theta: number                // Elo/1PL ability
  thetaK: number               // learning rate, decays 0.5 → 0.08 with resultCount
  resultCount: number

  // ---- path position (prescriptive spine cursor) ----
  position: {
    arcId: string
    unitId: string             // first unit (pack order) whose skills are not all ≥ Practiced
    unitOrdinal: number        // index into graph.units, cached for O(1) advance checks
  }

  // ---- new-intake throttle + debt brake state (adaptivity §5.5, pedagogy §12.2) ----
  newPerDay: number            // adaptive, default 12, clamp [4, 30]
  newIntroducedToday: number   // resets in tickDay
  dailyCapacityEwma: number    // EWMA(α=0.15) of scored cards per ACTIVE day; seed 40
  backlogRing: number[]        // last 7 active days' end-of-day |DUE| (median drives throttle)
  lastThrottleAdjustDay: number // weekly cadence guard

  // ---- strand accounting (pedagogy §12.1: rolling 2-week window) ----
  strandTally: {               // ring of 14 daily buckets, seconds per strand
    day: number
    secs: [number, number, number, number]  // [input, output, language, fluency]
  }[]

  // ---- placement + jump ----
  placement?: PlacementRecord  // §4.3; kept for audit/UI + week-one check
  firstWeek?: { results: number; correct: number; cruiseSessions: number } // first-150 check
  jump: { lastOfferedDay: number; consecutiveCruiseSessions: number }

  // ---- lesson/checkpoint layer (R5) ----
  lesson: {                    // cursor into the active unit's lesson plan
    unitId: string
    lessonIndex: number        // index into graph.unitLessons[unitId]
    slotIndex: number          // next recipe slot to fill (§5.10)
  } | null                     // null ⇒ free-mix (no unit lesson active)
  checkpointsPassed: Record<string /*checkpointId*/, number /*epoch day*/>

  // ---- housekeeping ----
  sessionCounter: number       // increments per startSession; PRNG seed component
  lastTickDay: number          // lazy tickDay idempotence guard
  lastActiveDay: number        // last local day with ≥1 scored result (welcomeBack, §4.1)
  latencyBaselines: Record<string /*activityType*/, { logMean: number; n: number }>
}

export interface PlacementRecord {
  theta: number; se: number; day: number
  asked: { itemId: string; b: number; correct: boolean }[]
  outcome: "placed" | "skipped-zero-beginner" | "above-content"   // R10
}
```

### 2.5 SessionState — session-scoped, never persisted

```ts
export interface SessionState {
  sessionId: string            // `${stackId}:${courseId}:${sessionCounter}`
  rng: Rng                     // seeded mulberry32(hash(sessionId))
  startedDay: number
  scored: number               // scored cards this session
  openerServed: boolean        // warm-win opener emitted yet?
  jumpOfferedThisSession: boolean

  flow: { window: { score: number; latencyZ: number }[]; mode: "cruise"|"normal"|"struggle" }
                               // window = last 8 SCORED cards (flow.ts)
  last40: { activityType: string; strand: Strand; itemIds: string[] }[]  // interleaving window

  replayQueue: { itemId: string; notBeforeEmitIndex: number; form: 0|1|2; failures: number }[]
  emitIndex: number            // total cards emitted this session (gap accounting)
  lastEmit: Map<string /*itemId*/, number /*emitIndex*/>

  issued: Map<string /*specId*/, IssuedCard>   // §5.1 — grading metadata retention
  debuts: Map<string /*itemId*/, 0|1|2>        // new-item debut ladder: intro→recognition→done
}

/** Everything the engine needs to grade a result that the D2 wire shape omits. */
export interface IssuedCard {
  specId: string
  activityType: string
  itemIds: string[]
  form: 0 | 1 | 2
  guessable: boolean           // MC/recognition formats — caps grade at Good
  isReplay: boolean
  pool: PoolTag
  strand: Strand
  estSec: number
  modelNeeds: ("stt"|"llm"|"tts")[]
  issuedAtMs: number
}

export type PoolTag = "due"|"replay"|"new"|"repair"|"trickle"|"fun"|"probe"|"jump"|"scaffold"|"checkpoint"
export type Strand = "input" | "output" | "language" | "fluency"
```

### 2.6 CourseGraph read model (input contract to the D6 pack loader)

The engine consumes a **plain, JSON-serializable** object (so the sim harness can load
fixture graphs with zero IO). The `journey/store` layer builds it via the **normative
PackReader → CourseGraph loader section in `course-pack.md`** (added per R7): exact SQL
per CourseGraph field; **keyset pagination** over `intro_order` (the Rust
`content_packs_query_db` hard-caps at 2,000 rows and truncates SILENTLY); a row-count
assertion against `pack_meta.item_count` (mismatch = hard boot error, never silent);
build-time `textLen` column; `substituteIds` = same-skill items with `substitutable=1`
ordered by `intro_order`; one importance scale with its engine-weight mapping; and the
cold-start budget (full graph load < 500 ms on reference low-end Android at v0.1
scale). None of that is re-specified here — this section only fixes the shape the
engine receives.

```ts
export interface CourseGraph {
  courseId: string
  arcs: { arcId: string; ordinal: number; cefr: "A0"|"A1"|"A2"|"B1"|"B2"|"C1"|"C2" }[]
  units: { unitId: string; arcId: string; ordinal: number; skillIds: string[] }[]  // pack order
  skills: Record<string, {
    skillId: string
    prereqs: string[]          // DAG edges
    itemIds: string[]          // I(s)
    b: number                  // static difficulty, logit scale (A1 core ≈ −3 … C2 ≈ +4)
    unitId: string
  }>
  items: Record<string, {
    itemId: string
    ref: ItemRef               // D3 address (type-only import from contentPacks/types)
    skillIds: string[]
    b: number
    introOrder: number         // authored intro sequence within its skill
    importance: number         // frequency-rank weight 1.0..2.0
    probe?: boolean            // placement probe eligible
    substituteIds?: string[]   // leech substitution (same-skill alternates)
    textLen: number            // for latency normalization
    kind: ItemRef["kind"]
  }>
  /** (item kind × form) → renderable activities. Per-type metadata
   *  ({ form, strand, guessable, estSec, modelNeeds }) comes from the contract's
   *  `ACTIVITY_TYPES` registry in `activityContract.ts` — the ONE metadata source
   *  (R4); the loader copies registry rows for native types and
   *  `PackActivityDeclaration` rows for `<packId>:<name>` types. Never re-declared
   *  or hand-edited here. Availability filtering happens per call (§5.1). */
  activityTemplates: {
    activityType: string
    itemKind: ItemRef["kind"]
    form: 0 | 1 | 2
    strand: Strand
    guessable: boolean
    estSec: number
    modelNeeds: ("stt"|"llm"|"tts")[]
    provider: "native" | string   // pack id for anchor/rare providers
    funWeight?: number            // >0 ⇒ eligible for the FUN pool (game rounds, gems…)
  }[]

  // ---- lesson/checkpoint layer (R5) — loaded from lesson_recipes/recipe_slots,
  // ---- unit_lessons, checkpoints, rare_cards (course-pack.md §2) ----
  lessonRecipes: Record<string, {
    recipeId: string
    estMinutes: number
    slots: {
      slotType: string           // course-pack slot taxonomy ('review.retrieve', …)
      activityTypes: string[]    // choices for the mixer, ⊆ ACTIVITY_TYPES ∪ pack types
      itemSelector: "due"|"new"|"unit"|"known"|"grammar-node"|"l1-phoneme"|"rare"|"none"
      params?: Record<string, unknown>
      optional: boolean          // droppable under modelNeeds pressure
    }[]
  }>
  unitLessons: Record<string /*unitId*/, {
    lessonIndex: number; recipeId: string; params?: Record<string, unknown>
  }[]>
  checkpoints: {
    checkpointId: string
    scope: "unit" | "arc"
    unitId?: string; arcId?: string
    recipeId: string
    passScore: number            // checkpoints.pass_score — gates position advance (§5.10)
    params?: Record<string, unknown>
  }[]
  rareCards: {
    rareCardId: string
    cardType: "delight" | "minigame" | "etymology" | "story"
    rarityWeight: number
    minUnitOrdinal?: number      // resolved from min_unit_id at load
    provider?: string
    itemId?: string
    coverageGate?: number
    params?: Record<string, unknown>
  }[]
}
```

`graph.ts` derives at load: prereq transitive closure, per-skill item sets sorted by
`introOrder`, the global frontier function, and the probe bank (validated: ≥2 probes
per skill that declares any, else that skill is excluded from placement Phase 2 with a
console warning at load — never a throw).

---

## 3. Persistence

### 3.1 Adapter interface — consumed from storage-analytics.md (R15, normative there)

`EnginePersistence` is **defined in `specs/storage-analytics.md` §3.7** — that spec is
normative for the interface, the physical IndexedDB layout, tiers, namespaces, and
batching. The engine consumes it at construction; `persistence/types.ts` only
re-exports the type. Quoted for reference:

```ts
// normative home: specs/storage-analytics.md §3.7
import type { DocStore, AppendLog, KVStore } from "@/lib/storage"

export interface EnginePersistence {
  /** FSRS item cards. Doc id = serialized ItemRef (course-pack.md §1).
   *  ns = `journey-cards:${stackId}:${courseId}`. */
  itemCards: DocStore<ItemCardRecord>
  /** THE review history — the shared local analytics log (§2.2 / R15).
   *  One log, engine + analytics queries as readers; no second copy. */
  events: AppendLog<LocalAnalyticsEvent>
  /** Small engine meta: CourseState + SkillScalars[] + placement snapshot.
   *  ns = `journey-meta:${stackId}:${courseId}`. Keys: "course", "skills". */
  meta: KVStore
}
```

What **this** spec owns (per storage-analytics §3.7): `ItemCardRecord` and its codec.
`ItemCardRecord = ItemCard` (§2.1), doc id = `itemId`; `itemCardCodec: DocCodec<ItemCard>`
with `schemaVersion = ENGINE_SCHEMA`, a `parse` that structurally validates every field
(hand-rolled predicates, no zod — finiteness + range: `s > 0`, `d ∈ [1,10]`, `due`
within ±10y of now, enums in range; invalid ⇒ `null`, dropped and counted by the
storage doctor), and a **mandatory `migrate`** for any card schema bump (FSRS card loss
= re-placement — recoverable but expensive).

`load()` reads `itemCards.getAll()`, `meta.get("course")`, `meta.get("skills")`, runs
the engine-level recovery ladder (§3.5), and returns
`{ course?, skills?, cards, recovered: RecoveryReport }`:

```ts
export interface EngineKey { stackId: string; courseId: string }

export interface RecoveryReport {
  corruptCards: number         // dropped by the codec (storage-doctor counted)
  rebuiltFromLog: number       // cards reconstructed via scheduler.replay over `events`
  reseeded: number             // cards recreated as priorKnown/new (log gap)
  courseStateLost: boolean
  skillsLost: boolean
}
```

`persistence/memory.ts` provides in-memory `DocStore`/`AppendLog`/`KVStore` fakes
(deep-clone on read to catch shared-reference bugs); `src/journey/persistence.ts`
(app side, impure) wires the real ones — see storage-analytics §3.7/§3.8.

### 3.2 Physical layout, tiers, durability

Owned by storage-analytics.md: item cards and meta live on IDB-DOC (durable, never
volatile-evicted by policy — learner state is irreplaceable); the review history rides
the IDB-LOG local-analytics ring with its registered cap. Nothing engine-side chooses
shard counts, namespaces, or eviction flags anymore — the old private
`journey-engine::` shard scheme is superseded (see §9 decision 3).

### 3.3 Write batching

The `WriteBatcher` (storage-analytics §3.9) owns coalescing, the 250 ms debounce,
`maxPending`, and the `pagehide`/`visibilitychange:hidden` lifecycle flush. Engine-side
responsibilities shrink to:

- `applyResult` (synchronous, in-memory truth) then fire-and-forget:
  `itemCards.put(itemId, card)` per touched item, `meta.put("course"|"skills", …)`
  only when a scalar actually changed. The per-review `activity_result` event is
  recorded by the **runtime** from `ApplyOutcome` (§4.4) via `recordLocal()` — the
  single log writer (R15).
- **Explicit** `engine.flush()` delegates to the stores' `flush()`; the journey
  surface calls it on feed unmount / session end (React wiring, not here).
- Crash window: worst case loses one batcher window (≤ ~250 ms + pending cap) of
  reviews. FSRS state regresses by at most a few reviews and the feed re-serves them;
  nothing corrupts (doc puts are atomic per record; reads are read-your-writes).

### 3.4 Schema versioning

`ENGINE_SCHEMA = 1` in constants.ts = `itemCardCodec.schemaVersion` (and the schema
stamp on the `meta` values). Migrations are **codec-level and lazy**
(storage-analytics §3.4): a record written at an older version passes through
`migrate(raw, fromVersion)` on read and is re-`put`. A record from a NEWER version
(downgrade — user rolled the app back) fails `parse`, is dropped by the storage layer,
and the engine-level ladder (§3.5) rebuilds it — never guess.

### 3.5 Engine-level recovery ladder (`persistence/recover.ts`)

Record-level corruption is already absorbed below us: the DocStore codec drops invalid
records and never throws (storage-analytics §3.10). This ladder handles the *semantic*
gaps that leaves, per-record, never wholesale:

1. **ItemCard missing/dropped** → for each item that surfaces with no card:
   a. If the `events` log contains `activity_result` rows for it →
      `scheduler.replay(entries)` rebuilds S/D/state (ts-fsrs `reschedule` under the
      hood); `form` = max form over the log's activityTypes via the ACTIVITY_TYPES
      registry (R4).
   b. Else if any of its skills has `level ≥ 3` (Practiced) → recreate as priorKnown
      seed (§4.3 step 3) — the learner demonstrably knew the area.
   c. Else → fresh card on next scored exposure (normal lazy path).
   (a) runs eagerly at load for logged items with no card; (b)/(c) stay lazy.
2. **`skills` meta lost** → recreate scalars with `accEwma = derived strength of the
   skill` (best available proxy), `announcedLevel = derived level` (suppresses a
   celebration storm), `placedAt` from `placement?.day` if present.
3. **`course` meta lost** → θ re-estimated as the 75th percentile `b` over skills
   whose derived level ≥ 3 (or −4 if none); `newPerDay` reset to default 12;
   `position` recomputed from derived levels; `placement` lost (week-one check simply
   won't run). Surface a soft "we tuned things up" toast via the RecoveryReport — never
   an error state.

Everything recovered is logged loudly (`console.error("[journey-engine] recovered…")`)
and counted in `RecoveryReport` for an analytics event (fired by the caller — the
engine itself does no analytics IO).

---

## 4. Public engine API

### 4.1 Construction and lifecycle

```ts
export interface Clock {
  nowMs(): number
  /** Local epoch day: floor((t − tzOffsetMs)/86_400_000) — matches the app's
   *  localDay() convention (quotas/streaks reset at local midnight). */
  epochDay(): number
  setTimeout(fn: () => void, ms: number): () => void   // returns cancel; memory clock is manual
}

export function createJourneyEngine(deps: {
  key: EngineKey
  graph: CourseGraph
  persistence: EnginePersistence
  clock: Clock
}): JourneyEngine

export interface JourneyEngine {
  /** Load persisted state (runs recovery + migrations + lazy tickDay). Must resolve
   *  before any other call. Idempotent. */
  load(): Promise<{ fresh: boolean; recovered: RecoveryReport }>

  /** Begin a feed session: bumps sessionCounter, seeds the session PRNG, resets
   *  SessionState. The UI calls this when the feed surface mounts.
   *  `welcomeBack` (R5) is emitted when the gap since `lastActiveDay` is ≥ 7 days:
   *  `retainedPct` = mean FSRS retrievability at now over all seen cards (reps > 0).
   *  The runtime maps the signal 1:1 to the `welcomeBack` FeedCard. */
  startSession(): {
    sessionId: string
    needsPlacement: boolean
    welcomeBack?: { gapDays: number; retainedPct: number }
  }

  // ---- placement (§4.3) ----
  startPlacement(mode: "probe" | "zero-beginner"): PlacementController
  /** Batch form: replay a completed probe transcript and finalize. Used by tests,
   *  the simulator, and any future server-side placement import. */
  placeUser(probeResults: ProbeResult[]): PlacementOutcome

  // ---- the feed (§5) ----
  nextFeedItems(n: number, constraints?: FeedConstraints): EngineCard[]

  // ---- results (§4.4) ----
  applyResult(result: ActivityResult): ApplyOutcome

  // ---- day boundary (§4.6). Lazy-invoked internally; exposed for host + sim. ----
  tickDay(): DayRollover

  // ---- reads (UI: path viz, roadmap drawer, debug) ----
  getSkillState(skillId: string): SkillState
  getCourseSnapshot(): CourseSnapshot     // θ, position, dueCount, newRemainingToday,
                                          // flow mode, strand shares, jumpAvailable
  requestJump(targetSkillId?: string): EngineCard[] | undefined   // user-invoked test-out (§5.9)

  flush(): Promise<void>
}
```

`nextFeedItems` and `applyResult` are **synchronous** — all state is in memory after
`load()`; persistence is staged, not awaited. This keeps the feed's card-ready latency
at zero and makes the pure core trivially simulatable.

Every mutating entry point (`startSession`, `nextFeedItems`, `applyResult`) first runs
`maybeTickDay()`: if `clock.epochDay() > course.lastTickDay`, run `tickDay()` for each
missed day (capped at 30 iterations; beyond that, jump straight to today — nothing in
the rollover needs per-day fidelity past the 7/14-day windows).

### 4.2 The wire types (D2, settled — consumed, not defined, here)

The engine **re-declares nothing** (R3): it takes `ActivitySpec`, `ActivityResult`,
`ActivityItemResult`, `ItemRef`, and the `itemRefKey()` helper by **type-only import
from `activityContract.ts`** (the vendored contract file — `activity-contract.md` is
normative for the shapes). The shapes the engine relies on, quoted from the contract:

```ts
// import type { ActivitySpec, ActivityResult, ActivityItemResult, ItemRef }
//   from "../../contentPacks/activityContract"
//
// ActivitySpec (contract §2): specId, activityType, itemRefs: ItemRef[],
//   params?: Record<string, unknown>, level?: string ("A0".."C2" band hint),
//   targetLang: string (PRESENT, BCP-47 corpus code), nativeLang?,
//   timeboxSec?, modelNeeds?
//
// ActivityResult (contract §2): specId, score (0..1),
//   perItem: ActivityItemResult[], detail?, durationMs, abandoned?
//
// detail — the typed envelope (R3), on BOTH ActivityResult and ActivityItemResult:
//   detail?: {
//     numbers?: Record<string, number>
//     flags?:   Record<string, boolean>     // e.g. sttUnavailable, aggregateBinned (R9)
//     selfReport?: "already-knew" | "never-learned"
//     stt?: { overallScore: number
//             perWord?: Array<{ word: string; probability: number
//                               startMs: number; endMs: number }> }
//   }
```

`EngineCard` (R5 — renamed from the engine's old `FeedCard`; the surface's
discriminated union keeps the `FeedCard` name, feed-ux §2.4) is the engine's envelope
around the spec:

```ts
export interface EngineCard {
  spec: ActivitySpec
  meta: {                       // for the runtime/feed surface, not the provider
    pool: PoolTag; strand: Strand; form: 0|1|2; estSec: number
    provider: "native" | string
    celebration: "normal" | "rare"       // rare-card roll happened in the mixer
    rareVariant?: "delight" | "etymology" | "timeCapsule" | "miniGame" | "storyChapter"
                                         // R5: seeded-PRNG draw over graph.rareCards (§5.10)
    checkpoint?: {                       // present on checkpoint-batch cards (§5.10)
      checkpointId: string; scope: "unit" | "arc"; passScore: number
      index: number; count: number      // position within the checkpoint batch
      summary: CheckpointSummary        // skills covered + session stats for the card face
    }
    coolDownCandidate: boolean           // last-slot fluency-win hint (§5.4)
  }
}

export interface CheckpointSummary {
  unitId?: string; arcId?: string
  skillIds: string[]            // skills the batch covers
  itemCount: number
  passScore: number             // echoed for the card face copy
}
```

**Division of labor with `journey/runtime.ts` (R5, exact):** the runtime maps
`EngineCard → FeedCard` **1:1** — `meta.checkpoint` ⇒ `kind:"checkpoint"`,
`provider ≠ "native"` ⇒ `kind:"packActivity"`, `meta.rareVariant` ⇒ the `rare` wrapper,
everything else ⇒ `kind:"exercise"`; the `startSession().welcomeBack` signal ⇒ the
`welcomeBack` card. The runtime **synthesizes ONLY `blockIntro`** (at `modelNeeds` run
boundaries, from the mixer's model-block partition §5.4 step 6). No other card kind,
ordering, or behavior is invented in the runtime.

### 4.3 Placement

Interactive controller (the UI drives it card-by-card; each probe is a normal
`EngineCard` rendered by the normal feed surface):

```ts
export interface PlacementController {
  next(): EngineCard | undefined        // undefined ⇒ done, call finalize()
  submit(result: ActivityResult): void  // updates θ, se, per-skill tallies
  finalize(): PlacementOutcome
  abort(): void                         // no state written; restartable
}
export interface ProbeResult { itemId: string; correct: boolean; latencyMs: number }
export interface PlacementOutcome {
  record: PlacementRecord
  unlockedSkills: string[]; frontier: string[]
  startUnitId: string
}
```

Algorithm — adaptivity §4.3 verbatim, made concrete (+ the R10 content ceiling):

- **Content ceiling (R10)**: `max_b` = max item `b` in the installed pack's graph.
  Placement never probes above the content it has.
- **Phase 1 — band ladder** (≤5 items): one probe at each
  `b ∈ [−3, −1.5, 0, +1.5, +3]` **with rungs above `max_b` dropped** (the ladder caps
  at the max installed `b` — R10), ascending; stop at first miss. θ starts −1.0,
  `se` 2.0, `K` 0.9.
- **Phase 2 — Elo refinement** (until `se ≤ 0.45` or 20 items or 4 min by
  `clock.nowMs`): target `b_next = θ + N(0, 0.3)` (session PRNG), pick nearest unasked
  probe with skill spreading (never two consecutive probes from the same skill);
  `θ += K·(y − σ(θ − b))`, `K = max(0.15, K·0.82)`,
  `se = 1/√(Σ Pᵢ(1−Pᵢ))` over asked.
  **Early termination (R10)**: when `θ̂ − max_b > PLACEMENT_ABOVE_CONTENT_MARGIN`
  (constants.ts, default 0.5), Phase 2 stops immediately with outcome
  `"above-content"` — no Phase 3. `finalize()` unlocks every content skill
  provisionally (frontier = end of shipped content) and the PlacementResult carries
  honest copy for the UI ("this course currently covers A1; you're past it" — house
  no-absolutes rules apply; never promise future content).
- **Phase 3 — frontier confirmation** (2–4 items): 2 probes at the proposed frontier;
  any miss → step frontier back one DAG layer, re-verify once.
- Probe forms: fast, guessable-OK, **no speaking, no hints** (adaptivity §4.2);
  probe results **do not** create ItemCards and do not enter the review log (they are
  tagged `pool: "probe"` in the issued map and skipped by apply.ts card path — θ/tallies
  only).
- `finalize()` (adaptivity §4.3 finalize, verbatim):
  1. Unlock every skill with `b_s ≤ θ − 0.5` whose prereqs are unlocked; frontier =
     first locked teachable layer.
  2. Skipped skills → `placedAt = today`, `accEwma = 0.75` (Practiced floor); level
     derives to 3 provisionally via the §2.3 table.
  3. **Lazy priorKnown seeding**: no eager card creation. `getOrCreateCard` for an item
     of a placement-unlocked skill creates the card as: first review EASY
     (`S₀ = w3 ≈ 8.3d`) then immediately one GOOD advance (spreads due dates), flags
     `PriorKnown|PlacementSeeded`. The TRICKLE pool (§5.2) surfaces the backlog gradually.
  4. Store `PlacementRecord`; initialize `firstWeek` tally for the week-one check
     (<60% over first 150 → offer soft rewind one layer; >92% with cruise dominant →
     surface Jump — evaluated in `tickDay`).
- **Zero-beginner path**: `startPlacement("zero-beginner")` → no cards; `finalize()`
  returns θ = −4, frontier = root skills. One screen, never a wall.
- `placeUser(probeResults)` replays the transcript through the same θ update (Phase-2
  math, K schedule from result count) and calls the same `finalize()` — bit-identical
  outcome given the same answer sequence (asserted in tests, §8.2).

### 4.4 `applyResult` — the single update pipeline

```
applyResult(r):
  maybeTickDay()
  issued = session.issued.get(r.specId)          # unknown specId → log + return noop
  if issued.pool == "probe": placement.submit path only
  if issued.pool == "checkpoint": also feed the checkpoint tally (§5.10 pass_score gate)
  if r.abandoned: no grades; strand tally still credits durationMs; return

  # R6 — grades join by KEY, never by position:
  issuedKeys = set(issued.itemIds)               # itemIds ARE itemRefKeys (§2.1; R2 helper)
  for per in r.perItem:
    key = itemRefKey(per.itemRef)                # the ONE contract helper (R2)
    if key ∉ issuedKeys:
        console.warn("[journey-engine] dropping un-issued itemRef", key); continue
                                                 # warn-and-drop: never grade what we
                                                 # didn't issue
    itemId = key
    card  = getOrCreateCard(itemId)              # priorKnown path if placement-seeded skill
    grade = toGrade(r, per, issued, card)        # §4.5 table
    if grade == "forget": card.fsrs = scheduler.forget(card, now); continue
    { card.fsrs, log } = scheduler.next(card, now, grade)   # same-day path if due today
    if grade passed at issued.form and issued.form > card.form and !issued.guessable:
        card.form = issued.form                  # form ratchet (§5.5)
    collect per-item evidence into ApplyOutcome.items   # runtime records ONE
                                                 # activity_result event (§2.2, R15)
    if grade == Again:
        rq = session.replayQueue.entry(itemId)
        if rq.failures == 0: push {notBefore: emitIndex+3, form: max(0, issued.form−1)}
        else: mark due tomorrow, drop from replay      # frustration guard: one replay max
    leech.check(card)                            # lapses ≥ 6 ∧ reps/lapses < 2 → LEECH

  # issued-but-absent items (issuedKeys − keys seen in r.perItem): NO evidence —
  # cards untouched, no grade, no log row (contract: absence ≠ fail). (R6)

  for skill in itemToSkills(touched):
    if issued.form >= 1: skill.accEwma = 0.7*skill.accEwma + 0.3*r.score
    markDirty(skill)                             # memoization invalidation (§2.3)

  theta += thetaK * (r.score − sigmoid(theta − b̄))   # b̄ = importance-weighted mean b
  thetaK = max(0.08, thetaK * decay(resultCount++))   # 0.5 → 0.08 schedule
  latency.update(issued.activityType, r, per-item correct latencies)
  flow.push({score: r.score, latencyZ}); flow.mode = classify(window)   # §5.6
  strands.credit(issued.strand, r.durationMs)
  if issued.pool == "new" and debuts.completed(itemId): newIntroducedToday++
  firstWeek tally; jump.consecutiveCruiseSessions bookkeeping
  course.lastActiveDay = today
  stage everything (itemCards.put / meta.put — the WriteBatcher owns debounce, §3.3)
  return ApplyOutcome
```

```ts
export interface ApplyOutcome {
  grades: { itemId: string; grade: 1|2|3|4 | "forget" }[]
  /** Per-item evidence for the ONE activity_result event the runtime records via
   *  recordLocal() (§2.2, R15 — single log writer). Shape mirrors
   *  ActivityResultEvent.items (storage-analytics §4.3). */
  items: { ref: string; outcome: "pass"|"partial"|"fail"; grade: 1|2|3|4
           latencyMs?: number; hintsUsed?: number
           predictedRecall?: number; b?: number; theta?: number }[]
  replaysQueued: string[]
  skillTransitions: { skillId: string; from: number; to: number }[]  // derived now,
                                     // announced later by tickDay hysteresis
  checkpoint?: { checkpointId: string; passed: boolean; score: number }  // §5.10, on the
                                     // batch's final card
  flowMode: "cruise" | "normal" | "struggle"
  celebrationHint: "fail" | "pass" | "streak" | "levelup"   // CelebrationLayer tier input
}
```

### 4.5 Grade derivation table (adaptivity.md §1.4 + §3.3 — verbatim, operationalized)

Evaluated top-down, first match wins. All `detail.*` paths below resolve against the
**typed envelope** of R3 (`detail.selfReport`, `detail.stt.overallScore`,
`detail.flags.*`, `detail.numbers.*` — contract §2); the envelope exists on both the
result and each item, and item-level `per.detail` takes precedence over result-level
`r.detail` where both carry the same field. `z = latencyMs /
expectedLatency(activityType, textLen)` where `expectedLatency =
exp(latencyBaselines[type].logMean) × lengthScale(textLen)`; baselines are an EWMA
(α=0.2) of log-latency over **correct** responses only, updated after grading.
`firstTry = card.fsrs.reps === 0 && !issued.isReplay`. `retried = issued.isReplay`.
`detail.flags.sttUnavailable === true` ⇒ rows 4–5 are skipped (the item grades through
the non-STT rows; STT absence is never a fail).

| # | Condition | Grade |
|---|---|---|
| 1 | `detail.selfReport === "never-learned"` | **forget** (reset to New) |
| 2 | `detail.selfReport === "already-knew"` (new card only) | **Easy** + `PriorKnown` flag |
| 3 | `per.outcome === "fail"` | **Again** |
| 4 | STT activity: `detail.stt.overallScore < 0.45` | **Again** |
| 5 | STT activity: `overallScore ∈ [0.45, 0.7)` | **Hard** |
| 6 | `per.outcome === "partial"` | **Hard** (a pass — "Hard is never a fail") |
| 7 | `per.hintsUsed > 0` ∨ `retried` ∨ `z > 2.0` | **Hard** |
| 8 | multi-item game round without per-item hits: round `score < 0.5` | **Hard** (games are noisy evidence — never Again without per-item misses) |
| 9 | `z < 0.6` ∧ `firstTry` ∧ `hintsUsed = 0` ∧ `!issued.guessable` ∧ (non-STT ∨ `overallScore > 0.9`) | **Easy** (intentionally stingy) |
| 10 | otherwise | **Good** |

Caps applied after the table:
- `issued.guessable === true` (MC/recognition) ⇒ grade = min(grade, **Good**).
- Multi-item game rounds without genuine per-item evidence report **score-only**
  (contract rule, R9) ⇒ grade = min(grade, **Good**), applied uniformly to every item
  of the round (adaptivity §3.3). With genuine per-item entries in `perItem`, each item
  grades individually through rows 3–10.
- `per.detail.flags.aggregateBinned === true` (provider-synthesized per-item outcome,
  R9) ⇒ grade clamped to **[Hard, Good]**: Again → Hard, Easy → Good — synthesized
  evidence can never lapse a card or fast-track it.

Seed latency constants (`constants.ts`; per adaptivity §1.4): tap/choice 3500ms,
match 4000ms, tap-order 8000ms, type-short 9000ms, type-translate 12000ms, speak 8000ms,
listen-type 11000ms, cued-flip 5000ms; `lengthScale(len) = clamp(len/30, 0.6, 2.5)`.

### 4.6 `tickDay()`

Idempotent per local day; runs once for each day boundary crossed since `lastTickDay`:

1. Close yesterday's strand bucket; drop tally entries older than 14 days.
2. Push yesterday's end-of-day `|DUE|` into `backlogRing` (keep 7) — only for days with
   ≥1 scored result (inactive days don't distort the median).
3. Reset `newIntroducedToday = 0`; clear `firstWeek` once 150 results are reached
   (evaluating the week-one check exactly once, §4.3).
4. **Weekly `newPerDay` adaptation** (adaptivity §5.5), only if
   `day − lastThrottleAdjustDay ≥ 7`:
   `median(backlogRing) > 1.5 × dailyCapacityEwma` ⇒ `newPerDay ×= 0.8`;
   `median ≈ 0 (< 0.1×capacity)` ∧ cruise-share of last 7 active days' sessions > 50%
   ⇒ `newPerDay ×= 1.2`; clamp [4, 30]; round.
5. **Level-transition announcements** (hysteresis): for each skill whose derived level
   ≠ `announcedLevel`, emit one transition into the `DayRollover` return and set
   `announcedLevel`. UI never flaps intra-day.
6. Advance `position` only when the current unit's skills all derive ≥ 3 **AND** the
   unit's checkpoint has been passed at its `pass_score` (§5.10 — R5; advancement can
   also happen in-session at the moment the checkpoint batch passes). Arc boundaries
   additionally require the arc gate.
7. `lastTickDay = day`; stage + flush. (Review-history pruning is owned by the
   AppendLog ring caps — storage-analytics §3.5/§3.8 — not by tickDay.)

```ts
export interface DayRollover {
  day: number
  announcements: { skillId: string; from: number; to: number }[]
  newPerDay: number
  debtBrakeActive: boolean
  placementCheck?: "offer-rewind" | "offer-jump"
}
```

---

## 5. The mixer — `nextFeedItems(n, constraints)`

### 5.1 Inputs and constraints

```ts
export interface FeedConstraints {
  availableProviders: string[]           // installed packs; "native" always present
  modelsAvailable?: ("stt"|"llm"|"tts")[] // Budget-Arbiter/host residency hint (D8)
  excludeActivityTypes?: string[]        // e.g. quiet mode ⇒ no "speak"
  timeboxSec?: number                    // cap Σ estSec of the returned batch
  checkpointCadence?: number             // R5: cards between checkpoint/summary offers.
                                         // Derived from goalIntensity by the runtime
                                         // (feed-ux §3.7: casual 8 / daily 10 /
                                         // intensive 12); absent ⇒ 10.
}
```

Availability filter: an `activityTemplate` is usable iff `provider ∈ availableProviders`
∧ `modelNeeds ⊆ (modelsAvailable ?? all)` ∧ `activityType ∉ excludeActivityTypes`.
The feed **degrades gracefully**: if a pool's only templates are unavailable, the pool
is skipped and its quota redistributes pro-rata (adaptivity §5.1).

### 5.2 Pool construction (pools.ts — adaptivity §5.2 verbatim)

```
DUE      = { cards: due ≤ today } sorted desc by
             priority = (1 − R(now)) × item.importance × (1 + 0.1·lapses)
           suspended cards excluded; leech cards routed through leech.ts (§5.7)
REPLAY   = session.replayQueue where emitIndex ≥ notBeforeEmitIndex   # hard priority
NEW      = frontier skills' items in introOrder, minus items with cards,
           capped by (newPerDay − newIntroducedToday), gated by flow mode + debt brake
REPAIR   = items of skills with accEwma < 0.6 ∨ demotedAt within 14 days,
           sorted by (1 − R)
TRICKLE  = placement-seeded skills' items with no card yet, introOrder order
FUN      = templates with funWeight > 0 over items with R > 0.9 (strong-known only —
           fluency development needs known material, pedagogy §1); includes game
           rounds, story/reader chapters (95% coverage gate is checked by the
           provider param builder), etymology gems
```

### 5.3 Slot quotas and adjustments

Base quotas (constants.ts): `{ review: 0.35, new: 0.35, repair: 0.10, fun: 0.10, flex: 0.10 }`
(`flex` = drawn from whichever nonempty pool has the largest normalized backlog).

Adjustment order matters and is fixed:

1. **Flow mode** (§5.6):
   - cruise: `new += repair; repair = 0`; mark Jump checkpoint eligible (§5.9).
   - struggle: `new = max(0.10, new − 0.20); review += 0.10; repair += 0.10`;
     prepend one scaffold card (re-teach: example + recognition form of the most
     recently failed item's skill), followed by a near-certain win (R ∈ [0.9, 1)).
2. **Debt brake** (pedagogy §12.2 + D4): if `|DUE| > 1.5 × dailyCapacityEwma`
   ⇒ `new = 0` entirely (intake paused; TRICKLE also pauses). Soft backlog pressure
   below the brake: if `|DUE| > 2 × sessionThroughput` (throughput = capacity/                       
   sessionsPerDayEwma, min 20) ⇒ `review += 0.15; flex −= 0.15` (floor 0).
3. **Strand balance** (strands.ts): stage = current arc's CEFR → target ratios from
   pedagogy §12.1 (verbatim table below). Compute 2-week shares from `strandTally`;
   the most-deficient strand biases `chooseActivityType` (tie-break weight ×1.5).
   Hard rule: if language-focused share over `last40` > 65% ⇒ force ≥2 of the next
   batch's slots to input/fluency cards (reader segment, listen-only).

   | Stage | input | output | language | fluency |
   |---|---|---|---|---|
   | 0→A1 | .30 | .10 | .40 | .20 |
   | A2   | .30 | .20 | .30 | .20 |
   | B1   | .30 | .25 | .20 | .25 |
   | B2   | .30 | .25 | .15 | .30 |
   | C1–C2| .35 | .25 | .10 | .30 |

### 5.4 The full algorithm (mixer.ts)

```
nextFeedItems(n = 10, constraints):
  maybeTickDay()
  pools  = buildPools()                         # §5.2
  quota  = adjustQuotas(baseQuota, flow, debt, backlog)   # §5.3, fixed order
  slots  = []

  # -- 0. session opener: warm win (once per session) --------------------------
  if !session.openerServed:
      opener = argmax over DUE ∪ strong cards of R ∈ [0.80, 0.95], non-model-needing
      if found: slots.push(issue(opener, form=card.form, pool="due")); openerServed = true

  # -- 1. struggle scaffolding (prepend, outside quota) -------------------------
  if flow.mode == "struggle" and scaffoldPending:
      slots.push(scaffoldCard); slots.push(nearCertainWin)

  # -- 1.5 lesson layer (R5, §5.10) ----------------------------------------------
  # if a unit lesson is active (course.lesson != null), the next recipe slots are
  # filled FIRST: each recipe slot maps (itemSelector → pool, activityTypes → type
  # choice); `optional` slots drop under modelNeeds pressure. When the unit's lesson
  # plan is exhausted, lessons.ts emits the unit-boss CHECKPOINT BATCH (§5.10) and
  # the mixer returns it as-is. Free-mix (below) fills whatever the recipe left open.

  # -- 2. fill remaining slots --------------------------------------------------
  pushBudget = 1                                 # ≤1 "edge" card per batch (pedagogy §12.2)
  while slots.length < n:
      # replays preempt when their gap is satisfied
      if REPLAY has entry with notBeforeEmitIndex ≤ emitIndex + slots.length:
          item = popReplay(); form = entry.form            # easier-or-equal form
      else:
          pool = weightedPick(rng, quota, nonEmptyPools)   # renormalized over available
          item = pop(pool)                                  # pool-specific order (§5.2)
          if pool == "new":
              stage = debuts.get(item) ?? start
              # debut ladder: intro (unscored) → recognition, same session
              form  = stage == intro ? INTRO_PRESENTATION : 0
          else:
              form  = chooseForm(item)                     # §5.5 ladder
      type = chooseActivityType(item, form, constraints, strandBias, rng)
      if type == none: continue                            # no template available; item deferred
      slots.push(issue(item, type, form, pool))
      if pool == "new" and stage == intro: schedule same-batch recognition slot (gap ≥3)

  # -- 3. rare-card roll (variable ratio, D7 economy) ---------------------------
  # one roll per batch: delight 1:8, game round 1:25, etymology gem 1:50 —
  # replaces a flex/fun slot only; never replaces replay/scaffold/opener/checkpoint.
  # R5: the winning rareVariant is a SEEDED-PRNG draw over graph.rareCards
  # (rarity_weight as draw weights; eligibility: min_unit reached, provider
  # installed, coverage_gate met for story). Stamped on EngineCard.meta.rareVariant.
  rollRare(rng, slots)

  # -- 3.5 cadence checkpoint (R5) ------------------------------------------------
  # every constraints.checkpointCadence cards (session-cumulative), append ONE
  # summary checkpoint card (meta.checkpoint, non-graded stop/continue face) —
  # the feed's natural stopping point. Distinct from unit-boss batches (§5.10).

  # -- 4. Jump checkpoint (§5.9) -------------------------------------------------
  if jumpEligible and !session.jumpOfferedThisSession:
      slots.append(jumpCheckpointCard); session.jumpOfferedThisSession = true

  # -- 5. constraint repair (bounded local swaps within the batch) ---------------
  repeat ≤ 3 passes or until clean:
    - no two consecutive slots share activityType            → swap with nearest legal slot
    - same itemId appears with gap < 3 (incl. lastEmit map
      from previous batches this session)                    → push later / defer to next batch
    - ≤1 FUN full-game card per 10 slots                     → excess demoted back to pool
    - NEW debut pairs keep intro-before-recognition order
    - a card with modelNeeds never occupies slot 0
  if a constraint is unsatisfiable (tiny course, few types): drop the weakest
  constraint in this order: sameType-adjacency → itemGap(3→2) — NEVER drop the
  replay-gap or debut-order rules. Log the relaxation (starvation telemetry, §7).

  # -- 6. model-residency batching (D8) ------------------------------------------
  # Group by modelKey = canonical(modelNeeds): contiguous blocks, ≤1 block per
  # distinct heavy model per batch (stt / llm), stable within-block order.
  slots = stablePartition(slots, keyOrder = [none, tts, stt, llm])
  #   - "none"/"tts" cards are free interleavers and stay put where possible
  #   - stt block and llm block are never interleaved model-swap by model-swap;
  #     each appears as ONE contiguous run, placed late in the batch (models warm
  #     up once, run their block, unload)
  # re-verify itemGap after partition; resolve by swapping within blocks only.

  # -- 7. timebox + cool-down ----------------------------------------------------
  if constraints.timeboxSec: trim tail slots until Σ estSec fits
  mark last slot coolDownCandidate = true if it is (or can be swapped for) a
  fluency-strand card over known material (session "always ends green", pedagogy §12.2)

  session.emitIndex += slots.length; record lastEmit + last40
  return slots.map(toEngineCard)
```

`issue()` mints the `ActivitySpec` (specId = `${sessionId}:${emitIndex+i}`), builds
`params` via the template's param builder (distractor difficulty `b_distractor ≈ θ` in
cruise, θ−0.5 otherwise), stores the `IssuedCard` in `session.issued`, and stamps
`modelNeeds` from the template.

**New-item debut pattern** (adaptivity §5.3): intro card (show + hear + echo,
**unscored** — no ItemCard yet) → recognition card same session (first scored exposure
⇒ card created) → cued-recall lands next day as its first real FSRS review via DUE.
`newIntroducedToday` counts completed debuts. The 4:1 steady-state review:new ratio
(pedagogy §12.2) is not a separate control — it emerges from `newPerDay` (12) vs the
due stream; the simulation gate (§7.4 P3) verifies it.

### 5.5 Form-ladder state machine (forms.ts)

Per-item `card.form` = highest form **passed** (0 recognition, 1 cued recall,
2 production). Proposal rule:

```
chooseForm(card):
  ceiling = flow.mode == "struggle" ? max(0, card.form)        # de-escalate: repeat proven
          : min(card.form + 1, 2)                              # ratchet: next rung
  if ceiling == 2 and not productionReady(card): ceiling = 1
  # productionReady: R(now) ≥ 0.7 AND card has ≥1 prior pass at form ≥ 1
  if flow.mode == "cruise": prefer ceiling (production bias)
  else: pick ceiling with p=0.7, else card.form (consolidation)
  return form
```

Transitions of stored `card.form` (only in apply.ts): pass at issued form `f` with
`!guessable` ∧ `f > card.form` ⇒ `card.form = f`. Fails never demote `card.form`
(the ladder ratchets; struggle only affects *proposals*). Replays run at
`max(0, failedForm − 1)`. Level-up credit counts only form ≥ 1 (guess-rate control):
enforced structurally — `accEwma` updates only when `issued.form ≥ 1`, and Mastered
requires every seen item `form ≥ 1` (§2.3).

### 5.6 Flow controller (flow.ts — adaptivity §6.1)

Window = last 8 scored cards: `perf = mean(score) − 0.15 × mean(latencyZ > 1)`.

- **cruise**: `perf ≥ 0.9` ∧ zero fails in window.
- **struggle**: ≥3 fails in window ∨ `perf < 0.55`.
- **normal**: otherwise. Fewer than 4 scored cards ⇒ always normal (cold window).

Mode is recomputed per `applyResult`; consumed by quotas (§5.3), forms (§5.5),
distractor difficulty (§5.4), and Jump eligibility (§5.9). Session end with ≥8 scored
cards and cruise as the dominant mode increments
`course.jump.consecutiveCruiseSessions`, else resets it.

### 5.7 Leeches (leech.ts — adaptivity §6.4)

Flag: `lapses ≥ 6 ∧ reps/lapses < 2`. Behavior:
(a) flagged card's next servings must use a **different activityType** than its last
two, and the mixer pairs it once with a mnemonic/etymology card (wordpan template) if
available; (b) 2 further failures post-flag ⇒ `Suspended` flag; if
`graph.items[id].substituteIds` is nonempty, the first substitute without a card enters
NEW (same skill, fresh start). Suspended cards never enter any pool; a monthly
unsuspend retry is **out of v1** (parked). Leech servings are capped at 1 per batch —
leeches must not eat the feed.

### 5.8 Legendary challenge (consumed by the mixer, defined by D4 table)

`requestLegendary(skillId)` (UI-invoked from path viz; P1, ship behind devMode):
12–16 items of the skill, production-form bias, no hints, ≤2 mistakes, one attempt per
local day. Emitted as a dedicated batch of EngineCards tagged `pool: "jump"`. Pass ⇒
`legendaryAt = today`. Not counted in strand tallies (prestige, not pedagogy).

### 5.9 Jump checkpoint — trigger conditions and mechanics (adaptivity §6.3)

Eligible when **any** of:
1. `course.jump.consecutiveCruiseSessions ≥ 2` (sustained cruise), or
2. week-one placement check fired `"offer-jump"` (>92% accuracy over first 150 results
   with cruise-dominant sessions, §4.3.4), or
3. user-invoked via `requestJump(targetSkillId?)` (path viz "Jump here").

Throttles: at most one offer per session (`jumpOfferedThisSession`); at most one offer
per 3 local days (`jump.lastOfferedDay`); never while debt brake is active (clearing
debt beats skipping ahead).

Mechanics:

```
jumpCheckpoint(targetSkill = frontier + 1 unit by default):
  skipped = skills on DAG paths frontier → targetSkill
  test    = 3 probes per skipped DAG layer, adaptive around θ, production-form bias,
            no hints; mistakesAllowed = 3 if |skipped layers| ≤ 2 ("near") else 2 ("far")
  pass ⇒ for s in skipped: accEwma = 0.75, placedAt = today   # provisional Practiced
         theta += 0.3
         items trickle-seed as priorKnown on encounter (§4.3.3) + TRICKLE pool
  fail ⇒ zero penalty; failed layers' first items are boosted to the head of NEW
         ("you're close" framing); consecutiveCruiseSessions resets
```

Jump probe results, like placement probes, update θ but never create cards.

### 5.10 Lessons + checkpoints (lessons.ts — the R5 layer)

The engine owns session structure end-to-end; the runtime never invents it (R5).

**Unit lessons.** While `position` sits in a unit that has `graph.unitLessons[unitId]`
rows, `course.lesson` tracks the cursor `(lessonIndex, slotIndex)`. The mixer fills
recipe slots in order (§5.4 step 1.5): `itemSelector` maps to the §5.2 pools
(`due`→DUE, `new`→NEW, `unit`→the unit's item set, `known`→FUN-style strong-known,
`grammar-node`/`l1-phoneme`→their item kinds, `rare`→the rare roll, `none`→display-only
slot), and `activityTypes` restricts `chooseActivityType` to the recipe's choices
(availability-filtered per §5.1; `optional: 1` slots drop under modelNeeds pressure).
Flow-mode, debt-brake, and replay rules still apply inside a lesson — a recipe shapes
the batch, it never overrides safety adjustments. When the plan is exhausted the boss
follows; units without lesson rows run free-mix as before.

**Unit bosses / arc gates (checkpoint batches).** Loaded from `graph.checkpoints`
(course-pack `checkpoints` table; the boss recipe + `params_json` gauntlet make-up).
Emitted as ONE dedicated batch of EngineCards tagged `pool: "checkpoint"`, each
carrying `meta.checkpoint` (§4.2) with a `summary` for the card face. lessons.ts
tallies the batch's scores; on the final card:

```
score = Σ per-card score / batch size
pass  = score ≥ checkpoint.passScore              # checkpoints.pass_score (course-pack §2)
pass ⇒ checkpointsPassed[id] = today; position advances past the unit (arc gates
       likewise gate arc advancement)             # the ONLY way position crosses a
                                                  # unit with a checkpoint (§4.6.6)
fail ⇒ position holds; the checkpoint's weak items (score < passScore per card) and
       their skills route to REPAIR (remedial — §5.2); re-attempt allowed next
       session; zero penalty framing ("tasks, not tests" — pedagogy §9)
```

Checkpoint cards are graded normally through §4.4/§4.5 (they are real evidence);
only position advancement hangs on `passScore`.

**Cadence checkpoints.** Non-graded summary/stop-point cards every
`constraints.checkpointCadence` cards (§5.4 step 3.5) — same `meta.checkpoint`
envelope with `passScore: 0`, mapped by the runtime to the feed's stop/continue face.

**welcomeBack + rare variants.** Both engine-owned (R5): the welcomeBack signal is
computed in `startSession()` (§4.1); `rareVariant` selection is the seeded-PRNG draw
over `graph.rareCards` (§5.4 step 3). The runtime renders; it never rolls.

---

## 6. Engine ↔ app integration contract (informative)

- The `journey/store` layer (outside this spec) owns constructing `CourseGraph` from
  the installed `journey_<target>` pack per the **normative PackReader → CourseGraph
  loader section in `course-pack.md`** (R7 — exact SQL, keyset pagination, row-count
  assertion, <500 ms cold-start budget) and resolving `EngineKey`: `stackId` = the
  active stack, `courseId` = the id of the installed course pack matched to the stack's
  target language (`stack.languages[1..]`, D6). The engine treats both as opaque.
- `journey/runtime.ts` maps `EngineCard → FeedCard` **1:1** and synthesizes **only**
  `blockIntro` cards at modelNeeds run boundaries (R5, §4.2). It also records the
  per-result `activity_result` analytics event from `ApplyOutcome` (§4.4, R15). It
  invents no other cards, ordering, or scheduling behavior.
- `hostApi.journey.reportResult(result)` and the `corpan:activity-result` CustomEvent
  (D2) both funnel into `engine.applyResult` through one listener owned by the feed
  surface — the engine itself never touches the window.
- Small meta-state the UI needs synchronously at first paint (streak v2, journey
  settings, "has a journey started" flag) lives in the separate
  `store/journey.ts` zustand persist store (`corpan-journey-v1`, localStorage,
  partialize + version/migrate — D5). The engine does not read or write it.
- Quota (D9): the runtime debits the `journey` quota at its ONE debit site
  (R12 — completed debut cards + pack-anchor launches only; due-review/replay/repair
  are never metered); the engine is quota-oblivious (it just stops being asked for
  cards).

---

## 7. Simulation harness (sim/) — the pre-ship gate

Runs on the Spark (`node --experimental-strip-types sim/cli.ts --config sweeps/default.json`),
drives the **real engine** through the public API with `createMemoryPersistence()` and a
`SimClock` (manual day/ms advancement). No app build required.

### 7.1 Synthetic learner model (learner.ts)

Ground-truth memory is deliberately NOT FSRS (no self-fulfilling validation):

- Per learner: ability `a ~ N(μ_persona, 0.5)`; per item: true difficulty
  `b* = b + N(0, 0.4)` (models author-assigned `b` being noisy — adaptivity §8.1).
- Per (learner, item): true strength `S*` starts at `S0*(a − b*)`; on each exposure,
  `S* ← S* × g(a, b*, spacing)` on success (multiplier 1.6–2.6, larger when recalled
  near forgetting), `S* ← max(S*·0.3, 0.5d)` on failure. Recall:
  `P(recall at Δt) = σ(a − b*) × (1 + Δt/S*)^(−0.35)`.
- Answer generation: recognition forms add a guess floor of 0.25; production multiplies
  P by 0.85. Latency: lognormal around the persona's per-type median × (2 − P) —
  uncertain answers are slow.
- Self-reports, hints, abandonment: persona-parameterized probabilities.

Personas (fixed ids; every gate run covers all):

| id | a (μ) | attendance | session | notes |
|---|---|---|---|---|
| `daily-median` | 0.0 | 7/7, 15 min | 1/day | the reference curve |
| `daily-fast` | +1.0 | 7/7, 15 min | 1/day | cruise/Jump exerciser |
| `slow-struggler` | −1.0 | 6/7, 12 min | 1/day | struggle/scaffold/demotion exerciser |
| `weekend-binger` | 0.0 | 2/7, 60 min | 2/wk | backlog/debt-brake exerciser |
| `lapser` | 0.0 | p=0.5/day, gaps up to 21d | — | due-avalanche + fuzz exerciser |
| `placed-intermediate` | +0.5 | 7/7, 15 min | 1/day | knows first ~800 items; placement + TRICKLE + provisional-demotion exerciser |
| `kid-guesser` | −0.5 | 7/7, 8 min | 1/day | high guess usage; MC-cap/form-gate exerciser |

### 7.2 What a run produces (metrics.ts)

Per learner-day: due count, cards served by pool/strand/form, scored results, grades,
flow modes, newIntroducedToday, θ, debt-brake state, constraint relaxations, flush
sizes. Aggregated to per-persona curves over 180 simulated days × ≥500 seeded learners
per persona (deterministic: run seed → learner seeds → identical transcripts).

### 7.3 Fixture course

`sim/fixtures/journey-fixture.json`: a generated CourseGraph with 2 arcs, 24 units,
~120 skills, ~4,000 items, realistic `b` spread, 15 activity templates covering all
forms/strands/modelNeeds, probe bank, substitutes, lesson recipes + checkpoints +
rare cards (§2.6). Also a `journey_en` snapshot import once the real pack exists (the
gate then runs both). **P8 is NOT satisfiable on the fixture alone (R10): the
placement-quality gate must run against the real `journey_en` pack graph, with
personas scoped to the shipped arcs, before publish.**

### 7.4 Pass criteria (the ship gate — all must hold)

| # | Check | Criterion |
|---|---|---|
| P1 | **Review-load curve** | `daily-median`: median due-at-session-start ≤ 1.2× dailyCapacity from day 14 on; p95 ≤ 2.0×. `lapser`: after a 21-day gap, due queue drains below 1.2× within 10 active days without newPerDay hitting the 4 floor permanently. |
| P2 | **Debt brake** | Engages whenever backlog > 1.5× capacity; new intake is 0 while engaged; disengages within 3 active days for `weekend-binger`; never oscillates faster than weekly (`newPerDay` adjustments ≤1 per 7 days). |
| P3 | **Review:new ratio** | `daily-median` steady state (days 30–180): scored review touches : completed new introductions ∈ [3:1, 6:1] (target 4:1, pedagogy §12.2). |
| P4 | **Time-to-arc** | `daily-median` (15 min/day) completes Arc 1 (A1) in 45–100 active days; `daily-fast` ≥25% faster (via Jump + throttle-up); `slow-struggler` finishes without ever seeing >40% struggle-mode share after week 2. Sanity-anchored to FSI/§curriculum-spine hour budgets, not vibes. |
| P5 | **Starvation** | Over any 500-card window per learner: every nonempty pool served ≥1×; FUN share ≥5% when templates available; TRICKLE drains `placed-intermediate`'s backlog to <10% unvisited within 60 active days; no due item goes unserved >14 active days. |
| P6 | **Livelock / determinism** | `nextFeedItems` always returns ≥1 card or a typed shortfall reason; no replay loops (an item is replayed ≤1× per session); identical seeds ⇒ byte-identical transcripts across 2 runs. |
| P7 | **Strand convergence** | Per-persona 2-week strand shares within ±10 points of the stage targets (§5.3 table) from week 3 on; the last40 language-focused >65% rule fires <5% of batches at steady state. |
| P8 | **Placement quality** | `placed-intermediate`: |θ̂ − a| ≤ 0.6 for ≥90% of learners; ≤25 items; wrong-placement self-heal: week-one rewind or demotion path corrects starting frontier within 14 days for the (injected) 10% mis-calibrated cohort. **Runs against the real `journey_en` pack graph, not only the fixture, with personas scoped to shipped arcs (R10).** Above-ceiling personas (a > max content b) terminate `"above-content"` in ≤ Phase-2 budget, never grind 25 items. |
| P9 | **Grade sanity** | Easy share of all grades ≤ 10%; Again share ∈ [5%, 25%] at steady state for `daily-median` (matches the R≈0.9 target); MC-capped items never receive Easy. |
| P10 | **Leech containment** | Leech servings ≤3% of feed for `slow-struggler`; suspended items never served. |
| P11 | **Constraint integrity** | Zero violations of: replay minGap, debut order, model-block contiguity. Relaxation log rate (sameType adjacency) <2% of batches on the fixture course. |

`report.ts` emits `sim/out/<runId>/report.md` + `metrics.json` with per-criterion
pass/fail; CI-style exit code. **Any engine-behavior PR (constants.ts, mixer, grading,
scheduler config, ts-fsrs bump) must attach a passing run.** Tuning sweeps
(quota/threshold grids) reuse the same runner with a config matrix.

---

## 8. Unit-test plan

Runner: the existing `npm test` (`node --experimental-strip-types --test`), colocated
`*.test.ts` under `engine/`. Everything deterministic: `SimClock` + fixed seeds; **no
`Date.now()` anywhere in core** (rule §0.2).

### 8.1 Boundary/purity tests (meta)

- `boundary.test.ts`: statically scans `engine/**` sources (fs read + regex) asserting:
  no `window|document|localStorage|indexedDB|navigator|@tauri|react` references
  ANYWHERE in `engine/**` (the impure edge lives outside, in `src/journey/persistence.ts`
  — R15); no `Date.now|new Date(` outside `clock.ts`; no `Math.random`; no `enum `
  declarations (strip-types compatibility); only `scheduler.ts` imports `ts-fsrs`; only
  type-only imports from `contentPacks/` and `@/lib/storage`.

### 8.2 Per-module cases (representative, not exhaustive)

| Module | Key cases |
|---|---|
| `scheduler` | T-sched-1: `JOURNEY_FSRS_PARAMS.w` deep-equals the 21 weights in §1.3 (pins ts-fsrs upgrade drift). Same-day replay path: fail then same-day Good ⇒ S′ ≥ S. Lapse never increases S. Elapsed-day clamps: negative ⇒ 0; >365 ⇒ 365. Fuzz determinism: same card + grade + day ⇒ identical due across runs. `forget` resets to New. `replay()` reconstructs S/D within 1e-6 of sequential `next()`. |
| `grading` | Exhaustive table walk: one test per row 1–10 + all three caps + STT thresholds (0.44/0.45/0.699/0.7/0.9/0.91 boundaries) + game-round uniform/per-item paths + z boundaries (0.599/0.6/2.0/2.01) with seeded latency baselines. `flags.aggregateBinned` clamp (R9): Again→Hard, Easy→Good, Hard/Good pass through; `flags.sttUnavailable` skips rows 4–5. Property: Hard is only ever emitted on a pass. |
| `latency` | EWMA updates only on correct; seeds used at n=0; lengthScale clamps. |
| `mastery` | Memoization: read → no recompute on second read; applyResult on one item recomputes only its skills; day change invalidates all. Level table edge values (coverage 0.799/0.8 etc). Demotion at strength 0.49. Multi-skill item counted in both skills. |
| `theta` | K decay schedule 0.5→0.08; convergence on a scripted 1PL responder within 20 results; multi-item b̄ weighting. |
| `placement` | Scripted responders: all-correct ladder ⇒ Phase 1 reaches the highest rung ≤ max_b in ≤5 items; ladder rungs above max_b are never probed (R10); zero-beginner path writes θ=−4 + root frontier; Phase 3 miss steps frontier back exactly one layer once; SE math against hand-computed values; ≤25 items always; above-content: θ̂ − max_b > margin ⇒ Phase 2 terminates early, outcome `"above-content"`, frontier = end of content (R10); `placeUser(transcript)` ≡ interactive controller given same answers (bit-identical PlacementOutcome). priorKnown lazy seeding: no cards created at finalize; first encounter creates Easy+Good-advanced card with both flags. |
| `flow` | Mode transitions at exact thresholds; cold window (<4) stays normal; cruise-session counting across startSession. |
| `forms` | Ratchet: pass at form 2 sets card.form=2; guessable pass never ratchets; struggle proposals never exceed card.form; productionReady gate (R 0.69/0.7). |
| `pools` | DUE priority ordering formula; suspended exclusion; NEW respects introOrder + newPerDay remaining; FUN only R>0.9. |
| `mixer` | Property tests (1,000 seeded batches on the fixture graph): all §5.4 step-5 invariants; replay preemption at exactly gap 3; opener served once with R∈[0.8,0.95]; debt brake zeroes NEW; model-block contiguity + no stt/llm interleave + slot-0 rule; timebox trim; unsatisfiable-constraint relaxation order; quota redistribution when a provider is missing (uninstall lingo-hero ⇒ feed still fills). |
| `leech` | Flag at exactly lapses=6, reps/lapses<2; presentation-swap; suspend after 2 post-flag failures; substitute enters NEW; ≤1 leech per batch. |
| `daily` | Multi-day catchup (7 missed days ⇒ 7 ticks, capped at 30); weekly throttle cadence; announcement hysteresis (level flaps intra-day ⇒ one announcement); backlogRing only counts active days; position never advances past an unpassed checkpoint (§4.6.6). DST boundaries: epochDay stable across spring-forward/fall-back (fixed tz offsets injected). |
| `apply` | Full pipeline integration on memory fakes: grades→card→evidence→skill→θ→flow→replay in one call; abandoned results credit strand only; probe results create no cards; unknown specId noop. **R6 mandatory join-by-key test: `perItem` SHUFFLED and a strict SUBSET of the issued items ⇒ every present item grades against its own card (matched via `itemRefKey`), issued-but-absent items are untouched (no grade, no log row), and an un-issued itemRef is warn-and-dropped without grading.** |
| `lessons` | Recipe slots fill in order; optional slots drop under modelNeeds pressure; boss batch emitted once per unit after plan exhaustion; pass at exactly passScore advances position, 0.01 below holds it; fail routes weak items to REPAIR; cadence checkpoint appears every `checkpointCadence` cards; welcomeBack fires at gap 7, not 6, with retainedPct = hand-computed mean R; rareVariant draw is seed-deterministic over graph.rareCards. |
| `persistence` (against the in-memory DocStore/AppendLog/KVStore fakes) | `itemCardCodec.parse` rejects out-of-range fields (s ≤ 0, d ∉ [1,10], far-future due) and accepts round-trips; `migrate` path lazily upgrades an old-version record; puts coalesce through a fake batcher; events read-back yields replay-ordered entries. |
| `persistence/recover` | Missing cards ⇒ log-replay rebuild from `events`; skills-lost accEwma proxy; course-lost θ re-estimate; downgrade (schema 2 data, engine 1) ⇒ record dropped then rebuilt, not crash; every path returns a populated RecoveryReport and never throws. |
| `engine` (facade) | load idempotence; lazy tickDay on first call of the day; `engine.flush()` delegates to store flushes (batching policy itself is storage-analytics's to test, §3.3); startSession seed stability: same (key, sessionCounter) ⇒ same feed; welcomeBack emitted at gap ≥ 7 days only. |

### 8.3 Golden transcripts

`engine/__golden__/`: three end-to-end fixtures (fresh beginner day 1–3; placed
intermediate; struggle session) — scripted results through the public API, snapshotting
`(feed specIds, grades, due days, θ)` per step. Catches any unintended behavioral drift
in refactors; regenerating goldens requires a spec-cited justification in the PR.

---

## 9. Decisions taken here (ambiguities resolved — flagged for review)

1. **D2 result shape vs adaptivity §3.3 envelope**: D2's leaner `ActivityResult` wins
   (it's the settled ABI). The richer signals adaptivity's grade mapping needs
   (`firstTry`, `retried`, `form`, guessability) are reconstructed engine-side from the
   `IssuedCard` the engine retained when it minted the spec (§2.5, §4.5); STT evidence
   and self-reports ride the **typed `detail` envelope** (R3 — `numbers`/`flags`/
   `selfReport`/`stt`, defined in `activityContract.ts`, consumed type-only here).
2. **`placeUser(probeResults)` naming**: placement is inherently adaptive (item k+1
   depends on answer k), so the primary surface is the interactive
   `PlacementController`; `placeUser` is kept as the batch/replay form with guaranteed
   equivalence (§4.3). If the orchestrator intended `placeUser` as the *only* API, the
   controller still satisfies it (UI loops `next()`/`submit()`).
3. **Storage keying** *(superseded by R15)*: this spec originally defined a private
   `journey-engine` LARGE-tier namespace with 64 card shards and volatile review-log
   segments. That design is dead: persistence now consumes `EnginePersistence` from
   storage-analytics.md §3.7 (`journey-cards:` DocStore + `journey-meta:` KVStore +
   the shared local-analytics AppendLog). The keying intent survives — per
   `(stackId, courseId)` namespaces, learner state never volatile-evicted, review
   history the only ring-pruned data.
4. **SkillState split**: persisted `SkillScalars` (accEwma + timestamps + announcedLevel)
   vs derived `SkillState` (coverage/strength/mastery/level), with dirty-seq + day-key
   memoization. `announcedLevel` (not in adaptivity.md) implements the "announce
   transitions once/day" hysteresis without storing derived level as truth.
5. **Debt brake has two stages**: soft quota shift at backlog > 2× session throughput
   (adaptivity §5.3) AND hard new-intake pause at > 1.5× daily capacity
   (pedagogy §12.2 / D4). Both specified; the hard brake also blocks Jump offers.
6. **Quota `new: 0.35` vs pedagogy's 4:1 review:new**: reconciled by counting — NEW-pool
   slots include unscored intro cards and debut repeats; introductions are bound by
   `newPerDay`, and the 4:1 ratio is verified as an emergent property in the sim gate
   (P3), not double-controlled.
7. **Probe/jump results never touch FSRS cards** (θ and tallies only) — adaptivity
   implies but doesn't state it; placement creating 25 half-graded cards would poison
   early scheduling.
8. **`ENGINE_SCHEMA` migrations at load** mirror zustand version/migrate conventions
   since the engine bypasses zustand persist.
9. **ts-fsrs fuzz seeding** uses `GenSeedStrategyWithCardId("cardId")` with
   `cardId = fnv1a32(itemId)` because the library default mixes wall-clock ms into the
   seed (breaks reproducibility). Verified against the shipped 5.4.1 source.
10. **Erasable-syntax-only constraint** (no TS enums in engine code) derives from the
    repo's `node --experimental-strip-types` test runner — not stated in any Phase-1
    doc but load-bearing for the test plan.
11. **Legendary challenges ship devMode-only in v1** (D11 lists path viz P0 only);
    the engine implements the mechanics since the level table (D4) references them.

---

## Tracked risks (panel round 1)

Per R16: the panel's engine-relevant risk items, preserved verbatim (architecture +
pedagogy lenses). Non-blocking — they inform build-time tests, none gate the build
start. Bracketed *[status]* notes are editorial, not part of the panel text.

### Architecture lens

- courseId format drift in persisted keys: engine.md CourseState example uses
  "journey-en" (hyphen) while everything else is underscore-canonical journey_en;
  EngineKey/CourseKey (`${stackId}::${courseId}`) is persisted learner-state keyspace,
  so a mismatch between the store layer and feed-ux's courseKeyOf silently forks
  state. Normalize the example and add an assertion.
  *[example normalized to `journey_en` in §2.4; the load-time assertion remains a
  build-time test to add.]*
- Learner FSRS state in the LARGE tier is volatile:false but still evictable:
  util/storage evict() (index.ts:135-153) falls through to LRU over non-volatile
  records once volatiles are exhausted. With wordpan/catalog caches sharing the tier
  this is unlikely but real on quota-constrained webviews; the recovery ladder softens
  it, but consider exempting the journey-engine namespace from eviction (or
  persistent-storage request) before shipping.
  *[substrate changed to the storage-analytics DocStore (R15); the underlying
  eviction-under-quota concern carries over to `journey-cards:*` and stays tracked.]*
- sessionCounter exists twice: engine CourseState.sessionCounter (PRNG seed component)
  and feed-ux journey store JourneyCourseMeta.sessionCounter ("seeds deterministic
  rare-card PRNG"). Rare-card rolls are already engine-mixer-owned (rollRare); delete
  the store copy or mark it display-only, else the two counters diverge and
  determinism claims break.
  *[R5 makes rare rolls unambiguously engine-owned (§5.10); the feed-ux store copy
  must be deleted or marked display-only on that side.]*
- ts-fsrs 5.4.1 pin, default_w 21-weight equality, and GenSeedStrategyWithCardId
  behavior are asserted from a 2026-07-03 npm check; T-sched-1 covers regression but
  the initial implementation should re-verify the strategy API exists with that exact
  name/signature before building the scheduler wrapper around it.

### Pedagogy lens

- Course-exhaustion and over-placement are unhandled: v0.1 ships ~30 units (arcMax A1)
  but placement Phase 1 probes up to b=+3 and the engine has no 'you are beyond this
  course / course complete' state — a B1 learner or a cruising daily-fast persona runs
  off the end of content in weeks with no specced feed behavior. Define an
  end-of-content card + graceful frontier cap before preview users hit it.
  *[placement side resolved by R10 (§4.3 ladder cap + "above-content"); the
  end-of-content FEED state for learners who exhaust content organically remains
  open and tracked.]*
- Rare-card economy underdelivers in the launch window: storyChapter gates on measured
  95% vocab coverage over real book segments (implausible for A1 learners against the
  current non-graded book catalog, and the coverage computation itself — tokenize
  segments vs FSRS-known items — is defined nowhere); timeCapsule needs weeks of
  history; miniGame is 1:25. Week-one 'wow' rests entirely on delight variants (1:8)
  and etymology gems (1:50). Tune early-session ratios (e.g. guaranteed gem in session
  1–2) or the variable-reward economy reads as absent exactly when retention is
  decided.
  *[story content cut from v0.1 per R11; early-session ratio tuning stays open — the
  1:8/1:25/1:50 constants live in constants.ts for sweep tuning.]*
- First-session flow front-loads friction: enroll → placement offer → up-to-25-probe
  test → streak pact → feed. The learner's first dopamine is an exam. Consider a
  3-card guaranteed-win taste BEFORE the placement offer (warm-win opener exists but
  only post-placement).
- Engine review-log ring (engine.md §2.2, 20k entries) and D13's local analytics store
  are two overlapping append-only event logs with no reconciliation — decide whether
  ActivityResults/impressions write to one store or accept double-writing before both
  ship (storage-analytics.md wasn't in this review set).
  *[resolved by R15: one log (the local-analytics AppendLog), one writer, engine +
  queries as readers — §2.2/§3. Kept for the record.]*
- Simulation gate (7 personas × ≥500 learners × 180 days × 11 criteria + golden
  transcripts + boundary tests) is the right investment but is a full workstream, and
  P4 (time-to-arc) depends on the real journey_en pack that lands last — make the
  fixture-only gate the merge bar and the real-pack rerun a ship bar, or the engine
  team blocks on content.
  *[R10 pins P8 to the real pack as a ship bar; adopting fixture-gate-as-merge-bar /
  real-pack-as-ship-bar for the rest is the working plan.]*
- ts-fsrs 5.4.1 pin, its 21-weight default_w, and GenSeedStrategyWithCardId behavior
  are asserted as verified-on-npm; re-verify at implementation time and keep T-sched-1
  (the weight-equality test) as the tripwire — an upstream default change silently
  reshapes every interval.
- Instrumented-provider Leitner retirement (lingo-hero) creates two scheduling brains
  for the same user across standalone vs journey launches of the same pack — accepted
  for v1, but expect confusing 'why is this word back' moments; the parked
  Leitner→FSRS importer will become user-visible debt.
