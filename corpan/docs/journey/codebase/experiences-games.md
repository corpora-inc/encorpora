# Game-Like Experience Packs — Audit for Journey Mode

Audit date: 2026-07-03, branch `journey`. Scope: `corpan/packs/{lingo-hero, juice-squeeze, hover-runner, quest-ear, corpan-city, world-plaza}`.

**Headline for the architect:** all four playable games consume the SAME host contract
(`HostApi.getRandomEntries(count)` → `EntryOut{entry_id, level, domains, translations[{language_code, text, romanization?}]}` + `speak(lang, text)` + `getStackConfig()`), select entries **randomly** (host filters by the user-global stack levels/phrase-packs), keep all progress in **pack-private localStorage**, and expose **zero performance signal to the host**. The only host-bound events any game emits today are `corpan:exit` (and hover-runner listens to `corpan:streak-changed`, `corpan:host-pause/resume/dispose`). Meanwhile **corpan-city already contains the exact abstract activity contract Journey needs**: `ChallengeSpec`/`ChallengeResult` (Zod, serializable, `entryIds` + CEFR `level` + `params` + normalized 0..1 `score`) plus a registry of ~20 micro-challenge tools and a `LearningPath`/`Track` curriculum schema.

---

## 0. world-plaza — DOES NOT EXIST (renamed)

`corpan/packs/world-plaza/` contains only a stale gitignored `node_modules/` directory; there are no source files. Git history shows the pack was **renamed to `corpan-city`** in commit `1663a74e8` ("world-plaza corpan-city", 2026-06-07) — every file moved `packs/{world-plaza => corpan-city}/...`. Earlier commits ("world-plaza: ship Corpan City multiplayer to encorpora.io catalog + AWS App Runner") confirm it was always the same product. **Treat world-plaza ≡ corpan-city**; the leftover directory is a cleanup candidate.

---

## 1. lingo-hero (`lingo_hero`, v0.4.12, channel: preview)

Files: `src/Game.ts` (1156 ln orchestrator), `src/ContentManager.ts`, `src/learning/{wordStats,selector,difficulty,mastery,index}.ts`, `src/scoring/curve.ts`, `src/progression/`, `src/events.ts` + `src/types.ts` (typed bus ABI), `src/ui/Hud.ts`, Canvas-2D renderer + synthesized audio.

### (a) Core loop
"Catch the Translation": a known-language prompt phrase shows at top while the target-language translation's words fall down 3 lanes as a time-laid-out chart (Guitar-Hero style); the player taps lanes to catch the words **in order**, hearing each word via TTS as caught. Higher streaks tighten note spacing and add distractor words (real target-language words from other entries) to dodge. Completing a phrase triggers a result-linger card (read the assembled translation + meaning), celebration, then the next round.

### (b) Content consumed
Random phrase entries. `ContentManager.getRound()` (`ContentManager.ts:178-276`) accumulates up to 4 batches of `getRandomEntries(8)` into a ≥10-entry pool, resolves prompt/target languages from `stackConfig.languages` (`languages[0]` = known; target rotated randomly among `languages[1..]`; single-language stack → reading mode, `resolveLanguages` at :153), filters the pool to entries carrying both translations, then picks the target via the injectable `WordSelector` (spaced-repetition biased, else `valid[0]`). Fields used: `translations[].text` (both langs), `translations[].romanization`, `entry_id`. Distractors: up to 12 real deduped target-language words from other pool entries. Tokenization is script-aware via `Intl.Segmenter` (`src/segment.ts`, fixes zh/ja/th, issue #463).

### (c) Difficulty/config knobs (in code)
- `NOTE_TRAVEL_SECONDS = 6` (`Game.ts:82`) — THE feel knob (memory doc says 7; code is 6 as of v0.4.x).
- Beat gap by streak: `RELAXED=1.7s → TIGHT=0.85s` over 6 clean charts (`Game.ts:580-585`); decoy count by streak: 1, then 2 at streak ≥3 (`Game.ts:595-598`).
- `AdaptiveDifficulty` (`learning/difficulty.ts:33-38`): window 8, EWMA smoothing 0.25, hot ≥0.8 / cold ≤0.5 accuracy — a 0..1 **content**-difficulty signal only (explicitly forbidden from touching note speed).
- Leitner scheduler: `BOX_INTERVALS_WAVES = [0,2,5,10,20,40]`, mastered at box 4 (`learning/wordStats.ts:38-41`).
- Scoring: hit `100 + combo*10`, dodge `40 + combo*4` (`Game.ts:891,966`); combo tiers 5/10/20/35/50/75/100 → 1.5x..8x (`scoring/curve.ts:44-53`); XP level curve `120 * L^1.45` (`curve.ts:121-122`).
- Two modes: `GameMode.PRACTICE` / `BLITZ` (`types.ts:57-60`), both buttons in HUD.

### (d) Session length / round unit
Natural unit = one **phrase chart** (one entry, ~2-10 words, ~10-30 s incl. 2.6-5.2 s result linger — dwell `min(5200, 2600 + words*220 + 600)` at `Game.ts:772-775`). Runs are **endless** (no lives; `gameOver()` at `Game.ts:473` is only reached via HUD action) — session is player-terminated. A Journey-sized "round" of N phrases would need a stop condition (small change in `Game.ts` round lifecycle).

### (e) Launchable with parameters?
Not today. `GameModule.mount(container, hostApi, initialState?: {stackConfig})` (`sdk/types.ts:35-41`) accepts only a stack config. BUT the seams are ready: (1) **specific phrase set** — `ContentManager.fetchBatch` is the single content faucet; wrapping `hostApi.getRandomEntries` with a curated-entryId provider (host already has `getEntryById`) is a ~20-line change, or inject a `WordSelector` via the existing `setDefaultWordSelector()` registry (`ContentManager.ts:37`) to bias without hard-pinning; (2) **difficulty** — pass initial `chartStreak`/decoy count/beat gap through `initialState`; (3) **round count** — add a `maxRounds` to `startGame`. The learning stream was explicitly built to hook in "WITHOUT any further Game.ts edits" — same injection style works for Journey.

### (f) Performance signal
Richest of all packs, but all **internal**. The typed event bus (`events.ts`, payloads `types.ts:92-307`) carries per-word verdicts: `wave-resolved {word: {entryId, foreign, english, lang}, outcome: correct|wrong|passed, combo}` — one authoritative event per word/wave; plus `noteHit/noteMiss`, `result-celebrate {clean, wordCount}`, `gameOver {finalScore}` and `gradeRun(hits, misses, bestStreak)` → S/A/B/C/D + accuracy (`curve.ts:176-186`). Per-word Leitner state (box, EWMA strength, correct/wrong counts) persists in localStorage keyed `(stackId, lang, entryId)` (`wordStats.ts`). **Instrumentation point:** one extra bus subscriber in `learning/index.ts:initLearning` forwarding `wave-resolved` + `gameOver` to a host progress API — zero Game.ts edits needed.

### (g) Skills trained
Listening (each caught word is spoken; prompt optionally spoken), reading (target-word recognition under time pressure), vocab-in-context, **word order/syntax** (catch-in-sequence reconstructs the sentence). No speaking, no writing/production.

### (h) Polish
High — flagship premium. 45 KB CHANGELOG, Neon Arcade art, procedural synthwave music, haptics, RTL support, pause-on-background, dedicated test dir, CI pack-catalog gate. Preview channel (devMode-gated), not yet stable.

### Non-negotiable contracts (from memory/docs — do not regress when integrating)
1. **Answer dedup** — one wave's correct answer appears on exactly ONE note; distractors deduped against sequence words by `normWord` (`ContentManager.ts:250-264`); selector may bias, never break (contract box in `learning/selector.ts:9-21`).
2. **Offline-first** — no remote URLs/fonts/network; fonts inlined (app.css ~449 KB), audio synthesized.
3. **TTS speaks RAW foreign text**, never the display-cleaned label (`ContentManager.speak` :279; `WordIdentity.foreign` doc at `types.ts:109-120`).
4. **Pack id `lingo_hero`** (underscore) everywhere id-matters; paths/zip stay hyphenated.
5. **Delta-timed movement** — chart laid out in wall-clock `strumTime` (`types.ts:48`), speed derived from `NOTE_TRAVEL_SECONDS`; frame-coupled movement previously made it unplayable on 90/120 Hz.
6. **Input measured against the CANVAS**, not the container (`InputManager.canvasX`) — the catastrophic 0.2.0 wrong-lane bug.

---

## 2. juice-squeeze (`juice_squeeze`, v0.1.6, channel: stable)

Files: React + dnd-kit; `src/hooks/useGameLogic.ts` (507 ln orchestrator), `src/util/{phraseLoader,languagePair,tokenizer,readingOrder}.ts`, `src/state/{gameStore,fruits}.ts` (zustand + persist), Pixi liquid vessel, WAV SFX, native haptics.

### (a) Core loop
A target phrase is shown at top in one language; the same phrase's words in the *block* language sit shuffled in a word bank, and the player drags them into order to rebuild the sentence (win = exact order, RTL-aware). Each win pours juice +10% into a full-screen glass with chime/glug/TTS-readback choreography, then **auto-advances** to the next phrase; 10 phrases = a bottled jar that flies to a shelf, 6 jars = a basket carried off that mints a coin. Bottles-per-CEFR-level (A0:3 … C1:15) gates a level-complete modal with a phrase review and next-level suggestion.

### (b) Content consumed
Random entries, one at a time: `loadUtterance` (`util/phraseLoader.ts:60`) does up to 20 attempts of `getRandomEntries(1)`, client-side re-filters by `stackConfig.levels`, extracts `blockText` + `targetText` via `pickByLang` (exact code → base-code match; **strict, no silent language fallback** — Skylar review note at `phraseLoader.ts:44-47`), requires ≥2 words. Language pair from `pickLanguagePair` (`util/languagePair.ts:27-55`): dedup stack; 2 langs → [u0,u1]; 3+ → display fixed = u0, block language **rotates** through the rest (module-level index); single non-EN lang → EN prompt + build that lang. Fields: `translations[].text`, `level`, `entry_id`, optional `source` (phrase-pack id). CJK handled via `tokenizeText`/`isCJKText`.

### (c) Difficulty/config knobs
- `minWords = 2` gate (`useGameLogic.ts:202`, param of `loadUtterance`).
- CEFR gating is **implicit** — whatever the user's stack `levels` allow; `BOTTLES_PER_LEVEL = {A0:3, A1:5, A2:7, B1:10, B2:12, C1:15}` (`state/fruits.ts:75`).
- `BASKET_SIZE = 6` (`gameStore.ts:122`); choreography timings `POUR_DELAY 450 / VOICE_DELAY 1700 / ADVANCE_VOICE_PER_WORD 320 (cap 3200) + 600` (`useGameLogic.ts:51-60`).
- No adaptive difficulty at all — no distractor words (bank contains exactly the sentence's words), no speed, no scoring pressure. Assist buttons: ear (speak answer), eye (silent reveal / give up).

### (d) Session length / round unit
Round = one phrase (~15-40 s incl. drag time + celebration). Meta-units: bottle = 10 phrases (~4-6 min), level = 3-15 bottles. Endless, player-terminated; auto-advance keeps flow ("fast-paced ASMR"). Bottle (10 phrases) is the natural Journey step size.

### (e) Launchable with parameters?
Not today (same `mount(container, hostApi, {stackConfig})` shape, `sdk/types.ts`). Easiest retrofit of all packs: `loadUtterance(hostApi, minWords, blockLang, targetLang)` already accepts **explicit language pair**, and the phrase source is a single function — accept an `entryIds[]` or provider in `initialState` and swap the `getRandomEntries(1)` call (~15 lines in `phraseLoader.ts` + plumb through `useGameLogic.loadNext`). Difficulty param could map to `minWords`/max-words and CEFR filter. A "N phrases then report" mode = counter in `useGameLogic` + a completion callback.

### (f) Performance signal
Currently: `allTimeScore` (+wordCount per win), `coins`, bottle/level bookkeeping — persisted in localStorage key `"juice-squeeze-game-state"` (`gameStore.ts:18,596`), never surfaced to host. **No failure signal exists** — you can't get a phrase "wrong", only slow / give-up. Meaningful emissions would be: time-to-complete per phrase, moves vs. minimum, give-up/reveal usage, phrase word count, per-`entry_id` completion. Instrumentation point: `runWin()` (`useGameLogic.ts:246`) and `showGiveUp` (:443) — both already have phrase id, langs, wordCount in scope. Also has a `window.__jsf` debug surface (:137-158) proving the state is trivially exportable.

### (g) Skills trained
Reading + **word order/syntax** (sentence reconstruction), vocab recognition, cross-language mapping (prompt in lang A, build in lang B), light listening (win readback TTS + tap-to-hear target). No speaking, no recall-production (words are given, not recalled).

### (h) Polish
High and **stable-channel**. Recent CHANGELOG shows native haptics, robust long-phrase layout down to C2/verbose languages, slimmed Web Audio (zip 3.7→0.77 MB), iOS `corpan-pack://` audio fix, RTL reading order, gameplay tests (`app/gameplay.test.tsx`). Weakness is pedagogical, not technical: zero challenge scaling.

---

## 3. hover-runner (`hover_runner`, v0.3.6, channel: stable)

Files: Babylon.js 3D; `src/game.ts` (2777 ln monolith), `src/core/{utils,constants,types}.ts`, `src/tuningStore.ts` (zustand persist), `src/gameplay/entryHelpers.ts`, 54-locale i18n, GLB logo model, mp3 SFX.

### (a) Core loop
You pilot a hoverboard down an endless neon ribbon road (keyboard / tap / device tilt) while a prompt phrase is shown+spoken; phrase billboards fly toward you in a 3×2 lane grid and you steer **into** the correct translation and dodge wrong ones. Correct = points/combo/XP/coin + celebration and a new round; wrong or missed-correct = streak reset. Visual world (sacred geometries, electric field, lights) escalates with level/netCorrect as a progression reward.

### (b) Content consumed
Random entries via a buffered fetch: `ensureEntryBuffer` tops up with `getRandomEntries(needed)` (`game.ts:1517-1541`); `buildRound` (:1543-1648) shifts an entry, picks `promptLang` **randomly** from the stack and `answerLang` randomly from the rest (`gameplay/entryHelpers.ts:20-37`; single-language stack → listening-match round: prompt spoken not shown, `singleLanguage` flag). Distractors = answer-language texts of other random buffer entries (up to `dynamicDistractors`, dedup vs. answer, :1584-1611). Fields: `translations[].text` + `.romanization` (both prompt and answer, shown per `showRomanization`), `entry_id`. No level/domain logic in-pack (host-side stack filters only).

### (c) Difficulty/config knobs — the most parameterized pack
`TuningSettings` (`tuningStore.ts:14-40`, persisted; several exposed in an in-game settings drawer): `autoAdjustDifficulty` (default true), `baselineSpeed 12 / maxSpeed 22`, `baselineCorrectProb 0.5 / minCorrectProb 0.1`, `baselineDistractors 2 / maxDistractors 6`, `baselineMaxPhrases 1 / maxSimultaneousPhrases 3`, `baselineMaxMisses 1 / maxMaxMisses 4`, `textScaleFactor`, `motionControlsEnabled`, music/sfx volumes, haptics. Auto-difficulty: `difficulty = 1 - exp(-netCorrect/150)` (`core/utils.ts:373-386`) lerps ALL params baseline→max (`getDynamicGameParams`, `utils.ts:390+`). Notably difficulty includes **spawn probability of the correct answer** (weighted pick at `game.ts:2090-2130`, forced-correct after `dynamicMaxMisses` incorrect streak). Fixed knobs in `core/constants.ts`: `PHRASE_HIT_WINDOW 0.25`, TTS repeat gap 8 s, celebration 1.6 s + 2 s post.

### (d) Session length / round unit
Round = one prompt phrase (~8-20 s: intro hold + fly-by + celebration). Endless runner, player-terminated; no lives/game-over (misses only reset streak). Also reads a host **day-streak** (`getStreak()` in its extended `sdk/types.ts:25-27` + `corpan:streak-changed` listener `game.ts:1959`) and shows a daily phrase quota — the only pack with any host-side retention integration.

### (e) Launchable with parameters?
Partially already: everything in `TuningSettings` is persisted state settable via `tuningStore.setSetting()` before/at mount — difficulty (speed, distractors, correctProb, misses) is programmable today with zero code change if the host writes the store key or a param is threaded into mount. Specific phrase set: needs the same faucet swap as others — `ensureEntryBuffer` is the single fetch point (~15 lines). Skill selection: prompt/answer language pair is currently random per round (`pickLanguages`); pinning it = accept an override in `buildRound`. Fixed round count = counter in `buildRound`/celebration path.

### (f) Performance signal
`GameStats` (`tuningStore.ts:54-64`, persisted): `score, streak, bestStreak, allTimeBestStreak, coinCount, level (1-20), xp, netCorrect`, and — uniquely — **`phraseHistory: {id, sourceLang, targetLang, correct, timestamp}[]`** via `recordPhraseResult` — a per-entry outcome log that is exactly Journey's needed signal, already accumulating in localStorage. Instrumentation: mirror `recordCorrect/recordWrong/recordPhraseResult` calls (search `game.ts:2324-2447`) to a host API. Accuracy is derivable; no timing-precision or WPM signal.

### (g) Skills trained
Reading (translation recognition under time+motion pressure), listening (prompt spoken, repeats every ~8 s; single-language mode is pure listening-match), vocab discrimination against distractors. No production, no word order (whole-phrase matching), no writing.

### (h) Polish
Good, stable-channel, the **reference pack** for SDK patterns. 54 locales for its own UI strings, delta-timed effects (v0.3.6), haptics, motion permission flow, some unit tests (electricField, particles, motionPermissionOverlay). game.ts is a 2777-line monolith — hardest of the four to modify safely; GOTCHAS.md documents Babylon landmines.

---

## 4. quest-ear (`quest_ear`, v0.1.0, NOT in catalog — experimental)

Files: Phaser 3; `src/engine/{StoryGraph,validator,types}.ts` (state-machine quest engine, 435 ln), `src/data/quest.json` (10 scenes), `src/game/{MainScene,ActionScene}.ts`.

### (a) Core loop
A text-adventure: each scene shows title + paragraphs (spoken via TTS) and 2-4 choice buttons; choices mutate typed quest state (`ear_fragments`, `trust_kendi`, `vow_silence`, …) and branch through a hub/diamond graph that reconverges at checkpoints. One choice drops into an `ActionScene`: a side-scrolling NYC street (80,000 px world) where you walk past vendor NPCs who pop hardcoded Spanish one-liners ("¿Con todo?", "¿Café caliente?") spoken on approach. Reaching the end shows "Quest Complete."

### (b) Content consumed
**None from the corpus.** All content is the hardcoded English `quest.json` (10 scenes, `spec_version: corpan.storygraph.v0.1`) plus 8 hardcoded Spanish NPC lines in `ActionScene.ts:219-226`. TTS: `MainScene.speakScene()` (`MainScene.ts:195-209`) speaks the **English** scene text in `stackConfig.languages[0]` — a mismatch bug if the UI language isn't English. The state schema reserves learning hooks (`learned_pack_ids`, `pron_score` 0-100) that nothing populates.

### (c) Difficulty/config knobs
None gameplay-wise. `globals.max_replays_per_scene: 99`, `default_language: "en"` in quest.json. Choice `requirements` (state predicates) exist in the engine — the only latent difficulty/gating mechanism.

### (d) Session length / round unit
One quest ≈ 5-10 min read-through; natural unit = one scene/choice (~30-60 s) or one hub-to-hub segment. No persistence — state is lost on unmount.

### (e) Launchable with parameters?
The **engine** is the value: `StoryGraph.initQuest(questData)` takes any conforming JSON, so launching a specific quest (per skill/level, in a target language) = pass `questData` through `initialState` instead of the static import (`MainScene.ts:6,47` — ~10-line change) + author content. Journey could use StoryGraph as a generic branching-dialogue activity runner. As-is, the pack is not launch-worthy.

### (f) Performance signal
Latent only: quest state vars (`pron_score`, `ear_fragments`, `visited` sets, trust scores) would be the signal if anything fed them; `StoryGraph.choose()` is the single instrumentation point for choice telemetry. Today: nothing measured, nothing right/wrong.

### (g) Skills trained
Listening (scene narration TTS, NPC lines) and reading — but of *English narrative*, not target-language corpus. Currently trains ~nothing; the *design* (choices gated on pronunciation score, NPC target-language interactions) points at listening comprehension + speaking.

### (h) Polish
Prototype. v0.1.0 (2025-11), not in `web/data/packs.json` at all, placeholder graphics (emoji NPCs, text buttons), TTS language bug, no persistence, no tests, no i18n. The clean part is the validated StoryGraph engine + quest JSON schema.

---

## 5. corpan-city (`corpan_city`, v0.1.8, channel: preview) — formerly world-plaza

Files: Babylon 9 + Havok client (`src/`, 34 modules), co-located Colyseus/Fastify server (`server/`, AWS App Runner), `contracts/` (Zod, `@corpan-city/contracts`), data-driven `content/` (quests, NPC roles, economy, badges, cosmetics), 50+ design docs in `docs/`, 169 KB CHANGELOG.

### (a) Core loop
You walk a 2.5D paper-cutout city (plaza, market, café; planned NYC-style archipelago per `docs/CITY_PLAN.md`) as a traveler; a beacon marks the objective NPC, you talk to it (dialogue driven by on-device Qwen3, speaking the target language via host TTS), and it issues a **micro-challenge** — one of ~20 modular exercises in an encounter overlay — whose score pays out XP/coins/items into a per-language-pair economy with badges, quests, levels, and optional shared multiplayer rooms. Quests chain scene-anchored encounters into a learning path per `Track` (native:target pair).

### (b) Content consumed
Corpus phrases through `ChallengeRuntimeHost` (`src/challenges/host.ts`): `getRandomEntries` / `searchEntries` / `getEntriesByIds` + `speak` + Whisper `recordAndScore` — i.e. **both random AND curated-by-id selection are first-class**. `ChallengeSpec` (`contracts/src/challenge.ts:14-24`) carries `language`, `nativeLanguage`, CEFR `level`, optional `entryIds[]`, `params`. NPCs pick tools + partial specs via parsed LLM intents; quest/scene content is authored JSON in `content/`. North-star doc flags the known gap: "Quest vocab is random, not the scene's vocab" (`docs/NORTH_STAR.md`, brutal-problem list) — scene-authored phrasebooks are track E of the plan.

### (c) Difficulty/config knobs
Per-tool `difficulty` 1-3 (drives rewards: `xp = round(8*difficulty*(0.4+0.6*score))`, `coins = round(2*difficulty*score)`, item rarity tiers at score ≥0.6/0.8/0.92 — `docs/CHALLENGES.md`); `ChallengeSpec.level` (CEFR) + `params`; `LevelCompletion` = allQuestsComplete | xpThreshold | badgeEarned (`contracts/src/curriculum.ts:10-15`); immersion toggle; per-Track state. No global adaptive engine yet.

### (d) Session length / round unit
Micro-challenge ≈ 30-90 s; encounter (walk → talk → challenge → reward) ≈ 2-4 min; quest = 1-N encounters (beginner quests deliberately 1 step, `docs/QUEST_FLOW.md`); level = quests/XP/badge per `LevelSpec`. Open-world, player-terminated.

### (e) Launchable with parameters?
**The challenge library already is.** `runChallenge(toolId, ctx, chHost, {container, npc, partialSpec, uiLanguage})` (`src/challenges/registry.ts`) runs any of ~20 tools with a serializable spec incl. `entryIds`, level, params, and `mockChallengeHost()` runs the whole library standalone with zero native deps — Journey could embed these tools directly, outside the city. Launching the *city itself* into a given quest/scene = the `Track`/`LearningPath` machinery, partially built. `runChallenge` never rejects (cancel → score 0), so orchestration is uniform.

### (f) Performance signal
Best contract in the codebase: `ChallengeResult {score: 0..1, detail: Record<string,number>, xp: XpEvent[], completedAt, offline, sig?}` (`contracts/src/challenge.ts:26-38`) — normalized score, per-tool detail metrics, offline flag, HMAC anti-cheat for later reconciliation. STT tools (read-aloud, say-it-back) yield Whisper pronunciation scores. `LevelState` tracks path progress. An aggregate-telemetry design exists (`docs/ANALYTICS_PULSE.md`, design-only, awaiting owner approval on the privacy amendment).

### (g) Skills trained
Broadest: listening (listen-choose, number-drill, NPC speech), reading (fast-translate, true-false, spot-typo, word-search), **speaking** (read-aloud, say-it-back via on-device Whisper), vocab (picture-match, memory-pairs, odd-one-out, category-sort), **grammar** (conjugation-tap, fill-the-blank, dialogue-fill), word order (build-sentence), plus conversational pragmatics via LLM NPCs.

### (h) Polish
Ambitious, uneven, preview-channel. Contracts + challenge library + quest engine are well-built (Zod conformance tests, QA harnesses `qa/challenges.mjs`, econ/result harness HTML). World rendering was owner-flagged "2010 prototype" (2026-06-05) with a premium-tracks remediation plan (cinematic pipeline, sound, character craft) in flight; multiplayer server deployed but adds infra/ops surface (note: only piece of the estate that isn't purely on-device). Not a shippable course experience yet; its **contracts are the most Journey-ready artifact in the repo**.

---

## 6. Comparison table

| | lingo-hero | juice-squeeze | hover-runner | quest-ear | corpan-city (=world-plaza) |
|---|---|---|---|---|---|
| **Version / channel** | 0.4.12 / preview | 0.1.6 / stable | 0.3.6 / stable | 0.1.0 / not in catalog | 0.1.8 / preview |
| **Stack** | Canvas 2D, TS, IIFE | React + dnd-kit + Pixi | Babylon.js 3D | Phaser 3 | Babylon 9 + Havok + Colyseus server |
| **Core verb** | Catch falling target words in order, in rhythm | Drag words to rebuild the sentence | Steer into the correct translation billboard | Choose your path in a branching story | Live in a city; NPC-issued micro-challenges |
| **Content source** | Random `getRandomEntries(8)`×4 pool; SRS-biased pick | Random `getRandomEntries(1)`, ≤20 retries | Random buffered `getRandomEntries` | Hardcoded quest.json (no corpus) | Corpus via ChallengeHost: random **or** `entryIds` **or** search |
| **Fields used** | text (2 langs), romanization, entry_id | text (2 langs), level, entry_id, source | text + romanization (2 langs), entry_id | none | text, romanization, level, entry_id; Whisper STT |
| **Difficulty knobs** | streak→beat gap 1.7→0.85 s, decoys 1→2; AdaptiveDifficulty 0..1 (content only); Leitner boxes | none (minWords=2; CEFR via stack; bottles/level table) | 9-param auto-difficulty from netCorrect: speed, correctProb, distractors, maxPhrases, maxMisses | none (latent choice `requirements`) | per-tool difficulty 1-3; spec.level; LevelCompletion |
| **Round unit / length** | phrase chart ~10-30 s; endless run | phrase ~15-40 s; bottle=10 phrases; level=3-15 bottles | phrase fly-by ~8-20 s; endless | scene ~30-60 s; quest 5-10 min | challenge 30-90 s; encounter 2-4 min; quest; level |
| **Param launch today** | No (mount gets stackConfig only); WordSelector injection hook exists | No; but loadUtterance already takes explicit lang pair | Partially — tuningStore settings are programmable | Engine takes any quest JSON (1 wiring change) | **Yes** — `runChallenge(toolId, spec)` with entryIds/level/params |
| **Perf signal (internal)** | per-word wave-resolved, Leitner box/strength, accuracy, S-D grade, XP | allTimeScore(+words), coins, bottles; **no fail signal** | score, streak, xp, netCorrect, **phraseHistory per-entry log** | none (latent pron_score) | **ChallengeResult score 0..1 + detail + XpEvent, HMAC** |
| **Signal to host** | none | none | none (reads host day-streak) | none | contract designed for it (offline reconciliation) |
| **Skills** | listening, reading, vocab, word order | reading, word order, vocab, light listening | reading, listening, vocab discrimination | (intended: listening) | listening, reading, **speaking(STT)**, vocab, grammar, word order |
| **Persistence** | localStorage per (stackId, lang) | localStorage `juice-squeeze-game-state` | localStorage tuningStore | none | IndexedDB per-Track `wp:track:{native:target}:*` |
| **Polish** | High (flagship premium) | High (stable, best mobile polish) | Good (stable, reference pack; 2.8 kln monolith) | Prototype | Uneven: contracts A+, world visuals in remediation |

---

## 7. Cross-cutting findings for the Journey architect

1. **Uniform host contract, uniform gap.** All packs mount as `CorpanGames[id].mount(container, hostApi, initialState?)` and pull random entries. `initialState` today carries only `stackConfig` — it is the natural vehicle for a Journey `ActivityParams` (entryIds / language pair / difficulty / round count / sessionId). Each pack has exactly ONE content-faucet function to swap: `ContentManager.fetchBatch` (lingo-hero), `loadUtterance` (juice-squeeze), `ensureEntryBuffer` (hover-runner).
2. **No game reports results to the host.** All learning signal dies in pack-local storage. Each pack has one clean choke point to instrument: lingo-hero `wave-resolved` bus event; juice-squeeze `runWin()`/`showGiveUp()`; hover-runner `recordPhraseResult()`; corpan-city `ChallengeResult` (already shaped for it). A single host API (`reportOutcome({entryId, lang pair, activityId, correct/score, ms})` or a `corpan:activity-result` window event, mirroring the existing `corpan:segment-progress` reader event) covers all four.
3. **Adopt corpan-city's contracts as the Journey activity ABI.** `ChallengeSpec`/`ChallengeResult`/`ChallengeToolId` + `LearningPath`/`LevelSpec`/`Track` (`packs/corpan-city/contracts/src/`) already model: serializable activity launch (tool + entryIds + CEFR + params), normalized 0..1 scoring with per-skill detail, XP economy, per-language-pair state envelope, and level completion criteria. The 20 micro-challenge tools run standalone (`mockChallengeHost`) and would give Journey instant activity variety; the three big games become premium "boss/arcade" activity types on the same spine.
4. **Per-language-pair scoping is already the convention** — lingo-hero keys localStorage by `(stackId, lang)`, corpan-city by `TrackId = native:target` (including `es:es` immersion tracks). Journey's per-target-course state should adopt the TrackId convention.
5. **Skill coverage gaps across ALL games:** speaking exists only in corpan-city's two STT tools (and pronunciation-coach pack, out of scope here); writing/production-recall exists nowhere; grammar only in corpan-city tools. Listening/reading/vocab/word-order are well covered.
6. **Single-language (immersion) stacks are handled deliberately** in lingo-hero (reading mode, `ContentManager.resolveLanguages`), hover-runner (listening-match, `pickLanguages`), and corpan-city (`isImmersionTrack`) — Journey's course model must preserve this mode (see also `packs/SINGLE_LANGUAGE_RULE.md`).
7. **Cleanups:** delete stale `packs/world-plaza/node_modules`; quest-ear speaks English text in the stack's primary language (bug, `MainScene.ts:202-208`); lingo-hero memory doc says `NOTE_TRAVEL_SECONDS=7` but code is 6 (`Game.ts:82`).

## 8. Open questions

- Should Journey drive difficulty through each game's existing knobs (heterogeneous) or normalize to a single 1-3 difficulty like corpan-city's tools and map per-game? hover-runner's 9-param auto-adjust and lingo-hero's SRS-driven content difficulty resist a single scalar.
- juice-squeeze has no failure signal — is time-to-complete + reveal-usage an acceptable mastery proxy, or does Journey only use it as a low-stakes "flow" activity?
- Who owns cross-pack SRS state? lingo-hero's Leitner store is pack-private; Journey presumably wants one per-Track scheduler feeding ALL activities (corpan-city curriculum contracts have no SRS yet).
- corpan-city multiplayer/server: Journey is offline-first — do we embed only the solo challenge library and quest engine, leaving Colyseus out of the course spine?
- `initialState` extension vs. a new host API for parameterized launch: extending `GameModule.mount`'s `initialState` is backward-compatible, but per-round re-launch (feed of small activities) may want a lighter `runActivity` entry point like corpan-city's `runChallenge`.
