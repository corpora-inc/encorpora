// GENERATED from corpan-app/src/contentPacks/activityContract.ts — DO NOT EDIT. Run: node packs/sdk/sync-contract.mjs

// ============================================================
// THE JOURNEY ACTIVITY CONTRACT (ABI) — ActivitySpec in, ActivityResult out.
// AUTHORITATIVE SOURCE. packs/sdk/activityContract.ts,
// packs/shared/capabilities/core/src/activityContract.ts, and every vendored
// packs/*/src/sdk/activityContract.ts are GENERATED copies — edit HERE, then
// run `node packs/sdk/sync-contract.mjs`. CI fails on drift
// (`node packs/sdk/sync-contract.mjs --check`).
//
// This file is IMPORT-FREE and dependency-free ON PURPOSE: it is copied
// verbatim into the SDK and every vendored copy. It carries the contract
// types plus EXACTLY TWO frozen runtime exports: itemRefKey/parseItemRef
// (the one ItemRef serialization helper, R2) and ACTIVITY_TYPES (the native
// activity-type registry, R4). Nothing else executable. Zod schemas
// (host-boundary validation) and JOURNEY_CONTRACT_VERSION live in
// ./activitySchemas.ts and are NOT part of the pack-facing contract.
//
// Spec: corpan/docs/journey/specs/activity-contract.md (D2/D3/D8).
// ============================================================

// ---------------------------------------------------------------- ItemRef (D3)

/** The seven addressable kinds of learnable thing. */
export type ItemRefKind =
  | "phrase"       // corpus entry: source = "base" | phrase-pack id, id = String(entry_id)
  | "word"         // wordpan word: source = target lang code, id = the word
  | "char"         // hanzi/kanji:  source = "hanzipan", id = the character
  | "segment"      // book segment: source = bookId, id = "chNN-SSS"
  | "grammarNode"  // minted by the course pack: source = course pack id, id = node id
  | "phoneme"      // minted by the course pack: source = course pack id,
                   //   id = sorted-IPA contrast key "A-B" (course-pack form)
  | "concept"      // imagepan concept: source = "imagepan", id = concept key

/**
 * One address for one learnable thing (D3). Nothing is renamed; Journey
 * references existing content ids verbatim. `id` is ALWAYS a string — numeric
 * corpus entry ids are stringified decimal (`String(entry_id)`).
 */
export interface ItemRef {
  kind: ItemRefKind
  /** Namespace the id is unique within (see kind table above). */
  source: string
  /** Stable id within (kind, source). */
  id: string
}

/**
 * CANONICAL SERIALIZATION (normative, R2): `<kind>:<source>:<id>` is THE
 * ItemRef string form — the FSRS/ItemCard key, the per-item dedup key, and
 * course-pack `items.id` (course-pack.md and engine.md cite this, they do not
 * restate it). Rules: kind and source NEVER contain ":"; id MAY — parse on
 * the FIRST TWO colons only. Serialized ItemRefs are immutable forever (they
 * are FSRS card keys on learner devices); removing or renaming one is a MAJOR
 * course-pack version event. This is the ONE helper — there is no second
 * serializer anywhere (`serializeItemRef` is this function's former
 * course-pack name; collapsed here per R2).
 */
export function itemRefKey(r: ItemRef): string {
  return `${r.kind}:${r.source}:${r.id}`
}

/** Inverse of itemRefKey. Null on malformed input (fewer than two colons). */
export function parseItemRef(s: string): ItemRef | null {
  const i = s.indexOf(":")
  if (i < 0) return null
  const j = s.indexOf(":", i + 1)
  if (j < 0) return null
  return { kind: s.slice(0, i) as ItemRefKind, source: s.slice(i + 1, j), id: s.slice(j + 1) }
}

// ------------------------------------------------------------ ActivitySpec (D2)

/** Models an activity needs resident to run (D8 / model-residency). */
export type ModelNeed = "stt" | "llm" | "tts"

/**
 * The data-only, serializable description of ONE activity instance —
 * host/engine-issued, provider-executed. Adapted from corpan-city's
 * ChallengeSpec; `itemRefs` generalizes `entryIds`. Everything here must
 * survive `structuredClone` — no functions, no DOM.
 */
export interface ActivitySpec {
  /**
   * Unique per LAUNCH (the engine mints a fresh id every time it enqueues a
   * card, even for the same content). Correlation + dedup key for results.
   * Format: any unique string; the engine uses `js-<epochMs>-<rand4>`.
   */
  specId: string
  /**
   * What to run. Open, namespaced string:
   *   - bare names are RESERVED for Journey's native renderers and MUST be
   *     keys of ACTIVITY_TYPES (snake_case: "choice_pick", "cloze",
   *     "listen_type", …);
   *   - pack-provided types are `<packId>:<name>` with the pack's REGISTERED
   *     id (underscore form), e.g. "corpan_city:build-sentence",
   *     "lingo_hero:round", "earthgate_reader:read-segments".
   * A provider MUST ignore (abandon with reason "unsupported") a spec whose
   * activityType it does not implement.
   */
  activityType: string
  /** The items this activity exercises, in presentation order where relevant. */
  itemRefs: ItemRef[]
  /** Provider-specific knobs. Declared JSON-serializable. */
  params?: Record<string, unknown>
  /** CEFR band hint ("A0".."C2") for providers that scale content. */
  level?: string
  /** Target language of the exercise (BCP-47 corpus code, e.g. "es"). */
  targetLang: string
  /**
   * Native/support language, when the exercise is cross-language. ABSENT on
   * single-language (immersion) stacks — every provider MUST degrade per
   * packs/SINGLE_LANGUAGE_RULE.md.
   */
  nativeLang?: string
  /**
   * ADVISORY duration budget in seconds. Scheduling input for the feed mixer
   * and an optional in-activity timer; the host NEVER force-kills on it.
   */
  timeboxSec?: number
  /** Models that must be loadable for this spec to run. */
  modelNeeds?: ModelNeed[]
}

// ---------------------------------------------------------- ActivityResult (D2)

/** Per-item verdict. The engine derives FSRS grades from this (D4). */
export type ActivityOutcome = "pass" | "partial" | "fail"

/**
 * Typed evidence envelope (R3) — same shape on ActivityItemResult and
 * ActivityResult. Providers put numeric evidence in `numbers`, boolean
 * markers in `flags`. RESERVED flag keys: `sttUnavailable` (speech card
 * degraded) and `aggregateBinned` (per-item outcome synthesized from an
 * aggregate score — the engine clamps grades derived from such entries to
 * [Hard, Good], R9).
 */
export interface ActivityDetail {
  /** Numeric evidence (combo, moves-over-minimum, finalScore, …). */
  numbers?: Record<string, number>
  /** Boolean markers (reserved keys above). */
  flags?: Record<string, boolean>
  /** Learner self-verdict (flip_recall-style cards, debut skips). */
  selfReport?: "already-knew" | "never-learned"
  /** STT evidence (speak_echo & friends). */
  stt?: {
    overallScore: number
    perWord?: Array<{ word: string; probability: number; startMs: number; endMs: number }>
  }
}

export interface ActivityItemResult {
  itemRef: ItemRef
  outcome: ActivityOutcome
  /** Time from item presentation to the resolving input, ms. */
  latencyMs?: number
  /** Hints/reveals consumed on this item (0 = clean). */
  hintsUsed?: number
  /** Typed evidence envelope (R3). */
  detail?: ActivityDetail
}

/**
 * The terminal outcome envelope for one ActivitySpec. Exactly ONE terminal
 * result is accepted per specId (first wins).
 */
export interface ActivityResult {
  /** Must equal the spec's specId. */
  specId: string
  /** Normalized aggregate, 0..1 (corpan-city convention). */
  score: number
  /**
   * One entry per itemRef the learner actually FACED (attempted or resolved).
   * Items never presented (e.g. abandoned round 2 of 5) are simply absent —
   * the engine treats absence as "no evidence", never as a fail.
   */
  perItem: ActivityItemResult[]
  /** Typed evidence envelope (R3). corpan-city's ChallengeResult.detail
   *  (Record<string, number>) maps into `detail.numbers`. */
  detail?: ActivityDetail
  /** Wall-clock ms from mount/spec-start to the terminal event. */
  durationMs: number
  /**
   * True when the activity ended WITHOUT natural completion (user exit, error,
   * provider bail). Abandoned results still carry any perItem evidence
   * accumulated before the exit. Absent ⇒ false.
   */
  abandoned?: boolean
}

// ------------------------------------------------------------- hostApi.journey

export type AbandonReason = "user_exit" | "error" | "timeout" | "unsupported"

/**
 * The typed pack→host results seam. OPTIONAL on HostApi (feature-detect:
 * `hostApi.journey?.isActive()`); present on hosts with HOST_CAPS.journey ≥ 1.
 */
export interface JourneyHostApi {
  /**
   * True iff THIS mount was launched by the Journey feed with an ActivitySpec.
   * Providers use it to switch instrumentation on and pack-local scheduling/
   * gating off. False for standalone launches — same pack, no spec.
   */
  isActive: () => boolean
  /** The spec this mount was launched with, or null outside a journey launch. */
  getSpec: () => ActivitySpec | null
  /**
   * OPTIONAL incremental reporting: push each per-item verdict as it resolves
   * (e.g. one lingo-hero wave). Buffered by the host; if the user swipes away
   * before the terminal result, the buffered items are folded into the
   * host-synthesized abandoned result so partial work is never lost.
   * No-op outside an active journey launch.
   */
  reportItem: (item: ActivityItemResult) => void
  /**
   * Terminal report. Call ONCE at the activity's natural completion boundary,
   * BEFORE dispatching `corpan:exit`. Idempotent: second and later terminal
   * reports for the same specId are dropped. No-op outside a journey launch.
   */
  reportResult: (result: ActivityResult) => void
  /**
   * Explicit provider-side bail (own quit button, unrecoverable error,
   * unsupported spec). The host synthesizes `{abandoned: true}` from buffered
   * items. Equivalent to the host-side unmount synthesis, just earlier and
   * with a reason.
   */
  abandon: (reason?: AbandonReason) => void
}

// -------------------------------------------------------- Event-rail wire shape

/** `detail` of the `corpan:activity-result` CustomEvent (fallback rail). */
export interface ActivityResultEventDetail {
  /** The reporting pack's REGISTERED id (manifest.id / CorpanGames key). */
  packId: string
  result: ActivityResult
}

// ----------------------------------------- Manifest / catalog declaration

/**
 * One activity type a pack offers to Journey. Declared in manifest.json
 * `activities: [...]` and mirrored verbatim onto the pack's catalog entry so
 * the engine can schedule anchor cards for not-yet-installed packs OTA.
 */
export interface PackActivityDeclaration {
  /** Namespaced type, `<packId>:<name>` (must start with the manifest id + ":"). */
  activityType: string
  /** ItemRef kinds this activity can consume. */
  itemKinds: ItemRefKind[]
  /** hostApi members the activity needs (e.g. ["journey","stt"]). Feature names
   *  match HostApi keys. Absent = ["journey"]. */
  requiredHostApis?: string[]
  /** Models the activity will request (scheduler batching input). */
  modelNeeds?: ModelNeed[]
  /** Typical wall-clock duration, seconds (feed-mixer slotting hint). */
  typicalDurationSec?: number
  /** Four Strands tags for the mixer's balance accounting (D4):
   *  mfi = meaning-focused input, mfo = output, lfl = language-focused
   *  learning, fd = fluency development. */
  strands?: ("mfi" | "mfo" | "lfl" | "fd")[]
  /** Minimum HOST_CAPS.journey this declaration needs. Absent = 1. */
  minJourneyCaps?: number
}

// ------------------------------------------ Native activity-type registry (R4)

/** Form ladder (engine §5.5): 0 = recognition, 1 = cued recall, 2 = production. */
export type ActivityForm = 0 | 1 | 2

/** Four Strands (pedagogy). Manifest `strands` tags map onto this:
 *  mfi→"input", mfo→"output", lfl→"language", fd→"fluency". */
export type Strand = "input" | "output" | "language" | "fluency"

export interface ActivityTypeMeta {
  activityType: string
  form: ActivityForm
  strand: Strand
  /** MC/recognition/self-report formats — engine caps derived grades at Good. */
  guessable: boolean
  /** Typical wall-clock seconds; feed-mixer slotting estimate. */
  estSec: number
  modelNeeds: ModelNeed[]
}

/**
 * THE registry of Journey-native activity types — snake_case, one row per
 * feed-ux §4 renderer (form/strand/guessable/estSec sourced there). This
 * const is the ONE metadata source: it feeds the engine's native
 * `CourseGraph.activityTemplates` rows (engine §2.6 / R7) and authoring gate
 * V-7 validates recipes/bosses against the vendored copy (CI drift check via
 * sync-contract.mjs). Translation direction is a PARAM (`direction`) of
 * choice_pick/listen_type/cloze, never a separate type. NOT here on purpose:
 * `read-segment` (book segments are served through the earthgate/segment
 * PROVIDER card) and `etym-gem` (a rare-card face, not a schedulable type).
 * Pack types stay `<packId>:<name>` and are declared via
 * PackActivityDeclaration, never added to this const.
 */
export const ACTIVITY_TYPES = {
  choice_pick:  { activityType: "choice_pick",  form: 0, strand: "language", guessable: true,  estSec: 12, modelNeeds: [] },
  listen_pick:  { activityType: "listen_pick",  form: 0, strand: "input",    guessable: true,  estSec: 15, modelNeeds: [] },
  listen_type:  { activityType: "listen_type",  form: 2, strand: "language", guessable: false, estSec: 30, modelNeeds: [] },
  cloze:        { activityType: "cloze",        form: 1, strand: "language", guessable: false, estSec: 20, modelNeeds: [] },
  word_order:   { activityType: "word_order",   form: 1, strand: "language", guessable: false, estSec: 25, modelNeeds: [] },
  match_pairs:  { activityType: "match_pairs",  form: 0, strand: "language", guessable: true,  estSec: 35, modelNeeds: [] },
  flip_recall:  { activityType: "flip_recall",  form: 1, strand: "language", guessable: true,  estSec: 10, modelNeeds: [] },
  speak_echo:   { activityType: "speak_echo",   form: 2, strand: "output",   guessable: false, estSec: 25, modelNeeds: ["stt"] },
  intro_echo:   { activityType: "intro_echo",   form: 0, strand: "input",    guessable: false, estSec: 12, modelNeeds: [] },
  grammar_note: { activityType: "grammar_note", form: 1, strand: "language", guessable: false, estSec: 45, modelNeeds: [] },
} satisfies Record<string, ActivityTypeMeta>
