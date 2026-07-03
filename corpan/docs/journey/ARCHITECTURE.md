# Journey — Architecture Decisions

**Status: v0.9 (post–Phase 1 synthesis, pre–adversarial review). Owner: CTO/integrator.**
Inputs: `codebase/*.md` (6 subsystem maps), `research/*.md` (5 foundations). Each decision
cites the finding that forced it. Detailed specs elaborate under `specs/`.

---

## D1 — Journey is a native surface in corpan-app, not a pack

The feed, the engine, and the core exercise renderers live in `corpan-app/src/journey/`.

Why: packs mount one-at-a-time, full-screen, with heavy dispose semantics (LLM/whisper
unload per switch — `hostApi.ts:280-309`); a feed hopping packs per card would pay a
remount + model-reload per 30-second activity. Core cards must be instant. The engine
needs the stores, IndexedDB, and the corpus sampler directly. Packs remain first-class
*activity providers* for anchor/rare cards (D8), never the spine itself.

## D2 — The Activity ABI: `ActivitySpec` in, `ActivityResult` out

One contract for every activity, native or pack. Shape adapted from corpan-city's proven
Zod `ChallengeSpec`/`ChallengeResult` (the fleet's only existing activity ABI —
`experiences-games.md`), promoted into `corpan-app/src/contentPacks/types.ts` + the SDK.

- `ActivitySpec`: `{ specId, activityType, itemRefs: ItemRef[], params, level, timeboxSec?, modelNeeds?: ('stt'|'llm'|'tts')[] }`
- `ActivityResult`: `{ specId, score: 0..1, perItem: { itemRef, outcome: 'pass'|'partial'|'fail', latencyMs?, hintsUsed? }[], detail?, durationMs, abandoned? }`

Transport: host→pack via the existing `PackLaunchEntry` seam widened with
`activity?: ActivitySpec` (`types.ts:39-52`, flows through `mount(container, hostApi,
initialState)` already — `ContentPackHost.tsx:549-558`). Pack→host via new
`hostApi.journey.reportResult(result)` with a `corpan:activity-result` CustomEvent
fallback for SDK-lagging packs. Capability discovery: pack manifests declare
`activities: [{ activityType, itemKinds, requiredHostApis }]`, surfaced catalog-first
(same OTA pattern as recommendation metadata); host advertises the seam in
`__CORPAN_HOST_CAPS`. `manifest.sdkVersion` stays decorative — compatibility remains
additive-optional members + feature detection (the codebase's real, working convention).

## D3 — `ItemRef`: one address space for every learnable thing

`{ kind: 'phrase'|'word'|'char'|'segment'|'grammarNode'|'phoneme'|'concept', source, id }`

All content already has stable, FSRS-keyable ids: phrases = `(packId|base, entryId)`
(immutable authoring order), words = `(word, lang)`, hanzi = `char`, book segments =
`(bookId, chNN-SSS)`, images = concept key. Grammar nodes and phonemes are minted by the
course pack. Nothing is renamed; Journey references, never forks, existing content.

## D4 — The engine: FSRS-6 + derived mastery + one ability scalar, pure TS

Per `research/adaptivity.md`, adopted wholesale:

- **Scheduler**: FSRS-6 via `ts-fsrs` (MIT), default 21 weights, retention 0.90,
  short-term params ON (same-session replay of fails), learning steps OFF (the feed *is*
  the intra-session pacing). Grades derived deterministically from `ActivityResult`
  (fail→Again, hints/slow→Hard, normal→Good, fast+first-try→Easy; MC capped at Good).
- **No BKT/DKT**: skill mastery is *derived* on read = coverage × mean retrievability ×
  recall-accuracy EWMA over the skill's items. Item cards are the single source of truth.
- **One Elo/IRT scalar θ** per (stack, course), against static author-assigned item
  difficulty `b` shipped in the course pack — drives placement and difficulty targeting.
- **Placement**: 3-phase adaptive probe (band ladder → Elo refinement to SE<0.45 →
  frontier confirmation), ≤25 items / ~5 min; known items lazily seeded `priorKnown`.
- **Feed mixer**: `nextFeedItems(n)` = slot-template sampler (due ~35% / new ~35% /
  repair / fun / flex) + interleaving constraints (no same activityType adjacent, ≥3-card
  item gap, warm-win opener, failed-card replay at gap ≥3) + strand-balance enforcement
  over a rolling window (Four Strands, stage-tilted ratios — `research/pedagogy.md` §12).
- **Difficulty moves on exercise FORM** (recognition→cued recall→production) and
  new-intake rate — never backward on path position. Cruise ⇒ offer Jump checkpoint
  (test-out). Debt brake: new intake pauses when due-queue > 1.5× daily capacity.
- **Packaging**: `corpan-app/src/journey/engine/` is a pure TS module, zero DOM/Tauri
  imports — simulatable with synthetic learners on the Spark before shipping.

## D5 — Storage: IndexedDB LARGE tier, keyed (stackId, courseId)

ItemCards (~64B × up to ~25k ≈ 1.6MB) + a ~20k-row review-log ring buffer go in the
existing IndexedDB LARGE-tier pattern (`store/catalog.ts:185-188`) — the 5MB localStorage
budget has already overflowed once and is off-limits for per-item state. Journey
meta-state (position, streak v2, settings) is a small zustand persist store,
`corpan-journey-v1`, following house conventions (partialize + version/migrate).

## D6 — Course packs: one per TARGET language, data-only, wordpan-precedent

`journey_<target>` (e.g. `journey_en`) is a new data-only pack kind:
built by `dja/journey_pack/` → SQLite + manifest (`entryType: "data"`, `databases` map)
→ immutable ZIP at `s3://corpan-prod/artifacts/corpan/journey-packs/` → own `index.json`
(accumulate-merge, max-age 300) → app-side `journeyPackCatalog.ts` cloned from the
wordpan module → `content_packs_install_from_url` + generic read-only
`content_packs_query_db`. **Zero Rust changes** (`content-data.md` §6). Preview channel
first.

Contents: units (7 arcs → ~192 unit specs), skill DAG, grammar-node graph, item table
(ItemRef, unit, static difficulty `b`, intro order, importance, probe flag), lesson
recipes, rare-card tables, checkpoint/boss specs. **L1 scaffolding is data, not forks**:
54-language instruction/note strings ride the existing translation machinery; contrastive
overlays (transfer traps, cognate pre-credits, phoneme-diff pairs) are keyed by
`(l1, target)` in overlay tables — one spine, no 54×54 explosion. The learner's stack
already encodes `(native=languages[0], target)`, selecting overlays at runtime.

## D7 — The feed UX

Full-screen cards; complete → celebrate → scroll/auto-advance (next card pre-mounted;
scroll-back read-only). Checkpoint card every 8–12 with equal-weight stop/continue —
compulsion with designed stopping points, per the ethics rules in
`research/engagement.md`. One host-owned **CelebrationLayer** (4 juice tiers + intensity
setting) so every provider gets feedback free. Variable-ratio **rare cards** are the
reward economy (delight variants ~1:8, mini-game rounds ~1:25, etymology gems ~1:50,
story chapters gated on measured 95% vocab coverage); no gems/currency; rarity never
purchasable; no lives/energy (measured neutral at Duolingo). Streak v2 extends
`store/progress.ts` + `StreakChip` (earned rest days 1/7 cap 2, learning-priced repair,
never purchased). Progress viz: P0 = simple arc/unit path; P1 = per-language
constellation (stars ignite/brighten/dim with retrievability; placement pre-lights =
endowed progress). Entry: `LandingIntent` union + a Journey hero card on HomeHub;
onboarding graph gains journey nodes (it was designed for this). KPI: CURR ×
learning-events per returning day — never minutes-on-app.

## D8 — Pack activities are anchor/rare cards; core cards are native

~8–10 native exercise renderers cover the everyday cards (picture-choice, listen-type,
cloze, word-order, speak-after-me via STT, match, cued-recall flip, read-segment,
etymology gem, grammar-note + micro-drill). Pack rounds (lingo-hero wave, juice-squeeze
bottle, hover-runner run, corpan-city challenge, reader chapter) arrive as scheduled
anchor cards or rare-card rolls — worth their mount cost as celebration-scale events.
Model residency is serialized by the scheduler using `ActivitySpec.modelNeeds` (3.3GB
LLM + 1.5GB whisper cannot co-reside on ≤8GB phones; the Budget Arbiter is unbuilt).
STT/LLM cards are batched into blocks, never interleaved model-swap by model-swap.

## D9 — Journey gets its own quota surface

The feed cannot be starved by per-pack daily caps (10–20 units — `experiences-ai.md`).
New `journey` quota in the central registry (`packs/shared/monetization/src/quotas.ts`,
remote-config overridable): free tier = N feed cards/day (generous; exact N is a product
call), Plus = unbounded. Pack activities launched *by* Journey debit the journey quota,
not the pack's. Standalone pack launches keep their existing caps. No dark patterns:
the daily lock stays what it is today — monetization, clearly labeled, never disguised
as pedagogy.

## D10 — Content gap pipeline (build-side, on the Spark / in dja)

Priority-ordered; none blocks the app skeleton:
1. **Frequency ranks** for EN items (wordfreq, MIT) — annotate the item table at pack
   build; per-target lists acquired language-by-language as courses ship.
2. **Grammar-node graph for EN** (~300 ordered nodes): mined from CEFR grammar profiles,
   LLM-drafted, human-spot-checked. The main authoring lift; journey-en and journey-es
   prove the format before scaling.
3. **Missing phrase domains** for early units (nationalities, time, shopping, home) —
   small dja phrase packs, existing tooling.
4. **CEFR relabel** of the 7B-model labels — later, via codex; treat current labels as a
   weak prior (they only seed `b`, which self-corrects through Elo).
5. **Transfer-trap / cognate matrices** per (l1, en) — start with es→en, LLM-drafted,
   shipped as overlay data.
6. **imagepan** (per `research/images.md`): one language-neutral concept pack,
   ~2,300 objects + ~50 hotspot scenes, ~55MB WebP, generated on the Spark (SD3.5
   pipeline at `~/projects/image-gen`; FLUX.1-dev outputs banned by license), concreteness-
   gated (≥4.0), heavy A0–A1. Ships as its own data pack; picture-choice renderer
   consumes it natively.

## D11 — v1 scope (this branch)

Ship on preview channel, devMode:
- `journey/` surface: feed, ~8 native exercise types, CelebrationLayer, checkpoints,
  path viz P0, streak v2 P0, placement flow, i18n keys ×54 locales (build gate).
- Engine: FSRS-6 + mixer + placement + θ, pure TS + simulation harness.
- Contract: ActivitySpec/Result + ItemRef in types.ts + SDK, hostApi.journey,
  PackLaunchEntry widening, HOST_CAPS flag, manifest `activities` declaration.
- Course pack: `dja/journey_pack/` builder + `journey_en` v0.1 with Launchpad + Arc A1
  (~30 authored units), frequency-ranked items over existing phrase corpus + wordpan refs.
- Providers instrumented: lingo-hero (wave-resolved → per-item results — its pack-local
  Leitner store is retired in journey context; FSRS is the one scheduler), earthgate
  (segment-range param + result), corpan-city (spec passthrough — it already speaks this).
- Quota seam + entitlement wiring.
Explicitly out of v1: constellation viz, imagepan content (schema stubs only), teletron/
world-radio (online-only → optional side-quests later), tutomaton grading, notifications,
on-device FSRS optimization, journey-zh (spec'd to prove generality, built after).

## D12 — Offline-first cache with online revalidation (operator directive, 2026-07-03)

Everything works offline; being online only means things quietly get fresher. The house
pattern is **cache-first, revalidate-when-appropriate**: every remote read (catalogs,
indexes, cover images, pack metadata) hits a local persistent cache first and renders
from it immediately — *including cold-start offline* — then, if online, revalidates in
the background per an explicit per-resource policy (TTL / ETag) and updates in place.
The current behavior where Home catalog images vanish offline is the named bug this
kills. One shared cache layer (spec: `specs/offline-cache.md`), used by HomeHub,
catalogs, Journey course-pack discovery, and packs via the host API — not N ad-hoc
fetch wrappers. Journey ships on it; the rest of the app migrates to it.

## D13 — Storage discipline + local analytics (operator directive, 2026-07-03)

localStorage is reserved for **true global state** (small, hot, synchronous: settings,
stack config, landing intent). Everything else — per-item learning state, review logs,
caches, transcripts, media — lives in IndexedDB or the Tauri filesystem behind typed
adapters with quotas, batching, and corruption recovery. New capability: a **local
analytics store** — an append-only, on-device event log (activity results, card
impressions, session shapes; ring-buffered, never uploaded) that powers engine
calibration, the predicted-vs-actual difficulty report, "ghost of you" personal
records, and future FSRS weight optimization. Spec: `specs/storage-analytics.md`.

## D14 — Shared capability modules: pop into the tech, not the pack
## (operator directive, 2026-07-03)

The reusable **guts** of experiences are extracted into shared modules
(`packs/shared/` workspace precedent) that both the owning pack and Journey — and any
other pack — can mount: e.g. `@corpan/pronounce` (parlometron's whisper-score round:
record → score → per-word feedback UI), `@corpan/squeeze` (juice-squeeze's
reveal-a-phrase round), reader segment player, corpan-city challenge tools. A capability
module is a mountable micro-component with the signature
`mount(container, hostApi, spec: ActivitySpec) → Promise<ActivityResult>` — the same
ABI as everything else (D2), just in-process. This enables **cross-pollination**:
pronunciation-score the phrase you're looking at in Phrase Flip or a reader segment;
Journey composes any capability inline without pack-mount cost. Full pack rounds (D8)
remain for anchor/rare cards; capability modules are how everyday cards borrow another
experience's technology. Extraction is incremental — start with pronounce + one game
round; never fork logic, always move it. Spec: `specs/capability-modules.md`.

## Open decisions parked for the operator

- Free-tier N for the journey quota (D9) and default streak stance (opt-in vs pact).
- Whether goalIntensity (captured, unused) maps to session-shape defaults.
- CEFR descriptor licensing (paraphrase-only until confirmed).
