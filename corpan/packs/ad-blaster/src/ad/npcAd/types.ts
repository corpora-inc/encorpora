export type AdSizeCategory = "banner" | "mrec" | "leaderboard"

export type AdSize = {
  width: number
  height: number
  category: AdSizeCategory
  label: string
}

export const AD_SIZES: Record<AdSizeCategory, AdSize> = {
  banner:      { width: 320, height: 50,  category: "banner",      label: "320x50" },
  mrec:        { width: 300, height: 250, category: "mrec",        label: "300x250" },
  leaderboard: { width: 728, height: 90,  category: "leaderboard", label: "728x90" },
}

export type NpcAdCreative = {
  id: string
  size: AdSize
  imageUrl?: string
  imageData?: ImageBitmap | null
  fallbackText: string
  fallbackColor: string
  provider: string
  language?: string
  impressionUrl?: string
  clickUrl?: string
}

export type NpcAdRequest = {
  size: AdSizeCategory
  count: number
  language?: string
}

export interface NpcAdProvider {
  readonly name: string
  init(): Promise<boolean>
  isAvailable(): boolean
  fetch(request: NpcAdRequest): Promise<NpcAdCreative[]>
  reportImpression(creativeId: string): void
  reportClick(creativeId: string): void
}
