# World Plaza — NPC language correctness (R2-2)

**Status:** Applied to `src/npc/*`.

**The rule (must hold for ANY pair):** an NPC teaches the **target** language —
what the player is LEARNING (`learnerPair.target`). Both the NPC's **system-prompt
language** AND its **TTS voice** must be the target language.

- Learning **AR-from-EN** (`target:"ar", native:"en"`) → the prompt's decisive
  directive is composed **in Arabic** (priming a small model to write Arabic in
  Arabic script), it speaks Arabic, and the voice is chosen from **Arabic** voices.
- Learning **EN-from-AR** (`target:"en", native:"ar"`) → English directive, speaks
  English, **English** voices.

`learnerPair` is supplied by the orchestrator (`OpenArgs.learnerPair`) — never
hardcoded.

## The two bugs we fixed

### 1. Voice spoke the wrong language

`npcRuntime.open` derived the TTS language from
`scene.npcSkins[id].voiceHint`, which is **scene-derived** (Spanish for the
Antigua world) and even carries a non-BCP-47 character suffix (`"es:warm"`). So an
ES→EN NPC spoke correct English text through a **Spanish** voice, and fed TTS a
junk code.

**Fix (`src/npc/npcRuntime.ts`):** the voice language is now
`learnerPair.target` (an explicit `args.voiceCode` override still wins for
vignettes/tests). The scene `voiceHint` is no longer consulted for the speak
language. Per-NPC voice **variety** is unaffected — it comes deterministically from
`npcVoice.pickVoiceId(npcId, listVoices(target))`, which already enumerates +
picks within the **target** language's voice set (male/female split when exposed,
sticky + persisted per NPC). The whole engage→speak path now carries `target`:
`open()` → `speak(text)` → `voiceResolver.speak(npcId, target, text)` →
`listVoices(target)` / `speakVoice(target, …)` / `speak(target, …)`.

#### 1b. The on-device wrong-VOICE bug (the language was right, the voice wasn't)

Even with the language correct, the owner hit ES-voice-on-EN-text on-device. Root
cause was voice SELECTION, in TWO places that both had the same "keep the full
list" anti-pattern:

- `npcVoice.voicesFor` USED to do `matched.length > 0 ? matched : all` — if
  `listVoices("en")` returned voices but NONE were English (an ES-locale device
  with no English voice installed, or an unfiltered host return), it kept the
  Spanish list and `pickVoice` deterministically pinned a Spanish voiceId →
  `speakVoice("en", text, esVoiceId)` → Spanish voice, English text.
- The host's `listVoices` (`corpan-app/src/contentPacks/hostApi.ts`) has the SAME
  fallback: `const list = matched.length > 0 ? matched : all` — so when no EN voice
  is installed it returns ALL (Spanish) voices labelled with their `es-*` language.

**Fix (`src/npc/npcVoice.ts`):**
1. Candidate voices are STRICTLY those whose own `.language` matches the target.
   When none match, we pin NOTHING (`voicesFor` returns `[]`) and fall back to
   language-only `speak(target, text)`. The native plugin then picks a
   target-language voice from `language:"en"` (no `voice_id`) — at least the
   LANGUAGE is honored; a wrong-language voice is never forced.
2. A PIN-SITE language guard in `speak()` re-checks `langMatches(pin.language,
   target)` before `speakVoice`, so no path can pin the wrong language.
3. The sticky-voice cache is keyed by `npcId|target` (bumped to
   `wp:npc:voice:v2`, value `{id, language}`) so an "en" pin is never reused for
   "es"; a cached pin whose language no longer matches the target is discarded
   (defends against any stale/legacy poison).
4. On-device diagnostics (noisy, not silent): `listVoices` returns + how many
   matched + the pinned voice's `.language` + each `speakVoice`/language-only
   decision — so we can SEE on-device what the host returns and whether it honors
   the language.

The pack fix is sufficient on its own (it degrades to language-only speak, which
the native plugin language-resolves). The HOST `listVoices` "keep the full list"
fallback is a companion bug — it should return `matched` (possibly empty) for a
specific `uiCode`, not silently substitute a wrong-language list; flagged to the
app team. **Host-contract expectation:** `listVoices(uiCode)` must return ONLY
voices for `uiCode`'s language (empty is fine); `speakVoice(uiCode, …, voiceId)`
and language-only `speak(uiCode, …)` must honor `uiCode`'s language.

### 2. Prompt language primed the wrong output

The entire system prompt was English, including the "reply in {target} ONLY" rail.
A 4B model writes the language its instructions are in, so an English "reply in
Arabic" rail produced **Latin-letter babble**, not Arabic.

**Fix (`src/npc/promptLocale.ts` + `composeSystemPrompt`):** the decisive
language+behaviour directive (speak ONLY in `{target}` in its own script, ≤2 short
sentences, stay in character, no translation/parenthetical, never reveal being an
AI) is now rendered **in the target language** and placed **last** in the prompt,
so it is the freshest instruction priming the model's output. The English persona
framing stays (it's instruction the model reads ABOUT the scene, not text to echo);
a terse English anti-ramble belt remains.

`promptLocale.ts` mirrors `challengeSegues.ts`: a per-language bank keyed by
language code, `en` as the always-present fallback, a `{lang}` slot filled with the
language's own **endonym** (e.g. "العربية", "español"), and a
`registerPromptLocale()` seam so the 50-language localization generator can merge
more languages without re-shipping the file.

### Full language coverage (all ~50 langs / 52 scripts)

The directive is now authored **by hand for the entire Corpán roster** (60 codes —
the 57 in `src/entry/languageNames.ts` PLUS `lt`/`sl`/`ne` from the chrome i18n
catalog `src/i18n/strings.ts`, which ships a few base languages `languageNames.ts`
doesn't). With Punjabi shipping Gurmukhi `pa` + Shahmukhi `pa-Arab`, Serbian
Cyrillic `sr` + Latin `sr-Latn`, Chinese `zh`/`zh-Hans`/`zh-Hant`, Korean
`ko`/`ko-polite`. Each directive is written IN that language and IN its native
script, so EVERY target primes the model correctly — not just en/es/ar. Any code
absent from the table still falls back to `en` (which names the target via
`{lang}`), so the bank can never break a pair.

**Granularity differs from the chrome i18n layer ON PURPOSE.** The chrome (`t()`
in `src/i18n/strings.ts`) collapses variants to base (`zh-Hans`→`zh`,
`ko-polite`→`ko`, `pa-Arab`→`pa`, `sr-Latn`→`sr`) because UI copy doesn't change by
script/register. This layer must NOT collapse — priming a 4B model to WRITE the
language genuinely differs by script (`zh-Hans` vs `zh-Hant`, `pa-Arab` Shahmukhi
vs `pa` Gurmukhi) and register (`ko` vs `ko-polite`). So we keep full-variant
granularity here; the two key sets intersect at the base codes and our extra
variant keys are additive (confirmed with the i18n-rtl owner).

**Endonyms are baked inline** into each directive (rather than substituting
`{lang}`) so per-language grammar/case/prepositions are correct; only the `en`
fallback still uses the `{lang}` slot to name an arbitrary unknown target.

**Resolution order (`promptLocaleFor`)** tries the EXACT code first, then the base
subtag, then `en`. This is load-bearing: a script-variant subtag can be a DIFFERENT
script than its base — `sr-Latn` is Latin while `sr` is Cyrillic; `pa-Arab` is
Shahmukhi (Arabic script) while `pa` is Gurmukhi. The earlier
`split("-")[0]`-only normalization collapsed these to the wrong-script base entry;
the exact-first lookup fixes it (and `es-MX` still finds `es`).

**Quality bar + verification.** en/es/ar are the hand-authored quality bar. The
full set was reviewed by the codex CLI judge (GPT-5.x, `eval/judge/judge.sh`) on
three axes: correct script, faithful meaning vs the canonical English, and
naturalness. All 57 are confirmed in the **correct script**. Two meaning fixes were
applied from the review (`kn` "no brackets" term; `sw` "stay in character"
phrasing) plus minor naturalness polish (`hu`/`id`/`ms`). A script-correctness
regression test (`src/npc/promptLocale.test.ts`) asserts every locale renders in
its expected Unicode block, with no `{lang}` leftovers and no ASCII-dominance in a
non-Latin language — so adding a language can't silently ship the wrong script.

**Flagged for native review** (usable now — meaning + script are correct, but
idiomatic wording would benefit from a native pass): `is`, `ga`, `cy`, `pa-Arab`,
`am`. These are not blockers; they're tracked for polish.

## Verify (standalone `:5174`, mock host)

The mock host's `speak()` logs `speak(<lang>): <text>` — confirm `<lang>` is the
TARGET. The composed prompt's tail directive is in the TARGET language/script.
Covered by `src/npc/npc.test.ts`:

- "R2-2: prompt directive language = TARGET; AR target → Arabic directive (native
  script)" — AR target ⇒ Arabic-script directive naming "العربية"; EN target ⇒
  "Speak ONLY in English".
- "R2-2: voice is enumerated + spoken from the TARGET language code passed" — an
  EN-learning NPC enumerates with `"en"`, picks an `en-*` voice, and speaks with
  `"en"`, never `"es"`.

## Known remaining seam (outside `src/npc/*`)

Two callers in OTHER domains still pass a **scene-derived `voiceHint`** as the
explicit `voiceCode` override, which re-introduces the mismatch for those paths:

- `src/game.ts` (vignette host) passes `voiceCode: args.voiceCode`.
- `src/vignettes/taxi.ts` computes `targetVoice = scene.npcSkins?.[driverId]?.voiceHint`
  and passes it as `voiceCode`.

These should pass `learnerPair.target` (or simply omit `voiceCode`) so the runtime
default applies. Flagged for the owner of those files.
