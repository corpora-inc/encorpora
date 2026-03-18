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
  showInterstitial?: () => Promise<{ shown: boolean; error?: string }>
  showRewarded?: () => Promise<{ shown: boolean; rewarded: boolean; error?: string }>
  showBanner?: (opts: { position?: "top" | "bottom"; size?: string }) => Promise<{ shown: boolean; error?: string }>
  hideBanner?: () => Promise<{ shown: boolean; error?: string }>
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
