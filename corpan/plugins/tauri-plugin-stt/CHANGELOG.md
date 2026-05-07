# Changelog

All notable changes to this plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.2] - 2026-05-07

### Reverted
- **`prewarm: false` on runtime prepare → reverted to `prewarm: true`.**
  Briefly tried this as a memory micro-optimization (defer CoreML
  compile from load-time to first-transcribe time). It reshaped
  runtime behavior in ways that hurt on models that previously
  worked. Restored the original prewarm-at-load behavior across
  the runtime prepare path and both install-failure restore paths.
  First transcribe is cheap again.
- **Serial dual-decode → reverted to parallel TaskGroup.** The
  original concurrent form was what worked before. Forcing
  constrained-then-free serial may have changed CoreML scheduling
  in ways that interacted poorly with quantized variants. Restored
  the parallel form with shared timeout race.

The chain serializer (preventing two concurrent `prepare()` calls
from stacking model allocations), `autoreleasepool` around kit
drops, mmap retry, and memory snapshot logging all stay — those
are structural fixes, not runtime-shape changes.

### Added
- **`getStatus()` returns memory budget data.** Two new fields on
  `StatusPayload`: `availableMemoryMB` (per-app jetsam budget from
  `os_proc_available_memory()`, iOS 13+) and `physicalMemoryMB`
  (total device RAM from `ProcessInfo.processInfo.physicalMemory`).
  Used by the pack to gate memory-hungry models on devices with
  iPhone-class budgets, regardless of what `navigator.userAgent`
  claims about iPad-vs-iPhone.

### Fixed
- **Transcribe-time OOM crash on iPhone with quantized large
  models, take 2 — serial dual-decode.** The previous theory
  (prewarm on prepare being responsible) was wrong on its own. With
  `prewarm: false` on prepare, the same crash reproduced
  immediately on the 632 MB Large Turbo (Mobile) variant during
  the very first transcribe. Live trace showed the app dying
  mid-transcribe with 4386 MB available at entry — confirming the
  burst exceeded 4 GB even with no prewarm.

  Real root cause: the dual decode (constrained + free passes,
  used for honest scoring) ran both passes **concurrently** in a
  `withThrowingTaskGroup`. On a large model that put TWO decoder
  activation tensor sets live in GPU/ANE memory at the same time —
  roughly 2× peak memory of a single decode. The original code
  even noted "we pay ~2× transcribe latency for this," meaning the
  parallel form wasn't even giving a wall-clock speedup (the GPU
  is shared, both passes serialize on it under the hood). Cost of
  the concurrency was pure: doubled peak memory for no
  throughput win.

  Decodes now run **in series** — constrained first, then free —
  with the same per-pass timeout race. Peak memory during
  transcribe approximately halves; wall-clock cost is unchanged.
  Two new memory snapshots (`transcribe-constrained-start`,
  `transcribe-free-start`) make the new shape visible in trace.

- **Transient `Unable to mmap` failures on consecutive loads of
  the same model.** Live trace showed `LOAD_FAILED` (mmap
  error on `weights/weight.bin`) on a prepare that ran ~30 ms
  after a successful install-time load test of the same file.
  Same model loaded fine ~10 s later. The mmap failure is a
  short-lived resource issue (CoreML / kernel hasn't released
  the prior mapping yet); it's not corruption. `loadKitWithComputeFallback`
  now retries on the "Unable to mmap" pattern with 250 ms / 750 ms
  exponential backoff (up to 3 total tries), bounded so a genuinely
  unreadable file still fails fast. Genuine corruption fails on
  every retry and surfaces LOAD_FAILED as before.

- **Prewarm: false on the runtime prepare path** (kept from the
  earlier theory — still a memory win even though it wasn't the
  full story). Install-time load test still uses `prewarm: true`
  so we verify the model compiles end-to-end on the device before
  declaring the install successful. The two install-failure
  restore paths also use `prewarm: false` since by the time we
  reach those, the device is already memory-pressured.

### Added
- **Memory snapshot logging at every load/transcribe boundary.**
  New helper `sttMemSnapshot(tag:)` logs resident memory and
  `os_proc_available_memory()` (iOS's "headroom before jetsam"
  estimate) at: prepare entry, prepare loaded, after unload,
  transcribe entry, transcribe done. Format:
  `Whisper | mem [<tag>] resident=NMB available=NMB`. Lets us
  diagnose future OOM crashes by reading numbers off the log
  instead of guessing from process death.

## [0.2.1] - 2026-05-07

### Fixed
- **Model-switch OOM crash on iPhone.** `prepare()` had no in-flight
  serialization — every call unconditionally spawned a fresh
  `Task { try await loadKitWithComputeFallback(...) }`. When two
  prepares arrived close together (e.g., boot's prepare still
  loading when a setup-overlay switch fired), both Tasks ran their
  CoreML allocations in parallel, peaking at `(old + new)` resident
  memory and tripping iOS jetsam on iPhones even when each model
  fit individually. Live trace evidence:

  ```
  12:35:19  prepare requested: large-v3_turbo
  12:35:19  loading model from disk: large-v3_turbo
  12:35:28  prepare requested: base       ← second prepare 9s later
  12:35:28  loading model from disk: base ← runs concurrently
  12:35:34  loaded ok: base
  12:35:35  loaded ok: large-v3_turbo     ← both kits resident
  ```

  Two `loading model from disk` lines back-to-back with no
  intervening unload.

  Fix: every `prepare()` now appends to a `prepareChain: Task<Void,
  Never>` and awaits the previous tail before doing any work. After
  the await, it re-checks whether the requested model is now loaded
  (a previous chain entry may have just loaded it for us) and
  short-circuits if so. Otherwise it drops the previous kit
  (in `autoreleasepool` so CoreML's MLModel can release its
  memory-mapped weight buffers immediately) and runs its own load.
  Net effect: at most ONE WhisperKit allocation in flight at a
  time. Concurrent prepares queue cleanly. Switch-during-load adds
  a few seconds of latency but never crashes.

  Also: a new log line — `Whisper | prepare queueing behind
  in-flight load: <model> (requested: <other-model>)` — makes the
  serialization visible in trace.

### Changed
- **`unload()` wraps the kit drop in `autoreleasepool`** so the
  Obj-C autorelease drain fires immediately, not at some deferred
  ARC moment. Without this, a subsequent `prepare()` could begin
  allocating a new kit before CoreML had actually released the
  previous one's memory.

## [0.2.0] - 2026-05-06

### Added
- **Android stub module** (`android/build.gradle.kts` + `SttPlugin.kt`)
  so `gradlew :app:assembleRelease` can resolve the
  `:tauri-plugin-stt` project dependency. The plugin is iOS-only at
  runtime; every command on Android either rejects with "STT not
  supported on Android" or returns a feature-detection no
  (`isAvailable: false`, `listInstalled: []`). Pronunciation-coach
  is gated to `platforms: ["ios"]` in the catalog, so these stubs
  are never invoked at runtime — they only exist so the Android
  release variant resolves and the Android APK build can complete.

### Changed
- **CoreML compute-backend fallback to CPU-only on error -14.**
  Even with `.cpuAndGPU` for both encoder and decoder, certain iPad
  chips still fail to compile a CoreML execution plan for
  `large-v3-turbo` and surface as `"Failed to build the model
  execution plan ... error code: -14"`. Reinstalling didn't help
  (the bytes were fine — it's an MLProgram backend bug). The plugin
  now wraps all WhisperKit loads in `loadKitWithComputeFallback`,
  which on a compute-backend error specifically (matched on
  "execution plan" / "could not build the model" / "error code: -14"
  patterns) automatically retries with `.cpuOnly`. Pure-CPU is
  noticeably slower but works on every iPad we ship to. Affected
  devices keep working without ever surfacing the Reinstall loop
  caused by what was actually a backend bug. Network and
  file-not-found errors bubble up immediately without a fallback
  attempt.

### Changed
- **Model lifecycle rebuilt — no more error-driven auto-wipe.** Two
  reproducible failures motivated the rewrite: (1) "Could not load
  Advanced model: Model not installed" appearing right after a
  successful install, and (2) leaving the pack and returning leaving
  Standard no longer installed. Root cause was the JS `looksCorrupt`
  substring predicate matching `"timed out"` and triggering `wipeModel`
  on any transient timeout — CoreML slow first-compile, app suspended
  mid-transcribe, tokenizer fetch hiccup during prepare(). The fix:
  - **Structured error codes.** Every plugin failure carries a stable
    code (`MODEL_NOT_INSTALLED`, `NETWORK`, `LOAD_FAILED`, `IO_FAILED`,
    `BUSY`, `CANCELLED`, `MIC_PERMISSION_DENIED`, etc.) emitted as
    `"CODE: human-readable description"` (matching the convention used
    by tauri-plugin-iap). The host-app bridge parses the prefix and
    attaches `error.code` to thrown errors. Packs route on code, never
    on message substring.
  - **`listInstalled({ models: [...] })` command.** Single round-trip
    that returns disk-truth validation state for every requested
    variant. Boot calls it once instead of N×`validateModel`.
  - **Atomic install.** `installModel` now stages the existing on-disk
    install aside before WhisperKit.download writes new files, then
    validates and either commits (drop the rollback target) or rolls
    back (restore the previous install, remove the partial download).
    A failed install never corrupts the previous working install.
  - **`unload()` command.** Drops the in-memory WhisperKit instance
    without touching disk — for memory-warning hooks. Next prepare()
    is a load, not a download.
  - **No more `looksCorrupt` heuristic on transcribe error.** The
    in-memory kit is no longer dropped on substring matches like
    "timed out" or "weight.bin". If on-disk bytes are genuinely bad,
    the next prepare() returns LOAD_FAILED and the pack surfaces a
    Reinstall prompt — the user, not a substring match, decides
    whether to delete files.

- **Phase 1 of pronunciation-scoring rethink: mine WhisperKit properly.**
  Single-pass Whisper scoring was leaning entirely on `avgLogprob` and
  per-word `probability`, which let `large-v3-turbo`'s LM prior recover
  a "correct" transcript from cadence-only nonsense (FR/ES "got away
  with murder") and intrinsically misranked low-resource Telugu.
  Several signals now flow into the score:
  - **Per-segment quality signals** (`noSpeechProb`, `compressionRatio`,
    `temperature`) read from every `TranscriptionSegment`. `noSpeechProb
    > 0.5` becomes a hard early-exit "Couldn't hear you" gate (no score
    breakdown, doesn't reset streak). `compressionRatio > 2.4` caps
    overall ≤ 0.4 (Whisper's own gibberish threshold). `temperature > 0`
    (decoder fell back from greedy) multiplies acoustic by 0.8.
  - **Per-token logprobs** (`segment.tokenLogProbs[i][segment.tokens[i]]`)
    aggregated to `minTokenLogprob` and `tokenLogprobStdev`. High stdev
    (> 0.8) — confident on some tokens, lost on others — is an honest
    pronunciation problem and halves acoustic.
  - **Free-vs-constrained dual decode.** Whisper is now run twice on
    the same audio: once with `prefixTokens` set to the encoded
    expected text (constrained), once with no bias (free). Levenshtein
    similarity between the two transcripts becomes
    `freeVsConstrainedSimilarity`; < 0.6 means the prior was rescuing
    weak audio and halves acoustic. Cost is ~2× transcribe latency;
    encoder-shared optimization (run audio encoder once, decoder
    twice) is a follow-up if latency proves user-visible.
- **Switched from `promptTokens` to `prefixTokens` for constrained
  decode.** `promptTokens` is conversation-context-style soft bias;
  `prefixTokens` is appended after SOT/lang/task prefill and feeds
  directly into the output sequence, giving us per-token logprobs
  against the *expected* text rather than against whatever Whisper
  would have free-decoded.
- **Free decode now drives `transcriptScore` directly.** The
  constrained pass matches expected almost by construction (prefix
  forces it), so its similarity to expected was a near-useless
  signal that the score was leaning on. `transcriptScore` is now
  `min(sim(constrained, expected), sim(free, expected))` — a strong
  free match ratifies the constrained match; a weak free match (the
  prior is rescuing rhythm-only mispronunciation) drags the score
  down directly. Real case that motivated this: expected "Necessito
  la clau" → constrained heard "Necessito la clau" (prior-rescued)
  while free heard "Necessita le cli" (~0.76 similarity), and the
  user got 100% "Nailed it" for an intentional mispronunciation.
- **Acoustic penalty for free-vs-expected divergence is now a smooth
  band**, not a binary `<0.6 → ×0.5` cliff. Multiplier curve: sim
  1.0 → ×1.0, 0.85 → ×0.90, 0.70 → ×0.70, 0.60 → ×0.55, 0.40 →
  ×0.35, 0.0 → ×0.20 floor. Penalty now bites in the 0.7–0.85 range
  where the old cliff was silently letting prior rescue through.
- **CoreML load test is resilient to flaky-network tokenizer fetches.**
  WhisperKit's `loadTokenizerIfNeeded` falls back to fetching the
  tokenizer from the openai/<variant> repo on Hugging Face when no
  local `tokenizer.json` is present (the argmaxinc/whisperkit-coreml
  repo we download from doesn't include one). On a slow / flaky
  connection that fetch times out and the install path was wiping the
  whole model — forcing the user to re-download 150 MB / 1.6 GB even
  though the model bytes were perfectly fine. Now the post-download
  load test retries up to 3 times with 2s/4s backoff on network errors,
  and on final failure the network case surfaces a friendly "couldn't
  fetch the tokenizer" message and DOES NOT wipe the model. CoreML
  errors still trigger a wipe (those mean the download was actually
  truncated).
- **Word-level similarity now drives transcript scoring alongside
  character-level.** The Spanish complaint case: user mispronounced
  "Si comes bien, te sentirás más saludable" → free decode
  "sitcoms been t centuris miss saludable". Char-level Levenshtein
  reads ~0.6 (accidental letter overlap inflates the score) but
  word-level reads ~0.2 (only 1 of 8 words actually matched).
  `transcriptScore` is now `min(charSim, wordSim)` against
  expected — both must agree on "good match" for full credit, so
  cadence-only mispronunciations no longer leak through as 60%+
  scores. Char-level alone is preserved for CJK / no-whitespace
  scripts where every character is a meaningful unit (word-level
  Levenshtein on a single "word" produces a useless 0/1 binary).
- **Removed the now-redundant acoustic divergence penalty.** When
  `transcriptScore` ignored the free decode, an `acoustic *=
  penaltyMul(freeVsExpected)` curve was the only way to surface
  free-vs-expected divergence in the score. With the min(char,
  word) change above baking that signal directly into transcript,
  applying the curve on top double-counted the same penalty.
  `freeVsConstrainedSimilarity` is still computed for the
  diagnostic chip and OSLog.
- **Compression-ratio gate is per-language now.** Whisper's 2.4
  default is calibrated for Latin-script English; Indic / Persian
  / Urdu BPE expands a single phoneme to 2–4 sub-tokens, so even
  clean speech in te/ta/bn/ml/mr/gu/pa/ur/fa/si/ne/or/as can
  legitimately push `compressionRatio` past 2.4. The gate was
  capping perfect Tamil attempts at 40% with a false "garbled"
  flag. Threshold raised to `3.5` for low-resource langs; `2.4`
  default holds for everything else.
- **Number-words ↔ digits normalization.** Whisper transcribes
  spoken numbers as digits regardless of how the speaker said
  them — `"novanta"` (it) → `"90"`, `"ten"` (en) → `"10"` — so
  text comparison was failing the user even on perfect
  pronunciation. `normalize()` now takes an optional `lang` and
  applies a per-language word→digit map before comparison.
  Coverage: en/es/fr/it/de/pt for 0–20, round tens, hundreds,
  thousand. Compound forms ("ventuno", "twenty-one") are out of
  scope for this pass; the common round-number practice case is
  covered. Heard side already arrives in digit form, so the
  expected side gets normalized to match.
- **Tightened acoustic ramps to remove top-end inflation.** With
  `highRes` ramp `avgZero=0.30, avgOne=0.85, minZero=0.10, minOne=
  0.50` plus `0.7·avg + 0.3·min` blending, "phrase understood,
  accent clearly off" was scoring 100%. Pushed to `avgZero=0.40,
  avgOne=0.95, minZero=0.20, minOne=0.78` and bumped min weight to
  `0.6·avg + 0.4·min` so a single weak word visibly hurts the
  score. `lowRes` ramp also nudged: `avgOne 0.55→0.70`, `minOne
  0.35→0.45`. Result: 100% now requires near-native confidence on
  every word; "passable" sits in the 60–80 range with room above.
- **Fixed crash when switching from Standard → Advanced.** The
  previous-loaded model wasn't released before the new one was
  allocated, so peak memory hit `oldModel + newModel + CoreML
  buffers`. Standard (~150 MB) → Advanced (~640 MB) blew past iOS's
  per-app memory limit and the OS killed the app. Reverse direction
  worked because peak was bounded by the resident large model.
  `prepare()` now drops the existing kit reference (under
  `queue.sync` to flush deallocation) BEFORE allocating the new
  one.
- **Latency caps to fail fast on nonsense audio.** Two
  `DecodingOptions` knobs were running on defaults that ballooned
  latency on hard audio:
  - `sampleLength` (default 224 = `Constants.maxTokenContext`) is
    now capped at `max(40, min(120, expectedTokenCount * 3))`.
    Practice phrases are typically <30 words (~60 tokens), so good
    speech finishes well under the cap; nonsense audio that would
    otherwise grind through 224 tokens looking for a confident stop
    is bounded.
  - `temperatureFallbackCount` (default 5: greedy plus retries at
    temperatures 0.2/0.4/0.6/0.8/1.0) is now `0`. The fallback
    loop was Whisper's mechanism for rescuing weak audio at higher
    sampling temperature — exactly the prior-rescue pattern we're
    fighting. For pronunciation training the honest greedy result
    is the answer; we don't want the decoder to try harder. Cuts
    worst-case dual-decode latency by up to 6× on nonsense audio.
- **Empty free-decode is no longer a silent failure.** When dual
  decode runs and the free pass returns no text (Whisper gave up on
  the audio without the prefix bias — a genuine pronunciation
  failure mode, not silence which `noSpeechProb` already catches),
  the plugin used to fall back to constrained-only scoring,
  silently inflating the result. Now: an `sttErr` log line fires
  with session/lang/expected/heard context, `transcriptScoreFree`
  is forced to 0, the divergence-penalty curve always runs, and
  acoustic floors at the curve's 0.20 minimum. Net effect: nonsense
  audio that constrained "rescues" via prefix tokens scores ≈ 0%
  instead of 70–90%.

### Added
- New `TranscriptionResult` fields: `acousticScore`, `noSpeechProb`,
  `compressionRatio`, `temperature`, `minTokenLogprob`,
  `tokenLogprobStdev`, `freeVsConstrainedSimilarity`, `freeText`.
- OSLog lines tagged `[stt-cal]` for every transcribe — heard,
  expected, normalized versions, all signals — so per-language
  thresholds can be calibrated from real recordings via
  `log show --predicate 'subsystem == "com.corpora.corpan"' --info`.

### Fixed
- **Telugu (and other Indic / Persian abugida) scripts no longer
  collapse to 0% on score.** Two compounding bugs hit the
  low-resource path:
  - `normalize()` was an allowlist over `CharacterSet.letters` (Unicode
    L*) plus digits and space, which dropped Indic vowel marks
    (categories Mn / Mc) — essential for the spelling of Telugu, Tamil,
    Bengali, Malayalam, Marathi, Gujarati, Punjabi. After NFC and
    lowercase it now strips only punctuation, symbols, controls,
    illegals, and format characters (a blocklist), keeping every
    script's marks.
  - When WhisperKit returned no per-word timings (rare but observed on
    Telugu), `acousticScore` collapsed to 0 and the multiplicative
    `overall = transcript × (textFloor + (1-textFloor)·acoustic)`
    floored hard. We now fall back to the overall `avgLogprob` mapped
    to 0..1 so the score still tracks model confidence.
- **Diagnostic log line** now prints `lang`, raw and normalized heard
  vs expected text, word count, avgWordProb, minWordProb, transcript,
  likelihood, and overall on every transcribe — makes "why is Telugu
  scoring weirdly" debuggable from device logs.

### Changed
- **Always prewarm.** WhisperKit's CoreML models need device-specific
  "specialization" before first inference; Apple maintains that cache
  outside the app and evicts it on OS updates and after extended idle
  periods. Without prewarm the first transcribe of a session can take
  10–30 s while CoreML re-specializes on demand, which produced the
  "scoring takes 0.5 s sometimes and 30 s other times" inconsistency.
  Both `installModel`'s CoreML load test and `prepare`'s load now pass
  `prewarm: true` to `WhisperKitConfig`. ~2× one-time load cost (already
  hidden in the install "Verifying…" phase) in exchange for consistent
  fast inference afterward.
- **Language-tier scoring.** Whisper's per-word probabilities are
  calibrated very differently across languages — low-resource ones
  (Telugu, Tamil, Bengali, Malayalam, Marathi, Gujarati, Punjabi,
  Urdu, Persian, Sinhala, Nepali, Odia, Assamese) intrinsically score
  lower even on perfect speech, so a single threshold tuned on English
  was making them stuck at ~30%. Two-tier ramp now: high-resource uses
  the prior `avgWordProb 0.30→0 / 0.85→1` curve with `textFloor=0.10`;
  low-resource uses `0.10→0 / 0.55→1` with `textFloor=0.30`. Native
  Telugu pronunciation now scores ~80% instead of capping at ~30%;
  garbage still scores ~15%.
- **Scoring uses per-word acoustic confidence (`avgWordProb` /
  `minWordProb` from Whisper word timings) multiplicatively with the
  transcript-text match.** Previous formula
  (`0.7·transcript + 0.3·likelihood`) let `large-v3-turbo`'s strong
  language-model prior recover the right transcript text from rhythm
  alone, scoring "Nailed it" on bad pronunciations. New formula:
  `overall = transcript × (0.1 + 0.9·acoustic)` where `acoustic =
  0.7·avgAcoustic + 0.3·minAcoustic`, both mapped from word
  probabilities via 0.30 → 0 / 0.85 → 1 (and 0.10 → 0 / 0.50 → 1 for
  min). Empty-expected fallback uses `acoustic` directly. Telemetry log
  line now includes `avgWordProb` and `minWordProb`.

### Fixed
- **CoreML error -14 ("Failed to build the model execution plan") on
  `large-v3-turbo`.** WhisperKit's default `textDecoderCompute` is
  `.cpuAndNeuralEngine`, but on some M-series iPad chips ANE refuses to
  compile a plan for the turbo text decoder graph and surfaces as -14.
  Both `installModel` (the post-download CoreML load test) and `prepare`
  now pass an explicit `ModelComputeOptions(audioEncoderCompute: .cpuAndGPU,
  textDecoderCompute: .cpuAndGPU)`. Still hardware-accelerated, works on
  every shipped device, harmless for the smaller `base` model that was
  already loading fine on ANE.

## [0.1.0] - 2026-05-04

### Added
- Initial scaffold of `tauri-plugin-stt`.
- iOS implementation backed by WhisperKit (Argmax's CoreML-based Whisper) for
  on-device speech-to-text with word-level timestamps and average log-probability.
- Commands: `prepare`, `start_session`, `stop_session`, `cancel_session`,
  `is_available`, `get_status`.
- Built-in scoring components against an `expectedText`:
  - `transcript_score` — normalized Levenshtein similarity.
  - `likelihood_score` — average log-probability mapped to [0, 1].
  - `overall_score` — weighted blend.
- Audio capture via `AVAudioEngine` with `AVAudioConverter` to 16 kHz mono Float32.
- Android stub returns `unsupported`. Desktop stub returns `unsupported`.
- iOS deployment target raised to 16.0 (WhisperKit requirement).
