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

export type LocalLlmMessage = {
  role: string
  content: string
}

export type LocalLlmDefaults = {
  temperature?: number
  topP?: number
  repeatPenalty?: number
  maxTokens?: number
  contextLength?: number
}

export type PackLlmModel = {
  id: string
  name: string
  relativePath: string
  absolutePath?: string
  exists: boolean
  sizeBytes?: number
  recommended: boolean
  quantType?: string
}

export type PackLlmConfig = {
  runtime?: string
  defaultModel?: string
  models: PackLlmModel[]
  defaults?: LocalLlmDefaults
  chatTemplatePath?: string
}

export type LocalLlmRuntimeStatus = {
  backend: string
  commandPath: string
  available: boolean
  detail?: string
}

export type LocalLlmGenerateRequest = {
  modelPath: string
  messages: LocalLlmMessage[]
  maxTokens?: number
  temperature?: number
  topP?: number
  repeatPenalty?: number
  contextLength?: number
  packId?: string
}

export type LocalLlmStreamCallbacks = {
  onDelta?: (delta: string, accumulatedText: string) => void
  onDone?: (output: string) => void
  onCancelled?: (output: string) => void
  onError?: (message: string) => void
}

export type LocalLlmStreamHandle = {
  requestId: string
  cancel: () => Promise<boolean>
}

export type TtsVoiceGender = "male" | "female" | "unspecified"

export type TtsVoiceQuality =
  | "default"
  | "enhanced"
  | "very_low"
  | "low"
  | "normal"
  | "high"
  | "very_high"

export type TtsVoice = {
  id: string
  name?: string
  language: string
  gender?: TtsVoiceGender
  quality?: TtsVoiceQuality
  engine?: string
  networkRequired?: boolean
}

export type HostApiTtsVoiceQuery = {
  languagePrefix?: string
  gender?: TtsVoiceGender
  femaleOnly?: boolean
}

export type HostApiSpeakVoiceOptions = {
  voiceId?: string
  rate?: number
}

export type HostApi = {
  speak: (uiCode: string, text: string) => Promise<void>
  speakConcurrent?: (uiCode: string, text: string) => Promise<string>
  speakWithVoice?: (
    uiCode: string,
    text: string,
    options?: HostApiSpeakVoiceOptions
  ) => Promise<void>
  speakConcurrentWithVoice?: (
    uiCode: string,
    text: string,
    options?: HostApiSpeakVoiceOptions
  ) => Promise<string>
  listTtsVoices?: (query?: HostApiTtsVoiceQuery) => Promise<TtsVoice[]>
  stopSpeech?: () => Promise<void>
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
  resolvePackAssetPath?: (relativePath: string) => Promise<string>
  getPackLlmConfig?: () => Promise<PackLlmConfig>
  getLocalLlmRuntimeStatus?: () => Promise<LocalLlmRuntimeStatus>
  startLocalLlmStream?: (
    request: LocalLlmGenerateRequest,
    callbacks?: LocalLlmStreamCallbacks
  ) => Promise<LocalLlmStreamHandle>
  cancelLocalLlmStream?: (requestId: string) => Promise<boolean>
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
  llm?: {
    runtime?: string
    defaultModel?: string
    models?: Array<{
      id?: string
      name?: string
      path: string
      sizeBytes?: number
      recommended?: boolean
      quantType?: string
    }>
    defaults?: LocalLlmDefaults
    chatTemplatePath?: string
    chatTemplate?: string
  }
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
