export type StackConfig = {
  activeStackId: string
  languages: string[]
  domains: string[]
  levels: string[]
  rate: number
  textSize: string
  showRomanization: boolean
  phrasePackIds: string[]
  baseCorpusEnabled: boolean
  scrollNavigationEnabled: boolean
}

export type StackConfigPatch = Partial<{
  levels: string[]
  rate: number
  domains: string[]
  languages: string[]
  textSize: string
  showRomanization: boolean
  scrollNavigationEnabled: boolean
  phrasePackIds: string[]
  baseCorpusEnabled: boolean
}>

export type HostHistoryRef = { entryId: number; source: string }

export type HostHistoryApi = {
  getState: () => { ids: number[]; sources: string[]; index: number }
  push: (entryId: number, source?: string) => void
  setIndex: (index: number) => void
  replaceCurrent: (entryId: number, source?: string) => void
  getRecentTuples: (n: number) => HostHistoryRef[]
  subscribe: (listener: () => void) => () => void
}

export type HostInstalledPhrasePack = {
  id: string
  name: string
  nameLocalized?: Record<string, string>
  topic?: string
  topicLocalized?: Record<string, string>
  accentColor?: string
}

export type HostPhrasePacksApi = {
  getInstalled: () => Record<string, HostInstalledPhrasePack>
  setEnabled: (id: string, on: boolean) => void
  subscribe: (listener: () => void) => () => void
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
  /**
   * Source identifier: `"base"` for the bundled corpus, or a phrase-pack
   * id (e.g. `"phrase-botany-basics"`). `entry_id` is only unique within
   * a source — game packs that resume from history need to remember the
   * `(source, entry_id)` pair and pass `source` to `getEntryById`.
   */
  source: string
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
  language: string
  whisperLanguage: string
  durationMs: number
  overallScore: number
  transcriptScore: number
  likelihoodScore: number
  acousticScore: number
  avgLogprob: number
  noSpeechProb: number
  compressionRatio: number
  temperature: number
  minTokenLogprob: number
  tokenLogprobStdev: number
  freeVsConstrainedSimilarity: number
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
  wipeModel?: (opts?: { model?: string }) => Promise<{
    wiped: boolean
    message?: string
  }>
  validateModel?: (opts?: { model?: string }) => Promise<{
    model: string
    valid: boolean
    problems: string[]
  }>
  installModel?: (
    opts: { model: string },
    onProgress?: (event: SttInstallProgress) => void,
  ) => Promise<{ installed: boolean; model: string; alreadyInstalled: boolean }>
  listInstalled?: (opts: {
    models: string[]
  }) => Promise<SttListInstalledResult>
  unload?: () => Promise<{ unloaded: boolean }>
}

export type SttInstallProgress = {
  model: string
  phase: "downloading" | "verifying" | "verified" | "failed"
  fraction?: number
  completed?: number
  total?: number
  error?: string
  code?: SttErrorCode
}

export type HostApi = {
  speak: (uiCode: string, text: string) => Promise<void>
  getStackConfig: () => StackConfig
  onStackConfigChange: (listener: (config: StackConfig) => void) => () => void
  setStackConfig?: (patch: StackConfigPatch) => void
  history?: HostHistoryApi
  notifyUtterance?: () => void
  phrasePacks?: HostPhrasePacksApi
  getRandomEntry: () => Promise<EntryOut>
  getRandomEntries?: (count: number) => Promise<EntryOut[]>
  /**
   * Resolve an entry by id. `source` defaults to `"base"` (bundled corpus).
   * For phrase-pack entries, pass the pack id you stored alongside the
   * `entry_id` (read from `EntryOut.source` on the original sample).
   */
  getEntryById: (entryId: number, source?: string) => Promise<EntryOut>
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

export type GameModule = {
  id: string
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: Record<string, unknown>
  ) => { unmount?: () => void } | void
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
}

export function registerGame(game: GameModule): GameModule

export function createMockHostApi(options?:
  Partial<HostApi> & {
    stackConfig?: Partial<StackConfig>
  }
): HostApi

export function mountStandalone(
  game: GameModule,
  options?: {
    container?: HTMLElement
    hostApi?: HostApi
    initialState?: Record<string, unknown>
  }
): { unmount?: () => void }
