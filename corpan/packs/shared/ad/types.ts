export type AdFormat = "interstitial" | "rewarded" | "banner"

export type LoadedAd = {
  format: AdFormat
  show: () => Promise<AdResult>
}

export type AdResult = {
  shown: boolean
  rewarded: boolean
  error?: string
}

export type ConsentState = "unknown" | "granted" | "denied"

export interface AdProvider {
  readonly name: string
  init(): Promise<boolean>
  isReady(format: AdFormat): boolean
  load(format: AdFormat): Promise<LoadedAd | null>
}

export interface AdManagerApi {
  init(): Promise<void>
  showInterstitial(): Promise<AdResult>
  showRewarded(): Promise<AdResult>
  isReady(format: AdFormat): boolean
}
