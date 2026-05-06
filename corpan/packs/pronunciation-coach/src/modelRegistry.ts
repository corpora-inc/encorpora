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

export const MODELS: ReadonlyArray<ModelVariant> = [
  {
    id: "standard",
    folder: "openai_whisper-base",
    label: "Standard",
    shortDesc:
      "Fast and light. Good for English and major Latin-script languages.",
    approxSizeMB: 145,
    defaultForFreshInstall: true,
  },
  {
    id: "advanced",
    folder: "openai_whisper-large-v3_turbo",
    label: "Advanced",
    shortDesc:
      "Larger and more accurate. Better on tonal and Indic-script languages.",
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
