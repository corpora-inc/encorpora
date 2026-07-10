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
