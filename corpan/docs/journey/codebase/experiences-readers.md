# Audit: Reader / Audio Experience Packs

Scope: `earthgate-reader`, `stargate-reader`, `beatlounge`, `melopan`, `teletron`, `world-radio` under `/home/skyl/encorpora/corpan/packs/`. Rubric per pack: (a) core loop, (b) content consumed + selection, (c) config knobs, (d) natural session/round unit, (e) parameterized-launch feasibility, (f) performance/completion signals, (g) learning skill trained, (h) polish level. Plus: how narration packs/books are discovered and installed.

Date: 2026-07-03. Status: audit snapshot — verify against `main` before relying on it.

---

## 0. Shared infrastructure these packs sit on (load-bearing for Journey)

### 0.1 The pack mount contract (host side)

- `corpan-app/src/contentPacks/ContentPackHost.tsx:549-558` — the host mounts every pack with `mount(container, hostApi, initialState)` where initialState = `{ stackConfig, isPlus, entitlement, ...(entry ? { entryId, source, route } : {}), ...(entry?.seedBookId ? { seedBookId } : {}) }`.
- `corpan-app/src/contentPacks/types.ts:39-53` — **`PackLaunchEntry` is the existing "addressability groundwork"**: `{ entryId?: number; source?: string; route?: string; seedBookId?: string }`. This is the only deep-link channel that exists today. **None of the six packs audited here consume `entryId`/`route`** (grep confirms; readers consume `seedBookId` only, via the appShell). So parameterized launch for Journey = extend `PackLaunchEntry` (or a new `journey` initialState key) + teach each pack to honor it.

### 0.2 The reader appShell (shared by both readers)

`packs/shared/catalog/src/appShell.ts` wraps a reader with the command drawer, catalog browser, install/upgrade/entitlement machinery, and narration switching:

- **Catalog discovery**: `appShell.ts:99-100` — `DEFAULT_CDN_URL = "https://d38iwc9748jekz.cloudfront.net/catalog-v2.json"`, fallback `catalog.json`. Catalog v2 entries carry both legacy (`downloadUrl`/`tier`/`purchase`) and new two-ZIP fields (`preview`/`full`/`totalSegments`/`freeSegments`) — see `packs/shared/catalog/src/types.ts:107-151`. **Natural key of a narration = `(bookId, language, voiceId)`** (`types.ts:230-242`).
- **Install**: `packs/shared/catalog/src/installManager.ts` — `isTwoZipEntry()` (line 11) routes non-subscribers to the public preview ZIP and subscribers to a CloudFront-signed full ZIP via `POST {verify-url}/verify-purchase` (`DEFAULT_VERIFY_URL`, line 60). Installed packs are recorded in `libraryStore` (localStorage `corpan-library`) with a `full?: boolean` fullness flag (`types.ts:191-199`). Installed pack content is served at `corpan-pack://` URLs (`getPackUrl`).
- **First-run seed**: `appShell.ts:1044-1048, 1084-1172` — empty library → auto-install the free preview of `DEFAULT_SEED_BOOK = "book_biomes_tropical_rainforest"` (line 105) for every language in the user's stack (primary first, rest in background), overridable via `initialState.seedBookId`. This is the closest existing pattern to "Journey hands a reader a specific book."
- **Narration switch / reader relaunch**: `appShell.ts:1212-1267` `switchToNarration()` — disposes the reader and remounts it with initialState `{ baseUrl: getPackUrl(id), bookId, bookTitle, language, autoPlay, startAtSegmentStart: true }`. **The reader is already fully relaunchable by parameter** — the shell does it on every language switch.
- **Analytics**: `appShell.ts:1251-1256` calls `analytics.bookOpened({ bookId, narrationPackId, language, voiceId })`; shared module (`packs/shared/analytics`) emits `book_open`/`book_close` (with `duration_ms`)/`book_heartbeat`/`language_switch` plus free-form `track()` events, to `https://d1xp3xghrx3jfa.cloudfront.net/v1/events`.
- **JIT upgrade + paywall**: upgradeManager sweeps previews → full for subscribers; readers dispatch `corpan:request-unlock` at end-of-preview.

### 0.3 Book data format (both readers)

- `packs/shared/data/dataProvider.ts` — `loadSegments(lang)` → `segments.json` / `segments_{lang}.json`; `loadAudioManifest(lang)` → `audio_manifest_{lang}.json`; `resolveAudioUrl()`. Two providers: fetch-based (dev + installed `corpan-pack://` root) and preloaded (host-supplied JSON).
- `packs/shared/core/timeline.ts` — `buildTimeline(segments, manifest)` flattens all word-level timestamps (Whisper/stable-ts forced alignment) into one absolute-ms word timeline; `buildChapterIndex(segments)` derives chapters. Segment = the atomic addressable unit (`id` like `ch01-001`, chapter, text, word timings, duration).

### 0.4 Progress plumbing that already exists (window events)

Both readers dispatch (earthgate `src/game.ts`, stargate `src/game.ts` same names):

- `corpan:segment-progress` `{ bookId, language, segmentsReached, totalSegments }` (earthgate `game.ts:471-486`) → consumed by `corpan-app/src/store/progress.ts` (deepest-segment progress, "Continue" shelf, streaks; completion = `segmentsReached >= totalSegments`, `progress.ts:89`).
- `corpan:book-finished` `{ bookId, language, bookTitle, theme }` on full-book end (`game.ts:452-467`) — host suggests next book.
- `corpan:request-unlock` on preview end (`game.ts:430-447`).
- `analytics.track("segment_play", …)` per segment while playing; earthgate also `segment_play_one` for tap-to-replay (`game.ts:594`).

These four are the ready-made completion/performance seam for Journey's reader activities.

---

## 1. earthgate-reader (v0.7.4)

Path: `/home/skyl/encorpora/corpan/packs/earthgate-reader/` — src is small: `src/game.ts` (1,276 lines), `src/rendering/paragraphView.ts` (244), `src/main.ts` (113).

- **(a) Core loop**: Calm DOM audiobook reader. Continuous narration playback with word-level highlight in a paragraph view; transport bar (play/pause, ±30s, prev/next chapter, scrubber with chapter markers); swipe next/prev segment; tap-a-paragraph-while-paused = replay that one segment then snap back (`game.ts:580-606` — a genuinely pedagogical "repeat this sentence" affordance, incl. "switch language then replay"). Chapter overlay on chapter transitions. Heavy background-audio machinery (media session, native keep-alive, wake lock, iOS session-stale recovery — the majority of game.ts).
- **(b) Content**: narration packs (segments + audio_manifest + m4a audio) installed via appShell from catalog-v2 (§0.2/0.3). Selection: whatever narration the user (or seed) picked in the drawer; bookId falls back to `?book=` URL param then `"book_monte_alban"` (`game.ts:418-422`).
- **(c) Config knobs**: essentially none beyond the shell (language/narration switching, drawer). Per-book bookmark (`createBookmarkStore("earthgate-reader")`, autosaved every 15s + on pause/hide) and a `hasChapters` meta cache. No display settings section (unlike stargate).
- **(d) Session unit**: no built-in unit — it's an open-ended listening session. Natural quanta that exist in data: **segment** (one narrated paragraph, seconds long), **chapter**, **book**. The tap-to-replay preview is a natural single-segment micro-round.
- **(e) Parameterized launch**: **high feasibility**. initialState already accepts `bookId`, `bookTitle`, `language`, `baseUrl`, `autoPlay`, `startAtSegmentStart`, `dataUrl`, `contentRevision`, preloaded `segmentsData`/`audioManifest`/`resolveAssetUrl` (`game.ts:414-422, 935-963, 1052-1064`). Missing: a **`startSegmentIndex`/`segmentId` param** — today start position comes from the persisted bookmark only (`game.ts:1048-1056`). Adding "open book X, language L, segments [i..j]" is a ~20-line change (seek + a stop-at-segment condition, which the one-shot preview logic already half-implements via `oneShotSegmentEndMs`). The narration must already be *installed*; Journey would reuse `installNarration()` + `getPackUrl()` from the shared catalog module.
- **(f) Signals emitted**: `corpan:segment-progress` (deepest segment), `corpan:book-finished`, `segment_play`/`segment_play_one` analytics, `book_open/close/heartbeat` with duration. No comprehension/performance signal (pure exposure). Listening time is derivable from analytics durations.
- **(g) Skill trained**: listening comprehension + reading along (word-sync highlight builds sound↔script mapping); L1↔L2 by re-listening to the same segment across languages. Passive — no production, no recall test.
- **(h) Polish**: **high**. v0.7.4, long CHANGELOG, hardened background-audio/lock-screen behavior, paywall pause handling, preview/upgrade flows, analytics, 50+ localized manifest names. This is shipped production surface.

## 2. stargate-reader (v0.7.6)

Path: `/home/skyl/encorpora/corpan/packs/stargate-reader/` — `src/game.ts` (1,845), Babylon.js rendering (`wordStream.ts`, `waveformStream.ts`, `oscilloscope.ts`, `pulseRing.ts`, `starfield.ts`), `ui/settingsPanel.ts`.

- **(a) Core loop**: same reader loop as earthgate but immersive 3D: words fly through a starfield toward a "now" plane, positioned by forced-alignment timestamps (`z = (wordTs - nowMs) / MS_PER_Z_UNIT`); oscilloscope/waveform/pulse-ring visuals driven by a live AnalyserNode. Same transport/chapters/bookmark/preview machinery (code is a sibling of earthgate's, not shared — the two game.ts files duplicate ~800 lines of session logic).
- **(b) Content**: identical to earthgate — same appShell, same catalog-v2 narration packs, same segments/audio_manifest format (README documents the pipeline: Chatterbox TTS → stable-ts alignment → opus/m4a).
- **(c) Config knobs**: everything earthgate has **plus a Display drawer section** (`src/ui/settingsPanel.ts`, injected as a `DrawerSectionDef` via `main.ts:31-41`): toggles + sliders for oscilloscope (amplitude/width/alpha), waveform (radius/alpha/reversed), pulse ring, word-hold — persisted **per book** via `prefsStore.load(bookId)` (`game.ts:890, 1049-1107`).
- **(d) Session unit**: same as earthgate (segment / chapter / book; open-ended).
- **(e) Parameterized launch**: identical to earthgate — same initialState fields, same missing `startSegmentIndex`. One reader factory (`main.ts:43-58`) mounted through `createAppShell` with `readerId: "stargate"`.
- **(f) Signals**: same events as earthgate (`corpan:segment-progress`, `corpan:book-finished`, `corpan:request-unlock`, `segment_play`).
- **(g) Skill trained**: listening + reading-along like earthgate; the timed word-stream is closer to a *paced reading* trainer (words appear exactly at speech rate — attention scaffold per the README's stated design intent).
- **(h) Polish**: **high**, v0.7.6, same maintenance cadence as earthgate. Heavier runtime (Babylon.js) — worth remembering for a low-end-device Journey step.

## 3. beatlounge (v0.7.0)

Path: `/home/skyl/encorpora/corpan/packs/beatlounge/` — very large: ~103k lines of src (28k is `i18n/strings.ts`). Command-sourced DAW: one JSON doc, every mutation a typed `Command` through `reduce()`/CommandBus (`src/model/`), modules registered as Stage tiles (`src/modules/allModules.ts` — song-setup, step-grid/Drums, composer/Harmony, instruments, ribbon, **phrase-sampler, phrase-jam, phrase-scratch**, mixer, scenes).

- **(a) Core loop**: build/mutate a loop on a tick-accurate sequencer (PPQ 960); reshape it via the **on-device Qwen3 LLM** using a *closed tool catalog* (`src/llm/tools.ts:1-14` — the 4B model only picks a tool + scalar args; all musical logic is deterministic and clamped, "something musical ALWAYS happens"); and — the language part — sample the phrase corpus into the music. Three phrase surfaces:
  - **Phrases (discovery/library)** `modules/phrase-sampler/PhraseSamplerImmersive.tsx:1-20`: search/shuffle the 25k-phrase corpus → tap a phrase → see EVERY stack language row → drill into a full contiguous **n-gram breakdown** grouped by N → audition any combo via Web Audio → save combos to a Bank (rendered + IDB-cached fragments).
  - **Phrase Jam** `modules/phrase-jam/`: a lane grid where each saved bank snippet is a row; place snippets on beats, groove-scatter, live pitch ribbon.
  - **Phrase Scratch** `modules/phrase-scratch/`: turntable — scratch ONE saved phrase snippet like vinyl with word-position tracking (`wordTiming.ts`), two decks, cut fader.
  - The clip pipeline (`src/phrase/pipeline.ts`) tokenizes target-language text into fragments, resolves audio per fragment via `synthesizeToBuffer` (host TTS-to-buffer, feature-detected) with IDB cache and a synth-vox floor, and places them as "stack" (one word re-pitched up a pentatonic run) or "scatter" (phrase spoken across the bar) tracks.
- **(b) Content**: **live phrase corpus via HostApi** (`src/sdk/types.ts:118-141`): `getRandomEntries({count, domains, levels, languageCodes})`, `searchEntriesByText`, `getEntryById(entryId, source)`. Language pair from `getStackConfig().languages` (languages[0]=native, rest targets; `pipeline.ts:119-148`). Also hand-authored world-rhythm corpus (`src/rhythm/corpus.ts` — clave, teental, etc.), instrument presets, chords/modes corpora. No narration packs.
- **(c) Config knobs**: enormous within the DAW (tempo, scales incl. maqam/dastgāh/makam microtonality, kits, FX, grooves…), but *learning-relevant* knobs are just the stack (native+target, domains, levels filters on corpus fetch) and voice choice. Projects persist as Scenes.
- **(d) Session unit**: none imposed — open-ended creative studio. Natural micro-units Journey could carve: "save N phrase combos to the bank," "place a phrase on the grid and play the loop," "one scratch session on phrase X." The Bank save (`phrase/bank.ts`) is the closest discrete completion.
- **(e) Parameterized launch**: **low-medium today**. Mount takes only `{ stackConfig }` (`src/main.tsx:21,35`); no `entryId`/route handling. BUT the internals are unusually automatable: everything is a `Command`, and `getEntryById(entryId, source)` + `buildClip()` + `clipToCommands()` (`pipeline.ts:202-460`) means "launch beatlounge pre-loaded with phrase set S placed on a groove" is buildable by dispatching commands at mount — the plumbing exists, only the launch-param wiring doesn't.
- **(f) Signals**: **none today** — no analytics module, no completion events (grep: no `@shared/analytics` usage, no `corpan:` progress events). Journey would need new emissions (e.g. bank-save count, phrases auditioned).
- **(g) Skill trained**: phonological/prosodic exposure — hearing target-language words/n-grams repeatedly, rhythmically, at variable pitch/speed; chunking via the n-gram breakdown; incidental reading (gloss + romanization rows). Retention through beat-making is the bet; nothing tests recall.
- **(h) Polish**: **high engineering polish, pre-1.0 product** (v0.7.0). Frozen tested pure core (vitest on model/rhythm/groove), 85KB CHANGELOG, elaborate docs/ roadmap. Deep, expert-oriented surface — as a Journey activity it needs a *narrowed* entry (e.g. straight into phrase-scratch with a chosen phrase), not the full Stage.

## 4. melopan (v0.2.6)

Path: `/home/skyl/encorpora/corpan/packs/melopan/` — small (~4.2k lines): `src/model/project.ts`, `engine/audioEngine.ts` (Tone.js), `ui/` (StepGrid, PianoRoll, SampleBrowser, Delay/Reverb panels).

- **(a) Core loop**: 16-step drum grid (kick/snare/hat synths) + two "voice pad" tracks that play **pre-rendered voice-clone word samples** (`mountain`, `fire`, `water`, `breath`…) with grain-player pitch shift, falling back to an AM-synth "synth-vox" hum when no sample loaded (`src/engine/voicePad.ts:19-30`). Pick voice + word in the SampleBrowser, sequence, tweak delay/reverb.
- **(b) Content**: **bundled static assets only** — `public/voice-kit/{voice}/{word}.ogg`, generated offline by `scripts/generate-voice-kit.py` through the Chatterbox pipeline (README). HostApi declares `getRandomEntry`/`getEntryById` (`src/sdk/types.ts:23-33`) but `App.tsx` ignores hostApi entirely (`hostApi: _hostApi`, `App.tsx:46`) — **the phrase corpus is not actually consumed**. Project state persists via `storage/projectStore.ts`.
- **(c) Config knobs**: BPM, per-track steps/volume, voice pad pitch, delay/reverb params, skin picker. Nothing learning-related.
- **(d) Session unit**: open-ended jam; a "loop" is the only natural unit.
- **(e) Parameterized launch**: **low**. Only `{ stackConfig }` in mount and even that is unused. To make it a Journey activity you'd wire hostApi + a launch param at minimum.
- **(f) Signals**: none. No analytics, no events.
- **(g) Skill trained**: marginal — hearing a handful of fixed L2(-ish) words as instruments. It's a music toy with a language veneer; beatlounge supersedes it (its own README calls beatlounge "everything melopán has × 100").
- **(h) Polish**: functional and stable (v0.2.6, last touched 2026-05), but effectively **legacy/superseded**. Not a strong Journey candidate.

## 5. teletron (v0.1.10)

Path: `/home/skyl/encorpora/corpan/packs/teletron/` — `src/main.ts` (2,141), `mediator.ts`, `transcripts.ts`, `voice.ts`, `i18n.ts` (6k lines, ~54 locales).

- **(a) Core loop**: anonymous **penpal messaging** with LLM-mediated exchange. Views: onboarding → inbox → lobby/waiting → thread (`main.ts:70-72`). Matchmaking via a Colyseus presence server (`wss://presence.3-142-26-37.sslip.io`, `main.ts:182-191`) reusing `@corpan-city/contracts`; invite handshake; a living link lasts 24h of mutual activity (`LINK_TTL_MS`, `main.ts:84`) then the thread becomes a read-only keepsake. Every message runs through the **on-device safe-relay pipeline** (`mediator.ts` + `@shared/moderation`): outbound is moderated/relayed; inbound is "**lessonified**" — translated/adapted to the recipient's target language and CEFR level (`LessonifyOptions.level`, `mediator.ts:41-49`), displayed with native gloss (`StoredMessage.detail`), spoken via a **pinned stable TTS voice per language** (`voice.ts:1-9`), with dictation input (`@shared/asr` Whisper). Reply chips suggest responses. Free tier: **20 mediated messages/day** (`FREE_DAILY_LIMIT`, `main.ts:35,340-350`) and a one-active-link cap; Plus lifts them (entitlement from initialState).
- **(b) Content**: **peer-generated conversation**, not packs — but it hard-requires the on-device LLM pack: `BASE_MODEL = llm-base-qwen3-4b-v1 … 2497 MB` ZIP from the CDN (`main.ts:30-34`); transcripts stored permanently on-device in IndexedDB (`transcripts.ts` — server stores nothing).
- **(c) Config knobs**: languages from stack (native/learning, canonicalized to the relay language set, `main.ts:193-219`); beginner/advanced mediation mode; per-thread TTS mute; anonymous identity regeneration.
- **(d) Session unit**: a message exchange / a conversation. The daily 20-message quota is an existing "day session" boundary. Asynchronous by design (offline outbox, rejoin re-sync).
- **(e) Parameterized launch**: **low-medium**. Mount takes `{ stackConfig, isPlus, entitlement }` (`main.ts:45-49`); no deep-link to a thread. A Journey step like "send one message to your penpal today" is feasible with a small `route` addition (open inbox / open thread with partnerId); "guaranteed partner available" is not — matchmaking needs another human online. **Network-required + 2.5GB LLM dependency** make it a poor mandatory spine node; good as an optional social side-quest.
- **(f) Signals**: none emitted today (no analytics wiring found in main.ts). Countable locally: messages sent/received (transcript store), dictation use.
- **(g) Skill trained**: the strongest *communicative* surface in the fleet — real written production (+ optional spoken via dictation), level-adapted reading, listening to messages via TTS, authentic pragmatics with a real human.
- **(h) Polish**: **early but actively hardened** (0.1.x; recent fixes for delivery reliability and message truncation). Depends on external presence server uptime.

## 6. world-radio (v0.6.5)

Path: `/home/skyl/encorpora/corpan/packs/world-radio/` — `src/app.ts`, `views/` (browse shell, global map, station list/map/filters), `api/radioBrowser.ts`, `audio/radioPlayer.ts` (+ legacy sibling `world-radio-legacy/`).

- **(a) Core loop**: browse live radio **by language** (stack languages first) or via a global map; tap a station → streams (native `radio-stream` plugin or WebView audio, HLS support); player bar with volume, favorites, recents; media-session lock-screen integration.
- **(b) Content**: **external, online-only** — Radio-Browser API (`api/radioBrowser.ts:26-29`, de1/de2 mirrors, no key), with stale-while-revalidate localStorage cache (24h languages / 12h stations, LRU-evicting to fit WKWebView's 5MB budget). Corpan↔radio language mapping in `api/languageMap.ts`. Selection: user browsing; stack languages surfaced first via `getStackConfig`.
- **(c) Config knobs**: language filter, tag filters, sort, list/map view, favorites, volume (persisted `prefsStore`).
- **(d) Session unit**: open-ended listening; "one station listened for N minutes" is the only carveable unit.
- **(e) Parameterized launch**: **medium**. Mount takes `{ stackConfig }` only (`main.ts:19,57`), but `openStationList(corpanCode, { focusUuid, initialView })` already exists internally (`app.ts:104-107`) — wiring `route`/params to "open language L" or "play station UUID" is small. Caveat: content is live/unpredictable; can't guarantee comprehensible input at any level.
- **(f) Signals**: **the best-instrumented non-reader**: `src/analytics.ts` tracks `radio_station_play`/`radio_station_stop` **with listen duration**, language browsed, search, filters, errors — same shared analytics module as the readers (readerId `world_radio`). Nothing is exposed back to the host as events, though; Journey would read nothing today without adding a window event or importing the same store pattern.
- **(g) Skill trained**: raw immersion listening (native-speed, authentic, uncurated). Best framed as high-level (B2+) exposure or ambient habit, not an assessable step.
- **(h) Polish**: **high** (0.6.5, careful caching/CORS/media-session work, geo map, skeletons). Fundamentally **online-only** — violates the offline guarantee for any mandatory Journey step.

---

## 7. Cross-cutting findings for the Journey architect

1. **The readers are the most Journey-ready surfaces.** They are already parameter-mounted (dispose/remount with `{bookId, language, baseUrl, autoPlay, startAtSegmentStart}` on every narration switch, `appShell.ts:1229-1246`), already emit granular progress (`corpan:segment-progress` with `segmentsReached/totalSegments`), and already have an install pipeline from catalog-v2 keyed by `(bookId, language, voiceId)`. The single missing primitive is **segment-range addressing** (`startSegmentIndex`/`endSegmentId`) — trivially implementable; earthgate's tap-to-replay one-shot (`game.ts:580-606, 1152-1159`) already contains the "play segments [i..j] then stop" mechanics.
2. **`PackLaunchEntry` (`{entryId, source, route, seedBookId}`) is the only existing deep-link contract and no audited pack consumes `entryId`/`route`.** Journey's abstract activity contract should extend this seam rather than invent a parallel one; `ContentPackHost.tsx:549-558` is the injection point.
3. **Signal asymmetry is stark**: readers + world-radio emit rich anonymous analytics (fire-and-forget to CDN, not consumable in-app); only the readers emit *host-consumable* window events (`corpan:segment-progress`, `corpan:book-finished`). beatlounge, melopan, teletron emit **nothing** the host can score. A uniform "activity result" event (the Journey step contract) has exactly one existing precedent to generalize: the `corpan:segment-progress` → `store/progress.ts` pipeline.
4. **Two content universes**: narration packs (catalog-v2, installed ZIPs, segment/word-timing granularity — readers) vs the live phrase corpus (SQLite via hostApi `getRandomEntries/getEntryById(entryId, source)` with domain/level/language filters — beatlounge and the game packs). Journey must address both; the phrase corpus is already filterable by CEFR `levels` at the query level, narration packs are not leveled at all (no CEFR metadata on catalog entries — a gap for prescriptive sequencing).
5. **Offline compliance**: earthgate/stargate/beatlounge/melopan are offline after install. **world-radio is online-only; teletron needs network + a 2.5GB LLM pack + a live partner.** Those two can only be optional/bonus nodes on the spine.
6. **Duplication debt in the readers**: earthgate and stargate each carry ~800+ lines of near-identical session/media logic in their `game.ts`. A Journey "reader activity" wrapper is a chance to consolidate rather than fork a third copy.
7. **Natural activity units per pack** (candidate Journey step types):
   - earthgate/stargate: *listen-read segment(s)*, *replay-segment in language A then B*, *finish chapter* (completion = segment index reached; already measurable).
   - beatlounge: *phrase bank-building* (search→audition n-grams→save), *phrase scratch* on a target phrase (needs launch param + result event).
   - teletron: *send/read one mediated message* (daily quota already frames it).
   - world-radio: *listen X minutes in target language* (needs a host-visible signal).
   - melopan: none worth building on; superseded by beatlounge.

## 8. Gaps / unknowns

- Did not audit `quest-ear` (name suggests audio) or `world-radio-legacy` / `pronunciation-coach` — out of scope per task, but quest-ear may belong in this family.
- Whether `hostApi` in reader packs offers phrase-corpus access (readers take `HostApi` but earthgate ignores it: `_hostApi`, `game.ts:44`) — reader activities that mix in phrase quizzes would rely on the host contract, untested in these packs.
- catalog-v2 entries carry no difficulty/CEFR metadata (checked `shared/catalog/src/types.ts`) — Journey needs a leveling source for books (external mapping or new catalog field).
- beatlounge's LLM tool bus (`allActions()` registry, `modules/registry.ts:22-28`) could theoretically execute Journey-scripted setups ("place this phrase, 80 BPM") — powerful but unproven as an external API.
- Stargate/earthgate `initialState.dataUrl` + preloaded-data path means Journey could even feed a reader synthetic "books" (e.g. generated dialogues) without the catalog — format is just segments.json + audio_manifest + audio files.
