# Changelog — Pronunciation Coach pack

On-device pronunciation practice. Reads a target-language phrase aloud
from the host TTS, then scores the user's repetition via the host's
WhisperKit-backed STT bridge.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

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
