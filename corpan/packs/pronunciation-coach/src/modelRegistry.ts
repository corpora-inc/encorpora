// Single source of truth for the Whisper model variants this pack
// supports. Adding a model = one entry here. Both the boot flow and
// the setup overlay iterate this list; nothing else hardcodes
// "standard" / "advanced" / specific WhisperKit folder names.
//
// `id` is the canonical identifier persisted in localStorage (matches
// the legacy `mode` values "standard" / "advanced" so existing users
// migrate seamlessly). `folder` is the WhisperKit / Hugging Face
// repo path component — what the Swift plugin uses to download from
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
}

// Six tiers spanning ~145 MB → ~1600 MB. The four middle entries are
// new in 0.3.0 to give iPhones a real upgrade path without crashing
// (the full-fat 1.6 GB Advanced model peaks well above iOS's per-app
// memory limit on iPhone 14 / 17 Pro Max).
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
    id: "standard",
    folder: "openai_whisper-base",
    label: "Standard",
    shortDesc:
      "Fast and light. Good for English and major Latin-script languages. Runs anywhere.",
    approxSizeMB: 145,
    defaultForFreshInstall: true,
  },
  {
    id: "small",
    folder: "openai_whisper-small_216MB",
    label: "Small",
    shortDesc:
      "Better than Standard across most languages. Quantized small. Runs anywhere.",
    approxSizeMB: 216,
    defaultForFreshInstall: false,
  },
  {
    id: "medium",
    folder: "openai_whisper-large-v3-v20240930_547MB",
    label: "Medium",
    shortDesc:
      "Large-class quality at medium size. Strongly multilingual. Fits iPhone and iPad.",
    approxSizeMB: 547,
    defaultForFreshInstall: false,
  },
  {
    id: "large_mobile",
    folder: "openai_whisper-large-v3-v20240930_626MB",
    label: "Large (Mobile)",
    shortDesc:
      "Argmax's recommended pick for multilingual accuracy. Runs on modern iPhones.",
    approxSizeMB: 626,
    defaultForFreshInstall: false,
  },
  {
    id: "large_turbo_mobile",
    folder: "openai_whisper-large-v3-v20240930_turbo_632MB",
    label: "Large Turbo (Mobile)",
    shortDesc:
      "Same accuracy class as Large (Mobile) with a faster decoder. Runs on modern iPhones.",
    approxSizeMB: 632,
    defaultForFreshInstall: false,
  },
  {
    id: "advanced",
    folder: "openai_whisper-large-v3_turbo",
    label: "Advanced (iPad)",
    shortDesc:
      "Highest quality. Best on iPad Pro / M-series — not recommended on iPhone (may crash).",
    approxSizeMB: 1600,
    defaultForFreshInstall: false,
  },
]

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
