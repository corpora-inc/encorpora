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
  shortDesc: string
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
  // Tiny — the canonical OpenAI Whisper-tiny via whisper.cpp's
  // ggml-tiny.bin. Surprisingly capable on simple Spanish/French/etc.
  // but per-token confidence is intrinsically lower than larger
  // models, so the acoustic ramp is calibrated softer for this tier
  // (see STTPlugin.swift `pickAcousticRamp`).
  {
    id: "tiny_proof",
    folder: "ggml-tiny.bin",
    label: "Tiny",
    shortDesc:
      "Tiny is, honestly, kind of terrible. You say 'good morning' and Tiny writes down 'good warning'. Some languages it technically supports, in the sense that it returns words. Whether those words match the ones you said is between you and Tiny. Free, fast, occasionally hilarious. Maybe start here so you have something to compare the bigger ones to.",
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
      "The first one that mostly works. Sometimes it spectacularly doesn't and we have no idea why — it's a 244M-parameter neural network, you'd have to ask it. The boring, reasonable choice: roughly the smallest thing that holds its own across all 51 languages without sounding drunk.",
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
      "The smallest 'Large' — same Large brain as the bigger ones, weights crushed down to 5 bits to fit in 547 MB. Sometimes the crush works fine; sometimes Whisper invents pronunciations no human has ever produced. Quick on iOS. Surprisingly slow on Android, for unloveable reasons involving CPU instruction sets and 5-bit math. If you're on Android and want a Large, the q8 below is probably the one you want instead.",
    approxSizeMB: 547,
    defaultForFreshInstall: false,
  },
  // Large Turbo q8 — same distillation, lighter quantization.
  // (ggerganov never published a q8 of the full-decoder large-v3,
  // only of the turbo distillation — the header comment explains
  // why we don't ship the full-fp16 .bin.)
  {
    id: "large_q8",
    folder: "ggml-large-v3-turbo-q8_0.bin",
    label: "Large Turbo q8",
    shortDesc:
      "Same Large brain, slightly less aggressive crush — 8 bits instead of 5, which is what your phone's CPU likes. About 290 MB bigger than Turbo q5; on Android, also about 2.5× faster. Currently the sweet-spot Large for Android, and a solid pick on iOS too. The one to grab if you don't want to think about it.",
    approxSizeMB: 834,
    defaultForFreshInstall: false,
  },
  // Large q5 — full-decoder large-v3 with 5-bit quantization. The
  // standard Apple Silicon Large ship. Id stays `large_qlora` for
  // localStorage compat with users from the broken-Large-FP16 era.
  {
    id: "large_qlora",
    folder: "ggml-large-v3-q5_0.bin",
    label: "Large q5",
    shortDesc:
      "The full-decoder Large, weights compressed to 5 bits. The Turbo variants got their decoder trimmed for speed; this one keeps the original. Sometimes catches nuance the Turbo distillation lost — especially on languages Whisper's bigger-is-better training quietly got worse at. Costs you ~1 GB of disk, plus all the Android q5-slowness drama. iOS users, go nuts. Android users: probably skip in favour of Turbo q8 unless you specifically know your language is one that needs the full decoder.",
    approxSizeMB: 1031,
    defaultForFreshInstall: false,
  },
  // Full Weight Medium — canonical OpenAI Whisper-medium, no
  // quantization. Smaller architecture (769M params) than the
  // Large family (1.55B), but unquantized. Kept in the lineup
  // because the Large turbo distillation skewed English-heavy in
  // training; some users' languages may land better here.
  {
    id: "medium",
    folder: "ggml-medium.bin",
    label: "Full Weight Medium",
    shortDesc:
      "An older, smaller Whisper architecture (769M params, vs ~1.55B for Large), but with zero compression — every weight at native 16-bit precision. 1.46 GB download for a model that's not the biggest. The Larges are usually better. BUT: Whisper's later generations were tuned more aggressively on English-heavy data, and if your target language is one Whisper-large quietly got worse at, Medium can pleasantly surprise you. Or not. We're all learning here.",
    approxSizeMB: 1463,
    defaultForFreshInstall: false,
  },
  // Full Weight Large Turbo — distilled large-v3, no quantization.
  // Top of the on-device line. The full-decoder fp16 large-v3
  // (~3 GB) crashes ggml-metal on Apple Silicon — see header.
  {
    id: "large_max",
    folder: "ggml-large-v3-turbo.bin",
    label: "Full Weight Large Turbo",
    shortDesc:
      "The whole brain, uncompressed. Distilled Large with every weight at full 16-bit precision — no quantization, no shortcuts. The transcription quality you actually came for, if your phone has the 1.5 GB of disk and the patience to download it. Hits both CPU and Metal's fp16 fast paths, so it's not even the slow option. This might be the coolest thing your phone runs all year. Or it might transcribe 'goldfish moon' three times in a row and you'll uninstall in disgust. On-device AI in 2026, in one card. 🤷",
    approxSizeMB: 1549,
    defaultForFreshInstall: false,
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
