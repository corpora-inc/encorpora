export type StackConfig = {
  activeStackId?: string
  languages: string[]
  domains: string[]
  levels: string[]
  rate: number
  textSize: string
  showRomanization: boolean
}

export type TranslationOut = {
  language_code: string
  text: string
  romanization?: string
}

export type EntryOut = {
  entry_id: number
  level: string
  domains: string[]
  translations: TranslationOut[]
  /** "base" or a phrase-pack id; lets us tag history entries by source. */
  source?: string
}

export type GetRandomEntriesOptions = {
  count: number
  domains?: string[]
  levels?: string[]
  languageCodes?: string[]
}

/** Haptic feedback types mapped to native generators (iOS/Android). */
export type HapticType =
  | "selection"
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error"

export type HostApi = {
  speak: (lang: string, text: string) => void
  /** Speak concurrently (allows overlapping audio). Returns utterance ID. */
  speakConcurrent?: (lang: string, text: string) => Promise<string>
  stopSpeech?: () => void
  getStackConfig: () => StackConfig
  onStackConfigChange?: (listener: (next: StackConfig) => void) => () => void
  getRandomEntry?: () => Promise<EntryOut>
  getRandomEntries?: (q: number | GetRandomEntriesOptions) => Promise<EntryOut[]>
  getEntryById?: (entryId: number, source?: string) => Promise<EntryOut>
  /**
   * Optional native haptics. Absent on older hosts and on desktop/mock —
   * always call as `hostApi.haptic?.({ type })` so the pack degrades silently.
   */
  haptic?: (opts: { type: HapticType }) => void
}

export type GameModule = {
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: { stackConfig?: StackConfig }
  ) => { unmount?: () => void } | void
}
