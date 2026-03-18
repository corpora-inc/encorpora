/** Purchase info for a catalog entry */
export type PurchaseInfo = {
  type: "free" | "iap" | "code"
  productId?: string
  priceLabel?: string
  platformPackId?: string
}

/** A narration entry in the CDN catalog */
export type CatalogNarrationEntry = {
  id: string
  bookId: string
  bookTitle: string
  language: string
  languageName?: string
  voiceId: string
  voiceName: string
  version: string
  downloadUrl: string
  sha256: string
  sizeMb: number
  series?: string
  volume?: number
  tier: "public" | "premium"
  purchase: PurchaseInfo
}

/** A game pack in the CDN catalog */
export type CatalogGamePack = {
  id: string
  type: "game"
  version: string
  downloadUrl: string
  purchase: PurchaseInfo
}

/** CatalogV2 — the root catalog format served from CDN */
export type CatalogV2 = {
  version: 2
  generatedAt: string
  narrations: CatalogNarrationEntry[]
  gamePacks: CatalogGamePack[]
}

/** Locally installed narration record */
export type InstalledNarration = {
  narrationId: string
  bookId: string
  bookTitle: string
  language: string
  languageName?: string
  voiceId: string
  voiceName: string
  version: string
  sizeMb: number
  series?: string
  volume?: number
  installedAt: number
}

/** Download progress state for a single narration */
export type DownloadState = {
  stage: "idle" | "downloading" | "verifying" | "extracting" | "complete" | "error"
  progress: number
  total: number
  message: string
  error?: string
}

/** A book grouping — multiple narrations (different languages/voices) for one book */
export type BookGroup = {
  bookId: string
  bookTitle: string
  series?: string
  volume?: number
  narrations: CatalogNarrationEntry[]
  languages: string[]
}

/** Series grouping — books within a series */
export type SeriesGroup = {
  series: string
  books: BookGroup[]
}
