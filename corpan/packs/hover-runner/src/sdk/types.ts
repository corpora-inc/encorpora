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
}

export type HostApi = {
  speak: (lang: string, text: string) => void
  stopSpeech?: () => void
  getStackConfig: () => StackConfig
  onStackConfigChange?: (listener: (next: StackConfig) => void) => () => void
  getRandomEntry?: () => Promise<EntryOut>
  getRandomEntries?: (count: number) => Promise<EntryOut[]>
  getEntryById?: (entryId: number) => Promise<EntryOut>
  /** This pack's visit streak (consecutive local days opened) — recorded by the
   *  host at the pack-enter boundary; read-only retention signal. */
  getStreak?: () => { current: number; longest: number; lastDay: string }
  isMock?: boolean
}

export type GameModule = {
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: { stackConfig?: StackConfig }
  ) => { unmount?: () => void } | void
}
