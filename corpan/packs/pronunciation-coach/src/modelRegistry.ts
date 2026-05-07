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

// Five tiers spanning ~216 MB → ~1600 MB. Removed `openai_whisper-base`
// (Standard, 145 MB) in 0.3.2 — Small is meaningfully better across
// most languages and only ~70 MB larger, so the floor moves up.
// Existing users who saved `mode: "standard"` in localStorage will fall
// through `modelById("standard") === undefined` and boot at the new
// fresh-install default (Small). Their on-disk `openai_whisper-base/`
// files become orphans (the setup overlay no longer shows a card to
// remove them); cleaning those up is left to a future cleanup sweep.
//
// The 547 / 626 / 632 MB variants are from Argmax's `v20240930`
// generation, specifically tuned to preserve multilingual quality
// despite quantization. Argmax's own README recommends
// `large-v3-v20240930_626MB` for "maximum multilingual accuracy",
// so we're not gambling on quality across 50+ languages — we're
// using the variant they officially endorse.
//
// Folder-name conventions (from WhisperKit upstream):
//   _turbo            optimized smaller text decoder, ~similar accuracy
//   _v20240930        release date with improved multilingual quant
//   _NNNMB            palettized variant, N ≈ disk MB (lower = more aggressive)
export const MODELS: ReadonlyArray<ModelVariant> = [
  {
    id: "small",
    folder: "openai_whisper-small_216MB",
    label: "Small",
    shortDesc:
      "Tiny and quick. Often wrong. May barely understand the language you actually want. Lower your expectations and have fun.",
    approxSizeMB: 216,
    defaultForFreshInstall: true,
  },
  {
    id: "medium",
    folder: "openai_whisper-large-v3-v20240930_547MB",
    label: "Medium",
    shortDesc:
      "Sometimes shockingly good, sometimes wildly off. Don't take a single bad score personally — the model is just having a moment.",
    approxSizeMB: 547,
    defaultForFreshInstall: false,
  },
  // Internal: this is QLoRA-quantized large-v3 turbo (954 MB).
  // Different older quant scheme than the broken v20240930
  // palettized variants. Same architecture as Advanced. Label
  // shown to users is just "Large" — no jargon.
  {
    id: "large_qlora",
    folder: "openai_whisper-large-v3_turbo_954MB",
    label: "Large",
    shortDesc:
      "Solid across most languages, but every model has That One Phrase it can't hear. Take a deep breath when it happens.",
    approxSizeMB: 954,
    defaultForFreshInstall: false,
  },
  {
    id: "advanced",
    folder: "openai_whisper-large-v3_turbo",
    label: "Advanced",
    shortDesc:
      "Best open-source on-device speech-to-text we've got. Wants a recent iPad, eats a lot of memory, may crash on iPhones. When it works, it's the closest thing to magic without a server.",
    approxSizeMB: 1600,
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
