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

export type HostApi = {
  speak: (uiCode: string, text: string) => Promise<void>
  speakConcurrent?: (uiCode: string, text: string) => Promise<void>
  stopSpeech?: () => void
  getStackConfig: () => StackConfig
  onStackConfigChange: (listener: (config: StackConfig) => void) => () => void
  getRandomEntry: () => Promise<EntryOut>
  getRandomEntries?: (count: number) => Promise<EntryOut[]>
  getEntryById: (entryId: number) => Promise<EntryOut>
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
