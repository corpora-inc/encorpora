/** Purchase info for a catalog entry */
export type PurchaseInfo = {
  type: "free" | "iap" | "code"
  productId?: string
  priceLabel?: string
  platformPackId?: string
}

/**
 * A downloadable narration artifact (Corpán Plus two-ZIP model).
 *
 * `preview` is public (first `freeSegments` segments). `full` is gated: when
 * `requires` is set, the new runtime must obtain a CloudFront signed URL from
 * the verify Lambda (proving an active Plus subscription) before downloading.
 */
export type NarrationArtifact = {
  url: string
  sha256: string
  sizeMb: number
  /** Entitlement family required to download, e.g. "corpan.plus". Absent = freely downloadable. */
  requires?: string
}

// ── Provider ─────────────────────────────────────────────────────
/** Where a voice is rendered. "platform" = OS-native TTS (last-resort fallback). */
export type VoiceProvider =
  | "chatterbox"
  | "gemini"
  | "vertex-tts"
  | "elevenlabs"
  | "openai"
  | "platform"

// ── Voice clone source ───────────────────────────────────────────
/** Discriminated union: cloned voices have a source wave; native voices do not. */
export type VoiceSource =
  | {
      kind: "cloned"
      sourceWaveUrl: string
      sourceWaveSha256: string
      lengthSeconds: number
      recordedAt?: string
    }
  | { kind: "native" }

// ── VoiceProfile ─────────────────────────────────────────────────
/** A single voice variant. Owned by exactly one Character. The id matches voiceId on narration entries. */
export type VoiceProfile = {
  id: string
  characterId: string
  displayName: string
  provider: VoiceProvider
  providerVoiceId?: string
  source: VoiceSource
  supportedLanguages: string[]
  traits?: string[]
  previewClipUrl?: string
  status: "active" | "experimental" | "deprecated"
  order?: number
}

// ── Character ────────────────────────────────────────────────────
/** A narrator identity. May own one or many VoiceProfiles. */
export type Character = {
  id: string
  displayName: string
  tagline?: string
  bio?: string
  pronouns?: string
  avatarUrl: string
  bannerUrl?: string
  accentColor?: string
  links?: { label: string; url: string }[]
  /** Aggregate language coverage across all of this character's voice profiles. Backend may include for convenience; otherwise derived. */
  supportedLanguages?: string[]
  status: "active" | "deprecated"
  order?: number
}

// ── Book (promoted to first-class) ───────────────────────────────
/** Book-level metadata, promoted out of the narration row to enable cover art and rich detail. */
export type BookEntry = {
  bookId: string
  title: string
  description?: string
  author?: string
  /** 3:4 cover artwork. */
  coverImageUrl: string
  /** Optional landscape hero. */
  bannerUrl?: string
  series?: string
  volume?: number
  /** ISO code of the source manuscript language. */
  primaryLanguage: string
  tags?: string[]
}

/**
 * A narration entry in the CDN catalog.
 *
 * Natural key is (bookId, language, voiceId). voiceId === VoiceProfile.id when
 * voiceProfiles is hydrated. characterId is denormalized for cheap rendering.
 */
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
  /** Minimum Corpan app version required to use this pack */
  minAppVersion?: string

  // ── New (additive, optional) ──
  /** Denormalized FK to Character. Lets a client render a narrator chip without joining tables. */
  characterId?: string
  /** Optional cover URL on the row, for clients that don't load the books table. */
  coverImageUrl?: string

  // ── Corpán Plus two-ZIP model (additive, optional) ──
  // Old runtimes ignore these and use `downloadUrl`. New runtimes read ONLY
  // these: an entry without `preview` + `full` is invisible to the new Library.
  /** Total TTS segments in the full narration. */
  totalSegments?: number
  /** Segments included in the free preview (min(floor(total/3), 100), or per-book override). */
  freeSegments?: number
  /** Public preview artifact — first `freeSegments` segments. Non-subscribers download this. */
  preview?: NarrationArtifact
  /** Plus-gated full artifact — every segment. Subscribers download this via signed URL. */
  full?: NarrationArtifact
}

/** A game pack in the CDN catalog */
export type CatalogGamePack = {
  id: string
  type: "game"
  version: string
  downloadUrl: string
  purchase: PurchaseInfo
}

/** CatalogV2 — the root catalog format served from CDN. version stays 2; new fields are additive. */
export type CatalogV2 = {
  version: 2
  generatedAt: string
  narrations: CatalogNarrationEntry[]
  gamePacks: CatalogGamePack[]

  // ── New (additive, optional) ──
  characters?: Character[]
  voiceProfiles?: VoiceProfile[]
  books?: BookEntry[]
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

// ── NarrationKey (explicit natural-key helper) ───────────────────
/** Make the (bookId, language, voiceId) natural key explicit and computable. */
export type NarrationKey = {
  bookId: string
  language: string
  voiceId: string
}

export function narrationKey(n: CatalogNarrationEntry): NarrationKey {
  return { bookId: n.bookId, language: n.language, voiceId: n.voiceId }
}

export function narrationKeyEquals(a: NarrationKey, b: NarrationKey): boolean {
  return a.bookId === b.bookId && a.language === b.language && a.voiceId === b.voiceId
}

/** A character grouped with their narrations and the books they cover. */
export type CharacterGroup = {
  character: Character
  narrations: CatalogNarrationEntry[]
  bookIds: string[]
  languages: string[]
}
