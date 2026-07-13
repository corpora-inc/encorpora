# Journey Card Architecture — a CardType registry with a hard interface

> **Status:** proposal for CTO + owner review. Locks the API before implementation.
> **Author:** architecture pass, 2026-07-12.
> **Not** an implementation. No `src/` changes accompany this doc. A compact,
> compile-oriented interface sketch lives beside it at
> `docs/journey/card-architecture/CardType.ts`.

## 0. The complaint, stated precisely

> "I thought we were going to be implementing hard interfaces for scalable
> experiences and variety with a great API, not making little adjustments to
> function helpers with a bunch of nested ifs."

The complaint is correct and it points at three specific chains, all in the
surface layer:

1. **Presentation selection** — `runtime.ts prepareExercise` (lines ~454–692) is
   a growing precedence ladder: `maybeGlyphChoice` → `maybeImageChoice` →
   translation-integrity guard → `pickDirection` → context-cloze conversion →
   degenerate multi-token reroute → distractor request. Adding a presentation
   (say Tone Ladder, or a new glyph family) means editing the middle of this
   function.
2. **Advance behavior** — `feed/advanceRules.ts advanceRule` (lines 30–79) is a
   `switch (card.kind)` plus a tail of `if (t === "speak_echo")` /
   `isListeningCard` special cases.
3. **Per-component mode branches** — `exercises/ChoicePick.tsx` carries
   `imageMode` (line 59) and `glyphMode` (line 60) branches, each an
   `if (…) return <different tree>` (lines 113, 166). Every new presentation
   grows this component.

A fourth chain is the render dispatch: `FeedScroller.renderCard` (lines 249–387)
is a `switch (card.kind)` over the whole `FeedCard` union, and the runtime is
littered with `card.kind === "exercise" | "packActivity" | …` structural checks
(`specOf`, `isDebut`, `engineIssued`, the impression/analytics blocks).

**The important observation:** one hard interface already exists and *works* —
`ACTIVITY_TYPES` in `contentPacks/activityContract.ts` (R4, lines 298–309) plus
`EXERCISE_RENDERERS` in `exercises/index.ts` (lines 19–34). Renderer *dispatch*
is already registry-driven (`rendererFor`). What is **not** registry-driven is
everything *around* the renderer: which presentation gets chosen, how it
advances, how its params are built, how it settles. This proposal extends the
existing registry pattern to cover those, rather than inventing a parallel one.

---

## 1. Two registries that compose (the core idea)

There are two genuinely different axes today, conflated inside `prepareExercise`:

- **The schedulable activity type** (`ActivitySpec.activityType`: `choice_pick`,
  `cloze`, `speak_echo`, …). This is the **engine ABI**. The engine/mixer picks
  it from `ACTIVITY_TYPES` (form/strand/guessable/estSec/modelNeeds), FSRS grades
  by `itemRefs`, and every comment in `prepareExercise` guards the invariant that
  presentation upgrades keep `items[0]` as the graded item ("grading/mastery
  unchanged; only the presentation moves"). **We do not touch this.**

- **The presentation / interaction** (glyph grid vs picture grid vs text tiles vs
  cloze vs a whole net-new game). This is what actually varies and what the owner
  wants to be "register a module." Today it is chosen by the `maybe*` ladder and
  rendered by a single component with internal mode branches.

The proposal introduces one new surface-owned registry — **`CardType`** — that
owns the *presentation/interaction* axis, and composes with the existing
`ACTIVITY_TYPES` engine ABI on the *schedulable* axis:

```
ENGINE (unchanged)                     SURFACE (new registry)
─────────────────                      ──────────────────────
mixer picks a schedulable        →     CardType registry picks the presentation
activityType from ACTIVITY_TYPES        that will render THIS scheduled card,
(the R4 ABI: form/strand/…)             by priority-ordered match(); owns prepare,
                                        advance, score, Component, layout.
```

Concretely: a scheduled `choice_pick` on a first-exposure number word offers the
candidate set `[glyph_choice, image_choice, choice_pick]`; `glyph_choice.match()`
returns non-null (mapped numeral, `pool==="new"`, audio-first debut) and, being
highest priority, wins. For an ordinary word both `glyph_choice.match()` and
`image_choice.match()` return `null` and the base `choice_pick` (priority 0,
always matches) renders. **That is the exact precedence of today's
`if (glyphChoice) … else if (imageChoice) … else …`, expressed as data
(priority) + local `match()` functions instead of a nested `if` in one growing
function.**

The key unification with the pack ABI (§4): a `CardType` is **the in-process
implementation of an activity**, exactly as a pack's `PackActivityDeclaration`
(activityContract.ts lines 245–263) is the **out-of-process** implementation.
Both consume `ActivitySpec` and emit `ActivityResult`. Two providers, one ABI.

---

## 2. The `CardType` interface

Full compile-oriented sketch: `docs/journey/card-architecture/CardType.ts`.
The load-bearing shape:

```ts
// Everything a CardType needs to decide + build, injected (mirrors the
// resolver's DI boundary in content/resolve.ts — no hostApi/Tauri here).
export interface CardContext {
  ctx: ResolveContext          // { courseId, targetLang, nativeLang? }
  resolver: Resolver           // resolveItems / exampleFor (resolve.ts:220)
  resolverDeps: ResolverDeps   // findInstalledPack("imagepan"), …
  sttUsable: boolean           // replaces runtime's sttUsable() closure
  recentKeys: ReadonlySet<string>
  rng: (salt: string) => () => number   // cardRng bound to this specId
  log: (event: string, data: Record<string, unknown>) => void
}

// What match() returns: the typed params THIS CardType will read in prepare()
// + Component. The runtime never interprets `params` — only this module does.
export interface CardMatch<P = Record<string, unknown>> {
  params: P
}

export interface CardType<P = Record<string, unknown>> {
  /** Registry key + analytics/telemetry id, e.g. "glyph_choice". */
  id: string

  /**
   * Schedulable activity types this presentation may render (keys of
   * ACTIVITY_TYPES, or a pack `<id>:<name>`). The registry only offers this
   * CardType as a candidate for a scheduled card whose activityType is in here.
   * Absent ⇒ presents exactly its own `id` (net-new native types).
   */
  presents?: string[]

  /**
   * Precedence among candidates for one scheduled card. Higher wins. DATA, not
   * code: glyph_choice=100 > image_choice=80 > context_cloze=60 >
   * choice_pick=0. Replaces the ordering that is currently the *sequence* of
   * `if/else if` arms in prepareExercise.
   */
  priority: number

  /**
   * Applicability + typed-param builder. Returns the params to render with, or
   * null to decline (fall through to the next candidate). REPLACES
   * maybeGlyphChoice / maybeImageChoice / pickDirection / isTranslationForm.
   * May be async (image_choice resolves a concept). Pure w.r.t. stores.
   */
  match(ec: EngineCard, answer: ResolvedItem, cx: CardContext):
    CardMatch<P> | null | Promise<CardMatch<P> | null>

  /**
   * Resolve content + distractors into a mountable PreparedCard, or null if —
   * given real content — it cannot render (e.g. distractor shortfall, a phrase
   * that collapsed to one token). Null triggers fallthrough to the next
   * candidate, then contentMissingResult if none render. REPLACES the
   * per-branch body of prepareExercise (buildDistractorRequest, blankIndex
   * seeding, the degenerate guard, finalSpec assembly).
   */
  prepare(ec: EngineCard, matched: CardMatch<P>, cx: CardContext):
    Promise<PreparedCard<P> | null>

  /**
   * How the feed advances after this card settles. REPLACES the advanceRule
   * switch — each type owns its own rule. opts carries { failed, listeningRun }.
   */
  advance(card: PreparedCard<P>, mode: AdvanceMode, opts?: AdvanceOpts): AdvanceRule

  /**
   * Map the renderer's RawOutcome → ActivityResult. Most native types reuse
   * DEFAULT_SCORE (the current ActivityCardHost.settle math); speak_echo /
   * single-shot / self-report override. Absent ⇒ DEFAULT_SCORE.
   */
  score?(outcome: RawOutcome, card: PreparedCard<P>): ActivityResultDraft

  /** The renderer. Same duties as today's ExerciseProps components. */
  Component: ComponentType<CardComponentProps<P>>

  /** No-reflow layout contract (§2.3). */
  layout: CardLayout

  /**
   * Runtime-facing flags that REPLACE the `card.kind === …` structural checks
   * scattered through runtime.ts (engineIssued, unscored, metered, specOf).
   */
  meta: CardTypeMeta
}
```

### 2.1 `CardTypeMeta` — deleting the `card.kind` checks

The runtime today asks `card.kind === "exercise" | "packActivity" | …` in at
least six places (`specOf`, `isDebut`, the `engineIssued` computation,
`noteImpression`, the analytics `provider`/`slot`/`strand` derivation, the
settle path). Those become declared flags:

```ts
export interface CardTypeMeta {
  /** Results route to engine.applyResult (exercise/checkpoint/pack/capability/
   *  jumpOffer today). False for runtime-synthesized faces (blockIntro/welcomeBack). */
  engineIssued: boolean
  /** Presentation-only (no answer to grade/redo): blockIntro, welcomeBack. */
  presentationOnly: boolean
  /** Provider bucket for analytics: "native" | "pack" | "capability". */
  provider: "native" | "pack" | "capability"
  /** Debits the daily gate on completion when true AND the card is a debut
   *  (R12). Only native debut exercises + pack-anchor launches today. */
  metered: boolean
}
```

`isDebut`, `engineIssued`, and the analytics tag lookups (`POOL_TO_SLOT`,
`STRAND_TO_TAG` stay; they read `engine.meta`, not `card.kind`) all become reads
off `registry.get(card.cardTypeId).meta` — no union narrowing.

### 2.2 `PreparedCard` — generalizing `PreparedExercise`

Today `PreparedExercise` (types.ts:21–45) is exercise-shaped (spec, engine,
items, distractors, blankIndex, direction, example, sttFallback, sttUpgraded).
Generalize it so a CardType carries its own typed payload:

```ts
export interface PreparedCard<P = Record<string, unknown>> {
  cardTypeId: string            // registry key — the new dispatch discriminant
  cardId: string
  spec: ActivitySpec            // final spec (activityType + merged params)
  engine: EngineCard            // envelope for result routing + meta
  items: ResolvedItem[]
  /** Type-specific, opaque to the runtime; only this CardType reads it. */
  payload: P
}
```

`FeedCard` collapses toward `PreparedCard` + a thin discriminant. The
exercise-specific fields (distractors, blankIndex, direction, example) move into
the `choice_pick`/`cloze` CardTypes' `payload`; `sttFallback`/`sttUpgraded`
become `speak_echo` payload flags (§4-STT worked example).

### 2.3 The layout contract (ties into the live no-reflow work)

The no-reflow rule is already implemented, ad hoc, in `ActivityCardHost.tsx`
(lines 181–197): a reserved `min-h-8` feedback band with the `ResultStamp`
centered and `WordEnrichment` *absolutely positioned on the trailing edge* so a
settling word "never adds height." Make that a contract each CardType declares,
so the host can enforce it uniformly instead of one component hard-coding it:

```ts
export interface CardLayout {
  /** The interactive region reserves stable space; the feedback band is
   *  overlaid or pre-reserved and MUST NOT reflow the card on settle. */
  feedback: "reserved-band" | "overlay-only"
  /** Card renders its own Continue (button-advance: intro_echo/flip_recall/
   *  speak_echo) vs relies on host auto/swipe chrome. */
  ownsContinue: boolean
  /** Host reserves a settle-stamp slot (correct/incorrect + confidence read). */
  reservesStamp: boolean
}
```

The host frame (`ActivityCardHost` → a generalized `CardHost`) reads `layout`
and reserves the band once, for every CardType — the invariant stops being a
per-component convention that a new exercise can silently break.

---

## 3. The registry + resolution flow

### 3.1 The registry

```ts
// journey/cards/registry.ts
const REGISTRY = new Map<string, CardType>()
export function registerCardType(t: CardType): void { REGISTRY.set(t.id, t) }
export function cardType(id: string): CardType | null { return REGISTRY.get(id) ?? null }

/** Candidates for a scheduled activityType, highest priority first. */
export function candidatesFor(activityType: string): CardType[] {
  return [...REGISTRY.values()]
    .filter((t) => (t.presents ?? [t.id]).includes(activityType))
    .sort((a, b) => b.priority - a.priority)
}
```

Registration is one call per module, e.g. `journey/cards/index.ts` imports each
CardType module for its side-effect `registerCardType(...)`. A unit test pins
that every `ACTIVITY_TYPES` key has at least one registered CardType (the same
shape as the existing `EXERCISE_RENDERERS` coverage test).

### 3.2 `prepareExercise` becomes a resolver loop

The ~240-line `prepareExercise` collapses to:

```ts
async function prepareExercise(ec: EngineCard): Promise<FeedCard | null> {
  const outcome = await resolver.resolveItems(ec.spec.itemRefs)
  if (outcome.missing.length || !outcome.resolved.length) {
    engine.applyResult(contentMissingResult(ec.spec.specId)); return null
  }
  const answer = outcome.resolved[0]
  resolvedByCard.set(ec.spec.specId, outcome.resolved.map((i) => i.key))

  for (const t of candidatesFor(ec.spec.activityType)) {   // priority order
    const matched = await t.match(ec, answer, cardCtx(ec))
    if (!matched) continue                                 // declined → next
    const prepared = await t.prepare(ec, matched, cardCtx(ec))
    if (!prepared) continue                                // unrenderable → next
    return toFeedCard(prepared)
  }
  engine.applyResult(contentMissingResult(ec.spec.specId)); return null
}
```

- `maybeGlyphChoice` → `GlyphChoice.match` (priority 100).
- `maybeImageChoice` → `ImageChoice.match` (priority 80).
- `pickDirection` / `isTranslationForm` / `targetOnlyFallback` → the
  `choice_pick`/`flip_recall`/`cloze` CardTypes' `match` preconditions + an
  ordered text-family fallback (the `choice_pick` module *declines* when
  translation is impossible; the lower-priority `cloze`/`word_order`
  target-only module then matches).
- The degenerate multi-token guard → a shared `isRenderableTokens(...)`
  precondition consulted inside `cloze`/`word_order` `prepare`; on failure they
  return `null` and the loop falls through to a single-token-renderable
  candidate. Same *outcome* as today's inline reroute, but the reroute target is
  chosen by the registry, not by mutating `activityType` in place.
- The distractor request (`buildDistractorRequest` + `sampleDistractors`) moves
  into whichever CardTypes actually sample (choice/cloze/word_order/match).
  glyph/image carry their own distractors in `payload` (as today).

### 3.3 `advanceRule` becomes `cardType.advance(...)`

`FeedScroller` (lines 119, 129) currently calls `advanceRule(card, mode, opts)`.
It becomes `cardType(card.cardTypeId)!.advance(card, mode, opts)`. Each module
returns its rule:

- `glyph_choice`/`image_choice`/`choice_pick`/`cloze`/`word_order`/`match_pairs`
  → `auto`/`swipe` per mode (the current tap-answer default).
- `listen_pick`/`listen_type`/`match_pairs(text-audio)` → listening rule
  (`isListeningCard` logic moves inside these modules).
- `intro_echo`/`flip_recall`/`speak_echo` → `{ kind: "button" }`.
- `checkpoint`/`jumpOffer`/`blockIntro`/`packActivity` → `{ kind: "manual" }`.
- `capability`/`welcomeBack` → their current rules.

The `opts.failed → { kind: "swipe" }` short-circuit and `ANSWER_AUTO_MS` stay as
a shared default the modules import; `advanceRules.ts` shrinks to that default +
the `AdvanceRule` type.

### 3.4 Render dispatch becomes registry dispatch

`FeedScroller.renderCard`'s `switch (card.kind)` (lines 251–386) becomes:

```ts
const T = cardType(card.cardTypeId)!
return <CardHost card={card} layout={T.layout} mode={hostMode} …>
         <T.Component {...cardComponentProps(card, …)} />
       </CardHost>
```

The rare-variant wrapping (RareCard/Etymology/TimeCapsule/Delight, lines
277–318) and the boss banner become either host chrome keyed off
`engine.meta` (unchanged inputs) or, cleanly, *decorator* CardTypes — out of
scope for the first migration; noted in §5 as an optional later stage.

---

## 4. Alignment with the existing `activityContract` / pack ABI

This is a unification, not a second system:

| Concern | Out-of-process (pack) | In-process (CardType) |
|---|---|---|
| Declaration | `PackActivityDeclaration` in `manifest.json` (activityContract.ts:245) | `registerCardType({...})` |
| Input | `ActivitySpec` (via `hostApi.journey.getSpec()`) | `ActivitySpec` (via `prepare`) |
| Output | `ActivityResult` (via `reportResult`) | `ActivityResult` (via `score`/host settle) |
| Item kinds | `itemKinds: ItemRefKind[]` | inferred by `match()` on `ResolvedItem.kind` |
| Model needs | `modelNeeds` | `ACTIVITY_TYPES[id].modelNeeds` + `cx.sttUsable` |
| Scheduling meta | `strands`, `typicalDurationSec`, `minJourneyCaps` | `ACTIVITY_TYPES` row (native) |

A pack interlude therefore becomes **just another CardType** whose `Component`
mounts the pack through the existing single-owner `activitySession` seam
(`runtime.ts launchPackActivity`, lines 1091–1121) and whose `score` is the
`onResult` callback the host already consumes. `packActivity`/`capability` stop
being special `FeedCard.kind`s and become registered CardTypes with
`meta.provider = "pack" | "capability"`. The `ActivitySpec`→`ActivityResult` ABI
(`activityContract.ts`) stays the **authoritative** contract; `CardType` is the
in-app *provider interface* on top of it. Nothing in `activityContract.ts` (the
synced, pack-facing file) changes.

**Deliberate boundary:** the engine keeps scheduling by `ACTIVITY_TYPES`, not by
`CardType`. Presentation variety must never fabricate a mastery grade — the code
comments in `prepareExercise` guard this repeatedly ("`items[0]` stays the
WORD"). Keeping the engine ABI on the schedulable axis preserves that invariant
for free: a `glyph_choice` is still a `choice_pick` to FSRS.

### Worked example A — the STT swap/upgrade dance folds into `match()`

`mapEngineCard` (lines 736–779) currently has two hand-written STT branches (the
`speak_echo && !sttUsable` downgrade to `listen_type`, and the
`intro_echo|listen_type && sttUsable && shouldUpgradeToSpeak` upgrade to
`speak_echo`), plus `reswapDeclinedSpeakCards`. In the registry these disappear
into one module:

```ts
// journey/cards/native/SpeakEcho.card.tsx
registerCardType({
  id: "speak_echo",
  presents: ["speak_echo", "intro_echo", "listen_type"], // can upgrade these
  priority: 50,                    // above the plain intro_echo/listen_type (0)
  match(ec, answer, cx) {
    if (!cx.sttUsable) return null                       // downgrade: decline →
                                                         //   listen_type wins
    if (ec.spec.activityType === "speak_echo") return { params: {} }
    // upgrade share (shouldUpgradeToSpeak), deterministic in specId:
    return cx.rng(`${ec.spec.specId}:speakup`)() < 0.75 ? { params: {} } : null
  },
  advance: () => ({ kind: "button" }),
  score: sttScore,               // owns the single-shot Whisper settle
  Component: SpeakEcho,
  layout: { feedback: "reserved-band", ownsContinue: true, reservesStamp: true },
  meta: { engineIssued: true, presentationOnly: false, provider: "native", metered: true },
})
```

A native `speak_echo` with no usable model → `match()` returns `null` →
`listen_type` (priority 0) renders. An `intro_echo` with a usable model →
`speak_echo` outbids it. The decline-reversion (`reswapDeclinedSpeakCards`) just
re-runs the resolver loop with `cx.sttUsable = false`. The two special branches
and the reswap keyed-off-activityType logic become **precedence + one boolean in
context**.

### Worked example B — adding **Tone Ladder** (net-new game) + a glyph card

Owner's target: variety is "register a module, touch zero central files."

**Tone Ladder** (PREMIUM_SCROLL §5 Game 2 — minimal-pair listening
discrimination, `phoneme` ItemRefs already in the ABI). One new file:

```ts
// journey/cards/games/ToneLadder.card.tsx  — the ONLY file touched.
registerCardType({
  id: "tone_ladder",
  // A net-new schedulable type: add ONE row to ACTIVITY_TYPES
  // (form:0, strand:"input", guessable:true, estSec:20, modelNeeds:[]) so the
  // engine can slot it. That row is the single central edit, and it is DATA.
  priority: 0,
  match(ec, answer) {
    // schedulable by phoneme minimal-pair items
    return answer.kind === "phoneme" ? { params: {} } : null
  },
  async prepare(ec, _m, cx) {
    const { resolved } = await cx.resolver.resolveItems(ec.spec.itemRefs)
    if (resolved.length < 2) return null            // needs a pair
    return makePrepared(ec, resolved, { cardTypeId: "tone_ladder", payload: {} })
  },
  advance: (_c, mode) => (mode === "auto"
    ? { kind: "auto", delayMs: ANSWER_AUTO_MS } : { kind: "swipe" }),
  Component: ToneLadder,          // reads spec.itemRefs, swipe toward the match
  layout: { feedback: "overlay-only", ownsContinue: false, reservesStamp: true },
  meta: { engineIssued: true, presentationOnly: false, provider: "native", metered: true },
})
```

No edit to `prepareExercise`, `advanceRules`, `renderCard`, or `ChoicePick`. The
single central change is a *data* row in `ACTIVITY_TYPES` (the engine ABI) so the
mixer can schedule it — which is the correct place for "a new schedulable
activity exists," and CI already validates that table.

**A new glyph family** (e.g. clock-face time, or CJK number glyphs) is even
smaller: a new CardType with `presents: ["choice_pick","listen_pick"]`, a
`priority` above/below the numeral `glyph_choice`, and a `match()` that maps the
word to its glyph. Zero central edits — it just joins the candidate list for
`choice_pick` and wins when it matches.

---

## 5. Incremental migration plan (no big-bang)

Each stage is independently shippable, preserves outputs, and is guarded by a
**parity test** in the style of the existing `content/parity.test.ts`: snapshot
the `FeedCard` produced by the old path and assert the registry path produces the
same spec/params/advance for a fixed corpus of `EngineCard` fixtures. Existing
tests (`advanceRules.test.ts`, `faces.test.ts`, `imageChoice.test.ts`,
`clozeContext.test.ts`, `settle.test.ts`) stay green because the pure helpers
they cover (`faces.ts`, `glyphs.ts`, `imageChoice.ts`, `clozeContext.ts`,
`settle.ts`) are **kept and reused** by the new components — we are moving call
sites, not rewriting logic.

- **Stage 0 — Introduce the registry, zero behavior change.** Add
  `journey/cards/{CardType.ts, registry.ts, index.ts}`. Register the 10 existing
  native renderers as thin CardTypes that wrap `EXERCISE_RENDERERS` and delegate
  `advance` to the current `advanceRule`. Nothing consumes the registry yet.
  *Deletes:* nothing. *De-risks:* everything after.

- **Stage 1 — Advance ownership.** Point `FeedScroller` at
  `cardType(id).advance`. Keep `advanceRules.ts` as the shared default the
  modules import. *Deletes:* the `switch (card.kind)` + `speak_echo`/listening
  special-cases in `advanceRule`. `advanceRules.test.ts` retargets to per-module
  `advance` (mechanical).

- **Stage 2 — Presentation variants out of `prepareExercise`.** Extract
  `glyph_choice` and `image_choice` as CardTypes (`match` = the two `maybe*`
  fns, verbatim logic). `prepareExercise` gains the candidate loop for these two
  ahead of the still-inline base path. Move `ChoicePick`'s `imageMode`/`glyphMode`
  branches into `GlyphChoice`/`ImageChoice` components (they already call
  `buildGlyphTiles`/`buildImageTiles`). *Deletes:* `maybeGlyphChoice`,
  `maybeImageChoice`, the glyph/image `if` block in `prepareExercise`,
  `ChoicePick` lines 59–69 + 113–213.

- **Stage 3 — Text family + direction + degenerate guard.** Make
  `choice_pick`/`flip_recall`/`cloze`/`word_order`/`match_pairs` full CardTypes;
  fold the translation-integrity guard, `pickDirection`, `targetOnlyFallback`,
  context-cloze conversion, and the degenerate reroute into their
  `match`/`prepare` + a shared `isRenderableTokens` precondition with registry
  fallthrough. `prepareExercise` is now *only* the resolver loop (§3.2).
  *Deletes:* `isTranslationForm`, `pickDirection`, `targetOnlyFallback`, the
  degenerate-guard block, the finalSpec/distractor tail — ~180 lines.

- **Stage 4 — STT into `speak_echo.match()`.** Worked example A. *Deletes:* the
  two STT branches in `mapEngineCard`; `reswapDeclinedSpeakCards` becomes a
  resolver re-run.

- **Stage 5 — Card-kind unification (largest, last).** Turn `checkpoint`,
  `blockIntro`, `welcomeBack`, `jumpOffer`, `packActivity`, `capability` into
  CardTypes; collapse `renderCard`'s `switch` to registry dispatch; replace the
  runtime's `card.kind === …` checks with `meta` flags (§2.1). This touches every
  feed consumer, so it ships alone, behind the parity test, after 0–4 are stable.
  *Deletes:* `renderCard` switch, `specOf`, `isDebut`, the `engineIssued`
  computation, and the `FeedCard` union's per-kind fields (folded into `payload`).

Net deletions across the plan: the four chains named in §0, plus `specOf`,
`isDebut`, `engineIssued`, and two `mapEngineCard` branches.

---

## 6. Honest tradeoffs

**Cost.**
- Indirection: a new engineer reads a registry + N small modules instead of one
  linear function. Mitigated because the *precedence* (the part that was
  implicit in `if/else` order) becomes explicit `priority` data, and each module
  is small and single-purpose.
- `match()` is async (image_choice resolves a concept). The resolver loop
  `await`s candidates in priority order; a slow-but-declining high-priority
  matcher can add latency. Mitigated: keep expensive matchers (image) at their
  current single deterministic-share gate so they short-circuit cheaply, and
  cap async matchers by `pool === "new"` as today.

**Risk.**
- **Precedence is now data.** A wrong `priority` is a silent presentation-quality
  regression (glyph should always beat image should always beat text). The parity
  test + an explicit ordered `PRIORITY` table with a comment per rung is the
  guard. This is the same risk as today's `if/else` *order*, just made visible.
- **Stage 5 is broad.** The union collapse touches `FeedScroller`, the runtime's
  structural checks, and history/review rendering. It is the single highest-risk
  step (see report).

**Explicitly NOT solved by this proposal:**
- Engine-side scheduling / mixer variety. Which activity type gets *scheduled*
  (and the Four-Strands balance) stays in `ACTIVITY_TYPES` + the engine mixer.
  This proposal only owns how a scheduled card is *presented*.
- The out-of-process pack ABI. `activityContract.ts` is already a hard interface
  and is not modified.
- Content authoring, distractor *quality*, FSRS grading. Untouched.
- Rare-variant decoration (RareCard/etymology wrappers) — left as host chrome in
  the first pass; an optional decorator-CardType refinement is noted, not
  required.

---

## 7. Recommendation

**Incremental, staged (§5) — explicitly not big-bang.** The existing
`ACTIVITY_TYPES`/`EXERCISE_RENDERERS` registry proves the pattern; the migration
is additive (Stage 0 introduces the registry with zero behavior change) and each
subsequent stage deletes exactly one chain behind a parity test. A big-bang
rewrite of `prepareExercise` + `mapEngineCard` + `renderCard` + the `FeedCard`
union in one PR would put the entire feed's behavior — STT swaps, degenerate
reroutes, precedence, debit accounting — up for regression at once, with no
green baseline to diff against. Stage 5 is the only step that must ship on its
own; Stages 0–4 can land in quick succession because each keeps the pure helper
tests green by construction.
