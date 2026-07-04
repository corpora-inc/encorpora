# Journey Codebase Audit — AI-Powered Experiences & Native Plugins

Audited 2026-07-03 on branch `journey`. Scope: `packs/tutomaton`, `packs/pronunciation-coach`,
`packs/hanzipan`, `packs/wordpan`, `corpan-app/src/experiences/phraseFlip.ts`, and plugins
`tauri-plugin-corpan-llm`, `tauri-plugin-stt`, `tauri-plugin-asr-native`, `corpan-asr-contract`,
`tauri-plugin-tts`. All paths relative to `/home/skyl/encorpora/corpan/` unless absolute.

---

## 1. Per-Experience Rubric

### 1.1 Tutomaton (`packs/tutomaton/`, v0.6.0, **`devOnly: true`** in manifest.json:22)

**Loop** (documented in `src/chat.ts:1-19`): user message → `LanguageManager.retrieve(message)`
across 0..N RAG sources → if a source returns `kind: "theme"` the canonical vocab list is rendered
**directly, no LLM call** ("theme bypass") → else `hostApi.llm.chat(systemPrompt + grounding +
reference, messages)` streams tokens into the bubble → complete sentences are queued to TTS as
tokens arrive (`src/streamingTts.ts` — Unicode `Sentence_Terminal`-based incremental sentence
detection with per-language abbreviation suppression, `NO_SPACE_SENTENCE_LANGS` for ja/zh/yue).
Voice input = OS keyboard dictation plus an optional `hostApi.asr` mic path (chat.ts:1754-1835,
Android excluded at :1831).

**Content**: 50 target languages declared in `manifest.json:103+` (52 dirs under `languages/`
incl. `_template`), each with `module.json`, `prompts/system_prompt.txt`,
`prompts/grounding_instruction.txt`. Language modules are downloaded ZIPs from
`https://d38iwc9748jekz.cloudfront.net/corpan/tutomaton-languages/<code>-0.1.0.zip` (~1 MB each,
prompt-only) via `hostApi.installModuleZip` (`src/languageManager.ts:116`). Only **es and zh**
have real RAG corpora today (`manifest.json` `sources[]`, retrievers.ts:60-68):

- `languages/es/sources/core/data/spanish.sqlite3` — **164 MB**: `verbs`, `verb_meta`, `nouns`,
  `adjectives`, `idioms`, `lessons` (+FTS5), `vocabulary_themes`, `example_sentences` (+FTS5).
- `languages/zh/sources/core/data/mandarin.sqlite3` — 188 KB.
- en/fr/de/ja retrievers are bundled and ready, awaiting corpus verification (`src/retrievers.ts:47-55`).
- One **universal source**: `tutomaton-phrase-bridge-v1` (manifest `universalSources[]`) grounds the
  tutor in the user's already-installed phrase packs via `hostApi.phrasePacks` + `queryPackDb`
  (`src/retrievers.ts:57-66`, `languageManager.ts:243-256` `RetrieverHelpers`).
- RAG source contract: `RAG_SOURCES_CONTRACT.md` — self-describing source manifests
  (`packType: "tutomaton-rag-source"`), `authoritative` flag for theme-bypass, priority merge,
  future sources ship as separate catalog packs with **precompiled JS retrievers**
  (runtime `import()` impossible — IIFE bundle). `hostApi.discoverPacksByType` is a **stub returning []**
  (`languageManager.ts:124`).

**Knobs** (`src/modelTuning.ts`): per-language persisted `ModelTuning` — systemPrompt (editable!),
temperature (default **0.3**), topP 0.9, topK 20, minP 0.05, repeatPenalty 1.1, presencePenalty 0,
maxTokens 700, `think` toggle for hybrid models. Calibrated 2026-06-15 via `infra/tutomaton-eval`
(low temp rescued Marathi; one global default beat per-language overrides). Model size picker
(`src/modelTiering.ts`), voice picker (`src/voicePreferences.ts`), brevity directive (`src/brevity.ts`).

**Session unit**: one chat turn (message → streamed reply, ~5–60 s depending on device).
Metered: **20 messages/local day free** (`FREE_DAILY_LIMIT` chat.ts:82; registry
`packs/shared/monetization/src/quotas.ts` `tutomaton_daily`, remote-config overridable).
`CAPPED_ENTRY_SPEC.md`: at-cap entry skips model load entirely.

**Parameterized launch**: `mount(container, hostApi, initialState)` receives only
`{ stackConfig, isPlus, entitlement }` (chat.ts:63-67). **No task/scenario/topic injection
exists.** However the system prompt is a first-class runtime knob (`ModelTuning.systemPrompt`),
so a Journey activity contract could seed a scenario ("order coffee; correct the learner")
with near-zero new plumbing — the missing piece is only the initialState field + a graded-exit
condition.

**Emittable performance signal**: **none pedagogical.** The only structured outputs are
`llm-done` `{ totalTokens, elapsedMs }` (perf) and the quota tick. The conversation is unscored;
grading would need on-device LLM-as-judge (expensive on Android) or task-completion heuristics.

**Skill trained**: free conversation, reading, listening (TTS), vocabulary lookup (theme lists).

**Polish**: very high engineering (3.8k-line i18n, RAM tiering, per-language eval-gated model
support lists, streaming TTS) but **dev-gated, not shipped to users** (`devOnly: true`), and the
RAG corpus exists for only 2/50 languages.

### 1.2 Pronunciation Coach / Parlometron (`packs/pronunciation-coach/`, v0.8.0, id `pronunciation_coach`)

**Loop** (solo, `src/game.ts`): fetch random phrase via `hostApi.getRandomEntry()` (game.ts:1252)
→ pick a whisper-**scorable** target translation, rotating through the stack's target languages
(game.ts:698-706; unscorable langs never served) → show target + native + romanization → user
records (push-to-talk) → `stt.stopSession()` returns the 18-field scoring result → per-grapheme
word pills colored by `WordTiming.probability` (game.ts:487), overall score, streak counter
(game.ts:879,1020). History is navigable; **re-practicing any past phrase is free and unmetered;
only acquiring a NEW phrase is metered** — 10/day free, no soft nag (`quotas.ts` `parlometron_daily`).
Prefetch-next in background (game.ts:1258). **Multiplayer**: pass-the-phone lobby → round →
between-rounds → game-over state machine (`src/parlometron.ts:1-40`), state persisted for
crash-recovery.

**Content**: the entire ~25k-phrase core corpus via `getRandomEntry` (level/domains present on
`EntryOut` but the call takes **no filters** — selection is random within the stack's languages).

**Knobs**: 7-tier whisper model picker (`src/modelRegistry.ts`, see §2.2), per-language
`WhisperParams` overrides (`src/whisperTuning.ts` — incl. `initial_prompt` decoder priming for
low-resource non-Latin scripts), per-(lang, model) `ScoringParams` overlays (`src/scoringTuning.ts`),
a full interactive tuner UI (`src/whisperTunerUI.ts`, 726 lines).

**Session unit**: one phrase attempt (≈10–30 s: read, record, score). Multiplayer round = N players
× 1 phrase.

**Parameterized launch**: `mount` gets `stackConfig` only (`src/main.ts:18,34`). **Cannot request a
specific phrase, level, or domain today** — the single biggest gap for Journey use; `getRandomEntry`
would need filter params or an `entryId` passthrough.

**Emittable performance signal**: the **richest in the app** — `SttTranscriptionResult`
(game.ts:96-118): `overallScore`, `transcriptScore`, `likelihoodScore`, `acousticScore`,
per-word `{word, startMs, endMs, probability}`, `noSpeechProb`, `compressionRatio`,
`freeVsConstrainedSimilarity`, `freeText` (what Whisper heard unprompted), `minTokenLogprob`,
`tokenLogprobStdev`. **All of it stays inside the pack** (localStorage save
`corpan-pronunciation-coach:v2`); nothing is emitted to the host as a learning event.

**Skill trained**: speaking / pronunciation, per-word.

**Polish**: highest of the four — shipped, deeply calibrated (per-model acoustic ramps in native
code, language gating via `src/whisperLangs.ts`: whisper's fixed ~99-lang set, `jv→jw` alias,
Cantonese deliberately unsupported because whisper folds yue into zh).

### 1.3 Hanzipan (`packs/hanzipan/`, plain-JS pack, `src/main.js` ~2400 lines)

**Loop**: pick a random character — `SELECT char, pinyin, stroke_count, radical FROM
hanzi_character ${filter} ORDER BY RANDOM() LIMIT 1` (main.js:2244; a `WHERE char = ?` lookup
path also exists at :2238, so parameterized launch is nearly free internally) → hero card shows
character + tappable pinyin (TTS) + etymology paragraph in the user's native language
(`hanzi_etymology` preferred-language fallback `[...stackLangs, "en"]`, main.js:2298) → user
draws strokes on a canvas over a HanziWriter outline (guided hints, stroke animation, free-draw,
brush settings) → **per-stroke scoring** against medians (`scoreStroke`, main.js:409; match at
:1332-1360), overall = mean of per-stroke scores; ≥ threshold flashes green → completed-count +
cumulative total score persisted → next char. Examples panel: **real corpus phrases containing
the character** via `hostApi.searchEntriesByText` / `searchEntriesByTextCount` (main.js:2342-2393)
searching zh-Hans/zh-Hant translations.

**Content** (`data/hanzi.sqlite3`, **75 MB**): see §3 — this is the wordpan template.

**Knobs**: guided-hints toggle, hint, animate, brush, free-draw. No difficulty/frequency knob
surfaced (frequency column exists in the DB).

**Session unit**: one character (draw all strokes, ~1–2 min). Metered 20 characters/day
(`quotas.ts` `hanzipan_chars`).

**Parameterized launch**: `mount(container, hostApi, initialState={stackConfig})` (main.js:1740).
No character/set injection, but the exact-char query path exists — adding `initialState.char` or
`initialState.charList` is trivial.

**Emittable signal**: per-stroke score, overall 0–100 per character, completion events —
localStorage only, not emitted to host.

**Skill trained**: Hanzi writing (stroke order + shape), character recognition, pinyin listening,
etymology reading.

**Polish**: high; shipped; the only handwriting-input experience in the app.

### 1.4 Wordpan (`packs/wordpan/`, id `wordpan_es_en`, v0.1.0, `entryType: "data"`)

**Not an experience** — a data-only pack with **no launchable UI** (manifest.json:5
`"entryType": "data"`, `databases: { main: "data/word.sqlite3" }`). Consumed by Phrase Flip's
long-press popover (§1.5). Rubric fields (loop/knobs/session) are N/A; see §4 for format.

### 1.5 Phrase Flip (`corpan-app/src/experiences/phraseFlip.ts`)

The named file is **16 lines of card-art plumbing only** — it re-exports `PHRASE_PACK_ID` and the
bundled SVG so Home/Installed grids show consistent art. The actual experience is the built-in
`corpan-app/src/components/MainExperience.tsx` (`phrase_main`), launched by a special-cased
`openPhrase` path in `App.tsx`, metered 20 phrase-flips/day (`quotas.ts` `phrase_flips`). The
AI-relevant integration: **long-press (right-click on desktop) on any English word → word-meaning
popover** in the user's native language via the wordpan DB, with JIT install of the pack from the
word-pack index if missing (`corpan-app/src/util/wordPack.ts`, `components/WordExplanationText.tsx`,
`components/packs/WordPackSection.tsx`, `hooks/useWordPackCatalog.ts`). Mirrors the Hanzipan
etymology lookup exactly (wordPack.ts:1-13).

---

## 2. Plugin Capabilities — Exact

### 2.1 `tauri-plugin-corpan-llm` (on-device LLM, llama.cpp)

Vendored llama.cpp; **Metal on iOS**, **tuned CPU on Android** (GPU confirmed dead end —
`ANDROID_PERF.md:28-40`: Vulkan crashes/15× slower on Adreno; OpenCL prefill-only + Q4_0-only;
Mali slower than CPU). Desktop via `llama-cpp-2` crate.

**Models shipped/downloaded** (registry lives in the **pack**, `packs/tutomaton/src/modelTiering.ts:70-137`;
all Q4_K_M GGUF ZIPs on CloudFront `corpan/llm-packs/`, all `published: true`):

| Pack id | Download | Resident footprint | Reasoning mode | Language support (eval-gated) |
|---|---|---|---|---|
| `llm-base-qwen3-0.6b-v1` | 378 MB | ~900 MB | hybrid (`<think>` suppressed via `noThink` prefill) | 12 langs |
| `llm-base-qwen3-1.7b-v1` | 1,056 MB | ~1,600 MB | hybrid | 34 langs |
| `llm-base-qwen3-4b-v1` (Qwen3-4B-Instruct-2507) | 2,497 MB | ~3,300 MB | instruct (non-thinking) | full 50 |

**RAM tiering** (`modelTiering.ts:139-155` `RAM_THRESHOLDS`): 1.7B min 2,200 MB / safe 4,000 MB;
4B try-anyway 5,500 MB / safe **7,000 MB** (Metal relaxes to 5,000/6,000); a 6 GB Android phone
**OOM-crashes on the 4B** (Android OOMKills foreground well before nominal capacity). States:
recommended / available / try-anyway / disabled.

**Context length**: default **4096**; **8192** only for the 4B on ≥12 GB devices
(`recommendedContext`, modelTiering.ts:214-218). Plugin accepts `contextSize` override on
`llm_load` (`src/models.rs:23-31`).

**Tokens/sec on phones** (measured, `ANDROID_PERF.md`):
- **iOS/iPad Metal**: ~25–40 tok/s (iPad Pro M2 / iPhone 15 Pro class); prefill 15–20× faster than Android.
- **Android Snapdragon 8 Elite (S24/S25 Ultra), 7 threads, dotprod-forked build**: warm prefill
  **~91–93 tok/s** (was ~29 before the vendored `llama-cpp-sys-2` fork setting
  `GGML_CPU_ARM_ARCH=armv8.2-a+dotprod+fp16`), decode **~20 tok/s** (bandwidth-bound, dotprod flat).
  Tutomaton's ~850-token grounded prompt = **9–14 s to first token warm**; small prompt 1–2 s.
- **Cold**: `llm_load` 3–5 s for the 2.5 GB GGUF; first inference additionally page-faults mmap'd
  weights from flash (~39 tok/s prefill observed cold).
- **CRITICAL GAP: no KV-cache reuse across turns** (`ANDROID_PERF.md:126-133` note): every turn
  rebuilds the context and re-prefills system + entire history; latency climbs each round and
  **hard-errors once system+history exceeds n_ctx 4096**. Phase-2 fix documented, not implemented.
  iOS Metal masks it.

**Prompt interface** (`src/models.rs`): `llm_chat { messages: [{role, content}], options }` →
returns `sessionId`, then events `llm-token:{sessionId}` `{token}`, `llm-done:{sessionId}`
`{totalTokens, elapsedMs}`, `llm-error:{sessionId}` `{code, error}` (codes MODEL_NOT_LOADED /
INSUFFICIENT_MEMORY / LLAMA_CPP_ERROR / INTERNAL_ERROR). `ChatOptions`: temperature, topP, topK,
minP, repeatPenalty, presencePenalty, maxTokens, `stop[]`, `noThink` (seeds empty
`<think></think>` on hybrid Qwen3). Other commands: `llm_status` (returns `totalMemoryMb` — the
device-class signal), `llm_load {modelPackId, gpuLayers?, contextSize?}`, `llm_stop`, `llm_unload`,
`llm_query_pack_db` (**stub/TODO** — packs use `hostApi.queryPackDb` instead). Host wrapper:
`corpan-app/src/contentPacks/hostApi.ts:334-480` (buffers tokens, `onDone(fullText, {totalTokens,
elapsedMs})`; `llm.unload` frees the ~2.5 GB buffer at :299). Debug knobs: `debug.corpan.llm_threads`,
`debug.corpan.sysprompt` sysprops for on-device A/B without rebuild.

### 2.2 `tauri-plugin-stt` (whisper.cpp **pronunciation scorer**, not dictation)

whisper.cpp via iOS XCFramework + Android JNI. Models are `ggml-*.bin` files downloaded from the
`huggingface.co/ggerganov/whisper.cpp` base (pack-supplied URL wins — SttPlugin.kt:553), default
`ggml-tiny.bin` (SttPlugin.kt:51). **Model ladder** (pack-side registry,
`packs/pronunciation-coach/src/modelRegistry.ts:243+`):

| id | file | size | notes |
|---|---|---|---|
| `tiny_proof` | ggml-tiny.bin | 75 MB | fresh-install default; "honestly kind of terrible" |
| `small` | ggml-small.bin | 465 MB | solid Latin-script floor (base tier removed in 0.3.2) |
| `large_turbo` | ggml-large-v3-turbo-q5_0.bin | 547 MB | iOS pick; slow on Android CPUs |
| `large_q8` | ggml-large-v3-turbo-q8_0.bin | 834 MB | Android Turbo sweet spot (~2.5× faster than q5) |
| `large_qlora` | ggml-large-v3-q5_0.bin | 1,031 MB | full decoder; **star pick for Indic/non-Latin scripts** |
| `medium` | ggml-medium.bin | 1,463 MB | full-fp16 769M |
| (+ turbo-fp16 ~1,549 MB / self-quantized large_q8 ~1,580 MB per STT_MASTERPLAN table) |

Large tiers gated by memory: iOS ≥6,500 MB available OR Android ≥8,000 MB physical
(modelRegistry.ts:95-106). FP16 large-v3 (3 GB) **banned — SIGSEGVs in ggml-metal**
(modelRegistry.ts:207-209).

- **Streaming**: **NO.** Record → `stop_session` → batch transcription. Android whisper is
  CPU-only; large-v3 ≈ **15–25 s for a short clip** (STT_MASTERPLAN §1 constraints). An
  `audio_level` event stream exists for VU/silence detection (silenceWatcher currently unwired).
- **Word timings**: **YES** — `WordTiming { word, startMs, endMs, probability }`
  (`src/models.rs:129-136`).
- **Pronunciation scoring**: **YES, already built and shipped** — this plugin's entire purpose.
  `start_session` takes `expectedText` + per-call `WhisperParams` (temperature ramp, entropy/logprob
  thresholds, `initial_prompt` decoder priming — models.rs:38-64) + `ScoringParams` (acoustic ramp
  endpoints avgZero/avgOne/minZero/minOne, textFloor, compressionThreshold — models.rs:66-90).
  `stop_session` returns the 18-field `TranscriptionResult` (models.rs:141-178) including
  **dual decode** (free vs expected-text-constrained, Levenshtein similarity), per-model acoustic
  ramps (`pickAcousticRamp(modelName, baseLang)` in native code), no-speech gate, compression-ratio
  gibberish cap. Language guard: whisper's fixed ~99-language set enforced natively; mirrored
  JS-side in `packs/pronunciation-coach/src/whisperLangs.ts`.
- Hardened install path: streaming download with Content-Length truncation guard, ggml-magic
  validation, fsync barrier, process-global native lock (concurrent whisper init SIGSEGVs),
  `priorInitCrash` breadcrumb → analytics (CHANGELOG 0.5.2/0.5.3). Wire-format discipline: serde
  silently drops undeclared fields both directions; `availableMemoryMB` rename trap documented in
  models.rs — bit twice in one week.

### 2.3 `tauri-plugin-asr-native` + `corpan-asr-contract` (dictation)

`corpan-asr-contract` (`src/lib.rs`) is the frozen wire contract every ASR runtime implements:
`ProviderId ∈ {native, whisper, qwen3, sherpa}`, `LatencyClass ∈ {instant (<300 ms partials),
fast (<1.5 s), batch}`, `AsrCapability { languages (Corpán codes), onDevice, modelSizeMB,
residentMemoryMB, streaming, needsDownload, autoregressive }` — read by the router
(`host.asr.pick({lang, budgetMB, goal})`) and the planned Budget Arbiter. Commands:
`capabilities / is_available / ensure / start_session / stop_session / cancel_session`.

`tauri-plugin-asr-native` is the **only implemented provider plugin**: Apple
SpeechAnalyzer/SFSpeechRecognizer + Android SpeechRecognizer. **True streaming partials**
(`asr://partial`, `asr://level` events; hostApi.ts:758-800), ~0 app memory (out-of-process OS
daemon), no download. Locale map covers ~25 of our codes (`src/models.rs:20-49`); Indic and long-tail
→ `None` (router falls through). Whisper/Qwen3-ASR/sherpa provider plugins are **plans in
`docs/STT_MASTERPLAN.md`** (Phase 0 = mandatory on-device bake-off: Qwen3-ASR-0.6B vs
whisper-large-q5 vs Parakeet-TDT-v3 vs SenseVoice; NAR decoders weighted up for Android CPU) — not built.

### 2.4 `tauri-plugin-tts` (OS speech synthesis)

**No custom neural voices ship on device.** iOS 13+ `AVSpeechSynthesizer` (Enhanced/Premium OS
voices; user may need to install one), Android `TextToSpeech` (any installed engine), macOS native,
non-mac desktop **no-op** (`src/desktop.rs:36-40`). Voices are whatever the OS has:
`list_voices` → `VoiceInfo { id, name, language, gender, quality (default/enhanced/premium/…),
networkRequired }` (`src/models.rs:3-30`). Rich command set (permissions/autogenerated/commands/):
`speak` (with `voiceId`, rate), `speak_concurrent`, `synthesize_to_buffer`, `stop`, `list_voices`,
`bind_engine`, `get_tts_engine_status`, `probe_tts_health`, `try_auto_recover`,
`install_voice_data_for_language`, `open_tts_settings` / `open_tts_engine_store` — a substantial
Android engine-health/recovery layer for the onboarding rescue UX. Latency: effectively instant,
zero download; quality varies wildly by device/language. (High-quality narration in the app comes
from **pre-rendered narration packs**, not this plugin.)

---

## 3. Hanzipan content structure — the wordpan corpus template

`packs/hanzipan/data/hanzi.sqlite3` (75 MB), built by `dja/hanzi_pack/build_hanzi_pack.py`,
schema_version 2:

```sql
hanzi_character(char PK, pinyin, stroke_count, radical, frequency, tags_json)
hanzi_writer(char PK, data_json)          -- HanziWriter stroke/median vectors (bulk of 75 MB)
hanzi_etymology(char, language_code, summary, PK(char, language_code))
  + INDEX hanzi_etymology_language(language_code)
pack_meta(key, value)                      -- schema_version, generated_at, core_db
```

Counts: **3,344 characters × 51 languages = 170,544 etymology paragraphs** (uniform coverage —
every char has all 51 langs, verified by GROUP BY). Sample row (`一`/en): "Means 'one' or
'single.' … a single horizontal stroke, representing unity." — short multi-sense + origin +
form-explanation paragraph, exactly the shape wordpan scales up.

**Lookup pattern the app standardized on** (main.js:2293-2298, copied verbatim by wordpan):
`SELECT language_code, summary FROM hanzi_etymology WHERE char = ?`, then pick by preferred-language
order `[...stackConfig.languages, "en"]` in JS. The generalization is mechanical:
`(char, language_code, summary)` → `(word, language_code, paragraph)`.

---

## 4. Wordpan format & S3 index discovery

**DB** (`packs/wordpan/data/word.sqlite3`, 9.2 MB raw / ~3.1 MB gzipped, schema_version 1):

```sql
word_explanation(word, language_code, paragraph, PK(word, language_code))
  + INDEX word_explanation_language(language_code)
pack_meta: schema_version=1, generated_at, core_db, word_count=11757
```

Shipped pair: **es→en only** — 23,514 rows (11,757 en + 11,757 es). Word universe = unique English
surface words from the core corpus + all 33 phrase packs (~25,269 phrases) — `dja/word_pack/README.md`.
Paragraph contract: ~50 words covering polysemy + etymology + how the original idea branched
(exemplar: "Running means moving rapidly on foot, but can also describe… from Old English rinnan…").
Generator: `dja/word_pack/build_word_pack.py` + `generate_word_explanations.py` (codex gpt-5.5
subscription backend per memory; full corpus target 11,757 × 54 langs ≈ 635K paragraphs).

**Index discovery** (`corpan-app/src/contentPacks/wordPackCatalog.ts`): word packs are a **new
artifact kind** — NOT in catalog-v3, never on Home. Dedicated index at
`https://d38iwc9748jekz.cloudfront.net/corpan/word-packs/index.json`
(`DEFAULT_WORD_PACK_CATALOG_URL`, overridable via `VITE_WORD_PACK_CATALOG_URL`), wire format
version **1**:

```jsonc
{ "version":1, "generatedAt":…, "packs":[ {
    "id":"wordpan_es_en", "kind":"word-explanation",
    "nativeLang":"es", "targetLang":"en",
    "name":…, "nameLocalized":{…}, "version":"0.1.0",
    "zipUrl":…, "sha256":…, "sizeMb":3.06,
    "wordCount":11757, "languageCount":2,
    "minAppVersion":…, "channel":"preview" } ] }
```

Keyed by **(nativeLang → targetLang) pair**, `channel: "preview"` hidden from non-dev users.
Install: JIT from the Phrase Flip long-press popover (or Settings `WordPackSection.tsx`) via
`installWordPack(packId, zipUrl, sha256)` → `content_packs_install_from_url` with an **explicit
packId** (underscore-canonical `wordpan_es_en`; ZIP filename is hyphenated — id derivation trap
documented in `util/wordPack.ts:27-38,77-83`). Consumer query = `SELECT language_code, paragraph
FROM word_explanation WHERE word = ?` (lowercased), native-first + en fallback. Known follow-up:
no shared-base dependency primitive, so every native-pair pack redundantly bundles the 11,757 EN
paragraphs (~6 MB overhead/pack); `wordpan-en-base` split is tracked (`packs/wordpan/README.md`).

---

## 5. Mobile latency / size constraints (the numbers that gate Journey activity design)

| Engine | Disk | Resident RAM | Latency | Streaming |
|---|---|---|---|---|
| LLM 4B Q4_K_M | 2.5 GB | ~3.3 GB | iOS Metal 25–40 tok/s; Android decode ~20 tok/s, warm prefill ~91 tok/s → 9–14 s TTFT on an 850-tok prompt (8 Elite); cold load 3–5 s | token events |
| LLM 1.7B / 0.6B | 1.0 GB / 378 MB | 1.6 GB / 0.9 GB | proportionally faster; hybrid `<think>` suppressed | token events |
| Whisper scorer | 75 MB–1.5 GB | ~model size + ctx | Android large-v3 15–25 s per short clip (CPU-only, batch); tiny/small seconds | no (batch) |
| Native ASR | 0 (OS asset) | ~0 (out-of-process) | <300 ms partials | yes |
| OS TTS | 0 | ~0 | instant | n/a |
| hanzi.sqlite3 | 75 MB | mmap'd, queried | ms per query | n/a |
| word.sqlite3 (per pair) | ~9 MB (3 MB gz) | mmap'd | ms per query | n/a |

**Co-residency is the binding constraint**: 4B LLM (3.3 GB) + whisper large (~1–1.5 GB) cannot
coexist on ≤8 GB phones (GB-unified-memory-style OOM = OS kill). Journey's scheduler must
**serialize model residency** per activity block (e.g., batch all LLM activities, unload, then
speaking activities). The planned `host.models` registry + Budget Arbiter
(`docs/STT_MASTERPLAN.md` §4, "what fits alongside the running 4B?") is exactly this — **designed,
not built**.

---

## 6. Journey-readiness verdict per surface

| Surface | Parameterized launch | Perf signal | Gap to activity contract |
|---|---|---|---|
| Tutomaton | stackConfig only | none (unscored chat) | add `initialState.scenario/systemPrompt` + a graded exit; KV-cache fix for Android multi-turn |
| Parlometron | stackConfig only; phrases random | 18-field score, per-word — **pack-internal only** | add entry/level targeting + emit score event to host |
| Hanzipan | stackConfig only; char random | stroke scores — pack-internal | `WHERE char=?` path exists; add `initialState.char(s)` + emit |
| Wordpan | n/a (data) | n/a | ready as a grounding corpus for any activity (definitions, cloze, etymology cards); needs 53 more native langs |
| Phrase Flip | host-internal | quota ticks only | already host-side; easiest to instrument |

**Cross-cutting gaps**: (1) no pack emits structured learning events to the host — every score dies
in pack localStorage (the host has `corpan:segment-progress` for readers but nothing for
scores/attempts); (2) no pack accepts a task parameter — all content selection is random inside the
pack; (3) `discoverPacksByType`, `llm_query_pack_db`, and the model registry/Budget Arbiter are
stubs/plans; (4) tutomaton is `devOnly`; (5) Qwen3-ASR / sherpa / whisper-dictation providers and
the Phase-0 bake-off haven't happened — dictation coverage beyond ~25 OS locales is aspirational;
(6) daily quotas (10–20 units/day free) will interact with Journey pacing — a prescriptive course
that *assigns* 15 Parlometron phrases collides with the 10/day free cap unless Journey gets its own
quota surface or Plus-gating story.
