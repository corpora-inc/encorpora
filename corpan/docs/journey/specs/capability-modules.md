# Shared Capability Modules — Pop Into the Tech, Not the Pack

**Status: v1.0 implementable spec. Elaborates ARCHITECTURE D14 (with D2's ABI and D8's
division of labor taken as settled). App-wide platform capability: Journey ships on it,
the rest of the app migrates to it.**

Verified against: `packs/corpan-city/src/challenges/{registry,host,overlay}.ts` +
`packs/corpan-city/contracts/src/challenge.ts` (the working precedent),
`packs/pronunciation-coach/src/{game,main,parlometron,modelRegistry,whisperTuning,scoringTuning,whisperLangs}.ts`,
`packs/juice-squeeze/src/{hooks/useGameLogic.ts,util/*,components/*,state/gameStore.ts}`,
`packs/earthgate-reader/src/{game.ts,main.ts,rendering/paragraphView.ts}`,
`packs/shared/{audio,core,data,ui,sdk,monetization}`, `corpan-app/vite.config.ts:91`,
`corpan-app/src/contentPacks/{types,hostApi}.ts`, `corpan-app/src/util/wordPack.ts` +
`components/WordExplanationText.tsx` (pop-in precedent),
`docs/journey/codebase/{experiences-ai,experiences-games,experiences-readers,pack-contract}.md`,
`docs/journey/specs/course-pack.md` (§1 ItemRef).

---

## 0. Overview

A **capability module** is the reusable guts of an experience — parlometron's
record→score→per-word-feedback round, juice-squeeze's drag-to-rebuild round, the readers'
word-synced segment player — extracted into `packs/shared/capabilities/<name>/` so that
**the owning pack, Journey, and any other pack** can mount it in-process:

```
mount(container, hostApi, spec: ActivitySpec) → { result: Promise<ActivityResult>, pause, resume, dispose }
```

Same ABI as everything else (D2), zero pack-mount cost. This is *not* D8's pack-round
mechanism: full pack mounts (lingo-hero wave run, hover-runner run, the city) remain
anchor/rare cards worth their remount + model-reload price. Capability modules are how
**everyday cards** and **cross-pollination pop-ins** ("pronounce the phrase you're looking
at, right here") borrow another experience's technology without leaving the current
surface.

The proof this works already ships: corpan-city's ~20 micro-challenge tools run through
`runChallenge(toolId, ctx, host, opts)` with a serializable spec, resolve a normalized
result, **never reject** (cancel ⇒ score 0, `registry.ts:117-127`), and run fully
standalone against `mockChallengeHost()` with zero native deps (`host.ts:396-500`).
This spec generalizes that pattern fleet-wide and binds it to the Journey ABI.

Extraction is incremental and **never forks logic — it moves it**: the owning pack
becomes the first consumer of the moved code in the same PR, and keeps shipping
throughout (§4).

### Naming and the three first modules

| Capability id | Import specifier | Extracted from | Round |
|---|---|---|---|
| `cap-pronounce` | `@shared/capabilities/pronounce` | pronunciation-coach (Parlometron) | show phrase → push-to-talk record → whisper score → per-word pill feedback |
| `cap-squeeze` | `@shared/capabilities/squeeze` | juice-squeeze | prompt phrase → drag shuffled words into order → reveal/win |
| `cap-segment-player` | `@shared/capabilities/segment-player` | earthgate-reader (+ `@shared/audio`/`core`/`data`) | play narration segment range with word-sync highlight → completion |

Directory = `packs/shared/capabilities/{core,pronounce,squeeze,segment-player}/`.
Each capability directory carries a `package.json` with `"name": "@corpan/cap-<name>"`,
`"private": true` — a *label* for future workspace formalization and for size-budget
tooling; the consumption mechanism is the `@shared` source alias (§3), not npm.

---

## 1. The Activity ABI (shared with D2 — canonical types)

`docs/journey/specs/activity-contract.md` does not exist yet; until it lands, **this
section is the canonical elaboration of D2's shapes**. If a dedicated activity-contract
spec is written later, it owns these types and this spec defers to it; the shapes below
restate D2 verbatim and only pin field types.

**Single source of truth in code**: `packs/shared/capabilities/core/src/activity.ts`.
`corpan-app/src/contentPacks/types.ts` **re-exports** from `@shared/capabilities/core`
(corpan-app already imports `@shared/*` — `vite.config.ts:91`, `tsconfig.json:28-30`;
`contentPacks/types.ts` already does this for other shared types). The SDK mirror
(`packs/sdk/index.d.ts`) gets a documented copy for packs that don't import `@shared` —
but every capability *consumer* imports `@shared/capabilities/core` directly and never
touches the SDK copy, which is what kills the SDK-drift failure mode for this contract
(§3.2). This satisfies course-pack.md §1's "add to types.ts" as a re-export, not a
second definition.

```ts
// packs/shared/capabilities/core/src/activity.ts

/** D3/course-pack.md §1. Serialization: `${kind}:${source}:${id}`. */
export type ItemKind =
  | "phrase" | "word" | "char" | "segment"
  | "grammarNode" | "phoneme" | "concept"

export interface ItemRef { kind: ItemKind; source: string; id: string }
export function serializeItemRef(r: ItemRef): string
export function parseItemRef(s: string): ItemRef | null
// (implementations exactly as specified in course-pack.md §1)

export type ModelNeed = "stt" | "llm" | "tts"

/** D2: one contract for every activity, native or pack or capability. */
export interface ActivitySpec {
  /** Unique per issued activity instance (engine-minted or `popin-*`, §5). */
  specId: string
  /** What to run. For capabilities this is the capability id, e.g. "cap-pronounce". */
  activityType: string
  /** The learnable things this activity exercises (FSRS-keyable, D3). */
  itemRefs: ItemRef[]
  /** Capability-specific parameters. Each capability publishes a typed interface (§4). */
  params?: Record<string, unknown>
  /** CEFR level hint (course-static, informational to the module). */
  level?: string
  /** Soft time budget. Modules SHOULD auto-settle a result when it elapses. */
  timeboxSec?: number
  /** Models that must be resident for this activity. The SCHEDULER serializes
   *  residency (D8); the module may assume its declared needs were arbitrated. */
  modelNeeds?: ModelNeed[]
}

export type ItemOutcome = "pass" | "partial" | "fail"

export interface ActivityPerItem {
  itemRef: ItemRef
  outcome: ItemOutcome
  latencyMs?: number
  hintsUsed?: number
}

export interface ActivityResult {
  specId: string
  /** Normalized 0..1 (corpan-city ChallengeResult precedent, challenge.ts:30). */
  score: number
  perItem: ActivityPerItem[]
  /** Capability-specific evidence (e.g. the whisper word timings). JSON-serializable. */
  detail?: Record<string, unknown>
  /** Active wall-clock ms, EXCLUDING paused time (§2.3). */
  durationMs: number
  /** True when the run ended without a completed attempt (dispose-before-settle,
   *  timebox expiry with zero interaction, cancel). Engine grades abandoned ≠ fail. */
  abandoned?: boolean
}
```

Notes:

- `perItem.itemRef` is the **object** form (matches D2). The engine serializes with
  `serializeItemRef` for FSRS keying; capabilities never serialize.
- `score` and `outcome` are both required: `score` feeds θ/analytics, `outcome` feeds
  FSRS grade derivation (D4).
- Everything in `ActivitySpec`/`ActivityResult` must survive `structuredClone` — the
  same spec object is used for in-process capability mounts *and* (via
  `PackLaunchEntry.activity`, D2) cross-boundary pack launches. No functions, no DOM.

---

## 2. The capability-module contract

```ts
// packs/shared/capabilities/core/src/capability.ts
import type { ActivitySpec, ActivityResult, ModelNeed } from "./activity"
import type { CapabilityHostApi } from "./hostSlice"

export interface CapabilityHandle {
  /**
   * Settles EXACTLY ONCE with the run's result. NEVER rejects (runChallenge
   * precedent, corpan-city registry.ts:117-127): internal errors resolve
   * `{ abandoned: true, score: 0, detail: { error } }`.
   */
  result: Promise<ActivityResult>
  /**
   * Freeze the run: stop timers, pause audio, cancel any in-flight recording
   * session (mic released). Idempotent. Wired by hosts to `corpan:host-pause`
   * and by Journey to card-offscreen.
   */
  pause(): void
  /** Undo pause. Idempotent. Does not replay lost stimulus automatically. */
  resume(): void
  /**
   * Tear down DOM, listeners, audio, STT sessions (MUST call `stt.releaseAudio`
   * if a session was opened — iOS mic-indicator rule, hostApi.ts contract).
   * If `result` has not settled, it settles first with `abandoned: true`.
   * Idempotent; safe to call after settle.
   */
  dispose(): void
}

export type CapabilityMount = (
  container: HTMLElement,
  hostApi: CapabilityHostApi,
  spec: ActivitySpec,
) => CapabilityHandle

export type CapabilityAvailability =
  | { state: "ready" }
  /** Runnable after a download the user must approve. */
  | { state: "needs-model"; model: ModelNeed; sizeMB?: number }
  | { state: "needs-content"; kind: "narration" | "data-pack"; packId: string; sizeMB?: number }
  /** Never runnable here (platform / permanently missing host seam). */
  | { state: "unavailable"; reason: string }

export interface CapabilityMeta {
  /** `cap-<name>`, matches ActivitySpec.activityType. */
  id: string
  /** Semver of the module's OWN contract (params/detail shape). */
  version: string
  modelNeeds: ModelNeed[]
  /** The CSS class prefix this module owns (§2.4), e.g. "capPron". */
  cssPrefix: string
  /** Optional HostApi members the module uses (feature-detects all of them). */
  usesHostApis: string[]
}

export interface CapabilityModule {
  meta: CapabilityMeta
  mount: CapabilityMount
  /**
   * Cheap, side-effect-free probe: can this spec run right now on this host?
   * MUST NOT download anything or load models (parlometron rule: prepare() is
   * local-only — game.ts:1899).
   */
  checkAvailability(
    hostApi: CapabilityHostApi,
    spec?: ActivitySpec,
  ): Promise<CapabilityAvailability>
}
```

Every capability package's `index.ts` exports exactly one
`export const capability: CapabilityModule` plus its typed params interface and any
consumer helpers.

### 2.1 `CapabilityHostApi` — the host slice

Following the corpan-city discipline ("declare only the slice we touch",
`host.ts:110-114`), capabilities do **not** import the app's `HostApi` type. Core
defines a structural subset that the real `createHostApi()` object, any pack's
vendored `hostApi`, and the mock (§7) all satisfy:

```ts
// packs/shared/capabilities/core/src/hostSlice.ts
export interface CapabilityStackConfig {
  languages: string[]          // [0]=native/UI, [1..]=targets (SINGLE_LANGUAGE_RULE)
  rate?: number
  showRomanization?: boolean
  levels?: string[]
}

export interface CapabilityHostApi {
  // Required core (every host has these — sdk/index.d.ts 5-method core):
  speak(uiCode: string, text: string): Promise<void>
  getStackConfig(): CapabilityStackConfig

  // Optional — feature-detect, degrade gracefully:
  stopSpeech?(): Promise<void>
  stt?: CapabilitySttApi        // mirror of the slice parlometron uses (game.ts:93-190)
  queryPackDb?(q: {
    sql: string; params?: unknown[]; dbName?: string; packId?: string; maxRows?: number
  }): Promise<{ columns: string[]; rows: unknown[][] }>
  entitlement?: { isSubscribed(): boolean }
  isMock?: boolean
}
```

`CapabilitySttApi` is the typed mirror of `SttApi` as parlometron declares it today
(`pronunciation-coach/src/game.ts:93-190`: `prepare`, `startSession`, `stopSession`,
`cancelSession`, `releaseAudio?`, `subscribeAudioLevel?`, `getStatus`,
`installModel?`, `listInstalled?` + the 18-field `SttTranscriptionResult` and
`SttWordTiming`). Those type declarations **move** into core as part of the
cap-pronounce extraction (§4.1) — they become the fleet's one copy.

Rule: a capability MUST work (possibly degraded, or report `unavailable`) when any
optional member is missing. `checkAvailability` is where "degraded" vs "unavailable"
is decided *before* mount, so schedulers never mount a dead card.

### 2.2 Content flows through the spec, not the module

Capabilities do **not** select content. No `getRandomEntries` in the host slice: the
consumer (Journey engine, owning pack's loop, pop-in sheet) resolves the phrase /
segment range / word list first and passes concrete text + `itemRefs` in
`ActivitySpec.params`. This is the single biggest lesson from the games audit
("all content selection is random inside the pack" is the gap — experiences-games.md
§7.1); capabilities are born addressable.

Exception: `cap-segment-player` reads installed narration *assets* (audio, manifests)
via URLs/preloaded data the consumer resolves (§4.3) — still no selection.

### 2.3 Lifecycle semantics (normative)

1. **Mount is synchronous and cheap.** Heavy async work (model prepare, audio decode)
   starts inside mount but must render a visible skeleton immediately (parlometron's
   `cardSkeleton` precedent, game.ts:1124).
2. **`params.startPaused: true`** (honored by every capability): mount fully rendered
   but frozen until first `resume()`. This is how the Journey feed pre-mounts the next
   card (D7) without audio/mic side effects.
3. **Result settles exactly once**, on: user completes the round; timebox expires
   (auto-settle with whatever was measured; `abandoned: true` iff zero interactions);
   `dispose()` before settle (`abandoned: true`).
4. **`durationMs` excludes paused time.** Modules keep an active-time accumulator,
   not `Date.now() - mountTime`.
5. **After settle, the module freezes its final frame** (result card stays visible);
   celebration is the HOST's job (D7 CelebrationLayer) — capabilities render verdict
   *information* (pills, scores), never confetti. (`launchConfetti` stays in the
   parlometron pack, game.ts:742.)
6. **Model residency**: modules never call `llm.load`/model installs on their own
   during a run. `modelNeeds` on the spec is the arbiter's input; a module finding its
   model unexpectedly absent at mount settles `abandoned` with
   `detail.error = "model-unavailable"` (scheduler bug — surfaced, not hidden).
7. **No window events.** Capabilities are in-process: they communicate through the
   returned handle only. `corpan:*` events remain the pack↔host rail; a *pack* hosting
   a capability translates as needed (e.g. maps its own `corpan:host-pause` listener
   to `handle.pause()`).

### 2.4 Styling isolation (the Tailwind problem)

There is no iframe and no Shadow DOM anywhere in the pack system — pack CSS is
injected into the host document (`ContentPackHost.tsx:497-526`), where
**corpan-app's Tailwind 4 build (including preflight) is always present**. A capability
additionally runs inside arbitrary consumers: the Tailwind-styled app (Journey cards),
prefix-styled vanilla packs (`pc-*`, `jsf-*`, `wp-ch-*` are the existing conventions),
and future packs we don't control. Rules:

1. **No Tailwind. Ever.** A capability must not emit utility classes (`flex`, `p-4`,
   …): in-app they'd silently bind to the app's Tailwind theme; in a pack without a
   Tailwind build they'd style nothing; two packs building Tailwind with different
   configs would fight. Hand-rolled CSS only.
2. **One owned prefix per capability**, registered in `CapabilityMeta.cssPrefix` and
   unique fleet-wide: `capPron-`, `capSqz-`, `capSeg-`. Every selector in the module's
   stylesheet starts with `.capPron-…` (or is nested under the root class). No bare
   element selectors, no `:root`, no `*`. CSS custom properties are namespaced
   `--capPron-*`. (Existing prefixes stay reserved: `pc-`, `jsf-`, `wp-`, `na-`.)
3. **Defend against preflight, don't rely on it.** The root class
   (`.capPron-root`) sets an explicit baseline for everything the module renders:
   `box-sizing: border-box`, `font-family` (system stack — offline rule, no remote
   fonts), `line-height`, `color`, and explicit styles on `button`/`input` descendants
   (Tailwind preflight nukes button backgrounds; a vanilla pack's UA styles don't —
   the module must look identical in both).
4. **Container-relative layout only.** Fill the given `container` (`position:
   absolute; inset: 0` on the root is fine — the container establishes the box). No
   `position: fixed`, no viewport units (`vh/vw/dvh`), no `env(safe-area-inset-*)` —
   a Journey card is an inset box, not the screen; the host owns safe areas. (This is
   the concrete behavioral difference from the code's pack life, where `.jsf-app`
   reads safe-area insets — that styling stays behind in the pack shell.)
5. **CSS ships as a plain `.css` import** from the capability's `index.ts`
   (`import "./styles.css"`) — vite bundles it into the consumer's built stylesheet
   exactly like `packs/shared/ui/commandDrawer.css` does today. No runtime injection
   helper, no duplication concerns (one import site per consumer bundle).
6. **z-index discipline**: internal stacking only (`isolation: isolate` on the root);
   never above the consumer's chrome.

### 2.5 Size discipline

Budgets are enforced in CI (§7.4) per capability, measured as the min+gzip delta the
module adds to a bare consumer bundle (script builds a probe entry importing only the
capability):

| Capability | JS budget (gz) | CSS budget (gz) | Notes |
|---|---|---|---|
| `cap-pronounce` | 55 KB | 8 KB | vanilla TS; includes tuning tables + 54-locale strings for its own chrome |
| `cap-squeeze` | 95 KB | 8 KB | includes React + dnd-kit closure when consumer has neither (§4.2) |
| `cap-segment-player` | 35 KB | 6 KB | `@shared/audio`/`core`/`data` counted (they're deps) |
| `core` | 6 KB | 0 | types are free; mock host is dev-only (`import` from `core/mock`, never from `core`) |

General rules: no new runtime dependencies without a spec change; bare imports
(`react`, `zustand`) resolve from the **consumer's** `node_modules` (source-alias
consumption, §3.1), so frameworks dedupe automatically where the consumer already has
them (corpan-app and juice-squeeze both ship React → zero added React bytes there);
54-locale string tables for module chrome are capped at the keys the module actually
renders (~30 keys for cap-pronounce, not parlometron's 5,169-line `i18n.ts`).

---

## 3. Packaging model

### 3.1 Decision: workspace **source import** via the `@shared` alias (vendored at build)

Capabilities are TypeScript source packages under `packs/shared/capabilities/<name>/`,
consumed exactly like every existing `packs/shared/*` module:

- **A pack consumes one** by adding two alias entries and importing:

  ```jsonc
  // <pack>/tsconfig.json  (earthgate-reader/tsconfig.json:17-24 pattern)
  "paths": {
    "@shared/capabilities/core": ["../shared/capabilities/core/index.ts"],
    "@shared/capabilities/pronounce": ["../shared/capabilities/pronounce/index.ts"]
  }
  ```
  ```ts
  // <pack>/vite.config.ts  (earthgate-reader/vite.config.ts:184-185 pattern)
  resolve: { alias: {
    "@shared/capabilities/core": path.resolve(__dirname, "../shared/capabilities/core"),
    "@shared/capabilities/pronounce": path.resolve(__dirname, "../shared/capabilities/pronounce"),
  }}
  ```

  The capability compiles **into the pack's IIFE bundle** at build time. The pack
  remains a self-contained web bundle (pack-contract §0 — nothing changes at the
  host↔pack boundary).

- **corpan-app consumes one natively** through the wildcard alias that already exists
  (`corpan-app/vite.config.ts:91` `"@shared" → ../packs/shared`,
  `tsconfig.json:28-30`): `import { capability } from "@shared/capabilities/pronounce"`.
  Journey card renderers lazy-load via dynamic `import()` for code-splitting (§6.1).

**Why source import and not npm publish:** there is no npm registry in this repo's
loop, no workspace root `package.json`, and `packs/shared/{catalog,monetization,ui,…}`
already prove the pattern across both readers *and* corpan-app — including shipping CSS.
Publishing adds a version-bump/install dance to every change with zero consumers outside
this monorepo.

**Why this doesn't repeat the SDK-drift mistake:** the SDK drifted because packs
**vendor-copy** its *types* into `src/sdk/types.ts` per pack and the copies rot
independently (pack-contract §5: SDK `HostApi` already lacks a dozen members). Shared
capability code has exactly **one source file**; consumers reference it, never copy it.
What source-import does share with the SDK model is *build-time* binding: a shipped
pack bundle carries the capability as of its last build, so **version skew across
shipped bundles is inherent** (people don't update; OTA packs meet old hosts).
That skew is handled where the codebase already handles it — the ABI:

1. `ActivitySpec`/`ActivityResult` evolve **additive-optional only** (the proven
   compatibility convention, pack-contract §5).
2. A capability's `params`/`detail` shapes are versioned by `CapabilityMeta.version`;
   breaking a param is a major bump and a repo-wide consumer sweep (all consumers are
   in-repo — `grep -rn "@shared/capabilities/pronounce" packs/ corpan-app/` is total).
3. The capability↔host seam is only `CapabilityHostApi` — a structural subset of what
   every host has shipped for versions; new optional members follow feature detection.

One discipline requirement, stated plainly: **changing a capability requires rebuilding
+ republishing consumer packs to propagate** (same as changing `@shared/catalog` today).
The capability's CHANGELOG (§3.3) lists consumers to rebuild.

### 3.2 Package layout

```
packs/shared/capabilities/
  core/
    package.json          # { "name": "@corpan/cap-core", "private": true }
    index.ts              # exports activity.ts + capability.ts + hostSlice.ts types
    src/activity.ts       # ActivitySpec/ActivityResult/ItemRef — CANONICAL (§1)
    src/capability.ts     # CapabilityHandle/CapabilityModule/CapabilityMeta/Availability
    src/hostSlice.ts      # CapabilityHostApi + CapabilitySttApi (+ SttTranscriptionResult)
    src/result.ts         # clamp01, makeAbandonedResult(spec, detail?), settleOnce guard
    mock/index.ts         # createMockCapabilityHost (§7.1) — dev/test only, separate entry
    contract.test.ts      # generic contract suite runner (§7.3)
  pronounce/
    package.json          # @corpan/cap-pronounce
    index.ts              # export const capability; export type CapPronounceParams
    src/…                 # §4.1
    styles.css            # .capPron-* only
    strings.ts            # ~30 chrome keys × 54 locales
    harness/index.html + main.ts + (fixtures/)   # §7.2
    CHANGELOG.md
  squeeze/ …              # §4.2 (React inside; DOM boundary)
  segment-player/ …       # §4.3
```

`core` must not import from any capability; capabilities import only `core`,
other `packs/shared/*` modules, and their listed deps. Nothing under
`packs/shared/capabilities/` may import from `corpan-app/` or from any pack
(same direction rule as the rest of `packs/shared/`).

### 3.3 Changelogs and versioning

Capabilities are not independently shippable units; per `corpan/CHANGELOGS.md`, a
user-visible change lands in **each consuming unit's** `[Unreleased]` (the pack, or
corpan-app for Journey). Additionally each capability keeps a local `CHANGELOG.md`
(provenance + "consumers to rebuild" list) and bumps `CapabilityMeta.version`
(semver: patch = internal, minor = additive params/detail, major = breaking — requires
same-PR consumer sweep).

---

## 4. Extraction plans — the first three modules

Common refactor doctrine (applies to all three): every step leaves the owning pack
green (`npm run typecheck` + its tests + manual harness) and shippable; moves are
`git mv` where possible; the pack deletes its old copy **in the same PR** that points
it at the moved code (never two live copies); CSS class renames to the capability
prefix happen at move time with the pack consuming the renamed classes.

### 4.1 `cap-pronounce` — from pronunciation-coach (Parlometron)

The whisper-score round: show target text (+ romanization + native gloss) → hold-to-
record → `stt.stopSession` returns the 18-field `SttTranscriptionResult` → verdict
headline + per-word pills tiered by `WordTiming.probability` × free-decode similarity →
tap a pill to hear the word.

**Moves into `capabilities/pronounce/src/`** (from `packs/pronunciation-coach/src/`):

| Source | → destination | What it is |
|---|---|---|
| `whisperLangs.ts` (80 ln, whole file) | `whisperLangs.ts` | scorable-language gate (whisper's fixed ~99-lang set, `jv→jw` alias, yue excluded) |
| `whisperTuning.ts` (330 ln, whole file) | `whisperTuning.ts` | per-language `WhisperParams` overrides incl. `initial_prompt` priming |
| `scoringTuning.ts` (227 ln, whole file) | `scoringTuning.ts` | per-(lang, model) `ScoringParams` overlays |
| `modelRegistry.ts` (480 ln, whole file) | `modelRegistry.ts` | 7-tier model ladder + memory gating (`modelRegistry.ts:95-106`) + fp16 ban |
| `game.ts:93-190` (`SttWordTiming`, `SttTranscriptionResult`, `SttApi`, `SttErrorCode`, `errCode`, `formatErr`) | `core/src/hostSlice.ts` | the STT type slice — becomes the fleet's one copy (§2.1) |
| `game.ts:452-577` (`isRTL`, `normalizeForCompare`, `tokenizeForPills`, `charSimilarity`, `mergeApostropheWords`) | `text.ts` | script-aware comparison + pill tokenization |
| `game.ts:644-668` (`newSessionId`, `whisperLang`) | `session.ts` | session ids + lang mapping |
| `game.ts:1423-1834` (`renderResult`, pill tiering `heardTier`/`freeTier`/`pillClass`, transcript rows, diagnostic chips, `speakInTarget`) | `resultView.ts` | the per-word feedback UI |
| `game.ts:1835-2122` (`cancelActiveSession`, `startRecording`, `stopRecording`, `tryPrepareOnce`, `prepareWithMemoryRetry`, `ensureLoaded`, `beginMicHold`/`endMicHold`) | `recorder.ts` | push-to-talk + prepare/retry state machine |
| `game.ts:1149-1208` slice (`updateLangBadge`, target/romanization/gloss card body — the round card, not the deck) | `roundView.ts` | stimulus rendering |
| relevant `styles.css` rules (`pc-word`, `pc-transcript-*`, result banner/bars, record button) | `styles.css` | renamed `pc-` → `capPron-` |
| ~30 chrome keys from `i18n.ts` (verdict tiers, "couldn't hear", "heard you say", chips, aria labels) | `strings.ts` | 54-locale subset; pack's `i18n.ts` keeps its full table for pack chrome |

**Stays pack-specific** (`pronunciation-coach` keeps): `parlometron.ts` mode picker +
`multiplayer/`; phrase acquisition + deck (`fetchOneEntry`, `goNext`/`goPrev`,
`prefetchInBackground`, history persistence `corpan-pronunciation-coach:v2`,
`slideTo` card deck); streak + quota (`updateStreak`, `updateQuotaBadge`,
`paywall.ts`, `parlometron_daily`); the full model-setup UI (`openModelSetup`,
`runSetup` install/download flow, game.ts:2123-3215) and `whisperTunerUI.ts` (the
726-line tuner is a dev tool, not round guts); `silenceWatcher.ts` (unwired); zoom
block, confetti, exit wiring.

**Typed params + result mapping:**

```ts
export interface CapPronounceParams {
  /** REQUIRED. The exact text to pronounce (target language). */
  text: string
  /** BCP-ish corpan code of `text`. Must pass `isScorableLang` or availability = unavailable. */
  lang: string
  romanization?: string
  /** Native gloss shown under the stimulus (omit on single-language stacks). */
  nativeText?: string
  /** "installed-only" (default for Journey feed) never triggers install UI;
   *  checkAvailability reports needs-model instead. "offer-install" renders the
   *  module's minimal inline install prompt (pop-in surface). */
  modelPolicy?: "installed-only" | "offer-install"
  /** Attempts allowed before auto-settle (default 3; best attempt wins). */
  maxAttempts?: number
  /** Speak the target once on first resume (default false). */
  autoSpeakFirst?: boolean
  startPaused?: boolean
}
```

Result: `score` = best attempt's `overallScore` (clamped 0..1). One `perItem` entry
per `spec.itemRefs` (normally exactly one — the phrase/word/segment being pronounced)
with outcome from the pack's proven verdict tiers (game.ts:1462-1470 comment: confetti/
streak only ≥ 0.85): `pass ≥ 0.85`, `partial ≥ 0.6`, else `fail`; `latencyMs` = ms
from stimulus visible to first recording start; `hintsUsed` = replays of the target
TTS. `detail` = `{ attempts, best: { overallScore, transcriptScore, acousticScore,
likelihoodScore, noSpeechProb, freeText, words: SttWordTiming[] }, model, whisperLanguage }`
— the full evidence D13's analytics store wants, finally crossing the pack boundary.
`modelNeeds: ["stt"]` (+"tts" is NOT declared — OS TTS is free, hostApi.speak is core).

`checkAvailability`: `unavailable` if `!hostApi.stt` or lang unscorable; `needs-model`
(with ladder-appropriate sizeMB from `modelRegistry`) if `stt.listInstalled` finds
nothing usable; else `ready`. Never downloads (prepare is local-only).

**Refactor steps (pack ships at every step):**

1. Create `capabilities/{core,pronounce}`; `git mv` the four whole files
   (`whisperLangs/whisperTuning/scoringTuning/modelRegistry`); move the STT type block
   to `core/hostSlice.ts`; point the pack's imports at `@shared/capabilities/*`
   (alias entries added). Zero behavior change. Ship.
2. Extract `text.ts`/`session.ts`/`recorder.ts`/`resultView.ts`/`roundView.ts` out of
   `game.ts` with the pack calling the moved functions directly (same call sites,
   imported). Rename CSS classes to `capPron-` in the moved stylesheet; pack imports
   it and deletes the superseded `pc-` rules. Ship — this is the risky diff; verify
   with the pack's on-device flow + harness (§7).
3. Write `capabilities/pronounce/index.ts` (`capability.mount` composing
   roundView + recorder + resultView + settle logic per §2.3) and convert the pack's
   practice loop: `mountGame`'s per-phrase body becomes *fetch phrase → mount
   capability with a spec → await `handle.result` → update streak/quota/history →
   slide to next card*. The pack's deck/swipe chrome wraps the capability container.
   Delete the now-dead round code from `game.ts`. Ship (pack version bump; behavior
   identical to the user).
4. Wire the two new consumers: Journey `speak-after-me` card (§6) and the pop-in
   sheet (§5). Neither touches the pack again.

### 4.2 `cap-squeeze` — from juice-squeeze

The phrase-reveal round: prompt phrase on top (target lang), the block-language
words shuffled in a bank, drag into order; win = exact order (RTL-aware, CJK-aware);
assist affordances = ear (speak answer) and eye (silent reveal / give-up).

**Moves into `capabilities/squeeze/src/`** (from `packs/juice-squeeze/src/`):

| Source | → destination | What it is |
|---|---|---|
| `util/tokenizer.ts` (171 ln), `util/readingOrder.ts`, `util/rtl.ts`, `util/blockSizing.ts` | same names | script-aware tokenize + RTL reading order + block sizing math |
| `hooks/{useBlockSizing,useFitText,useWinDetection}.ts` | `hooks/` | layout + exact-order win check |
| `components/{TargetPhrase,WordBank,WordBlock,SentenceArea}.tsx` | `components/` | the round UI (dnd-kit) |
| `useGameLogic.ts` round slice: placement handling + `checkWin` dispatch (:420-432), `speakAnswer`/`showGiveUp`/`closeGiveUp` (:434-455), win-flash + phrase-scoped state | `round.tsx` | orchestrator for ONE phrase |
| `state/gameStore.ts` phrase-scoped slice (`phrase`, `bankOrder`, placed words, `checkWin`, `loadPhrase`) | `roundStore.ts` | zustand WITHOUT persist — round state dies with the handle; meta-progression stays in the pack |
| relevant `game.css` rules for bank/blocks/sentence/target | `styles.css` | renamed `jsf-` → `capSqz-` |

**Stays pack-specific**: `util/phraseLoader.ts` + `util/languagePair.ts` (content
selection — the capability receives resolved text); the entire juice economy
(`liquid/` Pixi vessel, `state/fruits.ts` BOTTLES_PER_LEVEL, jars/baskets/coins,
`jarFly`/`basketCarry`, level-complete modals, `BottleGauge`/`CoinCounter`/
`ScoreBar`); `audio/SfxEngine` + win choreography timings (`POUR_DELAY` etc.,
`useGameLogic.ts:51-60`); history hooks; persisted `"juice-squeeze-game-state"` store.

**Framework note (explicit decision):** the round is React + dnd-kit today; a vanilla
rewrite would fork logic, which D14 forbids. The module stays React **internally**;
the boundary is DOM: `mount` calls `createRoot(container.appendChild(rootEl))` and
`dispose` unmounts it. `react`/`react-dom`/`@dnd-kit/*` are bare imports resolved from
the consumer's `node_modules` → corpan-app and juice-squeeze dedupe to zero added
framework bytes; a vanilla consumer must add those deps (documented in the
capability README) and pays the ~95 KB budget (§2.5).

**Typed params + result mapping:**

```ts
export interface CapSqueezeParams {
  /** REQUIRED. The sentence to rebuild, in the block language. */
  text: string
  /** REQUIRED. Language of `text`. */
  blockLang: string
  /** Prompt shown at top (usually the other language's rendering). */
  promptText?: string
  promptLang?: string
  /** Pre-tokenized words; when absent the module tokenizes (CJK-aware). */
  words?: string[]
  /** Allow the eye (silent reveal) affordance. Default true. */
  revealAllowed?: boolean
  /** Speak the completed sentence on win (pack behavior). Default true. */
  speakOnWin?: boolean
  startPaused?: boolean
}
```

Result: juice-squeeze has **no failure signal** (audit §2f) — the mapping makes the
proxies explicit: `outcome = "pass"` on completion without reveal; `"partial"` if the
eye reveal was used or completion exceeded a per-word time budget
(`detail.slow: true` at > 6 s × wordCount active time); `"fail"` only on timebox
expiry with the sentence unfinished. `score` = pass 1.0 / partial 0.5 / fail 0
modulated by `-0.1 × min(hintsUsed, 3)`. `detail` = `{ moves, minMoves: wordCount,
revealUsed, earUsed, wordCount, msPerWord }`. `hintsUsed` = ear presses + reveal.
`modelNeeds: []`. `checkAvailability` → always `ready` (core-only host slice).

**Refactor steps:** (1) `git mv` the four `util/` files + the three hooks; pack
imports from `@shared/capabilities/squeeze` internals — ship. (2) Move the
components + extract `round.tsx`/`roundStore.ts`; `useGameLogic` becomes a consumer:
it mounts the round inline (as a React child — the module also exports the raw
`<SqueezeRound>` component for React consumers, so the pack doesn't pay a nested
`createRoot`), passes `onRoundEvent` where `runWin()` used to fire, and keeps all
juice choreography keyed off the round result — ship. (3) Add `capability.mount`
(the `createRoot` wrapper + spec/result mapping) for non-React consumers + Journey.
(4) Pack's `gameplay.test.tsx` keeps passing untouched throughout (it exercises the
composed app).

### 4.3 `cap-segment-player` — from earthgate-reader

The pedagogical core of the readers: play narration segment(s) with word-level
highlight, replay affordance, completion detection. Most of the machinery is
**already shared** (`@shared/audio` `createAudioEngine` — earthgate `game.ts:6,984`;
`@shared/core` `buildTimeline`; `@shared/data` dataProvider) — this extraction is
small and mostly *composes* existing shared modules behind the capability contract.

**Moves into `capabilities/segment-player/src/`** (from `packs/earthgate-reader/src/`):

| Source | → destination | What it is |
|---|---|---|
| `rendering/paragraphView.ts` (244 ln, whole file) | `paragraphView.ts` | word-sync highlight paragraph renderer (classes → `capSeg-`) |
| `game.ts:521-606, 1152-1159` (one-shot segment logic: `oneShotTargetSegment`/`oneShotSegmentEndMs`, tap-to-replay, end-of-segment stop check) | `segmentSession.ts` | generalized to "play segments [i..j], stop at j's end, count replays" — exactly what the audit called "the missing primitive is segment-range addressing" (experiences-readers.md §7.1) |
| `game.ts` data-load slice (`loadSegments`/`loadAudioManifest` wiring + preloaded-data branch, :935-963, 1052-1064) | `dataSource.ts` | thin resolver over `@shared/data` accepting `baseUrl` OR preloaded JSON |

**Stays pack-specific** (earthgate keeps): transport bar / scrubber / chapter overlay
(`@shared/ui`), bookmark store, ALL background-audio machinery (media session, native
keep-alive, wake lock, iOS session recovery — the majority of `game.ts`), appShell
integration (catalog/install/entitlement/narration switching), preview/paywall
(`corpan:request-unlock`), `corpan:segment-progress`/`corpan:book-finished` events.
The capability is a **foreground micro-player**: screen-on, card-sized, no lock-screen
integration. stargate's Babylon renderer is untouched (it can adopt
`segmentSession.ts` later; not in scope).

**Typed params + result mapping:**

```ts
export interface CapSegmentPlayerParams {
  bookId: string
  language: string
  /** Segment ids (`ch01-004`) or an index range. REQUIRED, non-empty. */
  segments: string[] | { fromIndex: number; toIndex: number }
  /** Root URL of the INSTALLED narration pack (consumer resolves via
   *  `@shared/catalog` getPackUrl). Mutually exclusive with preloaded. */
  baseUrl?: string
  /** Preloaded-data path (earthgate initialState precedent, game.ts:935-963):
   *  lets Journey feed synthetic mini-books with no installed pack. */
  preloaded?: {
    segmentsData: unknown; audioManifest: unknown
    resolveAssetUrl: (rel: string) => string   // NOTE: makes the SPEC non-cloneable;
  }                                            // allowed for in-process mounts only.
  autoPlay?: boolean            // default true (after resume when startPaused)
  showText?: boolean            // default true; false = pure listening card
  /** Require every segment fully heard for pass (default true). */
  requireFullListen?: boolean
  startPaused?: boolean
}
```

Result: one `perItem` per segment (`kind: "segment"`, `source: bookId`,
`id: "chNN-SSS"`); `outcome = "pass"` when playback crossed the segment's end,
`"partial"` when ≥ 50 % of its duration was heard, else `"fail"`. `score` = mean of
per-segment completion fractions. `detail` = `{ listenedMs, replays, segmentsCompleted,
totalSegments }`. `latencyMs` unused (exposure activity). `modelNeeds: []` (pre-rendered
audio). `hintsUsed` unused.

`checkAvailability`: with `preloaded` → `ready`. With `baseUrl` absent/unresolvable →
`{ state: "needs-content", kind: "narration", packId }` — the consumer decides whether
to JIT-install (`@shared/catalog` `installNarration`, the shell already does this) or
substitute the card (§6.3). Pause/resume map to `audioEngine.pause()`/`play()` with
`unlock()` on first resume (autoplay policy); dispose calls `audioEngine.dispose()`.

**Refactor steps:** (1) `git mv paragraphView.ts` into the capability (rename classes);
earthgate imports it from `@shared/capabilities/segment-player` — ship. (2) Extract
`segmentSession.ts` from the one-shot logic, generalized to ranges; earthgate's
tap-to-replay becomes `session.playRange(idx, idx)` — ship (this *deletes* the
`oneShotTargetSegment` locals from `game.ts`). (3) Add `dataSource.ts` +
`capability.mount` composing dataSource → `buildTimeline` → `createAudioEngine` →
paragraphView → session, with the §2.3 settle rules. (4) Journey `read-segment` card +
future reader consumers. earthgate's main playback path is untouched (it keeps driving
`createAudioEngine` directly with its background machinery).

---

## 5. Cross-pollination UX: the "pop-in"

**Precedent (the model):** Phrase Flip's long-press word popover —
`WordExplanationText.tsx` (`LONG_PRESS_MS = 450`, deliberate long-press/right-click
only, movement-cancels, post-press tap swallowed) + `util/wordPack.ts` JIT install of
the wordpan data pack when missing. That interaction proved: users discover long-press,
JIT install at point of need converts, and the affordance never interferes with normal
taps.

**The pattern:** long-press any **target-language phrase** anywhere in the app → a
host-owned bottom sheet ("phrase actions") with capability actions. v1 ships exactly
one action: **Pronounce it** → mounts `cap-pronounce` inside the sheet, in-process,
with a synthetic spec:

```ts
// corpan-app/src/components/capability/CapabilityPopIn.tsx  (new, host-owned)
// corpan-app/src/components/capability/usePhrasePopIn.ts    (long-press binding hook)
const spec: ActivitySpec = {
  specId: `popin-${Date.now().toString(36)}`,
  activityType: "cap-pronounce",
  itemRefs: itemRef ? [itemRef] : [],       // known for Phrase Flip entries: phrase:base:<id>
  params: {
    text, lang, romanization, nativeText,
    modelPolicy: "offer-install",           // pop-in MAY offer the whisper download
    maxAttempts: 3,
  } satisfies CapPronounceParams,
  modelNeeds: ["stt"],
}
```

Sheet chrome (drag-dismiss, title, safe-area) is the host's; the capability fills the
sheet body. Dismiss = `handle.dispose()` (abandoned result). On settle, the result is
appended to the D13 local analytics event log (`activity_result` event, surface
`"popin"`). v1 does **not** feed pop-in results into FSRS — the engine may later
consume them as bonus review evidence once calibrated; log-only first.

**Where the affordance appears in v1** (each gated on
`checkAvailability ∈ {ready, needs-model}` — hidden when `unavailable`):

1. **Phrase Flip** (`corpan-app/src/components/MainExperience.tsx`) — long-press on the
   *target-language* phrase row. Host-side, no pack rebuild ("easiest to instrument",
   experiences-ai.md §6). Word-level long-press keeps opening the wordpan popover
   unchanged; the phrase-level target binds outside word hit-targets — the existing
   `WordExplanationText` gesture code is reused via `usePhrasePopIn`, not duplicated.
2. **Journey feed cards** — every native card that displays a target-language phrase
   (cloze, match, read-segment text, etc.) binds `usePhrasePopIn` on its phrase
   element. The pop-in pauses the underlying card (`handle.pause()` on the card's
   capability if any) while open.
3. **Readers / other packs** — deferred past v1 (requires pack rebuilds; the seam is a
   future `__CORPAN_HOST_CAPS.phrasePopIn` flag + a `corpan:phrase-popin` request
   event so a pack can ask the HOST to open the sheet over it; packs never bundle the
   pop-in themselves).

**Quota**: pop-in pronounce attempts are **unmetered**. This mirrors parlometron's
shipped rule ("re-practicing any past phrase is free; only acquiring a NEW phrase is
metered", experiences-ai.md §1.2) — the phrase is already on screen; the pop-in never
acquires content. Journey-issued cards debit the `journey` quota per D9; standalone
pack launches keep theirs. (Operator can revisit; see decisions list.)

---

## 6. Registry & discovery

Capabilities are **code, always bundled** — never installed at runtime. What can be
missing is their *runtime needs*: models (whisper ggml), content (narration packs,
data packs), host seams (no `stt` on an old host). Discovery therefore has two layers:

### 6.1 The capability registry (corpan-app)

```ts
// corpan-app/src/journey/capabilities/registry.ts
import type { CapabilityModule } from "@shared/capabilities/core"

export type CapabilityId = "cap-pronounce" | "cap-squeeze" | "cap-segment-player"

/** Lazy loaders — dynamic import() keeps each capability in its own chunk. */
const LOADERS: Record<CapabilityId, () => Promise<CapabilityModule>> = {
  "cap-pronounce":      () => import("@shared/capabilities/pronounce").then(m => m.capability),
  "cap-squeeze":        () => import("@shared/capabilities/squeeze").then(m => m.capability),
  "cap-segment-player": () => import("@shared/capabilities/segment-player").then(m => m.capability),
}

export function isCapabilityId(t: string): t is CapabilityId
export async function loadCapability(id: CapabilityId): Promise<CapabilityModule>
export async function capabilityAvailability(
  id: CapabilityId,
  hostApi: CapabilityHostApi,
  spec?: ActivitySpec,
): Promise<CapabilityAvailability>   // loadCapability(id).checkAvailability(...)
```

Journey's card renderer for capability activity types
(`corpan-app/src/journey/cards/CapabilityCard.tsx`) mounts through this registry and
maps the handle to the feed lifecycle: pre-mount with `startPaused: true` (D7),
`resume()` on card-active, `pause()` on scroll-away, result → engine
(`reportResult`) → CelebrationLayer.

Packs don't need a registry: a pack imports the specific capabilities it consumes at
build time and calls `capability.checkAvailability` directly.

### 6.2 Scheduling gate

The feed mixer (D4) treats availability as a hard pre-filter: before emitting a
capability card into `nextFeedItems(n)`, the engine consults a session-cached
`capabilityAvailability` snapshot (refreshed on app-foreground and after any
model/pack install event). `modelNeeds` additionally routes through the residency
scheduler (D8) — STT cards are batched into blocks.

### 6.3 Fallback when a capability can't run

| Availability | Feed behavior | Pop-in behavior |
|---|---|---|
| `ready` | schedule normally | show action |
| `needs-model` | at most once per session, schedule an **install-offer card** (host-rendered, shows sizeMB, taps into the pack-owned/STT install flow); otherwise substitute | show action; module renders inline install prompt (`modelPolicy: "offer-install"`) |
| `needs-content` | consumer either JIT-installs (narration via `@shared/catalog`, size-gated) or substitutes | hide action |
| `unavailable` | substitute; never schedule | hide action |

Substitution table (engine-owned, static): `cap-pronounce → listen-type` (native
renderer, same itemRefs), `cap-squeeze → word-order` (native tap-to-order renderer),
`cap-segment-player →` reschedule the segment card and advance the mixer. Substituted
cards keep the itemRefs so spacing is preserved; the mixer logs the substitution to the
D13 event log for calibration.

---

## 7. Test strategy

### 7.1 Mock host — `@shared/capabilities/core/mock`

`createMockCapabilityHost(opts)` extends the proven `mockChallengeHost` pattern
(corpan-city `host.ts:396-500`: deterministic, zero native deps, fully playable):

```ts
export interface MockCapabilityHostOptions {
  stt?: {
    overallScore?: number          // default 0.86 (mockChallengeHost precedent)
    words?: SttWordTiming[]        // default: derived from expectedText, prob 0.9
    freeText?: string
    installedModels?: string[]     // default ["small"]; [] → needs-model paths
  } | false                        // false ⇒ hostApi.stt absent (degradation paths)
  languages?: string[]             // default ["en", "es"]
  speakLog?: (uiCode: string, text: string) => void
  isMock: true
}
export function createMockCapabilityHost(opts?): CapabilityHostApi
```

The mock STT fabricates a full 18-field `SttTranscriptionResult` (word timings spread
across a fake duration) so `cap-pronounce`'s pill UI renders every tier standalone.

### 7.2 Bare harness page — one per capability, mandatory

`packs/shared/capabilities/<name>/harness/{index.html,main.ts}` mounts the capability
against the mock host with knob controls (the corpan-city `resultHarness.ts` +
`qa/*.html`+`*-mount.ts` precedent):

- spec editor (text/lang/params presets incl. RTL + CJK cases), score slider for the
  mock STT, `pause`/`resume`/`dispose` buttons, a live `result` JSON panel.
- `cap-segment-player`'s harness ships a checked-in fixture mini-book
  (`harness/fixtures/mini-book/`: 3-segment `segments.json`, `audio_manifest_en.json`,
  three ~1 s generated tone WAVs, ≤ 60 KB total) consumed via the `preloaded` path.
- Two background modes toggled in the harness: **bare** (UA styles) and **hostile**
  (a checked-in `tailwind-preflight.css` copy + a fake consumer stylesheet defining
  unprefixed `.word`/`.pill`/`.flex` classes) — proving §2.4 isolation both ways.
- Run: `npx vite packs/shared/capabilities/<name>/harness` (each harness dir has a
  10-line `vite.config.ts` with the alias entries). On the Spark, bind `--host 0.0.0.0`
  and hand out the tailnet URL.

### 7.3 Contract suite (vitest, in `core`)

`runContractSuite(loadCapability, makeSpec, makeHost)` — executed by each capability's
`contract.test.ts` (jsdom; `@shared/audio` mocked via a stub AudioContext):

1. `mount` returns synchronously; container is non-empty within one frame.
2. `result` settles exactly once (complete twice → second ignored — settleOnce guard).
3. `dispose()` before settle → resolves `{ abandoned: true }`; container emptied;
   `stt.cancelSession`/`releaseAudio` called iff a session opened.
4. `dispose()` after settle → no throw, no second settle.
5. `pause()`/`resume()` are idempotent; `durationMs` excludes a 200 ms scripted pause.
6. `startPaused` mounts frozen: no `speak`, no `startSession` until `resume()`.
7. Result validates: `0 ≤ score ≤ 1`, `perItem.length ≥ spec.itemRefs.length ? ok :
   documented`, every `perItem.itemRef` ∈ `spec.itemRefs`, `detail` survives
   `structuredClone`.
8. Missing-optional-host degradation: mount with `stt: false` host ⇒ module never
   throws (checkAvailability said don't mount; mounting anyway settles abandoned with
   `detail.error`).

### 7.4 CI gates

- `npm run typecheck` in every consumer (packs + corpan-app) — the alias makes
  capability breakage a consumer compile error, which is the point.
- **CSS prefix lint**: script greps each capability's built CSS for any selector not
  starting with its `cssPrefix` (or `--<prefix>`); fails the build. Lives with the
  pack-catalog CI gate.
- **Size budget check** (§2.5): probe-bundle build per capability, gz-compare against
  the table; fail on exceed.
- Owning-pack regression: juice-squeeze `app/gameplay.test.tsx` and corpan-city's
  challenge conformance tests run unchanged in their packs' suites — the extractions
  must not touch them.

### 7.5 On-device verification

Each extraction step that ships an owning-pack rebuild is verified in the real app
(dev manifest loop, `packs/shared/dev/serve-pack.mjs`) on at least iOS WebKit —
the mic/audio-session behaviors (`releaseAudio`, autoplay unlock) do not reproduce in
jsdom or desktop browsers.

---

## 8. Sequencing (fits the D11 build)

1. `core` (types + mock + contract suite) — unblocks everything; corpan-app
   `types.ts` re-export lands here (with the D2 seam work).
2. `cap-pronounce` extraction steps 1-3 (pack keeps shipping) → Journey
   `speak-after-me` card consumes it (D11 lists STT cards) → pop-in sheet on
   Phrase Flip + Journey cards.
3. `cap-segment-player` (small; earthgate is v0.7.x stable — steps are low-risk
   moves) → Journey `read-segment` card (replaces the D11 plan of remounting
   earthgate for everyday segment cards; the full reader remains an anchor card).
4. `cap-squeeze` (React boundary; juice-squeeze is stable-channel — highest care,
   ship behind its normal release process).
5. Later candidates, same doctrine, explicitly out of v1 scope: `cap-strokes`
   (hanzipan's `scoreStroke`/resample/`distanceToPolyline` geometry, `main.js:380-416`
   — cleanly movable, plain JS), `cap-wave` (lingo-hero's Renderer/LaneSystem — hard:
   Canvas loop + synthesized audio are entangled with Game.ts; lingo-hero stays a
   D8 anchor pack in v1), corpan-city's choice/text/grid tools (already contract-shaped;
   migrate them onto core's types when the city next majors).

---

## 9. Decisions taken here (flag for operator review)

1. **Handle shape** `{ result, pause, resume, dispose }` refines D14's bare
   `→ Promise<ActivityResult>` signature (operator's task directive shape; pause/resume
   is required by the feed's pre-mount + host-pause realities).
2. `specs/activity-contract.md` does not exist; §1 pins D2's types and
   `@shared/capabilities/core` is named their code home, re-exported from
   `contentPacks/types.ts`. A later activity-contract spec inherits ownership.
3. **Source-alias consumption** (build-time vendoring of one shared source) over npm
   packaging — with the explicit rebuild-to-propagate discipline (§3.1).
4. **cap-squeeze stays React internally** (DOM boundary, deps from consumer
   node_modules) rather than a vanilla rewrite — never-fork-move rule.
5. Outcome thresholds: pronounce pass ≥ 0.85 / partial ≥ 0.6 (from the pack's shipped
   verdict tiers); squeeze pass/partial via reveal + time proxies (no fail signal
   exists in the source game); segment pass = fully heard.
6. **Pop-in pronounce is unmetered** (mirrors parlometron's re-practice-free rule);
   pop-in results are analytics-only in v1 (not FSRS input).
7. Pop-in v1 surfaces: Phrase Flip + Journey cards only; packs/readers get the
   host-mediated seam later.
