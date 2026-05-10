export type StackConfig = {
  activeStackId: string
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
  romanization: string
}

export type EntryOut = {
  entry_id: number
  level: string
  domains: string[]
  translations: TranslationOut[]
}

export type PackDbQuery = {
  sql: string
  params?: unknown[]
  dbName?: string
  packId?: string
  maxRows?: number
}

export type PackDbQueryResult = {
  columns: string[]
  rows: Record<string, unknown>[]
}

export type SttErrorCode =
  | "MODEL_NOT_INSTALLED"
  | "MODEL_NOT_LOADED"
  | "NETWORK"
  | "LOAD_FAILED"
  | "IO_FAILED"
  | "BUSY"
  | "CANCELLED"
  | "MIC_PERMISSION_DENIED"
  | "NO_ACTIVE_SESSION"
  | "AUDIO_FAILED"
  | "UNKNOWN"

export type SttPrepareResult = {
  ready: boolean
  model: string
  message?: string
  /** Structured error code when ready === false. Undefined on success. */
  code?: SttErrorCode
}

export type SttInstalledModel = {
  model: string
  valid: boolean
  problems: string[]
  sizeBytes: number
  isLoaded: boolean
}

export type SttListInstalledResult = {
  models: SttInstalledModel[]
}

export type SttStartSessionResult = {
  started: boolean
  sessionId: string
}

export type SttStatus = {
  available: boolean
  prepared: boolean
  model: string | null
  recording: boolean
  message: string | null
  /** Per-app jetsam budget in MB. iOS 13+; null on older. */
  availableMemoryMB?: number | null
  /** Total physical RAM on the device in MB. */
  physicalMemoryMB?: number | null
}

export type SttWordTiming = {
  word: string
  startMs: number
  endMs: number
  probability: number
}

export type SttTranscriptionResult = {
  sessionId: string
  text: string
  expectedText: string
  /** Full code the pack passed in (e.g. "pa-Arab", "zh-Hans"). */
  language: string
  /** Two-letter code actually sent to Whisper (e.g. "pa", "zh"). */
  whisperLanguage: string
  durationMs: number
  overallScore: number
  transcriptScore: number
  likelihoodScore: number
  /** Per-word posterior + per-language ramp + penalty stack. 0..1. */
  acousticScore: number
  avgLogprob: number
  /** Whisper's no-speech posterior (max across segments). > 0.5 → mic was silent. */
  noSpeechProb: number
  /** Repetition / gibberish detector (max). > 2.4 → caps overall ≤ 0.4. */
  compressionRatio: number
  /** Sampling temperature (max). > 0 → decoder fell back. */
  temperature: number
  /** Min chosen-token logprob (worst single decoded token). */
  minTokenLogprob: number
  /** Stdev of chosen-token logprobs (high = patchy confidence). */
  tokenLogprobStdev: number
  /** Levenshtein(free-decode, expected). 1.0 if dual-decode disabled. */
  freeVsConstrainedSimilarity: number
  /** Free-decode transcript (no prompt/prefix bias). Empty if disabled. */
  freeText: string
  words: SttWordTiming[]
}

export type SttApi = {
  isAvailable: () => Promise<boolean>
  getStatus: () => Promise<SttStatus>
  prepare: (opts?: { model?: string }) => Promise<SttPrepareResult>
  startSession: (opts: {
    sessionId: string
    language: string
    expectedText: string
  }) => Promise<SttStartSessionResult>
  stopSession: (opts: { sessionId: string }) => Promise<SttTranscriptionResult>
  cancelSession: (opts: { sessionId: string }) => Promise<void>
  /**
   * Wipes the on-disk model dir + download cache for the given model name
   * (or default if omitted). Used as an explicit reset.
   */
  wipeModel?: (opts?: { model?: string }) => Promise<{
    wiped: boolean
    message?: string
  }>
  /**
   * Inspects on-disk model files. Returns `valid: true` when every
   * required `.mlmodelc/weights/weight.bin` is present and ≥ 1 KB.
   */
  validateModel?: (opts?: { model?: string }) => Promise<{
    model: string
    valid: boolean
    problems: string[]
  }>
  /**
   * Downloads a model from Hugging Face into the app's data dir, then
   * verifies file integrity. Calls `onProgress` with `phase` ∈
   * `downloading | verifying | verified | failed`. Throws on failure.
   */
  installModel?: (
    opts: { model: string },
    onProgress?: (event: SttInstallProgress) => void,
  ) => Promise<{ installed: boolean; model: string; alreadyInstalled: boolean }>
  /**
   * Reports the disk-truth install state for every requested variant in a
   * single round-trip. Use this on boot and when opening the setup overlay
   * — the pack should not cache install booleans in localStorage.
   */
  listInstalled?: (opts: {
    models: string[]
  }) => Promise<SttListInstalledResult>
  /**
   * Drops the in-memory WhisperKit instance without touching disk. Safe
   * to call on memory warnings or when the pack closes; the next
   * `prepare()` is a load, not a download.
   */
  unload?: () => Promise<{ unloaded: boolean }>
}

export type SttInstallProgress = {
  model: string
  phase: "downloading" | "verifying" | "verified" | "failed"
  fraction?: number
  completed?: number
  total?: number
  error?: string
  /** Structured error code on `phase === "failed"`. Undefined otherwise. */
  code?: SttErrorCode
}

export type HostApi = {
  speak: (uiCode: string, text: string) => Promise<void>
  /** Speak concurrently (allows overlapping audio). Returns utterance ID. */
  speakConcurrent?: (uiCode: string, text: string) => Promise<string>
  stopSpeech?: () => Promise<void>
  dispose?: () => void
  getStackConfig: () => StackConfig
  onStackConfigChange: (listener: (config: StackConfig) => void) => () => void
  getRandomEntry: () => Promise<EntryOut>
  getRandomEntries?: (count: number) => Promise<EntryOut[]>
  getEntryById: (entryId: number) => Promise<EntryOut>
  searchEntriesByText?: (options: {
    text: string
    languageCodes?: string[]
    limit?: number
    offset?: number
  }) => Promise<EntryOut[]>
  searchEntriesByTextCount?: (options: {
    text: string
    languageCodes?: string[]
  }) => Promise<number>
  queryPackDb?: (query: PackDbQuery) => Promise<PackDbQueryResult>
  stt?: SttApi
  isMock?: boolean
}

export type ContentPackManifest = {
  id: string
  name: string
  version: string
  entry: string
  styles?: string[]
  baseUrl?: string
  entryType?: "script" | "module"
  sdkVersion?: string
  permissions?: string[]
  databases?: Record<string, string>
  devRevision?: string
}

export type ContentPackModule = {
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: Record<string, unknown>
  ) => { unmount?: () => void } | void
}
