# CTO Resolutions — Design Review Round 1

**Status: BINDING. 2026-07-03.** The four-lens adversarial panel returned
`needs-changes` on all lenses. Every blocker is ruled on below. Spec editors apply
these rulings verbatim — do not relitigate; if a ruling is unimplementable, escalate
with evidence, don't improvise. Risk/polish items from the panel are tracked in the
specs themselves as non-blocking notes.

## R1 — One course-pack spec (kills the duplicate-artifact blocker, all 4 lenses)

`course-pack.md` is **normative** for: SQLite DDL (its §2 — skills/item_skills/strings
are non-negotiable for the engine and D6), manifest/index/S3 layout, versioning,
catalog module, validation gates. `authoring.md` is rewritten as the **content
authoring layer**: unit YAML (WITH `skills:` blocks per course-pack §5.1), the grammar
inventory, item-assignment pipeline, census, overlays, lint — all **compiling to**
course-pack.md's DDL and layout. Its §2 DDL, §0 layout, and V-I18N-1 (app-locale
minting) are deleted; course copy ships in the pack `strings` table (D6 independence).
One merged validation-gate list lives in course-pack.md (renumber V-1..V-n);
authoring.md references it. Tool names: `build_journey_pack.py`,
`validate_journey_pack.py`, `publish_journey_pack.py`. Zip: `journey_en-0.1.0.zip`
(underscore, installer rule). Unit id grammar: course-pack's (`en.a1.u07` style).

## R2 — ItemRef: colon serialization, one helper, one source table

Canonical, immutable-forever key: `<kind>:<source>:<id>`. Rule: kind/source never
contain `:`; id may; parse on the first two colons. `itemRefKey()` and
`serializeItemRef()` collapse to **one function** in `activityContract.ts`;
activity-contract.md's pipe form and its rationale are replaced. `char` source is
**`hanzipan`**. Phoneme ids use course-pack's sorted-IPA contrast form. One
kind/source/id table lives in activity-contract.md §1; course-pack.md and engine.md
cite it. Add the cross-spec test: pack `items.id` round-trips through the one helper.

## R3 — `detail` becomes a small typed envelope (contract-level fix)

On both `ActivityResult` and `ActivityItemResult`:
`detail?: { numbers?: Record<string, number>; flags?: Record<string, boolean>;
selfReport?: 'already-knew' | 'never-learned'; stt?: { overallScore: number;
perWord?: Array<{ word: string; probability: number; startMs: number; endMs: number }> } }`.
`sttUnavailable` is `flags.sttUnavailable`. `aggregateBinned` is `flags.aggregateBinned`
(see R9). Zod schemas regenerated to match. engine.md §4.2 deletes its re-declared wire
types and quotes the contract file verbatim (type-only import; targetLang present,
`level?: string`, `params?`). Grade rows re-keyed to the envelope paths.

## R4 — One activityType registry, snake_case, in the contract

`ACTIVITY_TYPES` exported const in `activityContract.ts` with per-type metadata
`{ activityType, form, strand, guessable, estSec, modelNeeds }` — the ten feed-ux
renderers: `choice_pick, listen_pick, listen_type, cloze, word_order, match_pairs,
flip_recall, speak_echo, intro_echo, grammar_note`. Translation direction is a PARAM
of choice_pick/listen_type/cloze, not a type; `read-segment` → earthgate/segment
provider card; `etym-gem` → rare-card face, not a schedulable type. Pack types are
`<packId>:<name>`. Authoring recipes/bosses and gate V-7 validate against the vendored
constant (CI drift check like sync-contract.mjs). This registry also feeds the engine's
activityTemplates (see R7) — one metadata source.

## R5 — Engine owns session structure; runtime.ts maps, never invents

Engine's card type is renamed **`EngineCard`**; the surface's discriminated union keeps
`FeedCard`. The engine **gains a lesson/checkpoint layer** (the pedagogically honest
option): CourseGraph loads lesson_recipes/unit_lessons/checkpoints/rare_cards; the
mixer fills recipe slots when a unit lesson is active; unit bosses emit as checkpoint
batches whose `pass_score` gates position advancement, failures route to REPAIR
(remedial); arc gates likewise. `FeedConstraints` gains `checkpointCadence` (derived
from goalIntensity). Engine emits: checkpoint cards (with summary), a welcomeBack
signal from `startSession()` (gap ≥ 7 days; retainedPct = mean retrievability over
seen cards), and `rareVariant` selected by the seeded PRNG over the pack's rare_cards.
`journey/runtime.ts` maps EngineCard → FeedCard 1:1 and synthesizes ONLY `blockIntro`
(at modelNeeds run boundaries) — no other behavior invention in the runtime. Both
specs update to this exact division.

## R6 — Grade application joins by key, never by position

`applyResult` looks up `itemRefKey(per.itemRef)` in the issued spec's item set;
grades matches only; warn-and-drop refs not issued; issued-but-absent = no evidence.
Mandatory unit test: shuffled, subset perItem.

## R7 — The PackReader → CourseGraph loader gets a normative section (course-pack.md)

Exact SQL per CourseGraph field; **keyset pagination** over `intro_order`
(`WHERE intro_order > ? ORDER BY intro_order LIMIT 1000`, loop until short page) —
the Rust `content_packs_query_db` hard-caps at 2,000 rows and truncates SILENTLY
(`lib.rs:30-31, 1147-1148`), so course-pack.md's "nothing needs pagination" claim is
deleted; row-count assertion vs `pack_meta.item_count` (mismatch = hard boot error,
never silent). Native-template metadata comes from the R4 registry. `substituteIds` =
same-skill items with `substitutable=1` ordered by intro_order. Add build-time
`textLen` column. One importance scale with its engine-weight mapping. Cold-start
budget: full graph load < 500 ms on reference low-end Android at v0.1 scale; per-arc
lazy loading is specced (not built) before Arc 2 ships.

## R8 — One abandon path; the grace timer dies

`activitySession.ts` is the single owner; typed rail and event rail both call the same
ingest. Feed-ux's 300 ms grace timer and `{score: 0, perItem: []}` synthesis are
**deleted** — packs report before `corpan:exit` (already normative); overlay teardown
calls `endActivitySession()` which synthesizes from the buffered `reportItem` evidence
(partial work is never lost). Feed consumes the result callback from
`beginActivitySession`; it never re-implements routing.

## R9 — Synthesized per-item evidence must be distinguishable from measured

The corpan-city adapter emits `perItem` ONLY for tools with genuine per-item evidence.
Aggregate-only tools report score-only (engine row 8 caps apply). If any provider ever
synthesizes per-item outcomes, each carries `flags.aggregateBinned: true` and the
engine clamps grades to [Hard, Good] — never Again. Written into the contract as a
normative provider rule.

## R10 — Placement respects the content ceiling

The band ladder caps at the max item `b` in the installed pack. Phase 2 terminates
early with outcome `above-content` when `θ̂ − max_b > margin`; PlacementResult carries
honest copy ("this course currently covers A1; you're past it" — house no-absolutes
rules apply). Sim gate P8 runs against the real journey_en pack graph, not only the
fixture, with personas scoped to shipped arcs.

## R11 — Story content is CUT from v0.1 (schema stays)

Story lessons and the storyChapter rare card leave v0.1 units and rare tables (schema
support remains). Units that scheduled them re-pool to listen-heavy input. Follow-up
v0.2 workstream (named, not now): graded A1 micro-story narration pack + per-segment
known-token lists computed at build/install (Intl.Segmenter + irregular-form map onto
word items) so the 95% coverage gate is real before it gates anything.

## R12 — Quota meters NEW intake only (pay-to-not-forget is dead)

Debit = completed **debut** cards (first-ever presentation of an item) + pack-anchor
launches. Due-review, replay, and repair cards are NEVER metered — matching the
parlometron dignity precedent exactly. One debit site in `runtime.ts`; feed-ux §7.2
and activity-contract §9 both reference it. Free-tier N stays the operator's call.

## R13 — v0.1 content is buildable from real inventory

- New named workstream: build `phrase-people-nationalities` and
  `phrase-life-time-and-dates` gap packs (existing tools/phrase-packs pipeline),
  sequenced BEFORE pack build. Shopping/home units re-pool to base corpus where the
  census supports it or defer to v0.2.
- v0.1 unit anchors restricted to: `lingo_hero`, `earthgate` (or cap-segment-player),
  `corpan_city`, and capability modules `cap-pronounce`, `cap-squeeze` (in v1 scope
  per D14). beatlounge/hover_runner/tutomaton/stargate anchors are v0.2 swaps —
  pack data upgrades independently of the app.

## R14 — The content resolver gets its own spec (new file)

`specs/content-resolver.md`: `journey/content/resolve.ts` — `ResolvedItem` type,
exact queries per ItemRef kind (phrase/word/char/segment/grammarNode/phoneme/concept),
and the **distractor sampler contract**: pool = same-skill/near-b items; exclusions —
never a valid alternate answer for the prompt, distractor language = answer language,
dedup against recent cards; deterministic under seeded PRNG. Owned by the feed/build
team; renderers develop against it in the fixture slice.

## R15 — Platform-spec alignments (Phase 2b)

- engine.md persistence consumes **`EnginePersistence` from storage-analytics.md**;
  the D5 "review-log ring buffer" IS the local analytics AppendLog (one source,
  engine + queries as readers). No second copy.
- feed-ux/HomeHub image work rides `specs/offline-cache.md` (`<OfflineImage>`); the
  journey pack index is a cachedFetch resource (TTL 300s policy).
- capability-modules v1 set: `cap-pronounce`, `cap-squeeze`, `cap-segment-player`.
  `speak_echo` renders via cap-pronounce. Styling/packaging rules per that spec
  (@shared alias, no Tailwind in modules, prefixed CSS).

## R17 — Simulator-gate rulings on the W11 calibration evidence (2026-07-03)

Per `scripts/journey-sim/CALIBRATION.md` (rounds 1–2, 3-seed evidence):
- **P8 target amended to |θ̂−a| ≤ 0.8 @ ≥90%** (was 0.6). The ±0.6 leg sits at the
  information floor of ≤25 guessable probes (σ=0.40, unbiased); the adaptivity spec
  itself calls precision beyond ±half a CEFR band (0.75) illusory for author-assigned
  b. With the R10 ladder-cap fix + SE guard + self-heal (4/4 all seeds), placement is
  accepted. Measured under the amended target: 94/94/100% per seed.
- **P1/P3/P4: option A adopted** — the §7.1 fixed-ability synthetic learner is the
  defect (real learners acquire skill; churner items eventually pass). A future W11
  round amends the learner model with slow skill acquisition and re-derives targets;
  until then P1/P3/P4 are recorded "pending learner-model amendment", NOT gating.
  Knob-tuning against the current model is banned (round-2 evidence: every bundle
  that helps P1/P3 breaks P7/P10).
- **P7 metric amended** to ≥90% of days in-band (max-over-days is noise-limited at
  low daily volume).
- **P11 relaxation-rate regression** (0.30–0.32/batch vs <0.2, pre-existing on the
  W10 tip, zero hard violations; hypothesis: type-restricted recipe/boss slots make
  same-type adjacency structurally tight) — queued as a named follow-up workstream;
  not preview-blocking (feel-quality telemetry, not correctness).
- Spec-literal sync (engine.md leech/throttle/retention literals → the new constants
  names) rides the same follow-up.

## R16 — Panel risks worth pinning now (non-blocking)

Each spec editor appends a short "Tracked risks" section preserving their lens's
risk list verbatim (they inform build-time tests; none gate the build start).
