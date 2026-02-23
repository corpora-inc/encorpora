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
  isMock?: boolean
}

/**
 * initialState contract for Stargate Reader:
 *
 * Production (Tauri host provides preloaded data):
 *   segmentsData:        SegmentsData       — preloaded segments JSON
 *   audioManifest:       AudioManifest       — preloaded audio manifest
 *   resolveAssetUrl:     (path) => string    — resolves relative paths to asset URLs
 *   bookCatalog?:        BookCatalogEntry[]  — available books (optional)
 *   availableLanguages?: string[]            — available audio languages (optional)
 *
 * Dev fallback:
 *   dataUrl?:            string              — base URL for HTTP fetching
 */
export type GameModule = {
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: { stackConfig?: StackConfig }
  ) => { unmount?: () => void } | void
}
