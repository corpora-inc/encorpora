// Single source of truth for the Whisper model variants this pack
// supports. Adding a model = one entry here. Both the boot flow and
// the setup overlay iterate this list; nothing else hardcodes a
// specific id or WhisperKit folder name.
//
// `id` is the canonical identifier persisted in localStorage. Ids
// removed from this list (e.g., "standard" before 0.3.2, "advanced"
// from earlier broken installs) become unrecognized — `modelById`
// returns undefined and the boot path falls back to defaultModel().
// `folder` is the WhisperKit / Hugging Face repo path component —
// what the Swift plugin uses to download from
// `argmaxinc/whisperkit-coreml`.

export type ModelVariant = {
  id: string
  folder: string
  label: string
  /**
   * One- or two-sentence voice tagline: punchy, honest, no jargon.
   * The "what is this, in plain English" line that goes above the
   * pros/cons. Keep specific technical detail (quantization names,
   * layer counts) OUT of here — those belong in `pros`/`cons` or
   * the rendered tech-id footer.
   */
  shortDesc: string
  /**
   * At-a-glance positive points. 2–4 short bullets. Plain language
   * a parent picking up the app can parse without context, but
   * still concrete enough that a Whisper expert can confirm.
   */
  pros: string[]
  /**
   * At-a-glance trade-offs. Same shape and length rules as `pros`.
   * Honest. If a model is meaningfully worse for some use case,
   * say so; that's how the user picks the right one.
   */
  cons: string[]
  approxSizeMB: number
  /**
   * If no install exists yet, this entry is suggested as the default
   * pick on the setup overlay. Exactly one variant should set this.
   */
  defaultForFreshInstall: boolean
  /**
   * If true, the variant is hidden from the setup overlay on
   * non-iPad devices. Set this for models that have been observed
   * to OOM-kill the app during transcribe on iPhone-class memory
   * budgets (~5 GB per-app limit even on Pro Max). The user
   * literally cannot pick a card that's been gated out, so they
   * can't install something that will crash their device.
   *
   * Threshold (as of 0.3.x testing): models ≥ ~600 MB on disk
   * exceed iPhone budget during the constrained-pass decode burst.
   * Medium (547 MB) fits; Large variants (626/632/1600 MB) do not.
   */
  requiresIpad?: boolean
  /**
   * Optional explicit download URL. When set, overrides the default
   * `https://huggingface.co/ggerganov/whisper.cpp/...` derivation.
   * Used for community / self-quantized models hosted in our own
   * S3 — e.g. the Large v3 q8 we quantize from fp16 ourselves
   * because ggerganov never published one.
   */
  downloadUrl?: string
}

/// Cached per-app jetsam budget in MB, populated once at boot via
/// `setDeviceMemoryBudget()`. Source of truth: the iOS plugin's
/// `getStatus()` returns `os_proc_available_memory()`. Kept as a
/// module-level cache so the synchronous `visibleModels()` /
/// `hasLargeMemoryBudget()` calls don't need to await.
let cachedAvailableMemoryMB: number | null = null

/// Threshold (MB) for offering Large variants. Empirically derived
/// from live trace runs:
///   • Medium (547 MB) transcribed cleanly with ~3.3 GB available
///     at entry — 685 MB activation overhead.
///   • Large Turbo (632 MB) reproducibly crashed even with 4.4 GB
///     available at entry — first-transcribe spike on big Whisper
///     models can hit 3–4 GB regardless of model resident size.
/// 6500 MB picks a number where iPad Pro M-series (typically
/// 7–10 GB budget) easily passes and sub-iPad-Pro devices (iPhone
/// Pro Max ~5 GB, smaller iPads in Stage Manager) fail.
const LARGE_MODEL_MEMORY_THRESHOLD_MB = 6500

/// Call once at app boot with the device's per-app jetsam budget in
/// MB (from `stt.getStatus().availableMemoryMB`). Powers the
/// memory-aware gating in `visibleModels()`. Calling without a value
/// (null/undefined) leaves the cache untouched, so subsequent
/// `visibleModels()` calls fall back to the conservative default
/// (assume small device → hide Large variants).
export const setDeviceMemoryBudget = (mb: number | null | undefined) => {
  if (typeof mb === "number" && Number.isFinite(mb) && mb > 0) {
    cachedAvailableMemoryMB = mb
  }
}

/// Best-effort UA-based fallback when the real memory budget hasn't
/// been read yet (e.g., the host plugin hasn't been rebuilt to
/// expose `availableMemoryMB`, or `getStatus()` failed). Returns
/// true on devices that look iPad-class. Imperfect — older iPads
/// and Stage Manager iPads report "iPad" while having iPhone-class
/// budgets — but better than the alternative of showing nothing on
/// iPad until the Swift side ships.
const looksIpadByUA = (): boolean => {
  if (typeof navigator === "undefined") return true
  const ua = navigator.userAgent || ""
  if (/iPad/.test(ua)) return true
  if (/iPhone|iPod/.test(ua)) return false
  if (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) {
    return true
  }
  return true
}

/// True when this device's per-app memory budget can comfortably fit
/// the Large variants' first-transcribe spike.
///
/// Preference order:
///   1. Real budget from `os_proc_available_memory()` (set via
///      `setDeviceMemoryBudget()` from `stt.getStatus()`). Threshold
///      = `LARGE_MODEL_MEMORY_THRESHOLD_MB`.
///   2. UA-based fallback (`looksIpadByUA`) when budget is unknown.
///      Imperfect — older iPads / Stage Manager iPads pass UA but
///      can't actually fit — but doesn't blank out the lineup
///      entirely on iPad while we wait for the budget signal.
///
/// Once the host plugin rebuilds with the new `getStatus()` fields,
/// the real budget takes over and the UA fallback never matters.
export const hasLargeMemoryBudget = (): boolean => {
  if (cachedAvailableMemoryMB != null) {
    return cachedAvailableMemoryMB >= LARGE_MODEL_MEMORY_THRESHOLD_MB
  }
  return looksIpadByUA()
}

// Seven tiers: Tiny → Small → Medium → (Large family).
// Large family in ascending size:
//   Large Turbo (547 MB, turbo-q5_0)
//   Large HQ    (834 MB, turbo-q8_0)
//   Large       (1031 MB, q5_0)
//   Large Max   (1549 MB, turbo, no quant)
//
// Why no full-FP16 ggml-large-v3.bin (3.0 GB)?
// Verified live 2026-05-10 on iPad Pro / iPadOS 26.4.2: the full-
// precision file SIGSEGVs inside ggml-metal during model load, in
// `ggml_metal_buffer_is_shared` — `MTLDevice newBufferWithLength:`
// returned nil because a single tensor allocation exceeds Metal's
// `maxBufferLength` cap (~3.5 GB even on 16 GB iPads). This is a
// Metal architecture limit, not a per-app memory budget. Crash
// stack and full analysis: see CHANGELOG 0.3.7.
//
// The standard whisper.cpp distribution of Large for Apple Silicon
// is the quantized variants below (q5_0 / q8_0 / turbo-q5_0). They
// are the upstream ggerganov-maintained quants — *not* WhisperKit
// "qlora" / argmax palettized variants, which were unrelated and
// broken under MPSGraph on iPadOS 26.4.x.
//
// Existing users on saved `mode: "large_qlora"` from the broken
// 0.3.6 entry: same id is repointed at `ggml-large-v3-q5_0.bin`
// (the working "Large"). On next prepare, validateModel sees the
// new file is missing and the install flow runs to download the
// q5_0. Their on-disk 3 GB `ggml-large-v3.bin` becomes orphan;
// cleanup is deferred to a future sweep.
//
// Older orphan folders from the WhisperKit era (`_turbo*`,
// `_v20240930*`, original `large-v3*` mlmodelc bundles) are also
// still on disk for upgraders; same deferred cleanup.
//
// Removed `openai_whisper-base` (Standard, 145 MB) in 0.3.2 — Small
// is meaningfully better across most languages and only ~70 MB
// larger, so the floor moves up. Existing users who saved
// `mode: "standard"` fall through the same way.
//
// Folder-name conventions (whisper.cpp / ggerganov HF repo):
//   no suffix         full unquantized fp16 weights (multi-GB; broken on Metal for large-v3)
//   -q5_0             5-bit quantization (most common Apple Silicon ship)
//   -q8_0             8-bit quantization (closer to fp16 quality, larger)
//   -turbo            distilled large-v3 with smaller decoder (Whisper "turbo")
export const MODELS: ReadonlyArray<ModelVariant> = [
  // Tiny — canonical OpenAI Whisper-tiny via whisper.cpp's
  // ggml-tiny.bin. Per-token confidence is intrinsically lower than
  // the bigger models, so the acoustic ramp is calibrated softer
  // for this tier (see STTPlugin.swift `pickAcousticRamp`).
  {
    id: "tiny_proof",
    folder: "ggml-tiny.bin",
    label: "Tiny",
    shortDesc:
      "Tiny is, honestly, kind of terrible. You say 'good morning,' Tiny writes 'good warning.' Mostly useful as the baseline you compare bigger models against.",
    pros: [
      "Tiniest download",
      "Fast on every device",
      "Works offline like everything here",
    ],
    cons: [
      "Frequently wrong on real sentences",
      "Especially weak on non-Latin scripts",
    ],
    approxSizeMB: 75,
    defaultForFreshInstall: true,
  },
  // Small — canonical OpenAI multilingual Whisper-small via the
  // whisper.cpp ggml conversion. Straight from OpenAI's released
  // weights, no quantization, no decoder shrink.
  {
    id: "small",
    folder: "ggml-small.bin",
    label: "Small",
    shortDesc:
      "First model that genuinely works for everyday Spanish, French, German, and friends. Boring, reasonable choice for Latin-script languages.",
    pros: [
      "Solid for most European languages",
      "Modest size and RAM use",
    ],
    cons: [
      "Less reliable than the Larges",
      "Drifts on harder or longer sentences",
    ],
    approxSizeMB: 465,
    defaultForFreshInstall: false,
  },
  // Large Turbo q5 — distilled large-v3 with smaller decoder,
  // 5-bit quantization. Smallest of the Large family.
  {
    id: "large_turbo",
    folder: "ggml-large-v3-turbo-q5_0.bin",
    label: "Large Turbo q5",
    shortDesc:
      "The smallest 'Large.' Whisper's speedy distilled decoder, weights crushed to 5 bits. Snappy on iPhone.",
    pros: [
      "Smallest of the Large family",
      "Fast on iOS",
    ],
    cons: [
      "Slow on Android",
      "Distilled decoder is weaker on Telugu / Tamil / other non-Latin scripts",
    ],
    approxSizeMB: 547,
    defaultForFreshInstall: false,
  },
  // Large Turbo q8 — same distillation, lighter quantization.
  {
    id: "large_q8",
    folder: "ggml-large-v3-turbo-q8_0.bin",
    label: "Large Turbo q8",
    shortDesc:
      "Same Turbo distillation as q5, but at 8-bit precision — math your phone's CPU prefers. Sweet spot for Android.",
    pros: [
      "~2.5× faster than q5 on Android",
      "Better quality than q5",
      "Solid pick on iOS too",
    ],
    cons: [
      "Bigger download than q5",
      "Same Turbo weakness on non-Latin scripts",
    ],
    approxSizeMB: 834,
    defaultForFreshInstall: false,
  },
  // Large q5 — full-decoder large-v3 with 5-bit quantization. The
  // standard Apple Silicon Large ship. Id stays `large_qlora` for
  // localStorage compat with users from the broken-Large-FP16 era.
  // STAR PICK for Indic / non-Latin-script languages — confirmed
  // live 2026-05-16 on iPad Telugu testing: keeps the script picker
  // honest where Turbo wanders into Bengali / Latin / Amharic.
  {
    id: "large_qlora",
    folder: "ggml-large-v3-q5_0.bin",
    label: "Large q5",
    shortDesc:
      "Full Whisper Large brain — no Turbo distillation — compressed to 5 bits. Best in our testing for Telugu, Tamil, Bengali, and other non-Latin-script languages.",
    pros: [
      "Best for Indic and other non-Latin-script languages",
      "Keeps the full 32-layer text decoder",
      "Honest output in the right script",
    ],
    cons: [
      "~1 GB download",
      "Slower than Turbo on both platforms",
    ],
    approxSizeMB: 1031,
    defaultForFreshInstall: false,
  },
  // Full Weight Medium — canonical OpenAI Whisper-medium, no
  // quantization. Smaller architecture (769M params) than the
  // Large family (1.55B), but unquantized.
  {
    id: "medium",
    folder: "ggml-medium.bin",
    label: "Full Weight Medium",
    shortDesc:
      "Older Whisper architecture at full precision (no compression). Wins occasionally on languages later models quietly got worse at. Usually outdone by Large q5.",
    pros: [
      "Every weight at native fp16 precision",
      "Occasionally surprises on niche languages",
    ],
    cons: [
      "Bigger download than Large q5 for usually less quality",
      "Older architecture",
    ],
    approxSizeMB: 1463,
    defaultForFreshInstall: false,
  },
  // Full Weight Large Turbo — distilled large-v3, no quantization.
  // The full-decoder fp16 large-v3 (~3 GB) crashes ggml-metal on
  // Apple Silicon — see header.
  {
    id: "large_max",
    folder: "ggml-large-v3-turbo.bin",
    label: "Full Weight Large Turbo",
    shortDesc:
      "Whisper's speedy Turbo distillation at full 16-bit precision. Hits Metal's fp16 fast path on iPad, so it's quick despite the size.",
    pros: [
      "Fastest 'Large' on iPad (Metal fp16 fast path)",
      "Top quality for Latin-script languages",
    ],
    cons: [
      "1.5 GB download",
      "Same Turbo weakness on Indic — Large q5 or q8 is better for those",
    ],
    approxSizeMB: 1549,
    defaultForFreshInstall: false,
  },
  // Large q8 (self-quantized) — full-decoder large-v3 at 8-bit
  // precision. ggerganov never published this one, so we generate
  // it ourselves from the fp16 source via whisper.cpp's `quantize`
  // tool and host it on our own CDN. Runbook:
  // `corpan/RUNBOOK_QUANTIZE_LARGE_Q8.md`.
  //
  // BIGGEST entry in the list (1580 MB). Kept last so the ordering
  // remains size-ascending. Star-marked because in our testing it's
  // expected to be the new top pick for Indic / non-Latin-script
  // languages where the Turbo variants flounder.
  //
  // SHA256 of the file at the URL below:
  //   24bc434f372355688ab9a623077a63e5361a1c41f4d8d648977e39f9b060f09e
  // Size: 1,656,538,283 bytes.
  {
    id: "large_q8_full",
    folder: "ggml-large-v3-q8_0.bin",
    label: "Large q8 ★",
    shortDesc:
      "The biggest, baddest model that still fits on iPad — full Whisper Large at 8-bit precision (we quantize this one ourselves from the original fp16, since upstream doesn't ship it). Should be the new best for Indic and other non-Latin-script languages.",
    pros: [
      "Higher precision than Large q5, same full 32-layer decoder",
      "Expected best quality for Telugu, Tamil, Bengali, etc.",
    ],
    cons: [
      "~1.6 GB download",
      "Slower than Turbo and a bit slower than Large q5",
      "Needs ~3 GB RAM headroom during first transcribe (iPad-class only)",
    ],
    approxSizeMB: 1580,
    defaultForFreshInstall: false,
    requiresIpad: true,
    downloadUrl:
      "https://d38iwc9748jekz.cloudfront.net/whisper-models/ggml-large-v3-q8_0.bin",
  },
]

/// Models visible to the user on this device. Memory-budget-aware:
/// devices with `availableMemoryMB >= LARGE_MODEL_MEMORY_THRESHOLD_MB`
/// see everything; smaller-budget devices hide variants flagged
/// `requiresIpad: true` so the user literally cannot pick a card
/// that would OOM-kill their device. The canonical `MODELS` list is
/// unchanged — `modelById` still resolves every id including
/// iPad-only ones, so existing localStorage preferences from earlier
/// installs don't get orphaned. Only the SETUP OVERLAY uses this
/// filtered view.
export const visibleModels = (): ReadonlyArray<ModelVariant> => {
  if (hasLargeMemoryBudget()) return MODELS
  return MODELS.filter((m) => !m.requiresIpad)
}

/// Pick the fresh-install default from the variants currently visible
/// on this device. The fresh-install default (Small) is never gated.
export const visibleDefaultModel = (): ModelVariant => {
  const visible = visibleModels()
  return visible.find((m) => m.defaultForFreshInstall) ?? visible[0]
}

/// Convenience for the boot-time demotion check: is the model
/// currently saved in localStorage one that this device's memory
/// budget cannot safely run? True only if the variant is flagged
/// `requiresIpad` AND we don't have the headroom for it.
export const variantExceedsBudget = (m: ModelVariant): boolean => {
  return !!m.requiresIpad && !hasLargeMemoryBudget()
}

export const modelById = (id: string | null | undefined): ModelVariant | undefined => {
  if (!id) return undefined
  return MODELS.find((m) => m.id === id)
}

export const modelByFolder = (folder: string): ModelVariant | undefined => {
  return MODELS.find((m) => m.folder === folder)
}

export const defaultModel = (): ModelVariant => {
  return MODELS.find((m) => m.defaultForFreshInstall) ?? MODELS[0]
}

export const allFolders = (): string[] => MODELS.map((m) => m.folder)
