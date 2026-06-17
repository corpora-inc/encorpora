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

/**
 * Read-only entitlement snapshot from the host (mirrors the app's
 * `ContentPackEntitlementSnapshot`). Also exposed as the `__CORPAN_ENTITLEMENT`
 * global for back-compat.
 */
export type ContentPackEntitlementSnapshot = {
  plus: boolean
  subjectId: string | null
  entitlementToken: string | null
  subscription: {
    active: boolean
    plan: "monthly" | "annual" | null
    expiresAt: string | null
    autoRenew: boolean
  }
  checkedAt: number | null
}

/** Where a pack is asking for the paywall (free string forwarded to analytics). */
export type ContentPackPaywallContext = {
  surface: string
  packId?: string
  bookTitle?: string
  bookId?: string
  language?: string
  theme?: string
}

/** Typed host monetization seam (all optional / feature-detected). */
export type HostEntitlementApi = {
  isSubscribed: () => boolean
  snapshot: () => ContentPackEntitlementSnapshot
  onChange: (cb: (snapshot: ContentPackEntitlementSnapshot) => void) => () => void
}

export type HostApi = {
  speak: (lang: string, text: string) => void
  stopSpeech?: () => void
  getStackConfig: () => StackConfig
  onStackConfigChange?: (listener: (next: StackConfig) => void) => () => void
  getRandomEntry?: () => Promise<EntryOut>
  getRandomEntries?: (
    q: number | { count: number; domains?: string[]; levels?: string[]; languageCodes?: string[] }
  ) => Promise<EntryOut[]>
  getEntryById?: (entryId: number) => Promise<EntryOut>
  /** Feed the host's rating-prompt counter (host owns the actual prompt). */
  notifyUtterance?: () => void
  /**
   * Typed entitlement seam — documented replacement for reading the
   * `__CORPAN_PLUS` / `__CORPAN_ENTITLEMENT` globals (which still work).
   */
  entitlement?: HostEntitlementApi
  /**
   * Ask the host to surface the paywall at a natural interaction boundary. The
   * host applies its own guards (subscribed / IAP unavailable / frequency-cap)
   * and resolves to whether the paywall ACTUALLY opened. Documented replacement
   * for dispatching `corpan:request-unlock` (which still works).
   */
  requestPaywall?: (context: ContentPackPaywallContext) => Promise<boolean>
  /** Ask the host to consider its rating prompt (host re-gates / OS throttle). */
  showRatingPrompt?: () => void
  isMock?: boolean
}

export type GameModule = {
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: { stackConfig?: StackConfig }
  ) => { unmount?: () => void } | void
}
