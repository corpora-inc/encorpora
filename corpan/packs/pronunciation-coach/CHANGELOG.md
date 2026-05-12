# Changelog — Pronunciation Coach pack

On-device pronunciation practice. Reads a target-language phrase aloud
from the host TTS, then scores the user's repetition via the host's
whisper.cpp-backed STT bridge (iOS XCFramework + Android JNI; same
`ggml-*.bin` model files on both platforms, downloaded at runtime from
`https://huggingface.co/ggerganov/whisper.cpp/`).

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

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
