import type { ActivitySpec, JourneyHostApi } from "./activityContract"

export type StackConfig = {
  activeStackId?: string
  /** [nativeLang, ...targetLangs] on most stacks; a single entry on an
   *  immersion (single-language) stack. Drift reads [0] as native, [1] as
   *  target, and degrades gracefully when only one is present. */
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
  /** Source namespace ("base" | phrase-pack id); optional on older hosts. */
  source?: string
}

export type HostApi = {
  speak: (lang: string, text: string) => void | Promise<void>
  stopSpeech?: () => void
  getStackConfig: () => StackConfig
  onStackConfigChange?: (listener: (next: StackConfig) => void) => () => void
  getRandomEntry?: () => Promise<EntryOut>
  getRandomEntries?: (count: number) => Promise<EntryOut[]>
  /** `source` disambiguates phrase-pack entries — `entry_id` is only unique
   *  per source. Older hosts ignore the extra argument. */
  getEntryById?: (entryId: number, source?: string) => Promise<EntryOut>
  /**
   * Read-only SQL against ANOTHER installed content pack's bundled SQLite DB
   * (host command `content_packs_query_db`). Present on real hosts; absent in
   * the mock and on pre-DB hosts, so Drift capability-detects
   * (`typeof hostApi.queryPackDb === "function"`) and degrades when missing.
   * Drift uses it to read a `wordpan_<native>_en` word-explanation pack (the
   * same table Phrase Flip long-press reads) for word ORIGIN/etymology. A query
   * against an uninstalled pack REJECTS, so every call is wrapped in try/catch.
   */
  queryPackDb?: (query: {
    packId?: string
    dbName?: string
    sql: string
    params?: unknown[]
    maxRows?: number
  }) => Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }>
  /**
   * Journey activity seam (typed rail, activity-contract §3). Present when
   * `__CORPAN_HOST_CAPS.journey >= 1`; feature-detect
   * (`hostApi.journey?.isActive()`). The `corpan:activity-result` window
   * event is the fallback rail where this is absent.
   */
  journey?: JourneyHostApi
  isMock?: boolean
}

export type GameModule = {
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: {
      stackConfig?: StackConfig
      /** Journey activity launch (D2) — run as an activity provider. */
      activity?: ActivitySpec
    } & Record<string, unknown>
  ) => { unmount?: () => void } | void
}
