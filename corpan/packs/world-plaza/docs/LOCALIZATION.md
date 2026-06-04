# World Plaza — Localization Foundation (the "is everything keyed?" audit)

**Question this answers (owner):** *"Is everything keyed at the framework level so
we just fill in translations to localize to all languages?"*

**Short answer:** The **UI chrome is fully keyed and shipped in ~46 languages**
(`src/i18n/`, R2-4). The **NPC/prompt + challenge instruction layers are keyed but
under-filled** (the seams exist; the tables are English-/Spanish-only). The **quest
CONTENT layer is the real gap**: `content/quests/*.json` carry **hardcoded English
strings** AND are **hardcoded to the EN-native / ES-target pair** — so quests are
neither keyed nor pair-agnostic. This doc maps every user-facing string source with
its keyed?/gap status and the fill plan.

It composes with two siblings: `LOCALIZATION_SCALE.md` (the original 50-lang plan)
and `IMMERSION_TOGGLE.md` (immersion only *selects* native-vs-target; localization
provides the strings in every language — see §6).

---

## 0. The two orthogonal axes (don't conflate them)

A string is localized when BOTH are solved:

1. **Keyed?** — is the source a stable KEY resolved through a catalog
   (`t(key, lang)`), or a hardcoded literal? Only keyed strings can be filled per
   language without editing code/content per pair.
2. **Pair-agnostic?** — does the surface work for ANY `(native, target)` pair, or
   is it locked to one pair (e.g. `learnerPair:{es,en}`, `languageCodes:["es"]`)?
   A quest locked to ES-target simply *does not exist* for a JA learner.

UI chrome solved both (keyed + always renders in the live `uiLocale`). Quest
content solved neither. The middle layers (prompt/challenge/segue) are keyed/
parameterized but under-filled.

---

## 1. Full string-source audit

Legend: ✅ done · 🟡 seam exists, under-filled · ❌ hardcoded literal / pair-locked.

| # | User-facing string source | File(s) | Keyed? | Pair-agnostic? | Status |
|---|---|---|---|---|---|
| 1 | **UI chrome** — welcome, chooser, onboarding, menu, status capsule, quest hints/progress, interlude, place tag, immersion toggle | `src/i18n/strings.ts` + `surfaceStrings.ts` | ✅ `t(key, uiLocale)` | ✅ any native; target under immersion | ✅ **46 langs shipped** |
| 2 | **Challenge instruction strings** ("Tap to continue", "Find the matching pairs", "Nailed it", `whichMeant(native)`) | `src/challenges/tools/strings.ts` | 🟡 `challengeStrings(uiLang)` seam exists, table is `en`-only (the `_uiLang` arg is even unused) | ✅ (pair-agnostic by design) | 🟡 **fill: ~50 keys × 46 langs** |
| 3 | **NPC challenge segues** (the "let's play" pretext per tool) | `src/npc/challengeSegues.ts` `SEGUES()` | 🟡 keyed by tool×lang, only `es`/`en` authored | ✅ keyed by target lang | 🟡 **fill: per-tool target segues, 46 langs** |
| 4 | **NPC challenge pretext lines** (`prompts.json`) | `content/challenges/prompts.json`, `registry.ts pretextLine(toolId, uiLang)` | 🟡 per-lang lookup w/ `en` fallback, only `en` filled | ✅ | 🟡 **fill** |
| 5 | **LLM prompt scaffolding** — rails, scaffold rules, language discipline, quest-facts framing | `src/npc/promptProgram.ts`, `promptLocale.ts` | 🟡 `targetLanguageDirective` exists (npc-lang); rails/scaffold still EN prose | ✅ parameterized by target/native NAMES | 🟡 **npc-lang owns; see LOCALIZATION_SCALE §3** |
| 6 | **Persona flavor** (archetype labels, quirk/topic seeds, scripted fallback) | `src/npc/personaGen.ts`, `content/npc/roles.json scriptedFallback` | ❌ English archetypes; `roles.json` fallback is **Spanish-only** | ❌ ES-target only | 🟡 **npc-lang; per-target scripted packs** |
| 7 | **Special-NPC display names** ("the café host") | `content/npc/special.json`, `src/quest/specialNpc.ts` | ✅ **already keyed** (`nameKey` + `displayName(def,t,lang)` → `t(nameKey,lang)`, literal `name` as fallback) | ✅ | 🟡 **seam ready — fill the `special.*` catalog keys** |
| 8 | **Quest title** | `content/quests/*.json .title` | ❌ hardcoded English | ❌ pair-locked | ❌ **the gap (§2)** |
| 9 | **Quest narrative** | `.narrative` | ❌ hardcoded English | ❌ | ❌ **the gap (§2)** |
| 10 | **Quest step label** | `.steps[].label` | ❌ hardcoded English | ❌ | ❌ **the gap (§2)** |
| 11 | **Quest `learnerPair`** | `.learnerPair` | n/a | ❌ **`{target:es,native:en}` literal** | ❌ **structure — quest-flow (§2)** |
| 12 | **Quest `contentSelector.languageCodes`** | `.promptProgram.contentSelector.languageCodes` | n/a | ❌ **`["es"]` literal** | ❌ **structure — quest-flow (§2)** |
| 13 | **Objective beacon / wayfinding text** (anchor names, "talk to {who}") | `src/quest/questTracker.ts`, `anchorName`, `wayfinding/*` | ✅ via tracker strings (#1) + `anchorName` resolver | ✅ | ✅ (anchor *ids* prettify; named NPCs via #7) |
| 14 | **Corpus vocabulary** (the words drilled, glosses, TTS strings) | host corpus via `entryPair` | ✅ corpus carries every lang | ✅ point at any target | ✅ **free — no per-lang authoring** |

**The verdict, by layer:**
- **UI chrome (#1, #13):** ✅ done — fill = already shipped.
- **Challenge + segue + pretext (#2–#4):** 🟡 keyed, just need the 46-lang fill
  (mechanical, gen-tool driven). The single highest-leverage remaining fill.
- **Prompt + persona (#5, #6):** 🟡 npc-lang's domain (LOCALIZATION_SCALE §3).
- **Special-NPC names (#7):** 🟡 seam DONE; fill the `special.*` catalog keys.
- **Quest content (#8–#12):** ❌ the real foundation gap — neither keyed nor
  pair-agnostic. Detailed below.

---

## 2. The quest gap (#8–#12) — keyed + pair-agnostic quests

### 2.1 What's wrong today
A quest like `es-cafe.json` hardcodes `"title": "Coffee on the Plaza"` (English),
`"learnerPair": {"target":"es","native":"en"}`, and
`"contentSelector.languageCodes": ["es"]`. Consequences:
- A **JA learner gets no quest** (none target `ja`); the EN strings would show raw.
- The strings **can't be filled per language** — they're literals, not keys.
- The contract's own promise — *"Quests are templates parameterized by learnerPair
  + domain, so they can be stamped out toward all 2,450 ordered pairs"* — is unmet.

### 2.2 The fix has TWO halves (ownership)
**A. Structure → pair-agnostic (owner: quest-flow).** A quest template should NOT
carry a `learnerPair` or a literal `languageCodes`. Instead the runtime binds the
quest to the SESSION's `learnerPair` (already resolved by the entry orchestrator)
and derives `contentSelector.languageCodes = [learnerPair.target]`. One
`cafe.json` then serves every pair. (Migration: keep `learnerPair` optional for
back-compat; when absent, bind to the session pair.)

**B. Strings → keyed (owner: i18n / this doc).** Replace the literal
`title`/`narrative`/`label` with `*Key` fields resolved through a quest string
catalog, rendered in `uiLocale` (native, or target under immersion), with the
literal as the English fallback (never blank). See §3.

The two halves are independent and compose: A makes one quest reach every pair; B
makes its strings render in the player's language.

---

## 3. The keyed-quest-string contract (the design quest-flow consumes)

Additive, back-compat optional `*Key` fields on the quest contract
(`contracts/src/quest.ts`). The runtime prefers the key (resolved via a quest
string catalog) and falls back to the literal:

```ts
// Quest
titleKey?: string        // → t(titleKey, uiLocale) ?? title
narrativeKey?: string    // → t(narrativeKey, uiLocale) ?? narrative
// QuestStep
labelKey?: string        // → t(labelKey, uiLocale) ?? label
```

Resolution rule (mirrors the chrome `t`): `questString(key, uiLocale) ?? literal`.
Never blank — the authored English literal is the per-key floor exactly like the
chrome catalog's `en`. `uiLocale` comes from the immersion resolver (§6): native by
default, target under immersion.

**Catalog home:** a SEPARATE namespace from the chrome catalog (quest copy is
content-register, not UI-register, and is authored/tuned differently). Recommend
`src/i18n/quests.ts` (same `en`-source + `GENERATED_LOCALES` + `tools/gen_i18n.py`
mechanism as `strings.ts`, a second invocation), OR a per-quest sidecar
(`content/quests/<id>.<lang>.json`) loaded + merged at catalog build. Recommend the
**single generated `quests.ts`** for parity with the chrome pipeline and offline-
floor guarantees (it's still small — ~3 strings × N quests × 46 langs).

**Key naming:** `quest.<questId>.title` / `.narrative` / `.step.<stepId>` — stable,
derivable from the quest+step ids the JSON already has.

**Special-NPC names (#7) are already on this pattern** (`nameKey` →
`t(nameKey, lang)`); the quest keying is the same shape, so one `questString`/
`t` resolver covers both. Fill the `special.*` keys in the same catalog.

---

## 4. The fill plan (mechanical, once keyed)

Per layer, in leverage order:

1. **Challenge strings + segues + pretexts (#2–#4)** — the biggest visible win and
   already keyed. Author the `en` source-of-truth for each, then
   `tools/gen_i18n.py`-style generate 46 langs. (Coordinate the gen namespace; the
   chrome tool is reusable verbatim with a different source dict.)
2. **Special-NPC names (#7)** — fill the `special.*` keys (seam is live).
3. **Quest strings (#8–#10)** — after the `*Key` contract lands (quest-flow's
   structure + this doc's keying): author `en` quest catalog, generate 46 langs.
4. **Prompt/persona (#5, #6)** — npc-lang's per-target scripted packs +
   native-rendered scaffolding (LOCALIZATION_SCALE §3).

**Gen-tool reuse (proven):** `tools/gen_i18n.py` already does this for the chrome
catalog — quoted dotted keys, OpenAI translate, `{placeholder}` preservation,
per-key EN fallback, idempotent MERGE. RUN IT IN THE FOREGROUND IN ~10-LANG BATCHES
(backgrounded runs lose network mid-run — a real gotcha we hit). Point it at the
new source dict for each catalog.

---

## 5. "Are we keyed at the framework level?" — the honest scorecard

| Layer | Keyed framework? | Filled? |
|---|---|---|
| UI chrome | ✅ | ✅ 46 langs |
| Challenge instructions / segues / pretexts | ✅ (seam) | ❌ en/es only — **fill** |
| Special-NPC names | ✅ | ❌ — **fill `special.*`** |
| Quest title / narrative / label | ❌ — **add `*Key` (§3)** | ❌ |
| Quest pair-agnosticism | ❌ — **quest-flow (§2.2A)** | ❌ |
| LLM prompt / persona | 🟡 partial | ❌ — npc-lang |
| Corpus vocabulary | ✅ | ✅ free |

So: **chrome yes; the rest is a known, sequenced gap with the seams mostly in
place.** The two pieces of net-new framework work are (a) the quest `*Key` contract
+ resolver + catalog (this doc / i18n), and (b) pair-agnostic quest binding
(quest-flow). Everything else is a fill against existing seams.

---

## 6. Composition with immersion + RTL (no conflict)

- **Localization** provides the string in every language; **immersion** only
  decides which side (`uiLocale() = native | target`) each surface renders. Quest
  `*Key` resolves in `uiLocale` exactly like chrome `t` — so a quest title shows in
  the native by default and in the target under immersion, for free.
- **RTL** follows the effective `uiLocale` (`applyDir`), so a quest rendered in an
  RTL target under immersion mirrors with the rest of the chrome — already wired.
- **Graceful degradation:** a missing target quest string → fall back to the
  English literal for that one string + log noisily (never blank, never crash).

---

## 7. Sequenced next steps

1. **quest-flow:** make quest binding pair-agnostic (§2.2A) — drop literal
   `learnerPair`/`languageCodes`, bind to the session pair. (Structure; unblocks
   every pair.)
2. **i18n (this doc):** add the `*Key` contract + `questString` resolver +
   `src/i18n/quests.ts` catalog (§3). (Keying.)
3. **fill:** author `en` quest catalog + challenge/segue/pretext `en`, generate 46
   langs via the gen tool (§4). (Translation.)
4. **npc-lang:** prompt/persona per-target packs (LOCALIZATION_SCALE §3).
5. **gate check:** with 1–3 done, "fully localize to all languages" for the
   quest/UI/challenge content is just running the gen tool; only the LLM persona
   layer (4) remains language-by-language.

---

## 8. Staying current automatically — the `check-translations` freshness gate

**Owner intent:** localization must STAY current with no big pushes. Adding a
string anywhere should automatically surface as *"needs translation"* rather than
silently drifting back to English. The persistent localization owner is re-polled
each round; this gate is what makes drift visible the moment it happens.

### 8.1 The checker (`tools/check_translations.py`, `npm run check-translations`)
FAIL-LOUD, CI-friendly (exit 1 on drift). Two checks:

- **(A) COVERAGE.** Every chrome catalog key (`src/i18n/strings.ts` `en`) must be
  present in EVERY shipped locale (the `DEFAULT_LANGS` ~46-lang set), with its
  `{placeholder}` tokens intact. A newly-added key that hasn't been filled yet is
  listed per-locale as *"missing key(s)"* → the "needs translation" signal. Reuses
  `gen_i18n.py`'s `extract_en`/`extract_locales` so the two never drift apart.
- **(B) LEAKS.** A heuristic scan of the i18n-owned chrome surfaces (`entry/`,
  `shell/`, `onboarding/`, `immersion/`, + the quest-chrome files) for hardcoded,
  user-facing English string literals on a visible sink (`textContent`,
  `innerHTML`, `el(tag,cls,TEXT)`, `aria-label`/`title`/`placeholder`,
  `segButton`) that is NOT routed through `t()`/a `*Strings` builder. Catches a
  string added straight to the DOM before it ships English to 50 languages.
- **(C) LANGUAGE NAMES.** Every shipped catalog code must have an entry in
  `src/entry/languageNames.ts` (the chooser/welcome endonym source) — a code in
  the catalog but NOT there makes the chooser show the raw code (e.g. "lt")
  instead of the language's name ("Lietuvių"). This caught the real `lt`/`ne`/`sl`
  gap (seeded in the string catalog but absent from `languageNames.ts`, visible
  only by cross-referencing the two rosters — surfaced via npc-lang's promptLocale
  sync).

Both are validated to actually fire (inject a literal → leak flagged at file:line;
add an unseeded `en` key → every locale listed as missing). The COVERAGE half is
ALSO mirrored in `src/i18n/strings.test.ts` so `npm test` gates it even without
Python; `check-translations` is the richer superset (it adds the leak scan + the
auto-fill path).

### 8.2 Auto-fill (`npm run check-translations:fix`)
`--fix` computes the set of locales missing ≥1 key and shells out to
`gen_i18n.py` for exactly those, in foreground 10-lang batches (backgrounded gen
loses network — a known gotcha). So the loop is: add an `en` key → `check` lists it
as missing in all locales → `check --fix` gen-fills its ~46-lang set → `check`
green. A new string is never silently English: it's either caught as a leak (route
it through `t()`) or caught as a missing key (auto-filled).

### 8.3 How to wire it into the round cadence
- **Pre-merge / CI:** run `npm run typecheck && npm test` (coverage gate) and
  `npm run check-translations` (coverage + leak gate). A red gate = a string was
  added without a translation or without keying — fix before merge.
- **Each localization round (the re-poll):** `check-translations` → if missing
  keys, `check-translations:fix` to gen-fill → commit the insertions-only diff.
- **New catalogs (quest `quests.ts`, future challenge-strings):** extend the
  checker's coverage parser to those `en` blocks as they're authored (same
  `extract_*` shape); the leak scan already covers any new chrome dir added to
  `LEAK_SCAN_DIRS`.

This is the mechanism that keeps "fully localized to all languages" TRUE over time
instead of a one-time push that rots.
