# Corpan City — Localization at Scale (50 languages, both minigames + LLM)

**Status:** Design + sequenced plan. NO code in this doc — it is the spec the
implementation fans out from. This is workstream **#4** of `NEXT_LEVEL_PLAN.md`
and the single biggest force-multiplier for reach.

**Author intent in one line:** the minigames are **all English right now**
(because every shipped Track is `native=en` and the *instruction / segue /
prompt-scaffold / badge* layers were authored in English), and we must make **all
50 languages first-class** in BOTH the **minigames** (challenge content,
instructions, segues, UI strings) AND the **LLM character prompts** (persona
templates, quest clues, mood beats, rails) — with a pipeline that makes
adding/maintaining a language **as easy as dropping a corpus + a small template
set.** "Make it as EASY as possible."

**The spine this rides on (from `NEXT_LEVEL_PLAN.md`):** a **Track** =
`(native, target)`. Everything localizes against the Track:
- **UI / instructions / badges / menus** → localize into **`native`** (the
  language the learner reads help in). On a single-language stack
  (`native === target`) → localize into that one language (immersion).
- **Challenge VOCAB, segues, NPC speech** → produced in **`target`** (what
  they're learning), with an optional short `native` gloss.
- The **immersion toggle** (workstream #6) flips whether any `native` is shown at
  all; this doc must keep the `native` and `target` seams cleanly separable so #6
  can suppress `native` per Track.

---

## 1. The English-bound audit (concrete, file/function level)

Three layers exist. **Layer A is already localizable for free; Layers B and C are
the gap.**

### 1.A — Already localizable "for free" (the corpus carries it)
The 51-language, 10k-phrase-per-language corpus is reached through
`ChallengeRuntimeHost` (`src/challenges/host.ts`): `getRandomEntries`,
`searchEntries`, `getEntriesByIds`. Each `ChallengeEntry.translations[]` carries
**every language's text + romanization**. `entryPair(entry, target, native)`
(host.ts) already pulls the `(target, native)` text for ANY pair, and
`entryText` already does base-code collapsing (`ko-polite`→`ko` loose match).

**Implication:** the *content of a challenge* — the words/phrases drilled, the
distractors, the TTS strings, the gloss — is **already language-pair-agnostic.**
Point a challenge at `es` entries and it drills Spanish; point it at `ja` and it
drills Japanese. **No per-language authoring is needed for challenge vocabulary.**
The "all English" symptom is NOT the vocab — it is Layers B + C wrapped around it.

> Gap inside Layer A: the **mock host** (`MOCK_CORPUS`) is EN↔ES only. That's a
> dev-only seam; the real host serves all 51. But the *standalone* dev experience
> is EN/ES-locked, which has masked the Layer-B/C English-binding from agents who
> only tested standalone (the recurring "verify the REAL app" trap). **Action:**
> seed a few more pairs into `MOCK_CORPUS` (e.g. `fr`, `ja`, `ar`) so standalone
> can exercise a non-EN native + a non-Latin/RTL target. (Dev ergonomics only.)

### 1.B — Hardcoded English INSTRUCTION / UI strings (the in-card layer)
- **`src/challenges/tools/strings.ts`** — `ChallengeStrings` (~50 keys: "Tap to
  continue", "Find the matching pairs", `whichMeant(native)`, "Tough/Okay/Nailed
  it", etc.). `STRINGS = { en }` only; `challengeStrings(uiLang)` **already takes
  a lang and falls back to `en`** — the seam is cut, the table is empty. **This is
  the single highest-leverage localization target: ~50 strings × 50 langs = the
  whole minigame chrome.**
- **`content/challenges/prompts.json`** — NPC *pretext* lines per tool
  (`"My market words got all scrambled…"`). Loader `pretextLine(toolId, uiLang)`
  in `registry.ts` **already does per-language lookup with `en` fallback** — only
  the `en` block is authored.
- **Shell / menu / tracker / badge / economy / inventory / map** copy — per
  `COHESION_ITERATION.md §8` every new surface is told to "localize every new
  string through the same per-locale `strings` override the shell already uses,"
  but **that override table does not yet exist as a single seam** — each surface
  risks re-hardcoding English. (See §2: we give them ONE seam.)

### 1.C — English-bound LLM prompt scaffolding (the persona layer)
- **`src/npc/promptProgram.ts`** — the system prompt is assembled from **English
  instruction prose**: `rails` ("at most 2 short sentences · stay in character
  …"), `SCAFFOLD_RULES` ("Beginner: very common words…"), `languageDiscipline`,
  `questFactsSection` ("QUEST CONTEXT (facts — obey exactly)…"),
  `cluesLeanSection` ("QUEST WHISPERS…"), `toolProtocolSection`,
  `challengeSegueSection`. `LANG_NAME` maps only **11 codes** → English names
  (everything else falls through to the raw code).
- **`src/npc/personaGen.ts`** — `ARCHETYPES[]` is **deeply English-bound**:
  `label` ("a warm-hearted baker"), `quirkSeeds`, `pretexts`, `topics`,
  `backstoryHook` — all English. The **scripted fallback** (`ES_FALLBACK`,
  `NEUTRAL_FALLBACK`) is **Spanish-or-English only**; `fallbackLangOf(scene)`
  returns `"es" | "neutral"` — there is **no `(native, target)` awareness** and no
  table for the other 49 targets.
- **`content/quests/*.json`** — `promptProgram.personaTemplate` is authored in
  **English** ("You are teaching a learner whose goal is to {objective}…"), as is
  `quest.title` / `narrative` / step `label` / authored `clue` / `nextHint`.
- **`src/npc/challengeSegues.ts`** — `SEGUES` ships **`es` + `en` only** (a
  `GENERIC` `es`/`en` last-ditch). `localeFor(tool, lang)` already does
  `target → en → generic`, so a `ja` learner currently gets **English segues** —
  exactly the "minigames are all English" bug, in the segue path.

### The audit's verdict
- **Vocabulary:** solved by the corpus + `entryPair`. Zero per-language work.
- **Instruction / UI / badges:** ~50 challenge strings + ~20 pretexts + the new
  cohesion-surface copy → **one string table, generated into 50 langs** (§2).
- **Segues:** `SEGUES` table + `GENERIC` → **generate the per-tool target-language
  segue data for all 50 targets** (§4).
- **LLM scaffold:** rails/scaffold/discipline/facts blocks → **parameterize by
  `native`/`target`, keep most language-agnostic, generate the small authored bits
  per language** (§3).
- **Persona flavor + scripted fallback:** `ARCHETYPES` English + ES/neutral
  fallback → **per-`(target)` scripted line packs + native-glossed labels**,
  generated (§3, §4).

---

## 2. The string localization system (one seam for all in-app strings)

**Reuse the proven repo pattern verbatim** (tutomaton `src/i18n.ts` +
`tools/gen_i18n.py`, also in pronunciation-coach). It already solved exactly this:
an English source-of-truth dict, an OpenAI-generated `LOCALES` block between
`// GENERATED_LOCALES_START/END` markers, a `t(key, lang, params)` resolver that
collapses variants (`ko-polite`→`ko`, `pt-BR`→`pt`, `zh-Hans`→`zh`) and falls
back **per-key** to English (never a blank). Pitfalls already burned-in
(MEMORY `tutomaton-i18n-tooling`): never `unicode_escape` TS values (mojibake),
locale regex `[a-z]{2,3}` must allow `yue`, post-merge diff insertions-only.

### 2.1 Structure — a single pack-wide `src/i18n/strings.ts`
Promote `challenges/tools/strings.ts` into the **pack-wide** string seam (or
re-export through it) so every surface — challenges, menu, tracker, badges,
economy/inventory, map, onboarding copy — reads `t(key, native)` from ONE table.

```
src/i18n/
  strings.ts        // en = source of truth (the union of ChallengeStrings +
                    //   menu/tracker/badge/economy/map keys), + GENERATED block,
                    //   + t(key, native, params), collapseLocale(), isMissing()
  tools/gen_i18n.py // copied from tutomaton; reads en, writes GENERATED block
```

- **`ChallengeStrings` stays its typed shape** but its values come from `t(...)`.
  The function-valued keys (`whichMeant(native)`, `meansHint(native)`,
  `heard(transcript)`) become `t("whichMeant", native, { native: glossWord })`
  with `{placeholder}` tokens (the gen tool already preserves `{…}`).
- **Resolution language = the Track's `native`** for instructions/UI (the gloss
  text inside a card). Pretexts/segues resolve against **`target`** (§4).
  `runChallenge` already passes `uiLanguage` (defaulting to `ctx.nativeLanguage`)
  — wire that through to `challengeStrings`/`t`.

### 2.2 Authoring + storage + shipping
- **Authored:** only the **English `en` dict** + the **`{placeholder}` contract**.
  Everything else is generated.
- **Stored:** the generated `LOCALES` block is **committed into `strings.ts`**
  (same as tutomaton) so the pack works fully offline with zero network — this is
  small (~50 keys × 50 langs of short UI text ≈ tens of KB in the bundle, well
  under any budget; it is code, not localStorage).
- **Shipping / CDN override (catalog-driven, no app release):** per the repo
  principle *"catalog-driven everything"* and *"content ships without an app
  release,"* allow an **optional catalog/CDN string-pack** that the runtime merges
  OVER the committed `LOCALES` at mount (`fetch` a `corpan-city-strings/<ver>.json`,
  cache in **IndexedDB** per `corpan-pack-storage` — NOT localStorage). This lets
  us fix a bad translation or add a language post-ship. Committed table is the
  floor; CDN is the patch layer. Merge is per-key so a partial CDN pack is safe.

### 2.3 Runtime resolution + missing-string detection
- `t(key, native)` → `LOCALES[collapse(native)]?.[key] ?? LOCALES[native]?.[key] ??
  en[key]`. Never blank.
- **Dev-mode missing-string assertion:** a `vitest` test (mirroring
  `npc.test.ts`) asserts EVERY `ChallengeStrings`/menu key is present in `en`, and
  that every generated locale is a **subset of `en`'s keys** (no orphan keys), and
  that `{placeholder}` tokens are preserved across all locales. CI gate.
- **No silent English:** in dev, `t` logs once per `(key, lang)` when it falls
  back to `en` for a locale that *should* be complete (per MEMORY "noisy errors").

---

## 3. LLM prompt localization (any `(native, target)` pair, ~200 tokens)

**Principle (from `COHESION_ITERATION.md §7`):** the small model (Qwen3-4B) is a
**voice + translator**, not a planner. The author writes the subtlety; the model
re-voices ONE authored line in character + `target`. Localization keeps that
intact: **most rails are language-agnostic or `native`-rendered; the model is
*instructed in `native`* and *told to speak `target`*.**

### 3.1 What goes in which language (the parameterization rule)
| Prompt block (promptProgram.ts) | Language strategy |
|---|---|
| `LANG_NAME` (names languages) | **Expand to all 51 codes**, names rendered in `native` (a `de` learner sees "Spanisch", not "Spanish") — a 51×collapsed table, generated. |
| `rails` (brevity/character) | **`native`** (the model follows instructions best in a major language; render in `native`, fall back to English). Keep ≤35 tokens. |
| `SCAFFOLD_RULES` | **`native`**, generated (3 short strings × 50). |
| `languageDiscipline` ("Reply in {target} ONLY…") | **`native`**, parameterized with `target`/`native` *names*. |
| `questFactsSection`, `cluesLeanSection`, `challengeSegueSection` framing | **`native`** instruction prose; the **authored quote inside** (`authoredClue`/`authoredNextHint`/`segue tag`) is **`target`** (or authored-per-pair, §4). |
| `toolProtocolSection` | **language-agnostic** (it's JSON format spec — keep English/symbolic; the model handles it fine and it's outside the persona budget). |
| `personaSeed` / `mood` | persona seed in `native` (label) but the model SPEAKS `target`; mood beats `native`. |

> Why `native` for instructions, not `target`: a 4B model obeys instructions far
> more reliably in a high-resource language than in a low-resource `target`, and
> the learner never sees the system prompt. The model is told, in `native`, to
> *produce* `target`. This is the key insight that keeps prompts robust across 50
> pairs without per-pair prompt-engineering.

### 3.2 The instruction-string seam for prompts
Promote the English literals in `promptProgram.ts` (`rails`, `SCAFFOLD_RULES`,
the `questFactsSection`/`cluesLeanSection` framing, `languageDiscipline`,
`challengeSegueSection` wrapper) into a **second i18n table** — `src/i18n/prompt.ts`
— resolved by `native`, same `t`/gen mechanism as §2 but a SEPARATE namespace
(prompt strings are instruction-register, not UI-register; keeping them apart lets
us tune translation guidance — e.g. "translate as an instruction to an AI, keep
the {target}/{native} tokens"). Each entry stays terse to honor the ~200-token
budget; the gen tool is told to **not lengthen** (a per-namespace system prompt in
`gen_i18n.py`: "terse, imperative, preserve token count").

### 3.3 `LANG_NAME` → full 51-language table, rendered in `native`
`languageName(code, native)` returns the language's name **in the learner's native
language**. Generated: a 51×51 collapsed map is overkill — instead generate a
**per-`native` block** mapping the ~51 target codes → their endonym/native-rendered
name (51 langs × ~51 names, small). Fall back to the raw code (current behavior),
never block.

### 3.4 Persona flavor (personaGen) localization
- `ARCHETYPES[].label` and `quirkSeeds`/`topics`/`backstoryHook` are **persona
  flavor fed into the prompt** (the model speaks `target` from them). Two options,
  recommend **(a)**:
  - **(a) Keep archetype flavor in `native`, generated.** The label/quirk/topic
    seeds are short; generate per-`native`. The model reads them as `native`
    instructions and produces `target` speech. Cheapest; one table.
  - (b) Author per-`target` — unnecessary; the model translates fine from a
    `native` seed.
- `topics[]` ("bread","price","sea") are **content selectors**, not display —
  they map to corpus search terms. Keep them as **stable English keys** used only
  to `searchEntries`, and never shown to the user; the *words drilled* come back
  from the corpus in `target`. (So topics need NO translation — they're a query
  vocabulary, an internal index.) Document this clearly so no one "localizes" the
  query keys.

### 3.5 Scripted fallback (no-LLM) — the real per-`target` authoring need
`buildScriptedFallback` is the one place that **must read in `target` with no
model**. Today it's `es`/`neutral` only. Replace with a **per-`target` scripted
line pack** keyed `(archetypeId → {greet,teach,bye})` in `target`, generated (§4)
— `fallbackLangOf(scene)` becomes `scene.targetLang` (drive off the Track's
`target`, not era heuristics). When a `target` pack is missing, degrade to a
**corpus-built line** ("{topic-from-corpus} — repite") rather than English, so the
no-LLM path is never English in a non-English Track. Keep `{topic}` substitution
(topic resolved to a `target` corpus word).

---

## 4. Per-pair content generation pipeline (stamp all pairs offline)

**Scope reality:** there are 2,450 ordered pairs, but the localization surface
factors so we **almost never author per-PAIR** — we author **per-`native`** (UI
instructions) and **per-`target`** (segues, scripted persona lines, in-`target`
quotes). That collapses 2,450 → **~50 + 50 = ~100 generated tables**, each small.
The rare genuinely per-pair artifact is an authored quest's `target`-language
clue/nextHint quote — handled per-quest, not per-arbitrary-pair (a quest declares
its `learnerPair`; generate the quote in that pair's `target`).

### 4.1 What is generated vs corpus-derived vs hand-authored
| Artifact | Source | Cardinality |
|---|---|---|
| Challenge vocab, distractors, TTS, gloss | **Corpus** (`entryPair`) | free, all pairs |
| In-card UI / instruction strings (§2) | **Generated** from `en` | ~50 keys × 50 native |
| Prompt instruction strings (§3.2) | **Generated** from `en` | small × 50 native |
| Language-name table (§3.3) | **Generated** | ~51 × 50 native |
| Tool segues (`SEGUES`) — tag/chip/phrases | **Generated** per `target` | 20 tools × 50 target |
| NPC pretexts (`prompts.json`) | **Generated** per `target`(speech) / authored-in-`native` framing | 20 × 50 |
| Archetype persona flavor (§3.4) | **Generated** per `native` | ~16 × 50 |
| Scripted-fallback line packs (§3.5) | **Generated** per `target` | ~16 archetypes × 3 × 50 |
| Quest title/narrative/step-label | **Authored EN → generated** per `native` (UI) | per-quest × 50 |
| Quest authored clue/nextHint quote | **Authored EN → generated** per the quest's `target` | per-quest-step |
| Badge names/taxonomy (workstream #2) | **Generated** per `native` (see #2 doc) | shared seam |

### 4.2 The generator (one script family, reuse `gen_i18n.py`)
- **`tools/gen_i18n.py`** (copied) for every **string table** above — it already
  does manifest-driven language enumeration, `{placeholder}` preservation,
  idempotent block rewrite, `.env` key loading. Add per-namespace system prompts
  (UI vs instruction vs in-`target`-speech vs segue).
- **`tools/gen_segues.py`** — a thin wrapper that, for each tool's `en` segue
  (`tag/chip/phrases`), asks for the **`target`-language** equivalents
  (short, read-aloud-clean), writing the `SEGUES` table per target. Same engine.
- **Languages enumerated from a single manifest list** (mirror tutomaton's 51-code
  `languages` array) so "all langs" = one source of truth; pass `argv` to do a
  subset.

### 4.3 Offline grading + validation (RAG-against-CDN-sqlite style)
Per MEMORY `tutomaton-prompts-and-rag-validation` (validate by running queries
against the CDN sqlite locally — no device):
1. **Schema/coverage gate (CI):** every generated locale is a key-subset of `en`;
   `{placeholder}` tokens preserved; no empty strings; `yue`/`zh-*`/`pt-*`/`pa-*`
   variants present. (vitest, §2.3.)
2. **Corpus-grounding gate:** for a sample of `(target)` per tool, run the actual
   `searchEntries`/`getEntriesByIds` the challenge would run **against the release
   sqlite locally**, assert ≥N entries come back with non-empty `target` text +
   romanization where expected — proves the vocab layer is real in that language,
   not just the chrome. Catches "we localized the buttons but the corpus has no
   `sw` rows for this domain."
3. **Back-translation spot-check (optional, sampled):** back-translate a sample of
   generated `target` segues/fallback lines to English and flag large semantic
   drift for human review. Cheap, sampled, not a hard gate.
4. **Length gate:** prompt-instruction strings must stay within a per-key token
   budget (the model's ~200-token persona budget is sacred) — fail the gen if a
   locale blows it; re-prompt "shorter."
5. **TTS/STT readability gate:** flag generated `target` segue phrases that contain
   characters outside the language's script (model leakage) before they reach TTS.

### 4.4 No placeholders
Every generated table must be **complete for the manifest language set** before a
language is marked shipping. The CI gate (§4.3.1) is the definition of "done for
language X." A partially generated language is **not advertised** in the Track
picker (it falls back to English silently only as a safety net, never as a
shipped state).

---

## 5. Scripts, RTL, fonts, TTS/STT coverage (52 scripts, RTL, gaps)

### 5.1 Script + direction
- **Reuse the host's `isRTL(langCode)` + `RTL_LANGUAGES`** (`corpan-app/src/util/
  convert.ts`, `store/constants.ts`: `["ar","he","fa","pa-Arab","ur"]`, base-code
  aware so `pa-Arab` is RTL but `pa-Guru` is LTR). The pack is a standalone IIFE
  and must not import across packages → **vendor a tiny `src/i18n/dir.ts`** with
  the same `RTL_LANGUAGES` list + `isRTL` (single source of truth documented as
  mirroring the host; a test asserts parity if reachable). Cheap, ~6 lines.
- **Apply direction at the seam, per text's language**, not globally: a card shows
  `target` text (maybe RTL) AND `native` instructions (maybe LTR) simultaneously.
  Set `dir="rtl"`/`dir="ltr"` + `text-align` **on the element rendering that
  specific string**, driven by `isRTL(thatString'sLang)`. The challenge tools
  render `target` vocab and `native` gloss in different nodes already — tag each.
- **Romanization:** `ChallengeTranslation.romanization` exists per entry;
  `entryPair` returns it. Surface romanization **under** the `target` script for
  non-Latin targets (a `strings.ts` toggle `showRomanization`, default on for
  non-Latin `target` when `native` is Latin; immersion toggle #6 can hide it).

### 5.2 Fonts
- Non-Latin scripts (CJK, Arabic, Devanagari, Thai, Hebrew, etc.) must render in
  the pack's HD-2D billboards AND the card UI. The pack runs in the host WebView →
  **rely on the host/system fonts first** (the corpus already renders these langs
  across the app). For the **3D billboard "paper people"** name labels and any
  canvas-rendered text, ensure the glyph rasterizer uses a system font stack that
  covers the script (document a `FONT_STACK` per script-family; never a single
  Latin-only webfont). Flag: if any text is drawn into a Babylon dynamic texture,
  it must use a script-covering font or it tofu-boxes — call this out for the
  CONTENT_SCALE owner (billboards) explicitly.

### 5.3 TTS / STT gaps (degrade gracefully — pattern already exists)
- **TTS:** the host's `speak(uiCode, text)` is best-effort; for Apple-TTS-gap
  langs the app already "surfaces generically in OnboardingTTSInstructions"
  (MEMORY). The challenge `speak`/`hearIt` affordance must **degrade silently**
  when no voice exists for `target` — keep the button but no-op + a tooltip via
  `strings.ts` (`ttsUnavailable`), never a broken audio promise (host.ts already
  try/catches `speak`). **Do not block a challenge on TTS.**
- **STT:** `read-aloud`/`say-it-back` already feature-detect via
  `host.sttAvailable()` and fall back to **self-rate** (`strings.ts.selfRateHint`,
  "STT unavailable — tap to self-rate"). This is the correct degrade and is
  **already wired** — just ensure the self-rate strings are localized and that
  Whisper-gap `target` langs (per MEMORY: Android CPU-only, language coverage
  varies) take the self-rate path. STT language code passed through is the
  `target`; if Whisper lacks it, `sttAvailable` should return false → self-rate.
- **Principle:** every audio capability is additive; a language with no TTS and no
  STT still has a **fully playable** text/choice/grid challenge set + a localized
  self-rate path. No language is "broken," only "quieter."

---

## 6. Authoring + maintenance ergonomics ("add a language easily")

**The goal:** adding/refreshing a language is **drop the corpus (already there) +
run one command.** Concretely:

1. **Add the language code to the pack manifest's `languages` list** (mirrors
   tutomaton). This is the ONE source of truth for "what 50 means."
2. **`python tools/gen_i18n.py <code>`** — fills the UI table, prompt table,
   language-name table.
3. **`python tools/gen_segues.py <code>`** — fills the per-`target` segue +
   scripted-fallback + pretext tables.
4. **CI runs the §4.3 gates** — coverage, placeholder, corpus-grounding, length,
   script. Green = the language is shippable; the Track picker advertises it.
5. **Nothing else.** Vocab is already corpus-served; RTL/script/TTS-gap are
   table-driven and automatic.

Maintenance:
- **Missing-string detection** is the CI subset gate (§2.3, §4.3.1) — a new `en`
  key fails CI until regenerated, so English can never silently leak.
- **Re-translate one key:** edit `en`, re-run the gen tool (idempotent, rewrites
  the GENERATED block; diff is insertions/edits only per the tutomaton lesson).
- **Hotfix without a release:** push a corrected key to the CDN string-pack
  (§2.2); runtime merges it over the committed table.
- **A `docs/ADDING_A_LANGUAGE.md`** (one page) captures the 5 steps verbatim.

---

## 7. Phased build plan

Ordering matches `NEXT_LEVEL_PLAN`'s "MVP one non-EN target end-to-end → seam
everywhere → generate all 50 → script/RTL/TTS polish."

### Phase L0 — Cut the seams (no new languages yet, regression-safe)
- Stand up `src/i18n/strings.ts` (UI namespace) + `src/i18n/prompt.ts`
  (instruction namespace) + `src/i18n/dir.ts` (RTL) + `tools/gen_i18n.py`
  (copied). Route **every** `strings.ts` call, every `promptProgram.ts` English
  literal, and `languageName` through `t(key, native)`. **`en`-only LOCALES** ⇒
  zero behavior change (pure refactor; the existing `en` fallback is the output).
- Expand `LANG_NAME` to all 51 codes (English names) as the floor.
- Seed `MOCK_CORPUS` with `fr`/`ja`/`ar` rows so standalone can show a non-EN,
  non-Latin, RTL Track (dev-only; unblocks honest local verification).
- **Exit:** `npm run build` + the full minigame set behaves **identically** in
  `en→es`; the i18n subset/placeholder CI gate is green on `en`.

### Phase L1 — MVP: ONE non-EN Track fully localized end-to-end
- Pick **`en→fr`** (Latin, has TTS+STT, easy to eyeball) AND **`es→en`** (proves
  `native≠en`). Generate `fr` + `es` for: UI strings, prompt strings, segues,
  scripted fallback, language names, the MVP quest's title/labels/clue quotes.
- Drive `fallbackLangOf` off the Track `target`; wire `runChallenge` `uiLanguage`
  → `native`; render each string with its language's `dir`.
- **Verify in the REAL Corpán app** (not just standalone — the recurring trap):
  challenges, segues, NPC speech, menu/tracker, badges all in `fr`/`es`; no
  English leaks in `en→fr`; single-language stack `fr→fr` immersion works.
- **Exit:** an `en→fr` and an `es→en` Track are 100% non-English-where-expected,
  corpus-grounding gate green for both.

### Phase L2 — Generate all 50 (the force-multiplier)
- Add the full manifest language list; run the gen tools for **all**; CI gates
  enforce completeness. Advertise only green languages in the Track picker.
- Add the CDN string-pack override path (IndexedDB-cached) for post-ship fixes.
- **Exit:** every manifest language passes §4.3; the Track picker offers them;
  spot-check ~6 diverse langs (CJK, RTL, Cyrillic, Devanagari) in the real app.

### Phase L3 — Script / RTL / TTS-gap polish
- RTL layout pass on every surface (cards, menu, tracker, map labels, billboards);
  romanization under non-Latin `target`; font-stack coverage for canvas/billboard
  text; TTS/STT graceful-degrade verified on an Apple-gap lang + a Whisper-gap
  lang (self-rate path). Hand the billboard-font item to CONTENT_SCALE.
- **Exit:** Arabic (`en→ar`) reads RTL correctly end-to-end; a TTS-gap and an
  STT-gap language are fully playable with localized degrade copy.

### Cross-cutting (every phase)
- **Localize every new string** through the seam — no surface re-hardcodes English
  (the CI subset gate enforces it).
- **Single-language stack:** `native===target` ⇒ instructions resolve to that one
  language (immersion); never assume two langs; the immersion toggle (#6) reads
  the same `native`/`target` seam.
- **Storage:** committed tables are bundle code (tens of KB); CDN string-pack →
  **IndexedDB**, never localStorage (per `corpan-pack-storage`).
- **Noisy errors:** every fallback-to-English in a "complete" locale logs once.
- **No placeholders:** a language is shipped only when its gates are green.

---

## 8. Open questions for the owner
1. **Instructions in `native` vs English for low-resource pairs:** §3.1 renders
   rails/scaffold in `native` for learner-invisible prompt instructions. For a
   *very* low-resource `native` where the 4B model follows English better, do we
   prefer English instructions + `target`/`native` *names*? Recommend: `native`
   for major langs, **English instructions for the long tail**, decided per-native
   by a generated `instructionLang` flag (cheap, hedges model-following risk).
2. **CDN string-pack now or later:** ship committed-table-only for L1–L2 (simplest)
   and add the CDN override in L2/L3? Recommend yes (committed first, CDN as the
   hotfix layer once content stabilizes).
3. **Quest per-pair quotes:** authored quests declare a `learnerPair`; we generate
   the `target` clue/nextHint for THAT pair. If we later want one quest reusable
   across many targets, do we generate its quotes for every target at build time
   (cardinality = quests × 50) or lazily? Recommend build-time for the small
   authored quest set; revisit if quest count explodes (CONTENT_SCALE).
4. **Mock corpus breadth:** how many extra pairs to seed for standalone dev (§1.A)
   — just `fr`/`ja`/`ar`, or a wider set? Recommend the 3 (covers Latin/CJK/RTL).
