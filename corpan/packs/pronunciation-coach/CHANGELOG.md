# Changelog — Parlometron (formerly Pronunciation Coach)

On-device pronunciation practice and pass-the-device party game.
Reads a target-language phrase aloud from the host TTS, then scores
the user's repetition via the host's whisper.cpp-backed STT bridge
(iOS XCFramework + Android JNI; same `ggml-*.bin` model files on
both platforms). Pack was originally shipped as "Pronunciation Coach"
through 0.5.x; the catalog ID `pronunciation_coach` is preserved
for back-compat — only the user-facing brand changed.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.7.0] - 2026-05-19 — Scoring overlay + phrase-pack sourcing

### Added
- **Per-(language, model) scoring overrides.** New `scoringTuning.ts`
  passes a `scoringParams` overlay through `startSession` (sibling
  of `whisperParams`) so the acoustic ramp, `textFloor`, and
  compression-ratio gate can be calibrated from the pack without a
  native rebuild. Built-in tables ship empty in this release — the
  native plugin's ramps remain authoritative until profiles get
  populated empirically (see Phase 2 calibration plan). Requires
  `tauri-plugin-stt >= 0.5.0`.
- One `[PRON:score]` `console.info` per attempt with the score
  breakdown (overall / transcript / acoustic / likelihood plus
  noSpeechProb / compressionRatio / avgLogprob / temperature) for
  dev-loop calibration via `/tmp/pc-console.log`.

### Changed
- Model-setup overlay now mounts a calm offline notice when the device
  is offline ("Model downloads need internet — already-installed models
  still work"), and disables the Install / Reinstall buttons so taps
  don't kick off doomed downloads. Notice and button state swap live
  as airplane mode toggles.
- Network-related error strings (boot prepare failure, model-switch
  network failure, score-time blip) reworded to match the app's
  understated offline voice — no more "Network needed — check your
  connection" mic-button label.
- Phrase sampling now flows through the host-bridge's phrase-pack-
  aware `getRandomEntry` (Corpán 0.15.0+) — no pack changes required,
  any phrase packs the user has installed and activated automatically
  show up in Parlometron rounds.

## [0.6.3] - 2026-05-17

### Changed
- **Wait + retry instead of "restart Corpán" on
  INSUFFICIENT_MEMORY.** Device traces from the May-17 crash showed
  that iOS reliably reclaims freelist pages 5-10 seconds after a
  Large-model unload — the headroom gate fires too early, but the
  memory does come back on its own. Rather than dumping the user
  into a scary error message and forcing a process relaunch, the
  switch flow now wraps `stt.prepare()` in a `prepareWithMemoryRetry`
  loop: when the native gate returns INSUFFICIENT_MEMORY, the pack
  swaps the "Loading {target}…" overlay for a "Freeing memory for
  {target}…" message with a Cancel button, sleeps 1.5 s, and
  retries — up to 10 attempts (~15 s ceiling). On any successful
  attempt the flow continues normally. The "restart Corpán" error
  is only surfaced if all 10 retries still fail (genuinely
  out-of-memory device state) or if the user cancels (in which case
  the message is the gentler "Switch cancelled. Staying on
  {previous}.").
- **`showOverlay()` supports an optional Cancel button.** When
  invoked with `{ cancelLabel, onCancel }`, a button renders below
  the spinner with the supplied label and handler. Used by the
  memory-wait retry above; future cancel-able-wait flows (slow
  installs, etc.) can use the same primitive.

## [0.6.2] - 2026-05-17

### Added
- **Pre-flight memory check + INSUFFICIENT_MEMORY recovery
  routing.** Switching between two of the largest models (e.g.
  Large q5 → Large q8, both ~1.5 GB) could cause an iOS jetsam
  crash when the OS hadn't reclaimed the previous model's pages
  by the time `whisper_init_from_file_with_params` started
  allocating. The pack now does two layers of protection:
  1. **Pre-flight check before unload**: query
     `stt.getStatus().availableMemoryMB` and refuse the switch
     early (without touching the working model) if available is
     less than half the target's `approxSizeMB`. The user sees
     a clear "close other apps and restart Corpán" message;
     their current model stays loaded and usable.
  2. **Recovery from native gate**: if the pre-flight passes
     but the new native `INSUFFICIENT_MEMORY` error code comes
     back from `prepare()` (the authoritative check, run after
     unload + malloc pressure relief), the pack tries to revert
     to the previous model and surfaces the same restart-app
     guidance.
  Requires `tauri-plugin-stt 0.4.0`; older plugin builds don't
  emit `INSUFFICIENT_MEMORY` so the pack falls through to the
  generic error path and still recovers — just less specifically.

### Changed
- **Word pills lay out right-to-left for RTL target languages.** In
  both solo and pass-the-device results, the per-word
  red/orange/green pills under the heard transcript now flow from
  right to left when the target language is Arabic, Hebrew,
  Persian, Urdu, or pa-Arab — so the first expected word sits on
  the right edge, matching reading order. Implemented via
  `flex-direction: row-reverse` on the `.pc-words` container.
- **Play affordances flip for RTL target languages.** Within each
  pill, the ▸ play glyph becomes ◂ and moves to the left of the
  word. In the "Heard you say" row, the round ▶ play button
  becomes ◀ and moves to the right of the transcript — so in
  both spots the affordance sits at the leading edge of the
  reading direction.

### Removed
- **Silence auto-stop disconnected from the recording flow.** The
  RMS-thresholding-with-fixed-numbers approach we shipped in
  0.6.0 proved too unreliable across the variables that actually
  matter: mic gain (varies by device), noise floor (varies by
  environment), and speech amplitude (varies by speaker /
  language). Every threshold tweak trades one failure mode for
  another — quiet speakers never trip speechStart, mid-sentence
  pauses fire false stops, persistent background noise keeps the
  watcher armed forever. The real fix is a model-based VAD
  (Silero / webrtcvad) running inside the native plugin tap, not
  parameter tuning.
- **What stays.** The native `audio_level` event stream
  (tauri-plugin-stt 0.3.2+), `silenceWatcher.ts` state machine,
  `subscribeAudioLevel` host API, and `SILENCE_POLICY_BY_LANG`
  defaults map all stay intact for future re-wiring. The
  `mountGame` and `mountRound` paths no longer subscribe; users
  get the manual stop button back as the only stop trigger.
  Bundle drops ~2 kB via tree-shaking.

## [0.6.0] - 2026-05-17

### Late additions before tag (rolled in from [Unreleased])

- **Auto-stop on silence.** The native plugin now emits per-buffer
  RMS as `audio_level` events while recording (~11 Hz iOS, ~8 Hz
  Android). A new `silenceWatcher.ts` state machine subscribes to
  the stream and calls `stopSession()` after ~1.5 s of continuous
  quiet following detected speech. All thresholds (`rmsThreshold`,
  `speechStartMs`, `silenceMs`, `leadInMs`) live in JS so we can
  ship new per-language defaults via pack updates without touching
  native. Per-language overrides live in `whisperTuning.ts ::
  SILENCE_POLICY_BY_LANG`. Wired into both solo Practice and
  Parlometron multiplayer flows. The watcher feature-detects
  `stt.subscribeAudioLevel` — older host builds quietly skip it
  and the manual stop button still works.
- **Multiplayer rounds shuffle the target language.** Previously
  `pickTargetTranslation` deterministically grabbed the first
  non-native slot from the stack, so a 9-language stack kept
  landing on the same target every round. The picker now collects
  every non-native target the entry actually has a translation
  for and picks one at random per round. The eyebrow gains the
  language code (e.g. `Round 3 · KO · First to 5`) so everyone
  can see which language the round is being scored in.
- **Parlometron mount now pre-prepares the saved model.** Solo's
  boot path used to be the only place that called `stt.prepare()`,
  which meant going directly to Multiplayer on a fresh open never
  loaded the whisper.cpp context and the first `stopSession`
  failed silently. The router now reads the saved mode from
  Solo's localStorage and kicks off a fire-and-forget `prepare()`
  on mount so both modes work from any entry point.
- **Mode picker is a vertical stack** instead of side-by-side
  cards. The grid layout was producing super-tall cards mostly
  filled with empty space on iPad. Cards are now natural-height,
  stacked with a small gap, and vertically centered in the
  available body region. Max-width capped at 520 px so they don't
  span the full iPad-landscape width.
- **"Pass the iPad" → "Pass the device"** across all multiplayer
  copy. Parlometron runs on Android too.
- **"Way off" → blank.** The bad-tier (overall < 0.6) result
  banner now shows just the percentage. These models can be
  wrong, and telling someone they said it wrong when they didn't
  is worse than showing nothing.

### Audio session correctness (rolled in from [Unreleased])

- **Audio session no longer leaks past pack close.** Added a new
  `releaseAudio()` method on the host SttApi (wired through
  `tauri-plugin-stt`'s new `release_audio` command) and called
  from `parlometron.ts`'s `unmount`. Tears down AVAudioEngine +
  AVAudioSession on iOS (and AudioRecord on Android) when the
  pack closes — fixes the stuck orange mic indicator and the
  `.duckOthers` ambient-audio softening that previously persisted
  until the next process kill.

---

(Original [0.6.0] entry, 2026-05-16, follows.)

The **Parlometron** release. Rebrand + new multiplayer party game
alongside the existing solo practice flow.

### Changed
- **Pack rebranded to "Parlometron"** in user-facing copy. Catalog
  ID `pronunciation_coach` stays unchanged for back-compat with old
  Corpán installs (which keep seeing the previous 0.5.x version
  under its old name via catalog `maxAppVersion` gating). Manifest
  `name` field updated; two visible strings in `game.ts` updated;
  CHANGELOG title and prose refer to the new brand. The on-disk
  directory `packs/pronunciation-coach/` and the localStorage key
  `corpan-pronunciation-coach:v2` are kept stable — renaming would
  break user progress / dev tooling for no functional gain.

### Added
- **Mode picker** as the first screen on pack entry. Two equal-weight
  cards: **Practice** (solo, the flow you've had since 0.3.x) and
  **Play with Friends** (the new multiplayer mode). State machine +
  router lives in `src/parlometron.ts`.
- **Multiplayer mode (Play with Friends).** Pass-the-device party game.
  - Lobby: roster up to 8 players (2-player minimum, hard cap), each
    can be renamed; pick "first to 3 / 5 / 7 round wins."
  - Round: phrase is shown to every player in turn; each player has 3
    attempts; best % across attempts is their round score. Player
    order reshuffled at the start of every round so the same person
    isn't always first.
  - Between rounds: scoreboard for the round just finished (heard-vs-
    expected per player, round winner highlighted) plus cumulative
    round-win totals.
  - Game over: winner crown, final scoreboard with average %.
    "Play again" carries over the same roster + target; "Done"
    returns to the mode picker.
  - State persists to `localStorage` under `pc:parlometron:game-state`
    so a backgrounded / killed app doesn't lose mid-game progress.
    (Resume UX is not exposed in v1 — game is cleared on each new
    lobby entry.)
- **New `Large q8 ★` model entry** — full Whisper Large v3 at 8-bit
  precision (1.58 GB), self-quantized from the fp16 source because
  upstream doesn't publish it. Hosted on our own CloudFront/S3 and
  fetched via the new `downloadUrl` install field. Expected to be
  the new top pick for Telugu, Tamil, Bengali, and other non-Latin
  scripts where the Turbo distillation flounders. Runbook for the
  quantization step lives at `corpan/RUNBOOK_QUANTIZE_LARGE_Q8.md`.
- **Restructured model cards.** Each `ModelVariant` now declares
  `pros: string[]` and `cons: string[]` alongside the existing
  voice-tagline `shortDesc`. Setup-overlay cards render the
  pros/cons as a two-column ✓ / − bullet list under the tagline —
  scannable for parents and Whisper experts alike. The cards
  themselves have been reordered to be strictly ascending by size
  and the technical jargon stripped out of the prose taglines into
  the cons list where it belongs.
- **`initial_prompt` in the tuner.** Text-area row exposed in the
  Whisper-tuning panel. Set a one-sentence native-script primer per
  language; whisper.cpp prepends it (up to ~224 tokens) before
  generating, biasing the very first output tokens away from
  wrong-script greedy attractors. Built-in defaults for 13 Indic /
  Persian / Urdu languages ship a context-setting prompt — "I'm
  learning {language}. I'm going to try a phrase — tell me honestly
  what you hear." — translated into each target language. Machine-
  translated; refine per-language via the tuner.
- **Language badge moved to the header.** The uppercase base-lang
  code now lives in the header bar (between the streak and the mode
  chiclet) instead of above the phrase inside the card. Always-on
  context for polyglots; still doubles as the long-press anchor for
  the tuner.
- **Hidden Whisper-tuning panel** for power-user polyglots. Long-press
  the small uppercase language code in the header to open a
  bottom-sheet exposing whisper.cpp's decoder params per-language:
  `temperature_inc`, `temperature`, `entropy_thold`,
  `logprob_thold`, `no_speech_thold`, `suppress_blank`, `suppress_nst`,
  `n_threads`, `initial_prompt`. Values persist to `localStorage`
  under `pc:whisper-tuning` and apply on the next recording.
  Includes "Copy as JSON" to export discovered profiles for shipping
  as built-in defaults.
- **Built-in tuning profiles for Indic / low-resource languages**
  (te, ta, ml, bn, mr, gu, pa, or, as, ne, si, fa, ur). Default
  `temperature_inc = 0` for these, which disables whisper.cpp's
  internal temperature-fallback loop — replaces the chaotic mixed-
  script salad output (Ge'ez / Hiragana / Latin / Cyrillic from the
  high-T sampling path) with consistent imperfect greedy output.
  Requires the matching `tauri-plugin-stt` Unreleased entry.

## [0.5.0] - 2026-05-12

Version-skipped from 0.3.6 → 0.5.0 to signal a substantial release:
whisper.cpp runtime swap (iOS + Android), Android CPU perf via the
host plugin's `+dotprod` flag, full tonal pass on the model
catalog copy, and an Android safe-area fix on the setup overlay.

### Changed
- **Tone pass on all seven model descriptions** in
  `modelRegistry.ts`. Funny, honest, lower-expectations. The model is
  the failure surface, not the user or the app. Each card now sets
  expectations honestly — Tiny is candidly described as kind of
  terrible; Small is "the first one that mostly works"; Large q5
  carries the Android-specific slowness warning; Large Turbo q8 is
  flagged as the Android sweet spot; Full Weight Large Turbo gets
  the "might be the coolest thing your phone runs all year, or you
  might uninstall in disgust" framing. Cutting-edge / experimental
  framing throughout.
- **Setup overlay sub-headline** rewritten in the same tone. Sets
  the experimental-cutting-edge expectation up front, names the
  failure modes ("might crash your phone", "might transcribe
  'good morning' as 'goldfish moon'"), and frames the whole
  experience as on-device AI in 2026. Don't take the scoring too
  seriously.

### Fixed
- **Setup overlay respects Android bottom safe-area / gesture-bar
  inset.** `.pc-setup` bottom padding floor bumped from 24 px to
  48 px so there's visual breathing room above the gesture nav bar
  on Android — `env(safe-area-inset-bottom)` doesn't always resolve
  to a useful value under Tauri's Android WindowInsets configuration.
  iOS continues to stack the actual inset on top of the floor;
  visible change on iOS is minimal (24 px more breathing room).

### Scoring (via host plugin)
- **Punctuation and numeral words deprioritized in scoring.** The
  host plugin (`tauri-plugin-stt`, both iOS and Android) now (1)
  excludes pure-punctuation tokens from `tokenLogprobStdev` so
  comma/period-heavy phrases stop falsely triggering the acoustic
  half-penalty, and (2) excludes numeral words (pure digits OR
  language-specific number words like "diez", "noventa") from the
  acoustic per-word probabilities, because the constrained decode's
  per-word probability is unreliable for numerals (digit-vs-spelled
  ambiguity). Transcript scoring still catches numeral correctness
  via the existing `diez` ↔ `10` normalization. Net effect: phrases
  with punctuation or numerals score more honestly. Details in the
  plugin changelog.

### Performance
- **Android: Large Turbo q8 is now in the same wall-time envelope as
  Small.** Driven by the `+dotprod` ARM compile flag added to the
  host's `tauri-plugin-stt` (see that pack's changelog). Encoder per
  pass on Snapdragon 8 Elite: Small fp16 ≈ 6.0 s, Large Turbo q8 ≈
  6.0 s, Large Turbo q5 ≈ 14.8 s. q8 turbo is now the recommended
  Large default on Android; q5 turbo keeps the smallest-download
  slot. (No registry surgery required — card copy now describes
  this honestly so users self-select.)

### Added
- **`tiny_proof` model variant** for validating the host plugin's
  whisper.cpp runtime swap. Folder = `ggml-tiny.bin` (~75 MB), a
  single `.bin` file the new plugin downloads from
  `https://huggingface.co/ggerganov/whisper.cpp/`. See
  `tauri-plugin-stt` Unreleased entry for context.
- **Small + Medium repointed to whisper.cpp ggml format**:
  `ggml-small.bin` (~465 MB) and `ggml-medium.bin` (~1463 MB).
  Canonical OpenAI multilingual checkpoints, no quantization or
  bespoke distillation. The "rough edges" we hit with WhisperKit's
  argmax variants don't apply here — these are straight conversions
  of OpenAI's released weights.
- **Four Large tiers**:
  - **`large_turbo`** → `ggml-large-v3-turbo-q5_0.bin` (547 MB).
    Whisper's distilled large-v3 with smaller decoder, q5_0
    quantized. Large-class accuracy at roughly Medium download
    size; usually the best speed/quality tradeoff.
  - **`large_q8`** → `ggml-large-v3-turbo-q8_0.bin` (834 MB).
    Distilled large-v3 with the lighter q8_0 quantization. Quality
    bump over Large Turbo at modest size. (ggerganov never
    published a q8 of the full-decoder large-v3, only of the
    turbo distillation — and the full-fp16 .bin SIGSEGVs in
    ggml-metal anyway.)
  - **`large_qlora`** → `ggml-large-v3-q5_0.bin` (1031 MB). The
    standard Apple Silicon "Large" ship. Id stays `large_qlora`
    for localStorage compat with users from the WhisperKit-era
    Large slot.
  - **`large_max`** → `ggml-large-v3-turbo.bin` (1549 MB).
    Distilled large-v3 at full fp16 precision, no quantization.
    Biggest viable on-device Whisper.

### Changed
- **Download progress label shows MB** instead of raw byte counts.
  The whisper.cpp swap moved progress reporting from
  swift-transformers' file-count counters to URLSession byte
  counters; the label needed updating to match.
- **Model card labels now expose the tech tier** (Turbo / q5 / q8 /
  Full Weight). Users learn the lineage from naming + experience
  rather than abstracted t-shirt sizes.
- **Card descriptions rewritten** for the user, not the developer.
  Quirky, expectation-lowering, honest about what each tier can
  and can't do.
- **Tech-ID line added** under each card description, showing the
  underlying ggml file name in small monospace. Barely there for
  most users; scratching post for the curious.
- **Lineup reordered ascending by file size**, so the cards read
  cleanly from cheapest-to-fattest. Notable consequence: Full
  Weight Medium (1463 MB) sits between Large q5 (1031 MB) and
  Full Weight Large Turbo (1549 MB), because that's where it
  actually falls on the size scale.

### Removed
- **Full-fp16 `ggml-large-v3.bin` (~3.0 GB)** — never made it into
  a shipped tier. Verified live 2026-05-10 on iPad Pro
  (`iPad17,3`, iPadOS 26.4.2): SIGSEGV inside ggml-metal during
  load (`ggml_metal_buffer_is_shared` deref of nil — Metal's
  `MTLDevice.maxBufferLength` cap, ~3.5 GB even on 16 GB iPads,
  refused the single-tensor allocation). The quantized q5_0 /
  q8_0 / turbo-q5_0 variants are the standard whisper.cpp
  Apple Silicon ship and load cleanly. Crash report:
  `EXC_BAD_ACCESS` at `0x10`, `bug_type:309` — not jetsam.

## [0.3.6] - 2026-05-10

### Removed
- **Large and Advanced tiers temporarily removed** while every
  WhisperKit large-v3 variant on argmax's
  `argmaxinc/whisperkit-coreml` HF repo is broken on iPadOS 26.4.x.
  Verified live 2026-05-10 on iPad Pro M2 (`iPad17,3`,
  build `23E261`). Two distinct Apple bugs hit different variants:

  | Variant | Status on iPadOS 26.4.2 |
  |---|---|
  | `large-v3-v20240930_547MB` (Medium, kept) | Works |
  | `large-v3-v20240930_626MB` | Won't load. Error -14 on AudioEncoder both CPU+GPU and CPU-only. Failure path also wipes the install dir. |
  | `large-v3-v20240930` (full unquantized) | Won't load. Same error -14 on AudioEncoder. |
  | `large-v3` (full canonical OpenAI) | Won't load. Error -14 on TextDecoder both CPU+GPU and CPU-only. |
  | `large-v3_947MB` (canonical OpenAI palettized) | Loads cleanly (install + load test pass), then SIGABRT on first inference inside `MPSGraphTensorData initWithMTLBuffer` on `DefaultAsyncPredictionQueue`, ~5 GB free at crash. |
  | `large-v3_turbo_954MB` (prior Large) | Same SIGABRT as `_947MB`, reproducible 4× in one session. |
  | `large-v3_turbo` (prior Advanced) | Same as `_954MB`. |

  All failures live inside Apple frameworks (MPSGraph, Espresso,
  kernel mmap), not in WhisperKit, and cannot be caught from
  Swift try/catch. The same iPad ran the same models cleanly on
  iPadOS 26.3.x days before the OS update — the regression shipped
  with 26.4. iPadOS 26.4.2 is the latest publicly available build
  as of 2026-05-10, so no OS patch is available to wait for short-
  term.

  Medium (`large-v3-v20240930_547MB`) is the largest variant that
  survives both compile *and* inference on 26.4.2. Removing the
  upper tiers entirely is the only honest user experience until
  one of: an OS patch, a runtime swap (argmax-oss-swift 1.0.0
  bump, or sherpa-onnx, or non-on-device fallback), or argmax
  republishes the .mlmodelc bundles with different MIL ops.

  Existing users with `mode: "large_qlora"` or `mode: "advanced"`
  saved in localStorage fall through `modelById(...) === undefined`
  and boot at the fresh-install default (Small) — same graceful
  fallthrough that the 0.3.2 `openai_whisper-base` removal relies
  on. On-disk `_turbo*` / `_v20240930*` / `large-v3*` folders become
  orphans; cleanup is deferred to a future sweep.

### Known issues
- **Medium occasionally crashes on first transcribe right after
  a model switch** (e.g., Small → Medium). Transcribe-entry mem
  shows multi-GB free, no transcribe-done line, process dies, no
  jetsam. Same `MPSGraphTensorData`-class abort. Frequency: roughly
  1-in-10 post-switch attempts in this session's repro. Doesn't
  affect fresh-boot Medium use. Apple-side state pollution between
  WhisperKit unload and the next load that the existing
  `autoreleasepool` on unload doesn't fully clear. Workaround for
  affected users: force-quit + relaunch instead of switching tiers
  in-session.

### Investigation log (for future sessions)
- See `memory/feedback_whisper_ipados26_mps_crash.md` for the full
  diagnostic trail.
- Untested next moves, in rough order of effort:
  1. **Bump WhisperKit pin** from `0.18.0` → `argmax-oss-swift 1.0.0`
     (released 2026-05-01). Release notes claim "rebrand + Swift 6,
     no iOS-specific fixes" but the rebrand may have re-spun parts
     of the CoreML interaction inadvertently. Low-effort test.
  2. **Wait for iPadOS 26.4.3+**, re-test the same variants. Apple
     may quietly fix the MPSGraph regression in a point update.
  3. **Try a non-WhisperKit STT runtime** — sherpa-onnx (uses ONNX
     Runtime, sidesteps CoreML entirely) or whisper.cpp (Metal
     compute via custom shaders, not via MPSGraph).
  4. **Server-based STT fallback** for Large/Advanced tiers — host
     a Whisper-large server, ship "Server-Powered Large" as a tier
     that needs network. Sidesteps Apple entirely.
  5. **CrisperWhisper** — not on argmax's `whisperkit-coreml` HF
     repo, would need separate CoreML conversion via argmax's CLI
     or coremltools, then test whether its MIL ops dodge the
     regression.

## [0.3.5] - 2026-05-07

### Fixed
- **Pinch-zoom disabled** for the duration of the pack's mount.
  The host's viewport meta allows user-scalable, and a pinch on
  the models page was leaving the WebView in a zoomed-in state
  that persisted when navigating back to the main coach screen.
  Pack now overrides the document's viewport meta to
  `maximum-scale=1, user-scalable=no` on mount and restores the
  prior content on unmount. Pure declarative — no JS event
  listeners. (An earlier draft installed non-passive
  `gesturestart`/`gesturechange`/`gestureend` document-level
  listeners as belt-and-suspenders, but those degraded touch
  perf globally on iOS WebKit; removed in favor of the viewport
  meta alone.)
- **Swipe area now reaches the screen edges.** The card no longer
  appears to disappear "under" a strip of L/R padding during
  swipe-out. Implementation is pure CSS: `--pc-root-pad-x` is the
  canonical L/R chrome inset (22 px on iPad, 16 px on phones),
  used by both `.pc-root`'s padding and `.pc-swipe-area`'s
  matching negative margin. The deck breaks out of the chrome to
  full screen width; the header chiclets and mic stage stay
  comfortably inside the chrome (they're sibling flex children of
  `.pc-root`, unaffected by the swipe-area's negative margin).
  Inner card padding inherits the same var so content remains at
  the same visual position it had before — only the card
  *boundary* moved outward to the screen edge.

### Changed
- **Result panel pass.** Removed the Words and Sounds score bars.
  The headline already carries the percentage and verdict, and the
  per-word pills carry richer per-word truth than the bars ever
  did. The Sounds bar in particular was effectively pinned at 100%
  because its underlying acoustic score is computed from the
  *constrained* decode's per-word probabilities — and the
  constrained decode runs with `prefixTokens` forcing the expected
  text, so Whisper reports near-1.0 confidence on tokens it was
  forced to emit. Dropping the bar removes a misleading number from
  the UI; the underlying scoring fix lives in a future plugin
  release.
- **"Heard you say" restructured** as a centered, stacked block:
  small muted label on its own line, then ▶ + transcript inline
  below it. Replaces the old left-aligned label-text-button row
  that visually fought the centered banner above it and the
  centered per-word pills below. Both the success and the empty
  ("couldn't make out the words") branches share the same shape so
  the layout doesn't shift between attempts.
- **Result column normalized** to a single canonical width
  (`--pc-result-col: 600px`) used by the banner area, the
  transcript block, the per-word pill cluster, and the diagnostic
  chip row. Previously these used 600px / 640px / 720px caps that
  didn't agree visually.
- **Per-word pills** get a touch more padding and a smoother hover
  transition. They're now the primary score breakdown component
  with the bars gone, so they earn slightly more visual weight.
- **Banner percentage** font-size bumped a notch — it carries the
  quantitative load that the bars used to.

### Removed
- `.pc-bars`, `.pc-bar`, `.pc-bar-label`, `.pc-bar-track`,
  `.pc-bar-fill`, `.pc-bar-pct` styles. The bars-up slot is kept
  in the card grid for layout stability but is hidden via CSS.

## [0.3.3] - 2026-05-07

### Added
- **Large tier** (`openai_whisper-large-v3_turbo_954MB`) — QLoRA-
  quantized large-v3 turbo. Same architecture as Advanced but ~half
  the disk size. Sits between Medium and Advanced. Verified live
  through repeated transcribes on iPhone 17 Pro Max.

### Changed
- **Final 4-tier lineup**: Small (216 MB) / Medium (547 MB) /
  Large (954 MB) / Advanced (1.6 GB). All four verified working
  on iPhone Pro Max + iPad through dozens of model swaps and
  transcribes in real-device testing.
- **Card copy rewritten** to drop jargon and set honest expectations.
  Each card now describes what users actually experience ("often
  wrong", "having a moment", "every model has That One Phrase").
  Setup overlay sub-headline reframes the experience as cutting-edge
  AI running on-device that's frequently wrong — "have fun, don't
  take the scoring too seriously".
- **Reinstall actually wipes and redownloads** instead of short-
  circuiting at validateModel. Previously the plugin's
  `installModel` would bail at the validateModel check ("already
  installed") because validateModel only inspects file presence +
  size > 1 KB, not actual on-disk integrity — so a corrupt
  `.mlmodelc/weights/weight.bin` that mmap-failed at runtime would
  still pass validation and Reinstall would do nothing. Now the
  Reinstall click explicitly wipes the model dir before installing,
  guaranteeing fresh bytes from the network. Verified live: a corrupt
  install recovered cleanly via Reinstall.
- **Boot-time demotion** when a localStorage-saved model id no
  longer resolves in the registry — falls through to the fresh-
  install default (Small) before any prepare runs. Prevents the
  crash loop where a stale saved model id would keep failing on
  every launch.
- **Memory-budget gating infrastructure** wired up: pack reads
  `stt.getStatus().availableMemoryMB` at boot, caches it, and
  exposes `hasLargeMemoryBudget()` / `variantExceedsBudget()` for
  per-model gating. Currently no models in the shipping lineup
  carry the `requiresIpad: true` flag, so the gate is a no-op — but
  the wiring is in place for future use if a problematic variant
  needs to be hidden from low-memory devices.

### Removed
- **v20240930 palettized large variants (626 / 632 MB)**. Confirmed
  broken on every device tested in 100+ live attempts: install +
  load test pass, then transcribe consistently kills the app during
  the constrained-pass decode. Fresh-download from Hugging Face
  doesn't fix it; not a memory issue (Advanced 1.6 GB uses LESS
  resident memory and runs cleanly on the same device). CoreML
  inference-path bug specific to the v20240930 4-bit outlier-
  decomposition quantization. Argmax has shipped no fix; we drop
  these variants entirely until upstream resolves it.
- **Distil-whisper turbo (600 MB)** experiment. Installs and runs
  without crashing, but produces empty decodes on basic non-English
  phrases — distil-large-v3's architecture is distilled with English-
  heavy training data and the multilingual fidelity is degraded.
  Not honest to ship as a multilingual tier.

### Fixed
- **Light mode contrast on setup overlay**: `.pc-setup-root` was
  missing an explicit `color`, so descendant text inherited white
  from the host's modal chrome. Set `color: var(--pc-fg)` so every
  child picks up scheme-aware foreground.

## [0.3.2] - 2026-05-07

### Removed
- **Standard tier (`openai_whisper-base`, ~145 MB)** dropped from the
  registry. Small (`openai_whisper-small_216MB`, ~216 MB) replaces
  it as the new fresh-install default — meaningfully better across
  most languages and only ~70 MB larger. Existing users who saved
  `mode: "standard"` in localStorage fall through
  `modelById("standard") === undefined` on boot and land at the new
  default (Small). On-disk `openai_whisper-base/` files become
  orphans (the setup overlay no longer shows a card for them);
  cleaning those up is left to a future cleanup sweep — they don't
  affect functionality.

### Changed
- **Lineup is now 5 tiers** (was 6): Small / Medium / Large (Mobile)
  / Large Turbo (Mobile) / Advanced (iPad).

## [0.3.1] - 2026-05-07

### Changed
- **Explicit `stt.unload()` before switching models** in the setup
  overlay's switch flow. Defense in depth: the plugin's 0.2.1
  serialization is what actually prevents the model-switch OOM,
  but evicting the previous model from JS first means the user
  sees a clear "Unloading current… → Loading new…" UX progression
  instead of an opaque pause, AND the previous kit is guaranteed
  evicted before the new one is requested. Skipped when no
  previous model is loaded (boot path) or when the requested
  model is already active.
- **`minAppVersion` raised to `"0.12.4"`** because pc 0.3.1 needs
  the host-app's STT plugin 0.2.1 (with the prepare-chain
  serialization) to actually prevent the OOM crash. On a 0.12.3
  binary the pack would still partially work but switches could
  still crash.

## [0.3.0] - 2026-05-07

### Added
- **Four new model tiers** between Standard (145 MB) and Advanced
  (1.6 GB), so iPhones get a real upgrade path that fits within
  iOS's per-app memory limit. Lineup is now:
  - **Standard** — `openai_whisper-base` (145 MB) — unchanged
  - **Small** — `openai_whisper-small_216MB` (216 MB) — quantized small
  - **Medium** — `openai_whisper-large-v3-v20240930_547MB` (547 MB) —
    large-quality at medium size
  - **Large (Mobile)** — `openai_whisper-large-v3-v20240930_626MB`
    (626 MB) — Argmax's officially-recommended pick for "maximum
    multilingual accuracy" per their README. Should run on modern
    iPhones.
  - **Large Turbo (Mobile)** —
    `openai_whisper-large-v3-v20240930_turbo_632MB` (632 MB) — same
    accuracy class with a faster decoder.
  - **Advanced (iPad)** — `openai_whisper-large-v3_turbo` (1600 MB)
    — unchanged folder, retitled and re-described to flag that it
    is iPad / M-series only and may crash iPhones via OOM jetsam.
- The four middle tiers are all from Argmax's `v20240930` quantized
  generation, specifically tuned to preserve multilingual quality.
  Shipping multiple variants so real-device A/B testing can decide
  which one wins per language and device.

### Fixed
- **Light mode contrast on the setup overlay.** `.pc-setup-root`
  was missing an explicit `color: var(--pc-fg)`, so when the host
  wrapped the pack in a container with `color: white` (its dark
  modal chrome), the setup headline and card-name text inherited
  white. In dark mode this looked fine; in light mode it rendered
  white-on-light. Setting an explicit foreground on the setup root
  makes every descendant pick up the scheme-aware color. Main
  `.pc-root` already had this; the bug only affected the setup
  / model-management overlay.

### Changed
- **Setup overlay templates from `MODELS`** instead of hardcoding
  two `data-mode="standard"` / `data-mode="advanced"` cards. Adding
  a model is now a single registry entry; the overlay scales
  automatically.
- **First-load wait message generalized** from "Loading Advanced
  model…" to a size-driven check: any model ≥ 300 MB shows the
  CoreML-compile warning; smaller models skip it.

## [0.2.0] - 2026-05-06

### Changed
- **Model lifecycle rebuilt — installs survive reliably.** Reported
  failures: "Model not installed" appearing right after a successful
  install, and Standard disappearing after leaving and re-entering the
  pack. Root cause was the JS `looksCorrupt` substring predicate
  triggering `wipeModel` on transient errors (any "timed out" message
  ⇒ delete model files). Removed entirely. Now:
  - **No JS auto-wipe paths.** The recording-failure block no longer
    calls `wipeModel`. The boot-catch handler no longer calls
    `wipeModel`. Wipe is exclusively user-initiated via Remove or
    Reinstall buttons in the setup overlay.
  - **Routes on structured error codes** (`MODEL_NOT_INSTALLED`,
    `NETWORK`, `LOAD_FAILED`, etc.) from the plugin instead of
    matching message substrings. `LOAD_FAILED` shows a Reinstall
    prompt; `NETWORK` shows a "check your connection" banner; the
    user — not a heuristic — decides whether to delete files.
  - **`listInstalled` round-trip on boot.** Single plugin call returns
    disk-truth state for every registered model variant; replaces the
    per-mode `validateModel` loops.
  - **Model registry** in `src/modelRegistry.ts` is now the single
    source of truth for variants. Adding a model = one entry; the
    setup overlay's `renderActions` and the boot snapshot iterate the
    registry. The hardcoded `"standard" | "advanced"` literal type and
    `MODEL_BY_MODE` / `MODEL_LABEL` / `PREPARE_TIMEOUT_MS` constants
    are gone.
  - localStorage `mode` field continues to hold the registry id
    ("standard" / "advanced" today) — migration is a no-op for
    existing users.

- **Per-character pills for CJK phrases.** Chinese / Japanese /
  Korean phrases have no whitespace, so the previous whitespace
  tokenizer rendered the entire phrase as one giant pill. Mandarin
  "你好嗎" now becomes three pills (你 / 好 / 嗎), each tappable
  for per-character TTS. Uses `Intl.Segmenter` for grapheme-aware
  splitting so Hangul syllable blocks and surrogate pairs are
  handled correctly. Per-position `freeSim` works when the free
  decode has the same number of characters; falls back to overall
  similarity otherwise. Heard per-word probability isn't used in
  CJK mode — Whisper's word output for CJK doesn't align reliably
  with character boundaries. Thai / Lao / Tibetan / Burmese
  intentionally still render whole-phrase pills (complex grapheme
  clusters where individual codepoints aren't independently
  meaningful).
- **Per-pill numeral handling + per-lang "garbled" threshold.**
  Mirrors the plugin work to keep the pill UI consistent with the
  overall score:
  - `normalizeForCompare` now takes a `lang` and maps number-words
    to digits (`novanta` → `90`) for en/es/fr/it/de/pt, so per-pill
    `freeSim` no longer reads false-mismatches when the user
    pronounces a spelled-out number perfectly and Whisper
    transcribes it as a numeral.
  - "Sounded a bit garbled" chip threshold is now per-language:
    3.5 for Indic / Persian / Urdu (where BPE legitimately inflates
    `compressionRatio`), 2.4 elsewhere. Stops the chip from firing
    on clean Tamil / Telugu attempts.
- **Wider verdict spectrum.** The old three-way split (≥0.7
  "Nailed it", ≥0.4 "Close", else "Keep going") meant a 75% scored
  the same headline as a near-perfect 95%. New tiers give the
  feedback room to track the score:
  - ≥0.95 → "✨ Perfect!"
  - ≥0.85 → "🎉 Nailed it!" (confetti + streak)
  - ≥0.75 → "Great" (streak preserved, no confetti)
  - ≥0.60 → "Pretty good" (streak preserved)
  - ≥0.45 → "Close — keep going" (streak resets)
  - ≥0.25 → "Keep practicing"
  - <0.25 → "Try again"
  Confetti and streak increment now require ≥0.85 (genuine "nailed
  it"). 0.60–0.85 keeps the streak alive but doesn't reward it.
- **Loading model overlay is more clearly blocking.** The model
  load can take 10–30s on first launch (CoreML ANE specialization
  + prewarm) — the previous overlay had a 15px message and a small
  spinner that read like a passing toast. Now: stronger backdrop
  blur, larger text, larger spinner, two-line message naming the
  model and the rough wait. Mic button also gets a clearly-inactive
  gray treatment when disabled (was just opacity 0.5).
### Fixed
- **Plugin errors no longer surface as `[object Object]`.** Tauri
  plugin errors arrive across the JS bridge as plain objects (e.g.
  `{message: "...", code: 31, domain: "STT"}`), not `Error`
  instances, so the previous `err instanceof Error ? err.message :
  String(err)` pattern collapsed every install / record / score
  failure to "[object Object]". Replaced with a `formatErr` helper
  that walks the common error shapes (Error, plugin-shape with
  `message`/`localizedDescription`/`error`/`description`, plain
  string, plain object → JSON) so the user sees the real message.
- **Race condition in boot wiped the wrong model after a failed
  `prepare`.** `boot()` ran `prepareWithRecovery(modelMode)` and
  `loadFirstPhrase()` in `Promise.all`. `loadFirstPhrase` invoked
  `restoreFromStorage()` which mutated `modelMode = saved.mode` —
  even though `boot()` had already loaded the saved mode at the top
  via `savedEarly` and may have replaced it with the user's
  just-completed setup choice. With the in-flight prepare reading
  the captured arg but the catch handler reading the live `modelMode`,
  a failed prepare for one model wiped the OTHER model's files and
  re-prepared the OTHER model. Symptom on TestFlight: install
  Standard, score 0% with "Could not load Advanced mode: Model not
  installed (`<model dir missing>`)".
  Fix: removed the `modelMode = saved.mode` mutation from
  `restoreFromStorage` (boot is the single source of truth for
  `modelMode`). Also captured `bootTargetMode` / `targetMode` before
  the awaits in `boot()` and `openModelSetup()` so the catch always
  references the model that was actually being prepared.
- **Boot catch no longer wipes on "model not installed".** The wipe
  was meant for truncated-download / CoreML-load corruption — a
  missing model dir doesn't have anything to wipe, and trying could
  have hit the wrong target if `modelMode` had been mutated. Now
  the wipe runs only on real on-disk corruption errors.

### Changed
- **Friendlier result-panel language.** Removed jargon ("Prior
  rescue", "Decoder fallback", "Compression 2.6 (gibberish)",
  "Whisper lang: pa") in favor of plain English a kid can act on:
  - "Sounded faint — try a bit louder" (no-speech)
  - "Sounded a bit garbled" (high compression ratio)
  - "Words didn't quite match" (free-vs-constrained divergence)
  - "Couldn't make out the words" (free decode empty)
  - "Different writing system — scoring may be off" (script
    mismatch like `pa-Arab` → Whisper outputs Gurmukhi).
  Decoder-temperature and Whisper-language chips are gone from the
  user-facing UI entirely (still in OSLog for diagnosis).
- **Bar labels** changed from "Transcript" / "Acoustic" /
  "Likelihood" → "Words" / "Sounds". Likelihood was redundant with
  the other two, so it's dropped from the visual.
- **Constrained transcript hidden from default UI.** With
  `prefixTokens` forcing it, the constrained "Heard" line was
  essentially the expected phrase echoed back — already visible at
  the top of the page. The single transcript row now shows the
  FREE decode (the honest signal of what Whisper actually heard)
  labeled "Heard you say". When free is empty (Whisper couldn't
  make it out) the row still renders with a "(couldn't make out
  the words)" placeholder so silent failure stays loud.
- **Result panel layout overhaul** — rewrote the per-attempt result so
  the eye doesn't jump between rows that reflow per phrase:
  - **Score bars** replace the centered Transcript / Acoustic /
    Likelihood chips. Three rows in a fixed `label · track · pct`
    grid; fill colored red/amber/green by threshold.
  - **Word pills are now the EXPECTED phrase**, not what was heard,
    so tapping a pill always plays the correct word in the target
    language (great for studying individual words). Pill color now
    combines two signals: the heard per-word probability tier
    (constrained decode) AND the free-decode character similarity
    tier — the pill takes the *worst* of the two. This kills the
    "all green pills, 9% overall" contradiction: when the free
    transcript diverged from expected (the honest signal), the
    pills go orange/red even though the constrained decode was
    "confident" (because `prefixTokens` was forcing those tokens).
    Free-vs-expected is computed positionally when word counts
    align, otherwise the global similarity is applied uniformly.
    When the free decode came back empty (a genuine plugin-side
    failure that the plugin already drives to 0% overall), pills
    now also force-color from a similarity of 0 so the visual
    matches the score, and a "Free decode empty" warn chip renders
    in the diagnostics row.
  - **Heard / Free** transcripts moved to dedicated playable rows
    with their own ▶ buttons that speak the captured text in the
    target language — the user can audition what Whisper actually
    heard vs what the constrained pass returned. Free row only
    renders when it differs from the constrained transcript.
  - **Diagnostic warn chips** (No-speech, Compression, Decoder
    fallback, Prior rescue, Whisper-lang/script mismatch) collected
    into a single dimmed row at the bottom — only rendered when
    something is actually flagged.
- **Result UI now surfaces every Whisper signal.** Adds chips for
  Acoustic, conditional warning chips for No-speech (when > 20%),
  Compression (> 2.4 = gibberish detector tripped), Decoder fallback
  (temperature > 0), Prior rescue (free-decode diverged from expected,
  i.e. Whisper's LM was doing the work). Free-decode transcript
  rendered as a dashed-border chip when it differs from the
  constrained transcript so you can see what Whisper actually heard
  vs what it produced under bias.
- **"Couldn't hear you" path.** When the plugin reports
  `noSpeechProb > 0.5`, the result card switches to a dedicated
  "🎙️ Couldn't hear you — move closer or speak louder" message
  instead of a numeric score. Doesn't reset the streak (the user
  didn't actually attempt the phrase).

### Fixed
- **Telugu and other Indic / Persian abugida scripts no longer score
  0% on perfect speech.** Plugin's text-normalization step was
  stripping vowel marks (Unicode `Mn` / `Mc`) — essential characters
  for Telugu, Tamil, Bengali, Malayalam, Marathi, Gujarati, Punjabi
  spelling. Now keeps marks and falls back to the overall logprob
  signal when WhisperKit doesn't return per-word timings on
  low-resource languages.

### Changed
- **Telugu (and other low-resource Indic / Persian languages) no longer
  cap at ~30%.** The plugin's scoring now applies a softer per-word
  acoustic ramp for `te, ta, bn, ml, mr, gu, pa, ur, fa, si, ne, or,
  as`, since Whisper's word probabilities are intrinsically lower on
  these languages even for perfect speech. Native pronunciation in
  those languages should land in the 70–90% range now, garbage stays
  near 0%.
- **Consistent fast inference (no more 0.5 s vs 30 s lottery).** The
  plugin now uses WhisperKit's `prewarm: true` at install and prepare,
  so CoreML's device-specialized cache is populated up-front. Apple
  evicts that cache on OS updates and after long idles; without prewarm
  the first transcribe of a session paid the full re-specialization
  cost.
- **Stricter scoring on Advanced — no more "Nailed it!" for cadence-only
  guesses.** `large-v3-turbo`'s language-model prior is strong enough to
  recover the right transcript text from speech that just has the right
  rhythm, which was making the old `0.7·transcript + 0.3·likelihood`
  formula too forgiving. New score blends per-word acoustic confidence
  (avgWordProb / minWordProb from Whisper's word timings) multiplicatively
  with the transcript-text match: `overall = transcript × (0.1 + 0.9·acoustic)`.
  A perfect text match with mediocre acoustics (avgWordProb ~0.5) now
  scores ~50%, not 85%. Verdict thresholds (≥70% Nailed, ≥40% Close) are
  unchanged. Result UI gains a third **Acoustic** chip so you can see
  the per-word confidence directly.

### Fixed
- **Advanced model: CPU+GPU compute units to fix CoreML error -14.**
  The plugin now passes `ModelComputeOptions(audioEncoderCompute: .cpuAndGPU,
  textDecoderCompute: .cpuAndGPU)` for both install-time verification
  and recording-time `prepare`. WhisperKit's default
  `textDecoderCompute = .cpuAndNeuralEngine` fails to compile a CoreML
  execution plan for `large-v3-turbo` on some M-series iPad chips. CPU
  + GPU is still hardware-accelerated and works on every device we
  ship to. Standard model is unaffected (it loaded fine on ANE; CPU+GPU
  is harmless).
- **localStorage v1 → v2 migration**: drops a stale `mode: "advanced"`
  entry from previous broken installs so users land on the setup
  overlay with a clean slate. `mode: "standard"` is preserved
  (Standard installs were never broken).

### Changed
- **Formal install / settings flow.** The pack no longer tries to download
  a model in the middle of the recording flow. On first open you land on
  a setup screen with two cards (Standard ~145 MB, Advanced ~1.6 GB)
  showing live install state, sizes, and a real progress bar with
  byte-level numbers. The download has to finish AND pass post-download
  integrity verification (every `.mlmodelc/weights/weight.bin` present
  and ≥ 1 KB) before the screen lets you through to recording. The same
  screen doubles as ongoing settings — tapping the model pill in the
  recording header reopens it so you can switch active models, reinstall
  one, or remove an unused one. If a verified-installed model fails at
  runtime (rare — would require external file corruption), we wipe it
  and route you back to setup instead of silently re-downloading during
  scoring.
- The plugin's `prepare()` is now strictly local-only (`download: false`
  passed to `WhisperKitConfig`). The recording UX cannot accidentally
  trigger a network download.

### Added
- `stt.installModel(model, onProgress)` — explicit, observable download.
  Emits `phase: downloading | verifying | verified | failed` events with
  `fraction`, `completed`, `total` byte counts. Verifies post-download
  before resolving; refuses to declare success on a partial transfer.
- `stt.validateModel(model)` — synchronous on-disk integrity probe used
  to gate boot between setup and recording flows.

### Added
- **Advanced mode** — header toggle that swaps the WhisperKit model
  between `openai_whisper-base` (Standard, ~140 MB) and
  `openai_whisper-large-v3-turbo` (Advanced, ~1.6 GB). The first
  Advanced load downloads the model from HuggingFace and may take a
  couple of minutes; subsequent launches are instant. The choice is
  persisted in `localStorage` so the pack reopens in your last mode.
  The footer shows which model is currently driving inference.
- Tap the target phrase (or its romanization) to hear it via the host
  TTS before attempting to say it. Cursor and a subtle accent-colour
  hover indicate the affordance. Suppressed during real swipe gestures
  so swipe-to-navigate doesn't accidentally trigger playback.

### Fixed
- **Corrupt model auto-recovery (defense in depth)**: swift-transformers
  (WhisperKit's downloader) can silently report a Hugging Face download as
  complete while leaving `weights/weight.bin` files unmoved or 0-byte —
  manifesting either as a POSIX 2 "couldn't be moved" at init, a
  "could not open weight.bin" at first transcribe, a CoreML "execution
  plan" / error code -14 failure, or an indefinite hang. Six layers of
  defense:
  1. Plugin validates every `.mlmodelc/weights/weight.bin` is present AND
     larger than 1 KB at both pre-flight (before init) and post-init.
  2. If any weight is missing/truncated, wipe the model dir +
     `.cache/huggingface/download/<model>/` and re-download once.
  3. Transcribe is wrapped in a 60 s hard deadline on the Swift side so a
     CoreML compile loop can never freeze the UI.
  4. On any transcribe error matching `weight.bin` / `model.mil` /
     `execution plan` / `code -14` / `timed out` / `could not open`, the
     in-memory `WhisperKit` handle is dropped so the next prepare
     re-validates the on-disk files.
  5. New `stt.wipeModel({ model })` JS escape hatch lets the pack delete a
     corrupt model on demand.
  6. Pack wraps `prepare` (90 s Standard / 360 s Advanced) and
     `stopSession` (90 s) in deadlines and auto-calls `wipeModel` on any
     corrupt-looking failure, then retries; Advanced still demotes to
     Standard if it can't recover. The `Scoring…` spinner can no longer
     hang forever — within 90 s the pack either scores, recovers and
     prompts you to try again, or surfaces a real error.
- Per-word pills no longer split contractions across an apostrophe.
  Whisper's tokenizer routinely chops "j'ai" / "qu'il" / "don't" /
  "I'll" / "l'eau" into two pills; we now coalesce any pair where the
  previous word ends with `'` / `'` or the next starts with one. The
  merged pill takes the joined text, the union start–end window, and
  the worst (lowest) probability of its parts so the colour stays
  honest. The TTS playback on tap speaks the joined word.
- Swipe is bound to the whole middle area (deck + reveal), not just the
  card, with `touch-action: none` so iOS doesn't grab horizontal drags
  as page scroll. Buttons inside the swipe area (mic, skip, X, word
  pills, "Hear it") are excluded from swipe detection so taps still
  register. Pointer capture is acquired/released exactly once per drag
  on the wrapper, surviving the in-flight card swap during a slide.
- The score reveal no longer reads as a modal: the card chrome
  (background, border, shadow, manual × dismiss button) is gone. It is
  now plain typography stacked under the phrase area, auto-clearing on
  the next swipe, mic tap, or skip.

### Changed
- **Random target language across the stack**: every phrase now picks a
  random target slot from `languages.slice(1)` (Fisher–Yates shuffle,
  fall through if a given language has no translation). A FR/ES/DE/EN
  stack with EN as king now actually mixes FR, ES, DE phrase-to-phrase
  instead of locking onto whichever slot won the first draw.
- **Inline celebration instead of a blocking modal**: the score reveal
  now lives in the layout between the phrase card and the mic, with the
  mic anchored to the bottom (`margin-top: auto`) so it never moves.
  Swipes pass straight through to the phrase card — you can navigate
  to the next phrase without dismissing the celebration first; arriving
  at a new phrase auto-clears the previous score.
- **Phrase deck is bounded** (`28vh, max 360px`) so the inline reveal
  always has room without competing for the card's vertical space.

### Added
- **Per-word pills are now TTS buttons**: tap any colored word pill in
  the celebration to hear that single word spoken in the target language
  (via `hostApi.speak`). Subtle play-arrow indicator appears after each
  word; lift-on-hover for desktop testing.
- The dark UI background now reaches the actual screen edges on iPad.
  An always-on `.pc-backdrop` layer sits inside the pack container at the
  base of the host's overlay stacking context, and the pack root has an
  explicit dark fill — so even if iOS leaves a strip below the host's
  outer `bg-black` wrapper, the pack fills it.

### Added
- Streak and phrase history are persisted to `localStorage`
  (key `corpan-pronunciation-coach:v1`, capped at the last 50 phrases).
  Reopening the pack restores you on the last phrase, with your streak
  intact and back-swipe still working through the saved history.
- Top-right `×` close button — dispatches `corpan:exit` to return to the
  Corpán shell. Also bound to the Escape key.
- Horizontal swipe + arrow-key navigation: swipe left / `→` for next
  phrase, swipe right / `←` for previous (with phrase history).
- Live drag follow with subtle rotation; crisp slide-in/out transitions.
- Streak indicator (🔥) that ticks up on every score ≥ 70%, plus a
  one-shot confetti burst on the celebration.
- Background prefetch: the next phrase is fetched as soon as the current
  one renders, so swipe-next is instant.
- Spacebar shortcut for tap-to-speak (idle → record → score).
- Full-viewport sizing: `100dvh` + `env(safe-area-inset-*)` padding so
  the layout fills the iPad screen below the Dynamic Island and above
  the home indicator. Pinch-zoom, callout, and overscroll suppressed.

## [0.1.0] - 2026-05-04
### Added
- Initial WhisperKit-backed pronunciation practice pack (iOS only).
