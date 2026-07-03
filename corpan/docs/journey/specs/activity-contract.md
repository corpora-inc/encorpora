# Journey — Activity Contract Spec (D2, D3, D8)

**Status: v1.0 implementable spec. Elaborates ARCHITECTURE.md D2/D3/D8; decisions there are settled.**
Sources verified against code on branch `journey`, 2026-07-03:
`corpan-app/src/contentPacks/{types.ts,hostApi.ts,ContentPackHost.tsx,catalog.ts}`,
`packs/corpan-city/contracts/src/{challenge.ts,challengeTool.ts,ids.ts,economy.ts,track.ts}`,
`packs/corpan-city/src/challenges/{registry.ts,host.ts}`, `packs/sdk/{index.d.ts,index.js}`,
`packs/lingo-hero/src/{ContentManager.ts,types.ts,learning/index.ts}`,
`packs/earthgate-reader/src/{main.ts,game.ts}`, `packs/shared/catalog/src/appShell.ts`,
`corpan-app/src/App.tsx` (segment-progress listener at :404-447).
All paths below are relative to `/home/skyl/encorpora/corpan/` unless absolute.

---

## 0. Overview — one contract, two rails, three providers

Every activity in the Journey feed — native card or pack round — is described by a
serializable **`ActivitySpec`** and answered by a serializable **`ActivityResult`**.
The shapes are adapted from corpan-city's proven `ChallengeSpec`/`ChallengeResult`
(`packs/corpan-city/contracts/src/challenge.ts:14-38`), generalized from corpus
`entryIds: number[]` to the universal **`ItemRef`** address space (D3).

Transport follows the codebase's proven dual-rail pattern
(`requestPaywall` ⟷ `corpan:request-unlock`, `entitlement` ⟷ `__CORPAN_ENTITLEMENT`):

- **Host → pack**: `PackLaunchEntry.activity?: ActivitySpec`, spread into
  `mount(container, hostApi, initialState)` (the plumbing already exists end-to-end,
  `ContentPackHost.tsx:549-558`).
- **Pack → host, typed rail**: `hostApi.journey.reportResult(result)` (+ `getSpec`,
  `reportItem`, `abandon`).
- **Pack → host, event rail (fallback)**: `corpan:activity-result` CustomEvent, for
  OTA packs whose vendored SDK predates the seam or that run on newer hosts than they
  were built for. Both rails funnel into one idempotent ingest function.
- **Discovery**: manifest `activities: PackActivityDeclaration[]`, surfaced
  catalog-first (same OTA pattern as recommendation metadata, `catalog.ts:163-178`);
  host advertises `__CORPAN_HOST_CAPS.journey = 1`.

Validation is **Zod at the host boundary only**: packs ship plain TS types (the SDK
stays a dependency-free two-file prototype); the host `safeParse`s everything that
crosses in from a pack.

---

## 1. Canonical types — `corpan-app/src/contentPacks/activityContract.ts` (NEW)

A **new, import-free, types-only file**. This is the single authoritative source for
the contract (§5 defines the sync mechanism). `types.ts` re-exports it so existing
import sites (`import type { ... } from "./types"`) work unchanged. The file must
contain **zero value-level imports and zero runtime code** — it is copied verbatim
into the SDK and vendored SDKs.

```ts
// corpan-app/src/contentPacks/activityContract.ts
//
// ============================================================
// THE JOURNEY ACTIVITY CONTRACT (ABI) — ActivitySpec in, ActivityResult out.
// AUTHORITATIVE SOURCE. packs/sdk/activityContract.d.ts and every vendored
// packs/*/src/sdk/activityContract.ts are GENERATED copies — edit HERE, then
// run `node packs/sdk/sync-contract.mjs`. CI fails on drift.
//
// This file is DECLARATION-PURE (types/interfaces only, no consts, no
// functions, no imports) ON PURPOSE: the generated SDK copy is a `.d.ts`,
// where initializers are illegal — purity makes the verbatim copy valid in
// both worlds. Runtime helpers live host-side in ./activitySchemas.ts
// (`itemRefKey`, `JOURNEY_CONTRACT_VERSION`); packs inline the one-liners.
// Zod schemas (host-boundary validation) are also in ./activitySchemas.ts and
// are NOT part of the pack-facing contract.
// ============================================================

// ---------------------------------------------------------------- ItemRef (D3)

/** The seven addressable kinds of learnable thing. */
export type ItemRefKind =
  | "phrase"       // corpus entry: source = "base" | phrase-pack id, id = String(entry_id)
  | "word"         // wordpan word: source = target lang code, id = the word
  | "char"         // hanzi/kanji:  source = "hanzi", id = the character
  | "segment"      // book segment: source = bookId, id = "chNN-SSS"
  | "grammarNode"  // minted by the course pack: source = course pack id, id = node id
  | "phoneme"      // minted by the course pack: source = course pack id, id = phoneme id
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
 * CANONICAL KEY FORMAT (normative): the string `${kind}|${source}|${id}` is
 * the FSRS/ItemCard key and the per-item dedup key. "|" never occurs in any
 * source/id namespace (pack ids are kebab/underscore, book ids are snake,
 * lang codes are BCP-47, words never contain "|"). The host helper
 * `itemRefKey(r)` lives in activitySchemas.ts; packs inline the template
 * literal — this file stays declaration-pure.
 */

// ------------------------------------------------------------ ActivitySpec (D2)

/** Models an activity needs resident to run (D8 / model-residency, §7). */
export type ModelNeed = "stt" | "llm" | "tts"

/**
 * The data-only, serializable description of ONE activity instance —
 * host/engine-issued, provider-executed. Adapted from corpan-city's
 * ChallengeSpec (challenge.ts:14-24); `itemRefs` generalizes `entryIds`.
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
   *   - bare names ("picture-choice", "cloze", "listen-type", …) are RESERVED
   *     for Journey's native renderers;
   *   - pack-provided types are `<packId>:<name>` with the pack's REGISTERED
   *     id (underscore form), e.g. "corpan_city:build-sentence",
   *     "lingo_hero:round", "earthgate_reader:read-segments".
   * A provider MUST ignore (abandon with reason "error") a spec whose
   * activityType it does not implement.
   */
  activityType: string
  /** The items this activity exercises, in presentation order where relevant. */
  itemRefs: ItemRef[]
  /** Provider-specific knobs. Declared JSON-serializable; see per-provider §6. */
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
   * and an optional in-activity timer; the host NEVER force-kills on it (§8).
   */
  timeboxSec?: number
  /** Models that must be loadable for this spec to run (§7). */
  modelNeeds?: ModelNeed[]
}

// ---------------------------------------------------------- ActivityResult (D2)

/** Per-item verdict. The engine derives FSRS grades from this (D4). */
export type ActivityOutcome = "pass" | "partial" | "fail"

export interface ActivityItemResult {
  itemRef: ItemRef
  outcome: ActivityOutcome
  /** Time from item presentation to the resolving input, ms. */
  latencyMs?: number
  /** Hints/reveals consumed on this item (0 = clean). */
  hintsUsed?: number
  /** Optional numeric evidence (e.g. STT overallScore, moves-over-minimum). */
  detail?: Record<string, number>
}

/**
 * The terminal outcome envelope for one ActivitySpec. Exactly ONE terminal
 * result is accepted per specId (first wins, §3.4).
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
  /** Provider-specific numeric metrics (mirrors ChallengeResult.detail). */
  detail?: Record<string, number>
  /** Wall-clock ms from mount/spec-start to the terminal event. */
  durationMs: number
  /**
   * True when the activity ended WITHOUT natural completion (user exit, error,
   * provider bail). Abandoned results still carry any perItem evidence
   * accumulated before the exit. Absent ⇒ false.
   */
  abandoned?: boolean
}

// --------------------------------------------------------- hostApi.journey (§3)

export type AbandonReason = "user_exit" | "error" | "timeout" | "unsupported"

/**
 * The typed pack→host results seam. OPTIONAL on HostApi (feature-detect:
 * `hostApi.journey?.isActive()`); present on hosts with HOST_CAPS.journey ≥ 1.
 */
export interface JourneyHostApi {
  /**
   * True iff THIS mount was launched by the Journey feed with an ActivitySpec.
   * Providers use it to switch instrumentation on and pack-local scheduling/
   * gating off (§6). False for standalone launches — same pack, no spec.
   */
  isActive: () => boolean
  /** The spec this mount was launched with, or null outside a journey launch. */
  getSpec: () => ActivitySpec | null
  /**
   * OPTIONAL incremental reporting: push each per-item verdict as it resolves
   * (e.g. one lingo-hero wave). Buffered by the host; if the user swipes away
   * before the terminal result, the buffered items are folded into the
   * host-synthesized abandoned result (§8) so partial work is never lost.
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

// ------------------------------------------------- Event-rail wire shape (§3.3)

/** `detail` of the `corpan:activity-result` CustomEvent (fallback rail). */
export interface ActivityResultEventDetail {
  /** The reporting pack's REGISTERED id (manifest.id / CorpanGames key). */
  packId: string
  result: ActivityResult
}

// --------------------------------------- Manifest / catalog declaration (§4.2)

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
  /** Models the activity will request (scheduler batching input, §7). */
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
```

### 1.1 `types.ts` change (re-export, no drift)

```ts
// corpan-app/src/contentPacks/types.ts — add at top:
export * from "./activityContract"
```

and widen two existing types (see §2, §4.1 for context):

```ts
export interface PackLaunchEntry {
  entryId?: number
  source?: string
  route?: string
  seedBookId?: string
  /**
   * Journey activity launch (D2). When present the pack is being run AS AN
   * ACTIVITY PROVIDER: it should honor the spec and report via
   * hostApi.journey / corpan:activity-result. Packs that don't understand it
   * ignore it (additive-optional, like every other field here).
   */
  activity?: ActivitySpec
}

export type ContentPackManifest = {
  // ...existing fields unchanged...
  /** Journey activity types this pack provides (§4.2). */
  activities?: PackActivityDeclaration[]
}
```

`HostApi` gains one optional member, placed next to `entitlement`:

```ts
  /**
   * Journey activity seam (typed rail). Present when HOST_CAPS.journey ≥ 1.
   * Packs feature-detect; the `corpan:activity-result` window event is the
   * fallback rail on hosts where this is absent.
   */
  journey?: JourneyHostApi
```

### 1.2 ItemRef encodings (normative table)

| kind | source | id | Example |
|---|---|---|---|
| `phrase` | `"base"` or phrase-pack id | `String(entry_id)` (decimal) | `{kind:"phrase", source:"base", id:"18422"}` |
| `word` | target lang code | the word (verbatim, NFC) | `{kind:"word", source:"es", id:"aunque"}` |
| `char` | `"hanzi"` | the character | `{kind:"char", source:"hanzi", id:"愛"}` |
| `segment` | bookId | segment id `chNN-SSS` | `{kind:"segment", source:"book_biomes_tropical_rainforest", id:"ch05-088"}` |
| `grammarNode` | course pack id | node id | `{kind:"grammarNode", source:"journey_en", id:"gn-past-simple"}` |
| `phoneme` | course pack id | phoneme id | `{kind:"phoneme", source:"journey_en", id:"ph-th-voiced"}` |
| `concept` | `"imagepan"` | concept key | `{kind:"concept", source:"imagepan", id:"obj_bicycle"}` |

Rules: ids are strings everywhere in the contract; providers converting to
`entryIds: number[]` (corpan-city adapter, §6.3) parse with `Number(ref.id)` and
must pass `ref.source` through to `getEntryById(entryId, source)` — `entry_id` is
only unique per source (`types.ts:97-103`).

---

## 2. Transport host→pack: the `PackLaunchEntry` widening

### 2.1 Flow (all plumbing exists; two files change)

`App.tsx handleLaunchGame(game, entry)` (`App.tsx:536-551`) → `activeGame.entry` →
`<ContentPackOverlay entry>` → `<ContentPackHost entry>` → `mount(..., initialState)`.

**`ContentPackHost.tsx` change 1 — spread the spec** (at :549-558):

```ts
activeInstance = activeModule.mount(containerRef.current, hostApi, {
  stackConfig: hostApi.getStackConfig(),
  isPlus: entitlementSnapshotRef.current.plus,
  entitlement: entitlementSnapshotRef.current,
  ...(entry ? { entryId: entry.entryId, source: entry.source, route: entry.route } : {}),
  ...(entry?.seedBookId ? { seedBookId: entry.seedBookId } : {}),
  // Journey activity launch (D2). Packs read only what they understand.
  ...(entry?.activity ? { activity: entry.activity } : {}),
})
```

**`ContentPackHost.tsx` change 2 — the effect dependency list** (:602). `entry.activity`
is an object; putting it in the dep array verbatim would remount on every parent
render. Depend on the *identity* instead:

```ts
}, [hostApi, id, manifestUrl, entry?.entryId, entry?.source, entry?.route,
    entry?.seedBookId, entry?.activity?.specId])
```

A new `specId` ⇒ full remount with the new spec — which is the correct semantic:
one mount = one spec (there is deliberately NO mid-session re-tasking channel in v1;
the feed pre-mounts the next card natively and pack activities are whole launches, D8).

### 2.2 Backward compatibility

- Old packs receive an extra `activity` key in `initialState`
  (`Record<string, unknown>` on the pack side) and ignore it — the established
  "a pack reads only what it understands" convention (`types.ts:33-38`).
- Old hosts never populate the field; new packs feature-detect
  (`initialState?.activity` + `hostApi.journey?`) and run their standalone mode.
- The `?game=` URL scheme is unchanged; `activity` is deliberately NOT
  URL-parseable in v1 (specs are engine-minted, not deep-link material).
- `isPlus`/`entitlement`/`stackConfig` keys are untouched.

### 2.3 Journey-side launch (informative)

The feed controller (D1, `corpan-app/src/journey/`) launches a pack card via the
existing chokepoint:

```ts
handleLaunchGame(game, { activity: spec })
```

after calling `beginActivitySession(game.id, spec, callbacks)` (§3.2). Install-if-
missing uses the existing `installPack`/batch machinery and is the scheduler's
concern, not this contract's.

---

## 3. Transport pack→host: `hostApi.journey` + `corpan:activity-result`

### 3.1 Zod at the host boundary — `corpan-app/src/contentPacks/activitySchemas.ts` (NEW)

Add `"zod": "^4.4.3"` to `corpan-app/package.json` (matches corpan-city/teletron;
the Journey engine will use it too). Schemas are host-only — they never enter the
SDK copy. Each schema is pinned to its TS type with `satisfies z.ZodType<...>` so
the type file and the validator cannot drift silently.

```ts
// corpan-app/src/contentPacks/activitySchemas.ts
import { z } from "zod"
import type {
  ItemRef, ActivitySpec, ActivityItemResult, ActivityResult,
  ActivityResultEventDetail, PackActivityDeclaration,
} from "./activityContract"

/** Journey contract version advertised in `__CORPAN_HOST_CAPS.journey`. */
export const JOURNEY_CONTRACT_VERSION = 1

/** Canonical ItemRef key (format is normative in activityContract.ts). */
export const itemRefKey = (r: ItemRef): string => `${r.kind}|${r.source}|${r.id}`

export const ItemRefKindSchema = z.enum([
  "phrase", "word", "char", "segment", "grammarNode", "phoneme", "concept",
])

export const ItemRefSchema = z.object({
  kind: ItemRefKindSchema,
  source: z.string().min(1),
  id: z.string().min(1),
}) satisfies z.ZodType<ItemRef>

export const ModelNeedSchema = z.enum(["stt", "llm", "tts"])

export const ActivitySpecSchema = z.object({
  specId: z.string().min(1),
  activityType: z.string().min(1),
  itemRefs: z.array(ItemRefSchema),
  params: z.record(z.string(), z.unknown()).optional(),
  level: z.string().optional(),
  targetLang: z.string().min(2),
  nativeLang: z.string().min(2).optional(),
  timeboxSec: z.number().positive().optional(),
  modelNeeds: z.array(ModelNeedSchema).optional(),
}) satisfies z.ZodType<ActivitySpec>

export const ActivityItemResultSchema = z.object({
  itemRef: ItemRefSchema,
  outcome: z.enum(["pass", "partial", "fail"]),
  latencyMs: z.number().nonnegative().optional(),
  hintsUsed: z.number().int().nonnegative().optional(),
  detail: z.record(z.string(), z.number()).optional(),
}) satisfies z.ZodType<ActivityItemResult>

export const ActivityResultSchema = z.object({
  specId: z.string().min(1),
  score: z.number().min(0).max(1),
  perItem: z.array(ActivityItemResultSchema),
  detail: z.record(z.string(), z.number()).optional(),
  durationMs: z.number().nonnegative(),
  abandoned: z.boolean().optional(),
}) satisfies z.ZodType<ActivityResult>

export const ActivityResultEventDetailSchema = z.object({
  packId: z.string().min(1),
  result: ActivityResultSchema,
}) satisfies z.ZodType<ActivityResultEventDetail>

export const PackActivityDeclarationSchema = z.object({
  activityType: z.string().min(1),
  itemKinds: z.array(ItemRefKindSchema).min(1),
  requiredHostApis: z.array(z.string()).optional(),
  modelNeeds: z.array(ModelNeedSchema).optional(),
  typicalDurationSec: z.number().positive().optional(),
  strands: z.array(z.enum(["mfi", "mfo", "lfl", "fd"])).optional(),
  minJourneyCaps: z.number().int().positive().optional(),
}) satisfies z.ZodType<PackActivityDeclaration>
```

### 3.2 Host implementation — `corpan-app/src/journey/activitySession.ts` (NEW)

A module-level singleton session (the architecture guarantees one pack overlay at a
time, `App.tsx:809`). The feed controller owns begin/end; `createHostApi` and the
window-event listener both delegate to it. Pure TS, no React.

```ts
// corpan-app/src/journey/activitySession.ts
import type {
  ActivitySpec, ActivityResult, ActivityItemResult, AbandonReason,
} from "@/contentPacks/activityContract"
import {
  ActivityResultSchema, ActivityItemResultSchema, itemRefKey,
} from "@/contentPacks/activitySchemas"

export type ActivityResultMeta = {
  /** true when the host built the result (abandon/unmount/error), not the pack. */
  synthesized: boolean
  reason?: AbandonReason
  receivedAt: number
}

type SessionCallbacks = {
  onResult: (result: ActivityResult, meta: ActivityResultMeta) => void
}

type Session = {
  packId: string
  spec: ActivitySpec
  startedAt: number
  itemBuffer: ActivityItemResult[]
  terminal: boolean
  callbacks: SessionCallbacks
}

let session: Session | null = null

/** Feed controller calls this IMMEDIATELY BEFORE handleLaunchGame. */
export function beginActivitySession(
  packId: string, spec: ActivitySpec, callbacks: SessionCallbacks,
): void {
  // A still-open previous session is finalized as abandoned("user_exit") first
  // — belt-and-braces; the feed controller normally ends it at card teardown.
  if (session && !session.terminal) finalizeAbandoned("user_exit")
  session = { packId, spec, startedAt: Date.now(), itemBuffer: [], terminal: false, callbacks }
}

export function isActiveFor(packId: string): boolean {
  return !!session && !session.terminal && session.packId === packId
}

export function activeSpecFor(packId: string): ActivitySpec | null {
  return isActiveFor(packId) ? session!.spec : null
}

/** Both rails call this. Returns false when rejected (logged, never thrown). */
export function ingestItem(packId: string, raw: unknown): boolean {
  if (!isActiveFor(packId)) return reject("item from inactive session", packId)
  const parsed = ActivityItemResultSchema.safeParse(raw)
  if (!parsed.success) return reject(`invalid item: ${parsed.error.message}`, packId)
  // Per-item dedup: last write wins per itemRefKey (a provider may upgrade
  // partial→pass on retry within one activity); buffer stays presentation-ordered.
  const key = itemRefKey(parsed.data.itemRef)
  const i = session!.itemBuffer.findIndex((x) => itemRefKey(x.itemRef) === key)
  if (i >= 0) session!.itemBuffer[i] = parsed.data
  else session!.itemBuffer.push(parsed.data)
  return true
}

/** Both rails call this. First terminal wins; everything after is dropped. */
export function ingestResult(packId: string, raw: unknown): boolean {
  if (!session || session.terminal) return reject("result after terminal / no session", packId)
  if (session.packId !== packId) return reject("result from wrong pack", packId)
  const parsed = ActivityResultSchema.safeParse(raw)
  if (!parsed.success) return reject(`invalid result: ${parsed.error.message}`, packId)
  if (parsed.data.specId !== session.spec.specId)
    return reject(`stale specId ${parsed.data.specId}`, packId)
  session.terminal = true
  session.callbacks.onResult(parsed.data, {
    synthesized: false, receivedAt: Date.now(),
  })
  return true
}

/** Provider abandon() OR host teardown. Idempotent. */
export function finalizeAbandoned(reason: AbandonReason): void {
  if (!session || session.terminal) return
  session.terminal = true
  const s = session
  const attempted = s.itemBuffer.length
  const passed = s.itemBuffer.filter((x) => x.outcome === "pass").length
  s.callbacks.onResult(
    {
      specId: s.spec.specId,
      // Score over items FACED only; zero faced ⇒ 0 (engine ignores the
      // scalar on abandoned results anyway — perItem is the evidence, D4).
      score: attempted > 0 ? passed / attempted : 0,
      perItem: s.itemBuffer,
      durationMs: Date.now() - s.startedAt,
      abandoned: true,
    },
    { synthesized: true, reason, receivedAt: Date.now() },
  )
}

/** Feed controller calls this after the overlay unmounts. */
export function endActivitySession(): void {
  finalizeAbandoned("user_exit")   // no-op if a terminal result already landed
  session = null
}

function reject(why: string, packId: string): false {
  console.warn(`[journey] dropped activity report from ${packId}: ${why}`)
  return false
}
```

What the feed controller does with `onResult` (grade derivation, FSRS writes,
celebration tier) is the engine spec's business (D4) — this contract ends at the
validated, deduped `(ActivityResult, meta)` pair.

### 3.3 The two rails

**Typed rail — `hostApi.journey`** in `createHostApi(packId)`
(`hostApi.ts:182`; add next to the `entitlement` block in the returned object):

```ts
// corpan-app/src/contentPacks/hostApi.ts
import {
  isActiveFor, activeSpecFor, ingestItem, ingestResult, finalizeAbandoned,
} from "@/journey/activitySession"

// inside createHostApi(packId?), in the returned HostApi object:
journey: {
  isActive: () => !!packId && isActiveFor(packId),
  getSpec: () => (packId ? activeSpecFor(packId) : null),
  reportItem: (item) => { if (packId) ingestItem(packId, item) },
  reportResult: (result) => { if (packId) ingestResult(packId, result) },
  abandon: (reason) => {
    if (packId && isActiveFor(packId)) finalizeAbandoned(reason ?? "user_exit")
  },
},
```

Note `createHostApi()` with no packId (any legacy caller) gets inert no-ops — the
seam is always shaped, never throwing, matching the `asr` precedent.

**Event rail — `corpan:activity-result`.** Registered once by the Journey surface
(in the feed controller's mount effect, NOT App.tsx — Journey owns its listener the
way readers' `corpan:segment-progress` is owned at `App.tsx:404-447`, but scoped):

```ts
useEffect(() => {
  const onActivityResult = (e: Event) => {
    const detail = (e as CustomEvent<unknown>).detail
    const parsed = ActivityResultEventDetailSchema.safeParse(detail)
    if (!parsed.success) {
      console.warn("[journey] invalid corpan:activity-result dropped:", parsed.error.message)
      return
    }
    ingestResult(parsed.data.packId, parsed.data.result)
  }
  window.addEventListener("corpan:activity-result", onActivityResult)
  return () => window.removeEventListener("corpan:activity-result", onActivityResult)
}, [])
```

Pack-side fallback dispatch (what the SDK docs will show):

```ts
const reportResult = (result: ActivityResult) => {
  if (hostApi.journey) { hostApi.journey.reportResult(result); return }
  window.dispatchEvent(new CustomEvent("corpan:activity-result", {
    detail: { packId: PACK_ID, result },
  }))
}
```

There is **no event fallback for `reportItem`/`abandon`** — incremental buffering and
explicit bail are typed-rail-only conveniences; on old hosts the whole seam is absent
and Journey doesn't exist there anyway (the event rail exists for the *reverse* skew:
an OTA pack built against a newer SDK than the vendored copy it shipped with, and for
packs that never update their vendored SDK at all).

### 3.4 Semantics (normative)

| Rule | Behavior |
|---|---|
| **Validation** | Every pack-originated payload is `safeParse`d (§3.1). Invalid ⇒ dropped + `console.warn` + on-device analytics `journey_result_rejected` (fire-and-forget). Never throws into the pack. |
| **Scoping** | Reports are accepted only from the pack whose id owns the active session AND whose `specId` matches. Anything else ⇒ dropped + warn ("stale specId" covers a late result from a previous card). |
| **Dedup (terminal)** | First terminal result per `specId` wins — whether it arrived via typed rail, event rail, or host synthesis. All later terminals for that specId are dropped. A pack that (buggily) calls `reportResult` AND dispatches the event double-reports safely. |
| **Dedup (items)** | Per `itemRefKey`, last write wins inside one session. Items arriving after the terminal result are dropped. |
| **Ordering** | `reportItem*` → `reportResult` is the expected order. The terminal result's `perItem` array is AUTHORITATIVE and replaces the buffer when present and non-empty; the buffer is only used for host-synthesized abandoned results. |
| **Idempotent teardown** | `endActivitySession()` after a normal result is a no-op; after no result it synthesizes `abandoned`. Exactly one `onResult` fires per session, always. |
| **No result required for standalone launches** | When `entry.activity` is absent there is no session; all journey calls are no-ops. Packs never need to branch defensively. |

---

## 4. Capability discovery

### 4.1 `__CORPAN_HOST_CAPS.journey`

Widen the global's type and stamp it where `dailyLock` is stamped
(`ContentPackHost.tsx:240-259`):

```ts
import { JOURNEY_CONTRACT_VERSION } from "./activitySchemas"

const scope = globalThis as typeof globalThis & {
  __CORPAN_PLUS?: boolean
  __CORPAN_ENTITLEMENT?: ContentPackEntitlementSnapshot
  __CORPAN_HOST_CAPS?: { dailyLock?: boolean; journey?: number }
}
// ...
scope.__CORPAN_HOST_CAPS = {
  ...scope.__CORPAN_HOST_CAPS,
  dailyLock: true,
  // Journey activity contract version (JOURNEY_CONTRACT_VERSION). Absent on
  // pre-journey hosts → packs run standalone-only. Integer so a future
  // revision can gate on `>= 2` instead of minting a new flag.
  journey: JOURNEY_CONTRACT_VERSION,
}
```

An integer (not boolean) because `manifest.activities[].minJourneyCaps` compares
against it. `manifest.sdkVersion` stays decorative, per D2.

### 4.2 Manifest `activities` declaration

Pack `manifest.json` gains the optional array (schema §1, Zod §3.1). Example
(corpan-city, abridged):

```json
{
  "id": "corpan_city",
  "version": "0.2.0",
  "entry": "dist/app.js",
  "activities": [
    { "activityType": "corpan_city:build-sentence",
      "itemKinds": ["phrase"], "strands": ["lfl"],
      "typicalDurationSec": 60, "requiredHostApis": ["journey"] },
    { "activityType": "corpan_city:read-aloud",
      "itemKinds": ["phrase"], "strands": ["mfo"], "modelNeeds": ["stt"],
      "typicalDurationSec": 75, "requiredHostApis": ["journey", "stt"] }
  ]
}
```

Rules:
- `activityType` MUST be prefixed `<manifest.id>:` — the host refuses (ignores +
  warns) declarations that spoof another pack's namespace, mirroring the phrase-pack
  id-spoofing guard (`phrasePackRegister.ts:132-137`).
- Declarations are validated lazily with `PackActivityDeclarationSchema` when the
  Journey scheduler reads them; invalid entries are individually skipped.
- A pack MAY implement types it doesn't declare (the engine just won't schedule
  them); it MUST NOT be sent types it neither declares nor implements — if it is,
  it calls `hostApi.journey.abandon("unsupported")`.

### 4.3 Catalog surfacing

`CatalogV3Entry` (`contentPacks/catalog.ts:128-178`) gains, in the recommendation-
metadata block:

```ts
  /** Journey activity declarations, copied VERBATIM from the pack's
   *  manifest.json `activities` at publish time. Lets the Journey scheduler
   *  plan anchor/rare cards for packs the user hasn't installed yet
   *  (install-on-first-schedule), and re-plan OTA without an app release —
   *  the same pattern as categories/goodForClass/recommendOrder. */
  activities?: PackActivityDeclaration[]
```

- `filterCatalogForApp` (`catalog.ts:616-709`) forwards the field untouched (add it
  wherever `categories`/`recommendOrder` are forwarded onto the filtered entry).
- The catalog publisher copies `manifest.activities` into the pack's catalog entry
  at publish time (same discipline as version bumps; the manifest is the source).
- Runtime precedence for the scheduler: **installed manifest wins over catalog**
  (the installed pack is what will actually mount); catalog is used for
  not-installed packs only.
- `experiences/registry.ts` needs no change in v1 (Journey scheduling reads catalog
  + installed manifests directly; Home ranking is unaffected).

---

## 5. SDK update plan — killing the vendor-copy drift for this contract

**Problem (pack-contract.md §5):** the SDK is vendor-copied per pack and its types
have already drifted from `types.ts` (missing `entitlement`, `llm`, memory fields,
options-form `getRandomEntries`, …). A hand-maintained third copy of the activity
contract would drift the same way, and this contract is precisely the one that must
not.

**Decision: one authoritative file, generated copies, CI-enforced.**

1. **Authoritative source**: `corpan-app/src/contentPacks/activityContract.ts`
   (§1). Types-only, import-free — copyable verbatim.
2. **Generated copies**:
   - `packs/sdk/activityContract.d.ts` — byte-identical copy with a generated
     header. `packs/sdk/index.d.ts` adds one line:
     `export * from "./activityContract"` and widens its `HostApi` with
     `journey?: JourneyHostApi` (this one-liner is hand-maintained; the shapes it
     references are not).
   - Every vendored SDK that opts in: any existing file matching
     `packs/*/src/sdk/activityContract.ts` is overwritten by the sync. A pack opts
     in by creating the file once (empty is fine) — the script never invents new
     files in packs that don't use the contract.
3. **Sync script**: `packs/sdk/sync-contract.mjs` (node, zero deps):
   - reads the authoritative file, prepends
     `// GENERATED from corpan-app/src/contentPacks/activityContract.ts — DO NOT EDIT. Run: node packs/sdk/sync-contract.mjs`,
   - writes `packs/sdk/activityContract.d.ts` + every opted-in vendored copy,
   - `--check` mode exits 1 listing stale files without writing.
4. **CI gate**: add `node packs/sdk/sync-contract.mjs --check` to the repo's
   ci-gate workflow (alongside existing pack-catalog checks). Drift fails the PR.
5. **Runtime mock**: `packs/sdk/index.js createMockHostApi` gains a minimal
   `journey` mock — `isActive: () => !!mockSpec`, `getSpec`, and `reportItem`/
   `reportResult`/`abandon` that `console.log` and stash on
   `window.__corpanMockJourney = { items: [], results: [] }` so standalone pack dev
   (`mountStandalone`) can assert emissions without a host. `mountStandalone`'s
   options gain `activity?: ActivitySpec` which is threaded into `initialState`
   and the mock seam.
6. **Everything else in the SDK stays as-is** (deliberately standalone; the wider
   SDK-drift cleanup is out of scope for this spec — this mechanism is designed so
   it CAN later absorb more of `types.ts`, one import-free module at a time).

Rollout compatibility recap (the four proven layers, applied):
additive-optional `journey?` member + feature detection; `__CORPAN_HOST_CAPS.journey`
for OTA packs on older/newer hosts; catalog `minAppVersion` on any pack version that
*requires* the seam; `corpan:activity-result` as the dual-rail event twin.

---

## 6. Per-provider instrumentation plans

Common pattern for all three: **journey mode is detected once at mount** —
`const spec = initialState?.activity as ActivitySpec | undefined` (belt) and
`hostApi.journey?.isActive()` (suspenders) — and threaded explicitly; no globals.
In journey mode a provider: (a) sources content from `spec.itemRefs`, (b) reports
via §3, (c) suppresses its own daily gate (`corpan:daily-locked` / paywallGate
counters — the Journey quota was already debited by the host when the card was
enqueued, D9), (d) ends with `reportResult(...)` then `window.dispatchEvent(new
CustomEvent("corpan:exit"))`.

### 6.1 lingo-hero (`lingo_hero`) — activityType `lingo_hero:round`

**Spec params:**

```ts
type LingoHeroRoundParams = {
  /** Number of phrase charts to play, then report + exit. Default 3. */
  rounds?: number
  mode?: "practice" | "blitz"          // default "practice"
  /** Initial decoy count / beat-gap bias, 0..1 (maps onto the existing
   *  streak→gap curve, Game.ts:580-598). Default: engine sends 0 for new
   *  items, higher for review. */
  intensity?: number
}
```

`itemRefs`: `kind:"phrase"` refs — the phrases whose target-language words the
charts will quiz. (The engine sends 1 ref per round; extra refs are the ordered
backlog if `rounds > itemRefs.length` is false.)

**Choke points (all three were designed for injection — zero `Game.ts` gameplay
edits for content/results, one small edit for the stop condition):**

1. **Content — curated faucet + selector pin.** `ContentManager.getRound()`
   accumulates a pool via `fetchBatch` → `hostApi.getRandomEntries(8)`
   (`ContentManager.ts:178-276`). In journey mode:
   - `main.ts mount` resolves `spec.itemRefs` → `EntryOut[]` via
     `hostApi.getEntryById(Number(ref.id), ref.source)` and hands them to
     `new ContentManager(hostApi, { pinnedEntries })` (new optional ctor arg):
     `fetchBatch` serves pinned entries first, then tops up with
     `getRandomEntries` as today — random top-up is REQUIRED (distractor words
     come from other pool entries, `ContentManager.ts:250-264`; the answer-dedup
     contract in `learning/selector.ts:9-21` is untouched).
   - A journey `WordSelector` is registered via the existing
     `setDefaultWordSelector()` registry (`ContentManager.ts:34-38`):
     `chooseTarget` returns the next unplayed pinned entry from `candidates`
     (falling back to null → default behavior — the selector "may bias, never
     break" contract holds because ContentManager re-validates candidates).
2. **Results — one extra bus subscriber.** In `learning/index.ts initLearning`
   (which already subscribes to `wave-resolved`; Game.ts is the sole emitter,
   `types.ts:292-307`), when journey-mode:
   - Build an `entryId → ItemRef` map from `spec.itemRefs` at init.
   - On `wave-resolved {word: WordIdentity, outcome}`: if `word.entryId` maps to a
     spec ref, `hostApi.journey.reportItem({ itemRef, outcome: outcomeMap[outcome],
     latencyMs, detail: { combo } })` with `outcomeMap = { correct: "pass",
     wrong: "fail", passed: "fail" }`. Waves on non-spec (top-up) entries are NOT
     reported — they're scenery, not scheduled evidence. `latencyMs` = wall-clock
     from the wave's first note spawn to resolution (the bus timestamps suffice;
     if not measurable in v1, omit — it's optional).
   - Buffer everything locally too; on round-count completion build the terminal
     `ActivityResult`: `score` = clean-catch rate over spec items,
     `detail: { finalScore, bestCombo, decoysDodged }`, `durationMs` from mount.
3. **Stop condition — the one Game.ts edit.** Add `maxRounds?: number` to the
   round lifecycle (the report's (d)/(e) analysis: runs are endless, `gameOver()`
   only via HUD). After the result-linger of chart N === `params.rounds ?? 3`,
   emit the existing `gameOver` bus event and show a compact "Round complete"
   card whose single CTA fires `reportResult` + `corpan:exit`. (The host feed's
   CelebrationLayer does the big juice — keep the in-pack card minimal.)
4. **Retire the Leitner store under journey launches (D11).** In journey mode
   `initLearning`:
   - does NOT register the SRS-biased selector (the journey selector from (1) is
     registered instead) and does NOT write `WordStatsStore`
     (`learning/wordStats.ts`, localStorage `(stackId, lang, entryId)`) — **FSRS
     is the one scheduler**; double-bookkeeping would fight it.
   - `AdaptiveDifficulty` (content-difficulty EWMA) MAY stay live within the
     round — it's session-local feel, not scheduling state.
   - Standalone launches are UNCHANGED: Leitner keeps working exactly as today.
     No migration of Leitner state into FSRS in v1 (the engine's `priorKnown`
     lazy-seeding covers warm starts; a one-shot importer is a parked follow-up).

**Contract guards (do not regress, from experiences-games.md §1):** answer dedup;
offline-first; TTS speaks RAW `WordIdentity.foreign`; pack id `lingo_hero`
underscore; delta-timed movement; canvas-measured input. None of the above touches
them.

### 6.2 earthgate-reader (`earthgate_reader`) — activityType `earthgate_reader:read-segments`

**Spec params:**

```ts
type EarthgateReadSegmentsParams = {
  bookId: string          // must equal every itemRef.source
  language: string        // narration language (usually spec.targetLang)
  /** Inclusive 0-based segment index range; MUST correspond to itemRefs. */
  fromIndex: number
  toIndex: number
  autoPlay?: boolean      // default true for feed cards
}
```

`itemRefs`: contiguous `kind:"segment"` refs, `source = bookId`, `id = "chNN-SSS"`,
in reading order. The engine derives `fromIndex/toIndex` from the course pack's
segment table; the reader treats params as authoritative and the refs as the
reporting vocabulary (index → id mapping comes from its own `segments.json`, which
carries the ids).

**Choke points:**

1. **Launch routing — appShell.** `main.ts mount` builds `initialState` and mounts
   `createAppShell` (`main.ts:30-77`). Journey mode: appShell (`packs/shared/
   catalog/src/appShell.ts`) checks `initialState.activity`; when present it
   bypasses the library UI and calls its existing single activation path
   `switchToNarration(narrationId, …)` (`appShell.ts:1212-1246`) for the installed
   narration matching `(params.bookId, params.language)`, extending the reader
   `initialState` it already builds (`appShell.ts:1229-1239`) with
   `{ segmentRange: { from: params.fromIndex, to: params.toIndex },
   startAtSegmentIndex: params.fromIndex, autoPlay: params.autoPlay ?? true }`.
   Precondition: the narration is installed — the Journey scheduler ensures this
   before enqueueing the card (existing installManager); if it's missing anyway,
   appShell calls `hostApi.journey.abandon("error")` and falls back to its normal
   library UI.
2. **Range clamp + result emission — game.ts.** `createEarthgateReader` already
   reads `initialState` knobs (`game.ts:414-425, 935-1077`) and already owns the
   per-segment boundary: `reportSegmentProgress(index)` (`game.ts:470-486`).
   Additions:
   - Respect `segmentRange`: start at `from`, stop playback (and show the
     completion affordance) after segment `to` finishes.
   - At each segment boundary inside the range, alongside the existing
     `corpan:segment-progress` dispatch (KEEP IT — the Library "Continue" shelf
     and streaks feed on it), call
     `hostApi.journey?.reportItem({ itemRef: { kind: "segment", source: bookId,
     id: segmentIdAt(index) }, outcome: "pass" })`.
     Readers have no correctness signal — **exposure grades as `"pass"`**, and the
     engine caps the derived FSRS grade accordingly (D4's "MC capped at Good"
     principle applies; that mapping is the engine's, not the reader's).
   - After segment `to` completes: `reportResult({ specId, score: 1, perItem,
     durationMs, detail: { segments: to - from + 1 } })`, then a "Continue"
     affordance that dispatches `corpan:exit`. Partial listening (user exits at
     segment k < to) is covered by the buffered items + host synthesis (§8) —
     `score = reached/total`, `abandoned: true`, and the engine still credits the
     segments actually heard.
3. **Paywall interplay.** If the range crosses the free-preview boundary of a
   preview pack the reader already dispatches `corpan:request-unlock`; in journey
   mode it ALSO calls `abandon("error")` if the user declines and content can't
   continue. The scheduler should avoid crossing `freeSegments` for non-Plus
   users in the first place (it has `totalSegments`/`freeSegments` from the
   narration catalog).

### 6.3 corpan-city (`corpan_city`) — activityType `corpan_city:<toolId>` (spec passthrough)

corpan-city already speaks this contract in miniature; the work is a thin adapter,
not a refactor. **The internal `ChallengeSpec`/`ChallengeResult` contracts and the
NPC/quest flow are unchanged** — no migration of on-disk Track state, no server
changes.

**Type mapping (normative):**

| ActivitySpec | ChallengeSpec (`contracts/src/challenge.ts:14-24`) |
|---|---|
| `activityType` = `"corpan_city:" + toolId` | `toolId` (one of the 20 implemented `ChallengeToolId`s; legacy aliases resolve via `LEGACY_ALIAS`, `registry.ts:48-56`) |
| `specId` | `challengeId` |
| `targetLang` | `language` |
| `nativeLang` | `nativeLanguage` |
| `level` | `level` |
| `itemRefs` (kind `"phrase"`) → `Number(ref.id)` | `entryIds` (see caveat below) |
| `params` | `params` (merged over `buildSpec` output as `partialSpec`, exactly like NPC tool-calls) |
| — | `mode: "solo"` (always, for journey) |

Caveat: `ChallengeSpec.entryIds` is `number[]` with no source; the adapter passes
refs with `source !== "base"` through `params.entrySources = { [id]: source }` and
the pack's `ChallengeRuntimeHost.getEntriesByIds` implementation forwards the
source to `hostApi.getEntryById(id, source)`. (City's own quests only mint base
entries today; this keeps phrase-pack refs correct without widening the frozen
city contract.)

| ChallengeResultPlus (`challenge.ts:26-70`) | ActivityResult |
|---|---|
| `challengeId` | `specId` (must round-trip) |
| `score` (0..1) | `score` |
| `detail` (Record<string, number>) | `detail` |
| `outcome: "aborted"` | `abandoned: true` |
| `completedAt`, `xp`, `rewards`, `sig`, `playerId`, `offline` | dropped — Journey's CelebrationLayer + FSRS replace the city economy for journey launches (city standalone keeps all of it) |
| — | `perItem`: see below |
| — | `durationMs`: measured by the adapter around `runChallenge` |

**perItem synthesis.** Most city tools score one aggregate over their spec entries.
The adapter emits one `ActivityItemResult` per `itemRef` with outcome binned from
the aggregate score: `pass` ≥ 0.8, `partial` ≥ 0.4, else `fail` (0.8 aligns with
the city's own item-rarity tier). Tools that DO have per-entry verdicts internally
(memory-pairs, tap-translation, …) may later populate
`ChallengeResult.detail["item:<entryId>"] = 0|0.5|1`; when such keys are present
the adapter uses them instead of binning. v1 ships with binning only.

**Choke point — `src/journey/adapter.ts` (new, in-pack) wired in `mount`:**

```ts
// corpan-city main mount, before booting the Babylon world:
const spec = initialState?.activity as ActivitySpec | undefined
if (spec) return mountJourneyChallenge(container, hostApi, spec)  // world never boots
```

`mountJourneyChallenge`:
1. parses `toolId` from `activityType` (strip `"corpan_city:"`; unknown/unimplemented
   → `hostApi.journey?.abandon("unsupported")` + `corpan:exit`),
2. builds a `ChallengeContext` from the spec (`language/nativeLanguage/level/
   entryIds`; `domains/levels` from `params.contentFilter` if the engine sent one),
3. builds the real `ChallengeRuntimeHost` over `hostApi` (the same adapter the city
   world uses — it is already a thin typed wrapper over HostApi, `challenges/host.ts`),
4. calls `runChallenge(toolId, ctx, chHost, { container, partialSpec, uiLanguage:
   spec.nativeLang })` — which never rejects (cancel ⇒ score 0, `outcome:"aborted"`,
   `registry.ts` doc block) — so the adapter's mapping is total,
5. maps `ChallengeResultPlus → ActivityResult`, calls `reportResult`, dispatches
   `corpan:exit`.

This is the "challenge library without the city" path the report identified
(`mockChallengeHost` proves the tools run standalone). No Colyseus, no Babylon,
no Track state is touched on a journey launch. City's multiplayer/economy stays
standalone-only, consistent with offline-first Journey.

**Migration note for city itself (later, optional):** once the contract is stable,
`@corpan-city/contracts` MAY re-export `ActivitySpec`/`ActivityResult` from its own
vendored copy and express `ChallengeSpec` as the city-local specialization. Not
required for v1; the adapter isolates the seam.

---

## 7. Model-residency contract (`modelNeeds`)

Facts this encodes (D8, pack-contract.md §1.10-1.11): the 3.3GB LLM and ~1.5GB
whisper cannot co-reside on ≤8GB phones; `hostApi.dispose()` unloads LLM + whisper
on every pack switch (`hostApi.ts:280-309`); the Budget Arbiter's refcount store is
Phase-2 but `models.budget()/fits()` answer today.

**Semantics of `ActivitySpec.modelNeeds`:**

1. **It is a declaration, not a load request.** The provider still calls
   `stt.prepare()` / `llm.load()` itself and still feature-detects — `modelNeeds`
   tells the HOST what the provider will ask for, ahead of mount.
2. **`"tts"` is always satisfiable** (native voices, no residency cost) — declared
   only so the scheduler can respect audio-context constraints (never two
   TTS-speaking cards racing). It never blocks a launch.
3. **`"stt"` and `"llm"` are mutually exclusive per spec in v1.** The engine MUST
   NOT mint a spec with both; the host rejects such specs at
   `beginActivitySession` (logged, card skipped) rather than gamble on jetsam.
   (GB-class phones can't hold both; revisit when the Budget Arbiter's
   `whatFitsAlongside` is real.)

**Host serialization rules (the scheduler + feed controller enforce; providers
just declare):**

- **Batching**: the feed mixer batches specs by model need — STT cards arrive in
  contiguous blocks, LLM cards in contiguous blocks, never interleaved model-swap
  by model-swap (D8). `PackActivityDeclaration.modelNeeds` feeds the plan for
  pack cards; native STT cards (speak-after-me) join the same blocks.
- **Pre-flight**: before launching a pack card with `modelNeeds` containing
  `"stt"` or `"llm"`, the feed controller checks
  `hostApi.models.fits({ residentMB: need === "llm" ? 2500 : 1500 })`; on
  `fits: false` it triggers the eviction rule below, and if still unfit it skips
  the card this session (the mixer substitutes a no-model card; the spec returns
  to the queue).
- **Eviction rule**: evict whatever resident model is NOT in the incoming spec's
  `modelNeeds` (LLM via `llm.unload()`, whisper via `stt.unload()`), never both
  preemptively. Between two same-need cards, nothing is evicted — that is the
  entire point of batching.
- **Dispose stays**: `hostApi.dispose()` on pack unmount keeps unloading models
  (`hostApi.ts:299-301`). Journey does NOT keep pack models warm across cards in
  v1 — batching amortizes the reload for *native* STT cards (which don't remount
  packs); pack STT/LLM cards pay one load per mount and are therefore scheduled
  as anchor/celebration-scale events, not every-card fillers (D8's "worth their
  mount cost").
- **Memory oracle**: `SttStatus.availableMemoryMB/physicalMemoryMB`
  (`types.ts:169-172`) via `models.budget()` is the truth source; on devices
  reporting `physicalMB < 6000`, the scheduler additionally caps LLM-need cards
  to explicit user-initiated slots (same policy knob as D4's debt brake —
  engine-spec territory, noted here because the contract's `modelNeeds` is its
  input).

---

## 8. Error / abandon / timeout semantics

The invariant: **every begun session produces exactly one terminal
`ActivityResult`**, so the engine never leaks a "pending" card and the feed never
stalls waiting.

| Scenario | What happens | Terminal result |
|---|---|---|
| **Natural completion** | Pack calls `reportResult` then `corpan:exit`. | Pack's result, `abandoned` absent. |
| **User swipes away / taps Home / `corpan:exit` mid-activity** | Overlay unmounts → feed controller's teardown calls `endActivitySession()` → synthesis from the item buffer. | `{abandoned: true, perItem: buffered, score: passed/attempted (0 if none), durationMs}` , meta `reason: "user_exit"`. |
| **Provider bails** (own quit UI, unsupported spec, content unavailable) | Pack calls `journey.abandon(reason)` (then `corpan:exit`). | Same synthesis, with the provider's reason (`"unsupported"`, `"error"`, `"user_exit"`). |
| **Pack crash at mount** (`ContentPackHost` load error, module didn't register) | Feed controller observes the overlay error state (existing ErrorBoundary/fall-back-to-Home pattern, `App.tsx:797-804`) and calls `endActivitySession()`. | Synthesis, `reason: "error"`, empty `perItem`. |
| **Pack crash mid-run** (unhandled exception inside the pack) | Nothing crosses the boundary; the user exits or the ErrorBoundary fires → one of the two rows above. | Synthesis. |
| **Invalid result payload** (Zod fail) | Dropped + warn + analytics; session stays open — the pack may retry; otherwise unmount synthesis catches it. | Eventually synthesis unless a later valid result lands. |
| **Late/stale result** (previous card's specId, result after terminal) | Dropped + warn. | Unaffected. |
| **timeboxSec elapsed** | NOTHING is force-killed. `timeboxSec` is advisory: (a) scheduler slotting input, (b) providers MAY show a timer and self-complete at the box (reporting normally — that's a completion, not an abandon). The host never synthesizes a `"timeout"` on its own in v1; the reason value is reserved for providers that self-report a timeout bail. |
| **App backgrounded mid-activity** | Existing pause conventions (`corpan:host-pause`/`resume`, pack-local visibility pausing) apply; the session stays open across the pause. If the OS kills the process, the session was never terminal — the engine treats never-terminal launches found at next boot as `abandoned/"user_exit"` with no items (the session registry is in-memory by design; no persistence of half-open sessions). |

**Engine-facing note (consumed by the D4 spec, stated here as contract):**
`abandoned: true` results are engagement signals, not knowledge evidence, for the
*unfaced* items — items absent from `perItem` receive NO FSRS review. Items present
in `perItem` are graded normally whether or not the envelope is abandoned. The
scalar `score` on abandoned results is informational only.

---

## 9. Quota interaction (D9 wiring, contract-level)

- The host debits the **`journey` quota** (new row in
  `packs/shared/monetization/src/quotas.ts`) when it *enqueues/mounts* a card —
  including pack-activity cards.
- Providers MUST NOT debit their own pack gate for journey launches: the shared
  gate helper grows one check — skip counting + never dispatch
  `corpan:daily-locked` when the mount carried `initialState.activity` (providers
  pass that fact into their gate setup). Standalone launches keep today's caps
  unchanged.
- The daily lock, when Journey's quota is exhausted, is rendered by the HOST on
  the feed (never inside a pack card), clearly labeled monetization, per D9.

---

## 10. File-change inventory & changelogs

| Unit | Change | Changelog |
|---|---|---|
| `corpan-app` | NEW `src/contentPacks/activityContract.ts`, NEW `src/contentPacks/activitySchemas.ts`, NEW `src/journey/activitySession.ts`; edits: `types.ts` (re-export + PackLaunchEntry.activity + manifest.activities + HostApi.journey), `hostApi.ts` (journey seam), `ContentPackHost.tsx` (initialState spread, dep list, HOST_CAPS.journey), `contentPacks/catalog.ts` (CatalogV3Entry.activities + filter forward), `package.json` (+zod ^4.4.3) | `corpan-app/CHANGELOG.md` [Unreleased]: "Journey activity contract: ActivitySpec/ActivityResult host seam (`hostApi.journey`), `corpan:activity-result` fallback, HOST_CAPS.journey, manifest/catalog `activities`." |
| `packs/sdk` | NEW `activityContract.d.ts` (generated), NEW `sync-contract.mjs`; edits: `index.d.ts` (re-export + `journey?`), `index.js` (mock journey, mountStandalone `activity`) | `packs/sdk` changelog entry. |
| CI | ci-gate step: `node packs/sdk/sync-contract.mjs --check` | — |
| `lingo-hero` | journey mode: pinned ContentManager pool + journey WordSelector, `wave-resolved` reporter, `maxRounds`, Leitner-off under journey | pack CHANGELOG. |
| `earthgate-reader` (+ `packs/shared/catalog` appShell) | journey routing in appShell, `segmentRange` clamp, reportItem/reportResult | pack + shared-catalog CHANGELOGs. |
| `corpan-city` | `src/journey/adapter.ts` + mount branch; manifest `activities` (20 tools) | pack CHANGELOG. |
| `packs/shared/monetization` | journey quota row + gate skip-when-journey option | shared CHANGELOG. |

Sequencing: corpan-app + SDK land first (the seam is inert without the Journey
surface); providers instrument independently afterwards; catalog `activities`
fields ship with each provider's next publish. Preview channel + devMode
throughout, per trunk rules.

---

## 11. Explicitly out of scope (parked, not forgotten)

- Mid-session re-tasking without remount (`corpan:launch-entry` host→pack event /
  `journey.onSpec(cb)`) — v2 if native-card pre-mounting proves insufficient for
  pack cards.
- Event-rail fallback for `reportItem`/`abandon`.
- Leitner→FSRS one-shot import for lingo-hero standalone history.
- `discoverPacksByType` implementation (catalog `activities` covers discovery
  for v1).
- Per-entry verdicts from corpan-city grid tools (`detail["item:<id>"]`
  convention reserved, unimplemented).
- Keeping pack models warm across journey cards (Budget Arbiter Phase-2).
