# Journey Content Resolver — `journey/content/resolve.ts`

**Status: v1.0 implementable spec. Created per CTO-RESOLUTIONS.md R14. Owned by the
feed/build team; renderers develop against it in the fixture slice.**

Verified against: `docs/journey/codebase/content-data.md` (corpus schemas),
`docs/journey/codebase/pack-contract.md` (hostApi surface),
`docs/journey/codebase/experiences-ai.md` §3–4 (hanzipan/wordpan schemas),
`specs/course-pack.md` §1–2 (DDL, read patterns; the PackReader → CourseGraph loader
section is normative per R7), `specs/activity-contract.md` §1 (ItemRef kinds, R2 colon
serialization), `specs/feed-ux.md` §4 (renderer needs) + §2.4/§3.3,
`specs/engine.md` §2.6/§5.4 (CourseGraph, distractor difficulty), CTO-RESOLUTIONS.md
R2/R3/R4/R7/R11/R14.

---

## 0. Overview

The resolver is the seam between **addresses and content**. The engine schedules
`ItemRef`s (D3); renderers need text, translations, romanization, and audio. Nothing in
between exists today — this module is it:

```
corpan-app/src/journey/content/
├── resolve.ts        # resolveItems(): ItemRef[] → ResolvedItem[] + missing[]   (§2, §3)
├── distractors.ts    # sampleDistractors(): the distractor sampler contract      (§4)
├── rng.ts            # mulberry32 + fnv1a32 (deliberate ~20-line duplicate of
│                     #   engine/rng.ts — the engine barrel is closed, §8.1 of
│                     #   engine.md; a parity test pins the two, §6)
├── normalize.ts      # answer normalization for validity checks (§4.3)
├── cache.ts          # per-session LRU, memory-bounded (§3.2)
└── __fixtures__/     # golden fixture packs per kind (§6)
```

Boundaries (hard rules, mirror the engine's):

1. **No engine imports.** The resolver never deep-imports `journey/engine/*`
   (engine.md §8.1 boundary test covers both directions). It communicates with the
   engine only through data the runtime carries (`spec.params`, `ActivityResult.detail`
   per R3).
2. **Dependency-injected IO.** `resolve.ts` and `distractors.ts` take a `ResolverDeps`
   object (§3.1); no direct `hostApi`/Tauri imports. The runtime wires deps from
   `createHostApi()` (packId-less host API — `hostApi.ts:182`); tests wire fixtures.
3. **Read-only, offline, local.** Every resolution is a point lookup against installed
   SQLite / pack files. No network at resolve time, ever (§5).
4. **No unseeded randomness.** Same rule as the engine: `Math.random()` is banned;
   all sampling flows through the seeded PRNG (§4.5).
5. **Never a blank card.** A card whose refs cannot all resolve is dropped *pre-mount*
   and the engine is notified (§3.3). The learner never sees a skeleton, an English
   fallback, or an empty choice grid.

Who calls it: `runtime.ts` resolves the `next` feed slot's spec at pre-mount
(feed-ux §1.3 — pre-mount is the "no loading gap" requirement; resolution is local
SQLite, single-digit ms). `ActivityCardHost` receives the finished `ResolvedItem[]`
via `ExerciseProps.items` (feed-ux §4) and never queries anything itself.

---

## 1. `ResolvedItem` — the exact type

```ts
// journey/content/resolve.ts
import type { ItemRef, ItemRefKind } from "../../contentPacks/activityContract"

/** One face of an item in one language. */
export interface ResolvedText {
  /** Display truth — what the renderer prints. */
  text: string
  /**
   * What gets spoken. Diverges from `text` ONLY where the source corpus
   * diverges (segments carry tts.text); for every other kind ttsText === text.
   * Renderers speak ttsText, print text — never the reverse (house tts.text rule).
   */
  ttsText: string
  /** Optional (pinyin etc.) — rendered per stack showRomanization. */
  romanization?: string
}

export interface ResolvedItem {
  ref: ItemRef
  /** itemRefKey(ref) — `<kind>:<source>:<id>` per R2. Cache + dedup key. */
  key: string
  kind: ItemRefKind
  /** Target-language face. ALWAYS present — its absence means the item did
   *  not resolve (it lands in `missing`, never here). */
  target: ResolvedText
  /**
   * Native-language face. Absent on single-language stacks, when the source
   * corpus has no native-language row (word/char/segment — see §2), or when
   * the translation row is missing. Renderers already handle absence per
   * SINGLE_LANGUAGE_RULE.md.
   */
  native?: ResolvedText
  /** CEFR band where the source carries one (phrase kinds). */
  level?: string
  /**
   * Pre-rendered audio. v0.1: `segment` kind only — every other kind speaks
   * via on-device TTS (AudioButton → speakWithStackPrefs). Word timestamps
   * are against DISPLAY text (audio_manifest contract, content-data.md §4).
   */
  audio?: {
    src: string                 // corpan-pack://localhost/<packId>/audio/<lang>/<segId>.m4a
    durationMs: number
    words?: { word: string; startMs: number; endMs: number }[]
  }
  /** Per-kind payload, discriminated on `kind`. */
  extras?: ResolvedExtras
}

export type ResolvedExtras =
  | { kind: "phrase"; source: string; domains: string[] }
  | { kind: "word";
      /** wordpan ~50-word paragraph in the learner's NATIVE language, when the
       *  (native→target) wordpan pair pack is installed. Feeds etymology gems
       *  + long-press explanations; also the only native-side content that
       *  exists for words (there is NO word-translation table anywhere —
       *  content-data.md §8). */
      explanationNative?: string
      /** Same paragraph in the TARGET language, when present in the pair DB. */
      explanationTarget?: string }
  | { kind: "char"; pinyin: string; strokeCount: number; radical?: string;
      frequency?: number
      /** Etymology summary, native-first selection (§2.8). */
      etymology?: string
      /** HanziWriter stroke JSON — LAZY: fetched only via resolveCharStrokes()
       *  (cap-module writing drills), never in the base resolve (§3.2). */ }
  | { kind: "segment"; bookId: string; chapter: number; blockType: "heading" | "text";
      pauseAfterMs?: number }
  | { kind: "grammarNode"; title: string
      /** The ≤60s rule-card copy, L1-selected (§2.8). */
      note: string
      lateAcquired: boolean
      /** Exemplar phrases carrying the node, resolved. §2.5. */
      exemplars: ResolvedItem[] }
  | { kind: "phoneme"; contrast: string          // sorted-IPA form, e.g. "iː-ɪ"
      /** From l1_overlays phoneme_pair payload for the active L1. */
      minimalPairs: [string, string][] }
  | { kind: "concept"; imageSrc?: string }        // imagepan — absent in v0.1 (D10.6)
```

Notes:

- **Tokenization stays renderer-side** (feed-ux §4: whitespace / `Intl.Segmenter`).
  The resolver hands over raw text; `word_order`/`cloze` tokenize themselves so the
  distractor sampler and the renderer share one tokenizer (§4.4 imports it).
- `key` is minted with the ONE ItemRef helper in `activityContract.ts` (R2). The
  resolver never hand-rolls the string.

---

## 2. Resolution queries per kind

All SQLite goes through `deps.queryPackDb` → `content_packs_query_db`
(`src-tauri/src/lib.rs:1102`, parameterized read-only, connection-cached). **R7
truncation rule applies**: the Rust layer hard-caps at 2,000 rows and truncates
silently — every resolver query carries an explicit `LIMIT`, and any result with
`rows.length === limit` logs a truncation warning (§6 tests this). All queries here
are point lookups or `LIMIT ≤ 40`; nothing paginates.

### 2.1 `phrase` — base corpus + phrase packs (existing samplers)

Source `"base"` or a phrase-pack id; both served by the ONE existing command:

```ts
const out = await deps.getEntryById(Number(ref.id), ref.source)
// EntryOut = { entry_id, level, domains, translations:
//              [{ language_code, text, romanization }], source }  (types.ts:86-103)
```

- `target` = the `translations` row for `targetLang`; missing row ⇒
  `missing("translation_absent")` (the base corpus is 54×10,000 full-coverage, so this
  fires only on malformed phrase packs — but it MUST be handled, not assumed away).
- `native` = the row for `nativeLang` when the stack has one.
- `ttsText = text` (the phrase corpus has no tts-divergence column).
- `extras = { kind: "phrase", source: out.source, domains: out.domains }`,
  `level = out.level`.
- Entry-id uniqueness is per source — `ref.source` is ALWAYS passed through
  (activity-contract §1.2 rule; `entry_id` alone is ambiguous).

### 2.2 `word` — wordpan pair pack

Pack discovery: `deps.findInstalledWordPack(nativeLang, targetLang)` — wired to
`findWordPackForPair` (`wordPackCatalog.ts:270`, the single resolver for the pair) +
the installed-pack registry. Not installed ⇒ the word still resolves (the word IS the
content); only `extras` degrade (§5).

```sql
SELECT language_code, paragraph FROM word_explanation
WHERE word = ? LIMIT 60   -- pair packs carry exactly 2 language rows today
```

- `target.text = target.ttsText = ref.id` (the surface word, verbatim NFC — the
  wordpan key IS the word).
- `native` is **never set** for words: no word-translation table exists anywhere in
  the system (content-data.md §8). The native-language content is the explanation
  paragraph in `extras`. Consequence (normative): the runtime only issues word cards
  in `targetOnly` / recognition-of-form shapes (`listen_pick`, `match_pairs
  text-audio`, `flip_recall` with the explanation as the back face when installed);
  `direction: 'toNative' | 'toTarget'` word cards are not mintable in v0.1.
- Word missing from the DB (surface-form gap) ⇒ word still resolves, extras absent —
  a word item never hard-misses on wordpan.

### 2.3 `char` — hanzipan

Source is **`hanzipan`** (R2). `deps.queryPackDb({ packId: "hanzipan", ... })`:

```sql
SELECT pinyin, stroke_count, radical, frequency
FROM hanzi_character WHERE char = ? LIMIT 1;

SELECT language_code, summary FROM hanzi_etymology
WHERE char = ? LIMIT 60;    -- 51 language rows per char
```

- `target.text = target.ttsText = ref.id` (the character);
  `target.romanization = pinyin`.
- `etymology` picked by preferred-language order `[...stackLangs, "en"]` — the exact
  lookup pattern the app standardized on (`hanzipan main.js:2293-2298`).
- Stroke vectors (`hanzi_writer.data_json`, the bulk of the 75 MB) are fetched ONLY by
  the separate `resolveCharStrokes(char)` entry point, on demand from the writing
  drill (capability-modules), with its own small LRU (§3.2).
- hanzipan not installed ⇒ `missing("pack_not_installed")`. (v0.1 = `journey_en`, no
  char items; this path matters for `journey_zh_hans`.)

### 2.4 `segment` — narration pack files

Pack discovery: `deps.findInstalledNarrationPack(bookId, targetLang)` — the installed
registry keyed off catalog-v2 entries (one narration pack per (book, language); a pack
for another language does NOT satisfy the ref).

Files, fetched once per (packId) and cached parsed (§3.2):

- `segments.json` → `{ total_segments, segments: [{ id, chapter, block_type,
  heading_level, text, tts: { text, pause_after_ms } }] }` — lookup by `segments[].id
  === ref.id`.
- `audio_manifest_<targetLang>.json` → per-segment
  `{ file, duration_ms, pause_after_ms, words }`.

JSON is command-fetched (`content_packs_fetch_text` — WebViews can't `fetch()` the
custom scheme, pack-contract §4.2); the audio `src` is the `corpan-pack://` URL
(`http://corpan-pack.localhost/...` on Android/Windows), which media elements CAN load.

- `target = { text, ttsText: tts.text }` — the one kind where they genuinely diverge.
  `heading_level: 1` segments are display-only (no tts) and are never scheduled as
  audio items; if referenced anyway, `ttsText = text` and `audio` is absent.
- `native` is absent: narration packs are per-language artifacts; the native-language
  segments file lives in a *different* pack that is usually not installed. Do not
  fake it.
- `audio.words` are display-text-aligned word timestamps (the earthgate highlight
  contract).
- **Preview truncation**: `is_preview` / `segments.length < total_segments` and
  `ref.id` beyond the preview range ⇒ `missing("preview_truncated")` — never render a
  paywall surprise inside a feed card; the upstream scheduler treats it like an
  uninstalled pack.
- R11 note: story lessons/storyChapter are cut from v0.1 content, but `segment`
  resolution ships now — earthgate anchor cards and the v0.2 story workstream both
  ride it.

### 2.5 `grammarNode` — course pack tables + strings

`deps.queryPackDb({ packId: courseId, ... })` (courseId from the runtime's course
context; equals `ref.source` for minted kinds):

```sql
SELECT id, skill_id, cefr, title_key, note_key, late_acquired
FROM grammar_nodes WHERE id = ? LIMIT 1;

-- exemplar phrases carrying the node (same-skill phrase items):
SELECT i.id, i.kind, i.source, i.ref_id
FROM item_skills js JOIN items i ON i.id = js.item_id
WHERE js.skill_id = ? AND i.kind = 'phrase'
ORDER BY i.intro_order LIMIT 8;
```

- `title` / `note` from the strings selector (§2.8) on `title_key` / `note_key` —
  the note is the L1-language explanation (grammar_notes are localized ×54, D6).
- `target.text = title` in practice is wrong-language — grammarNode has no
  target-language "text" of its own; normatively: `target.text = target.ttsText =`
  the FIRST exemplar's target text (the node is always shown *through* an exemplar,
  feed-ux §4 rows 4/5/10). The node's own copy lives in `extras`.
- Exemplars: when `spec.itemRefs` already lists exemplar phrase refs (the mixer's
  choice), resolve exactly those; otherwise resolve the first `min(3, found)` from the
  query above, seeded-picked (§4.5) so the same card always shows the same exemplars.
- Zero resolvable exemplars ⇒ `missing("row_absent")` — a grammar card without an
  exemplar is a blank card.

### 2.6 `phoneme` — course pack l1_overlays + strings

```sql
SELECT payload_json, string_key FROM l1_overlays
WHERE l1 = ? AND overlay_type = 'phoneme_pair'
  AND ref_kind = 'item' AND ref_id = ? LIMIT 1;
```

(`ref_id` here is the serialized item id, `phoneme:journey_en:iː-ɪ`.)

- `extras.contrast` from the payload (`{"contrast":"iː-ɪ","minimalPairs":[...]}`),
  `minimalPairs` verbatim.
- `target.text = target.ttsText =` first minimal-pair word (the drill prompt);
  renderers for `practice.minimal-pair` slots consume the full pair list.
- No overlay row for the active L1 ⇒ `missing("row_absent")`: phoneme drills are
  L1-contrastive by construction; without the pair data there is no exercise. (On
  single-language stacks there is no L1 ⇒ phoneme cards are never issued — mixer
  rule, noted here for completeness.)

### 2.7 `concept` — imagepan

v0.1: imagepan does not ship (D10.6 / D11); `deps.findInstalledPack("imagepan")`
returns nothing ⇒ `missing("pack_not_installed")`. The runtime never emits
`media:'image'` params (feed-ux §4 row 1), so this path is exercised only by tests
until imagepan lands. When it does: image bytes resolve to a `corpan-pack://` URL in
`extras.imageSrc`; rendering rides `<OfflineImage>` per R15.

### 2.8 Strings selector (shared)

```sql
SELECT lang, text FROM strings WHERE key = ? LIMIT 60
```

then pick native-first with en fallback — the same contract as
`util/wordPack.ts::selectPreferred` (course-pack §2.1: reuse that selector, do not
re-implement the preference walk). Cached per (courseId, key) (§3.2).

---

## 3. Module API, caching, missing content

### 3.1 Surface

```ts
export interface ResolverDeps {
  // wired from createHostApi() by runtime.ts; from fixtures in tests
  getEntryById(entryId: number, source: string): Promise<EntryOut>
  getRandomEntries(q: { count: number; domains?: string[]; levels?: string[] }): Promise<EntryOut[]>
  queryPackDb(q: { packId: string; dbName?: string; sql: string; params?: unknown[];
                   maxRows?: number }): Promise<{ columns: string[]; rows: unknown[][] }>
  fetchPackText(packId: string, relPath: string): Promise<string>
  findInstalledWordPack(nativeLang: string, targetLang: string): string | null
  findInstalledNarrationPack(bookId: string, lang: string): string | null
  findInstalledPack(packId: string): boolean
}

export interface ResolveContext {
  courseId: string           // 'journey_en'
  targetLang: string
  nativeLang?: string        // absent on single-language stacks
}

export type MissingReason =
  | "pack_not_installed" | "row_absent" | "translation_absent"
  | "file_absent" | "preview_truncated" | "db_error"

export interface ResolveOutcome {
  resolved: ResolvedItem[]                       // spec order preserved
  missing: { ref: ItemRef; reason: MissingReason }[]
}

export function createResolver(deps: ResolverDeps, ctx: ResolveContext): Resolver

export interface Resolver {
  resolveItems(refs: ItemRef[]): Promise<ResolveOutcome>
  resolveCharStrokes(char: string): Promise<unknown | null>   // §2.3 lazy path
  invalidate(): void                                          // §3.2 triggers
}
```

`resolveItems` never throws: every failure mode is a `missing` entry (`db_error`
wraps and logs the underlying error). Partial success is normal and expected.

### 3.2 Caching policy — per-session LRU, memory-bounded

One `cache.ts` LRU instance per resolver (== per session surface mount):

| Cache | Key | Bound | Notes |
|---|---|---|---|
| items | `itemRefKey` | **500 entries AND ~4 MB** (est. `JSON.stringify(v).length` bytes; whichever trips first evicts LRU) | The main cache; a session tops out around 60 cards × a few refs, so 500 is generous headroom for distractor-pool resolution |
| strings | `(courseId, key)` | 2,000 entries | Tiny rows; grammar notes are the largest (~350 chars) |
| segment file maps | `packId` | 4 entries, size-counted against the 4 MB pool | Parsed `segments.json` + audio manifest per book |
| char strokes | `char` | 50 entries | `hanzi_writer.data_json` is KBs per char — never enters the main pool |
| distractor pools | `(skillId, kind)` | 32 entries | Candidate ROWS only (§4.2); resolved distractor SETS are never cached (recent-window-dependent) |

Never cached: audio bytes (the media element streams `corpan-pack://` directly),
`ResolveOutcome.missing` (absence is re-checked — a pack may have installed since).

Invalidation (`invalidate()`, wired by the runtime): session end (surface unmount),
course/stack switch, and any pack install/upgrade/uninstall event (the installed-packs
store subscription — a mid-session wordpan JIT install must surface without a restart).

### 3.3 Missing-content behavior (normative)

A card is **droppable, never blank**. When `resolveItems` for a spec returns any
`missing` entry whose ref the card cannot render without (all refs, for every v1 native
renderer):

1. The runtime drops the card **pre-mount** — it was being resolved in the `next`
   slot (feed-ux §1.3), so the learner sees no gap; the runtime immediately pulls a
   replacement from the engine.
2. The engine is notified via the normal result path: the runtime submits
   `{ specId, score: 0, perItem: [], durationMs: 0, abandoned: true,
   detail: { flags: { contentMissing: true } } }` — the R3 typed envelope. Engine rule
   (one line, carried in engine.md): `flags.contentMissing` ⇒ no FSRS grade, no θ
   update, AND the spec's itemRefKeys enter the session's exclusion set so the mixer
   does not re-issue them this session (unlike plain `abandoned`, which returns items
   to their pools and would loop).
3. Each drop logs one structured line (`journey_content_missing` with kind/source/
   reason) to the local analytics AppendLog (storage-analytics.md) — this is the
   census signal that tells the build team a shipped course references content the
   fleet doesn't have.

Cards that can degrade instead of drop, do: word extras absent ⇒ card renders without
long-press explanations; segment `audio` present but device route fails at play time
is a **renderer** concern (feed-ux owns the listen→text degrade), not re-resolved.

---

## 4. The distractor sampler contract — `distractors.ts`

Every wrong option a learner can tap comes from here. No renderer invents options.

### 4.1 API

```ts
export interface DistractorRequest {
  /** Seed source. spec/card correlation id — deterministic per card (§4.5). */
  cardId: string
  /** The correct item (already resolved). */
  answer: ResolvedItem
  /** Language the distractor SURFACES in. ALWAYS the answer's language:
   *  direction 'toNative' ⇒ nativeLang, else targetLang. Never mixed. */
  answerLang: string
  /** Language of the prompt face, for the same-translation collision check. */
  promptLang?: string
  /** How many distractors (NOT counting the answer). */
  count: number
  /** Difficulty target: b ≈ θ in cruise, θ − 0.5 otherwise — supplied by the
   *  engine in spec.params (engine §5.4); the sampler never computes θ. */
  targetB: number
  /** Pool strategy, from spec.params.distractors (feed-ux §4 row 1). */
  pool: "sameSkill" | "nearTheta"
  /** itemRefKeys used (as answer OR distractor) in the last 10 completed
   *  cards — maintained by the runtime from its session ring. */
  recentKeys: ReadonlySet<string>
  /** For token-level requests (cloze bank / word_order tiles): the full
   *  correct token list of the card, renderer-tokenized (§4.4). */
  answerTokens?: string[]
  mode: "item" | "token"
}

export interface DistractorSet {
  /** Length ≤ count. In final presentation-shuffle order (§4.5). */
  distractors: ResolvedDistractor[]
  /** count − distractors.length. > 0 is a shortfall the renderer must handle
   *  (choice_pick with 2 options is legal; 1 option is not — the card drops
   *  per §3.3 with reason "row_absent"). */
  shortfall: number
  /** Scaffold "eliminate one distractor" order (feed-ux §3.3): indexes into
   *  `distractors`, worst-fit first (§4.6). */
  eliminationOrder: number[]
}

export type ResolvedDistractor =
  | { mode: "item"; item: ResolvedItem; text: string }   // text = the answerLang face
  | { mode: "token"; text: string; fromKey: string }

export function sampleDistractors(req: DistractorRequest,
                                  resolver: Resolver,
                                  deps: ResolverDeps,
                                  ctx: ResolveContext): Promise<DistractorSet>
```

### 4.2 Pool construction

The pool is **course-pack items of the same kind**, laddered:

```sql
-- rung 1: same-skill (pool = "sameSkill", or first rung of "nearTheta")
SELECT i.id, i.kind, i.source, i.ref_id, i.difficulty_b
FROM item_skills s1
JOIN item_skills s2 ON s2.skill_id = s1.skill_id
JOIN items i        ON i.id = s2.item_id
WHERE s1.item_id = ? AND i.id <> ? AND i.kind = ?
ORDER BY ABS(i.difficulty_b - ?), i.id LIMIT 40;

-- rung 2: near-b course-wide
SELECT id, kind, source, ref_id, difficulty_b FROM items
WHERE kind = ? AND id <> ?
ORDER BY ABS(difficulty_b - ?), id LIMIT 40;
```

(`?` difficulty binding = `targetB`. The `, id` tiebreak makes candidate order
deterministic — SQLite offers no stable sort otherwise.)

- Rung 3 (phrase kind only, pathological starvation): `deps.getRandomEntries({ count,
  levels: [level] })` — the same random top-up floor the lingo-hero adapter is
  required to use (activity-contract §6.1). This rung is **non-deterministic by
  nature**; it logs `journey_distractor_topup` and is exempt from the §4.5 determinism
  guarantee. At v0.1 scale the course-pack pool gates (course-pack validation) make
  rung 3 unreachable for authored units; it exists so the feed never starves.
- Candidates resolve through `resolveItems` (cache-served); candidates that land in
  `missing` are simply skipped (a distractor never triggers a card drop).

### 4.3 Exclusion rules (the validity contract)

A candidate is REJECTED when any of the following holds. Normalization
(`normalize.ts`): Unicode NFKC → `toLocaleLowerCase(lang)` → strip punctuation +
symbols (Unicode P*/S* classes) → NFD + strip combining marks (diacritic fold) →
collapse whitespace. Deliberately aggressive: a distractor differing only in
diacritics or case from the correct answer is a valid-alternate hazard, not a
distractor.

1. **Answer-text collision**: `norm(candidate answerLang face) ===
   norm(answer answerLang face)`. In `token` mode: the candidate token normalized
   equals the blank/target token normalized, **or equals any token in
   `answerTokens`** (a tile the learner could legitimately place makes `word_order`
   ambiguous; a bank word identical to any sentence token makes `cloze` ambiguous).
2. **Same-translation collision**: `promptLang` set and
   `norm(candidate promptLang face) === norm(answer promptLang face)` — two items
   meaning the same thing in the prompt language are BOTH correct answers ("hola" and
   "buenas" both back-translating to "hello" ⇒ the distractor is a valid alternate).
3. **Language**: candidate has no `answerLang` face ⇒ reject. This structurally
   enforces *distractor language = answer language*; there is no cross-language
   distractor, ever.
4. **Recency dedup**: `candidate.key ∈ req.recentKeys` (window = last 10 completed
   cards, runtime-maintained) ⇒ reject. Within one set, candidates are set-deduped by
   `key` AND by normalized surface text (two different items rendering the same
   string is one option, not two).

These are the checks the property tests hammer (§6). Honest limit, stated once: for
`cloze`, "valid alternate" is decided by normalized string equality only — the sampler
does not grammar-check whether a different word is also syntactically valid in the
blank. Morphology-aware bank filtering is a tracked v0.2 improvement, not silently
claimed.

### 4.4 Token mode (cloze banks, word_order tile pools)

Token candidates are produced from item candidates: take the candidate's `answerLang`
face, tokenize it with the SAME tokenizer the renderers use (whitespace /
`Intl.Segmenter(lang, { granularity: 'word' })` + the per-language fallback table —
one shared module, imported by both), and pick the token whose 0-based index matches
the blank's index clamped to the candidate's length (positional plausibility beats
random-word plausibility and stays deterministic). The token then passes §4.3.

### 4.5 Determinism

- PRNG: `mulberry32(fnv1a32(cardId))` — same algorithms as `engine/rng.ts`,
  duplicated in `journey/content/rng.ts` because the engine barrel is closed
  (engine.md §8.1); a parity test pins the duplication (§6).
- Pipeline: deterministic candidate list (SQL `ORDER BY … , id`) → seeded
  Fisher-Yates shuffle → filter by §4.3 in shuffled order → take first `count` →
  the surviving order IS the presentation order (renderers do not re-shuffle; the
  answer's slot position is drawn from the same PRNG).
- Guarantee: same `(cardId, pack content, recentKeys)` ⇒ byte-identical
  `DistractorSet`, across runs and devices. (Rung-3 top-up excepted, §4.2.)
- `match_pairs` needs no distractors but DOES need a stable pair shuffle:
  `distractors.ts` exports `seededShuffle<T>(cardId: string, xs: T[]): T[]` for it —
  same PRNG, same guarantee.

### 4.6 Scaffold elimination order

Feed-ux §3.3 rung 1 eliminates ONE distractor on first miss. `eliminationOrder` ranks
distractors worst-fit-first: descending `|b − targetB|`, tie-broken by the card PRNG.
The renderer pops indexes off the front — deterministic, and the eliminated option is
always the least pedagogically interesting one.

### 4.7 Per-renderer distractor needs (normative table)

Renderer names are the R4 registry constants.

| activityType | needs from sampler | mode | count | answerLang | notes |
|---|---|---|---|---|---|
| `choice_pick` | option items | item | `choices − 1` (2–3) | `direction`-dependent: `toNative` ⇒ native, else target | pool from `params.distractors`; `eliminationOrder` consumed by scaffold |
| `listen_pick` | option items | item | `choices − 1` | target (audio prompt is target; options are what was heard) | options must be TTS-speakable — §4.3 rule 3 covers it |
| `listen_type` | — | — | 0 | — | free input; compare via normalizer, not sampler |
| `cloze` (`mode:'bank'`) | bank tokens | token | `bankSize − 1` (3–5) | target | `answerTokens` = full sentence tokens; §4.3 rule 1 token form |
| `cloze` (`mode:'type'`) | — | — | 0 | — | |
| `word_order` | extra tiles | token | `distractorTiles` (0–2) | target | rejected if normalized-equal ANY sentence token (§4.3.1) |
| `match_pairs` | none — `seededShuffle` only | — | 0 | — | all pairs are correct content; determinism still required |
| `flip_recall` | — | — | 0 | — | self-verdict card |
| `speak_echo` | — | — | 0 | — | STT-scored |
| `intro_echo` | — | — | 0 | — | unscored debut |
| `grammar_note` | inherits its embedded drill's row (`cloze` / `word_order`) | per drill | per drill | target | one sampler call, seeded by the SAME cardId |

---

## 5. Offline guarantees + degradation matrix

The resolver is **offline-complete by construction**: base corpus is compiled into the
binary (db.rs), everything else is installed pack SQLite/files on local disk. No
resolver code path touches the network. The only network-adjacent surface is pack
*installation*, which is upstream (journeyPackCatalog / installers, course-pack §7,
offline-cache.md per R15).

What each absence degrades:

| Absent / broken artifact | Affected | Resolver behavior | Feed effect |
|---|---|---|---|
| course pack (`journey_<target>`) | everything | n/a — the loader hard-errors at boot (R7 row-count assertion; course-pack §7) | Journey doesn't open |
| base corpus | — | impossible (embedded) | — |
| phrase pack named by a `phrase` ref's source | that source's phrase cards | `missing("pack_not_installed")` | cards dropped + engine excludes for session (§3.3); enrollment installs course-declared phrase-pack deps up front, so this is a repair path, not the normal path |
| wordpan (native→target) pair | word `extras`, etymology-gem rare face, long-press explanations | word items resolve WITHOUT extras (never a miss) | gem rare cards skip their roll; `flip_recall` back-face degrades to word-only |
| hanzipan | `char` items | `missing("pack_not_installed")` | char cards dropped (zh/ja courses only; none in `journey_en` v0.1) |
| narration pack for (book, targetLang) | `segment` items | `missing("pack_not_installed")` | segment cards dropped; earthgate anchor cards are already capability-guarded upstream (feed-ux §6.1) so posters never show for uninstalled books |
| preview-truncated narration pack | segments past the preview range | `missing("preview_truncated")` | same as uninstalled — no paywall inside a feed card |
| imagepan | `concept` items | `missing("pack_not_installed")` | runtime never emits `media:'image'` in v0.1 (feed-ux §4); nothing user-visible |
| device TTS voice for targetLang | all TTS-spoken cards | NOT a resolver concern — but the resolver's `audio` field tells the runtime which items have pre-rendered audio (segments) vs need TTS | listen→text degrade is runtime/renderer-owned; see tracked risk (§7) |

---

## 6. Test plan

All tests in `journey/content/*.test.ts`, deterministic, no IO outside
`__fixtures__/`.

**Golden fixtures per kind.** `__fixtures__/` carries: a mini course pack sqlite
(2 units, 3 skills, ~40 items across all seven kinds, strings in en+es), a 20-entry
phrase-pack sqlite, a 10-word wordpan pair DB, a 5-char hanzipan slice, and a 6-segment
narration pack dir (segments.json + audio manifest + zero-byte m4a stubs). One
snapshot test per kind: `resolveItems([ref])` output is byte-stable JSON. Fixture deps
implement `ResolverDeps` over these files (better-sqlite3 in vitest node env — same
approach as the engine's memory persistence).

**Distractor validity — property tests.** 1,000 seeded cases over the fixture pack
(fast-check or a seeded loop):

- a distractor NEVER normalized-equals the correct answer (item and token modes);
- token distractors never normalized-equal ANY `answerTokens` entry;
- no same-translation collision survives when `promptLang` is set;
- every distractor's text is in `answerLang` (rule-3 structural check: the source row
  had that language face);
- no key in `recentKeys` appears; no duplicate key or duplicate normalized text
  within a set;
- `distractors.length + shortfall === count`, and `shortfall > 0` only when the
  fixture pool is genuinely exhausted (a dedicated starved-skill fixture asserts the
  shortfall path).

**Determinism.**

- Same `(cardId, recentKeys)` ⇒ byte-identical `DistractorSet` across two fresh
  resolver instances; 100 distinct cardIds ⇒ ≥95 distinct sets (sanity, not a
  guarantee).
- `seededShuffle` stability across runs.
- **rng parity**: `journey/content/rng.ts` mulberry32/fnv1a32 outputs equal
  `engine/rng.ts` outputs for 1,000 seeds — the tripwire on the deliberate
  duplication (§0).

**Missing content.**

- Each `MissingReason` has a fixture that produces exactly it; `resolveItems` never
  throws (including a corrupted-sqlite `db_error` fixture).
- Runtime integration test (with the mock engine): spec with one unresolvable ref ⇒
  card never mounts, engine receives the §3.3 envelope
  (`abandoned + flags.contentMissing`), and the same itemRef is not re-issued within
  the session; the NEXT session may re-issue it (exclusion is session-scoped).

**Cache.**

- LRU entry bound (insert 600 ⇒ ≤500 retained, LRU order) and byte bound (oversized
  segment map evicts down to the pool cap); strokes never enter the main pool.
- `invalidate()` on a simulated pack-install event ⇒ next resolve re-queries (fixture
  swap test: wordpan installed mid-session surfaces explanations without a restart).

**Truncation guard.** Every SQL string in the module matches `/LIMIT \d+/` (static
test), and a fixture returning exactly `limit` rows triggers the truncation warning
(R7 — the Rust cap truncates silently; we never want to learn that in production).

---

## 7. Tracked risks (panel round 1)

Preserved verbatim from the round-1 panel risk lists (R16); these inform build-time
tests here and do not gate the build start.

- **[mobile-offline]** Offline completeness of listen-heavy cards depends entirely on
  device TTS voices for the target language; there is no bundled-audio fallback in v1
  and listen_* + auto-play is a large share of the feed. Add an acceptance test on a
  device WITHOUT target-language voice data installed (airplane mode), and a graceful
  per-card degrade (listen_pick → choice_pick) when speak() fails.
- **[pedagogy-fidelity]** Corpus census minor drift: on-disk today = 33 phrase packs /
  15,269 entries / 2,413 A0+A1 vs spec's '34 packs, 15,774, 2,493' — exactly one WIDE
  pack (~505 entries) missing. Also the four gap packs (nationalities, time-and-dates,
  shopping, home) are on the u02–u24 critical path but appear in no build-order/D11
  workstream; each needs 54-language fan-out before its consuming unit can pass
  V-POOL-1.
- **[pedagogy-fidelity]** Items outside the course graph: earthgate reports segment
  items as exposure-'pass'; engine getOrCreateCard for refs absent from graph.items
  (no b, no skills, no importance) is unspecced, and exposure-graded segments entering
  the DUE pool create re-read review demand the feed can't sensibly serve. Define:
  segment/anchor-only refs get logged but never carded, or carded with a no-review
  flag.
- **[product-scope]** A1 feed is text/audio-only at v1 (imagepan out per D11;
  picture-choice params-gated off) — the direct-method flash the North Star promises
  for beginners is missing at the level where it matters most. Consider a tiny bundled
  starter image set (~100 concrete A0 concepts) or an explicitly audio-first card
  design pass for Launchpad.
