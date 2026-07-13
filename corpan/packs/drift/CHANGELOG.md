# Changelog

All notable changes to the Drift pack are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-07-13

### Added
- **Etymology on a word tap (CTO ask: "the etymologies of all the words").**
  Tapping a story word now opens a calm, drift-styled card with the word, its
  meaning (native gloss), and — when reachable — its **Origin**: the senses +
  etymology paragraph read from an installed `wordpan_<native>_en` word pack (the
  same `word_explanation` table Phrase Flip's long-press uses), fetched via the
  existing `hostApi.queryPackDb` seam. Fully **capability-checked** (`etymology.ts`
  `EtymologyResolver`): absent seam, no installed pack, or a non-English target
  (the packs key English words) → the card just shows the meaning, no error. New
  in-pack `origin` string localized for ~54 locales.
- **Muted mode is now a real game, not a passive reader.** When narration is
  muted (or can't be heard — the likely cause of the CTO's "no game" report), each
  beat now poses a **VISUAL fill-the-missing-word** challenge: the target word is
  blanked in the just-read line and the learner taps the missing word from the
  same chips. No audio required, and it is **honest, scored recognition evidence**
  — reported through `session.ts` exactly like the sound-on variant (a visible gap
  + real word chips is a genuine task, not a blind guess). Sound-on users keep the
  **tap-the-word-you-HEARD** variant. New localized `missing` prompt (~54 locales).

### Fixed
- **Dead word taps on mobile (Android/iOS webview).** Tapping a word reportedly
  did nothing on device. Root causes fixed: (1) the per-word tap handler was only
  attached when the token had a non-empty gloss, so words with an empty gloss
  (missing native translation / immersion stacks) were **silently untappable** —
  taps are now handled by ONE delegated listener on the prose so **every** word
  responds; (2) no touch **affordance** — words now carry a subtle dotted
  underline so the reader knows they're tappable (the CTO didn't); (3) tap
  reliability — `touch-action: manipulation` drops the 300ms delay and stops the
  gesture layer swallowing taps, and `-webkit-tap-highlight-color` hides the grey
  flash.

## [0.2.0] - 2026-07-13

### Added
- **Light game loop.** Drift is no longer a passive reader — it now plays a real,
  scored loop while keeping the calm drifting vibe:
  - Narration **auto-plays on entry** (no Listen toggle to start); the old toggle
    is now a **mute** control. Sound is delegated to `hostApi.speak`, so the app's
    global sound setting still gates audio; pacing uses a spoken-word estimate
    (`speechTiming.ts`, mirrors the host's audioManager) and never overlaps
    utterances or hangs a user-instant exit.
  - After each narrated beat, a gentle **"which word did you hear?"** challenge
    floats up: the target word is spoken, 3–4 candidate words drift in as tap
    chips (≥44px), grounded in the beat just heard. Reuses the existing
    beat/token/gloss model — pair-agnostic, multilingual, no new content.
  - **Real scoring:** answers are tracked and reported as a proper
    `ActivityResult` (`session.ts`) — per-item `pass`/`fail` verdicts streamed via
    `reportItem` for spec-scheduled phrases (random-fill beats stay scenery, like
    wordfall's top-up tiles), a `score = correct/faced` aggregate, and
    `detail.numbers`. The journey engine can now grade the phrases a drift featured.
  - **Completion:** on the natural end it reports the terminal result then scrolls
    on; a **Done** tap mid-run is an abandon (`journey.abandon("user_exit")`) so
    the host synthesizes the abandoned result from buffered items — the pack never
    fakes a terminal result. Exit/Done is always instant (turbo-scroll).
  - Gentle, buzzer-free feedback in the drift aesthetic; reduced-motion safe.
  - **Honest evidence guards:** while muted, beats narrate silently and NO
    challenge is posed (a "which word did you hear?" guess would stream junk
    pass/fail evidence); unsegmented han/kana lines (whole-sentence tokens)
    are never posed as tap-the-word targets, and the speech-pacing estimate
    counts CJK glyphs (≈2 per spoken word) so the challenge utterance never
    tramples a Chinese/Japanese narration.
  - New in-pack chrome string "Which word did you hear?" localized for ~54 locales;
    unit tests for challenge generation/scoring, the reporting contract, and
    speech-timing (`npm test`).
- Wired into the app as an auto-installing system pack: the Journey mixer now
  schedules `drift:read` as an interlude, discovered from this manifest's
  `activities` via the app's catalog (`web/data/packs.json` + catalog-v3).

### Changed
- Reclassified in the app catalog from `packType: "reader"` to `"game"`
  (`web/data/packs.json`). This is load-bearing, not cosmetic: the mixer marks
  reader interludes `unscored` and `apply.ts` discards grading for unscored
  slots — as a game, Drift's real per-item results now feed FSRS, it fills the
  spike (game) cadence slot, and the interlude poster shows the "quick game"
  cue.

### Fixed
- `minAppVersion` raised to `0.20.3` (was `0.17.0`) — the premium-scroll Journey
  interlude host that runs `drift:read` first shipped in 0.20.3, so pre-0.20.3
  apps (incl. 0.19.2 production) no longer auto-install a pack they can't use.
- The pack ZIP is now actually built and published by `deploy-pages.yml`;
  previously the catalog advertised `drift.zip` but the workflow never produced
  it, so the system-pack auto-install 404'd.

## [0.1.0] - 2026-07-10

### Added
- Initial Drift pack — a calm, serial, reactive micro-story reader built as a
  Journey scroll interlude (the down-tempo comedown between exercise cards).
- Pair-agnostic, multilingual content model: scenes are mood + content slots
  filled at runtime from the learner's own corpus (`getStackConfig` /
  `getRandomEntries` / spec `itemRefs`); target + native codes resolved from the
  stack or the Journey spec, degrading to target-only on immersion stacks.
- Tap-any-word gloss reveal in the learner's native language.
- Optional, user-initiated TTS narration via `hostApi.speak()` with
  beat-by-beat word highlighting; sound is off by default so sound-off learners
  are never surprised.
- Reactive scene: an evocative motif (dawn, lantern, snow, tide, door, stars)
  resolves per beat; reduced-motion safe.
- Interlude conformance: honors `journey.isActive()` / `getSpec()`, features the
  spec's current phrase as a story beat, and reports an unscored completion
  (`reportResult({ specId, score: 1, perItem: [], durationMs })`) before
  `corpan:exit` on finish. Swipe-outable; `typicalDurationSec: 30`.
- Manifest declares the `drift:read` journey activity
  (`itemKinds: ["phrase"]`, `requiredHostApis: ["journey"]`,
  `strands: ["mfi","fd"]`); localized name/description for ~54 locales; two
  chrome strings ("Listen"/"Done") localized in-pack.
- Squared-off (8px), cool-temperature, compact-mobile design; self-contained
  IIFE build (`CorpanGames.drift`), no shared deps.
