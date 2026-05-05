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

export type SttPrepareResult = {
  ready: boolean
  model: string
  message?: string
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
}

export type SttInstallProgress = {
  model: string
  phase: "downloading" | "verifying" | "verified" | "failed"
  fraction?: number
  completed?: number
  total?: number
  error?: string
}

export type HostApi = {
  speak: (uiCode: string, text: string) => Promise<void>
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
