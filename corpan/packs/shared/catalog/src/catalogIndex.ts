/**
 * Hydrated catalog index.
 *
 * Builds in-memory lookup tables from a CatalogV2 so the rest of the UI can
 * assume Character / VoiceProfile / BookEntry rows always exist for every
 * narration — even when the backend hasn't published the new optional fields
 * yet.
 *
 * When the catalog lacks `characters` / `voiceProfiles` / `books`, this module
 * synthesizes minimal placeholders from existing narration rows so consumers
 * never have to branch on "what if the lookup is missing". Orphans (a
 * narration whose voiceId / characterId / bookId doesn't resolve) are logged
 * loudly per the project's noisy-errors policy.
 */

import type {
  CatalogV2,
  CatalogNarrationEntry,
  Character,
  VoiceProfile,
  BookEntry,
  CharacterGroup,
} from "./types"
import { resolveVoiceName } from "../../core/constants"

export type CatalogIndex = {
  catalog: CatalogV2
  /** Always non-empty; synthesized from narrations if absent. */
  characters: Character[]
  voiceProfiles: VoiceProfile[]
  books: BookEntry[]
  /** Whether the input catalog had the corresponding field populated. Useful for telemetry/diagnostics. */
  hadCharacters: boolean
  hadVoiceProfiles: boolean
  hadBooks: boolean

  // ── Lookups ──
  getCharacter(id: string): Character | undefined
  getVoiceProfile(id: string): VoiceProfile | undefined
  getBook(bookId: string): BookEntry | undefined

  // ── Joins ──
  getCharacterForVoice(voiceId: string): Character | undefined
  getCharacterForNarration(n: CatalogNarrationEntry): Character | undefined
  getVoiceProfileForNarration(n: CatalogNarrationEntry): VoiceProfile | undefined
  getNarrationsForCharacter(characterId: string): CatalogNarrationEntry[]
  getNarrationsForBook(bookId: string): CatalogNarrationEntry[]
  getNarrationsForVoiceProfile(voiceProfileId: string): CatalogNarrationEntry[]
  getCharacterBooks(characterId: string): BookEntry[]
  getCharacterLanguages(characterId: string): string[]

  // ── Convenience ──
  /** Display name for a narration's voice, falling back through legacy paths if missing. */
  getVoiceDisplayName(n: CatalogNarrationEntry): string
  /** Cover URL for a book; falls back to narration.coverImageUrl, then empty string. */
  getCoverUrl(bookId: string, fallbackFromNarration?: CatalogNarrationEntry): string
  /** Group narrations by character (only characters that have narrations are returned). */
  groupByCharacter(narrations?: CatalogNarrationEntry[]): CharacterGroup[]
}

/**
 * Build the hydrated catalog index. Pure function; safe to call repeatedly,
 * though callers typically build it once per `fetchCatalog` and pass it down.
 */
export function buildCatalogIndex(catalog: CatalogV2): CatalogIndex {
  const hadCharacters = Array.isArray(catalog.characters) && catalog.characters.length > 0
  const hadVoiceProfiles =
    Array.isArray(catalog.voiceProfiles) && catalog.voiceProfiles.length > 0
  const hadBooks = Array.isArray(catalog.books) && catalog.books.length > 0

  // Build voice profiles — backend-provided rows take precedence; missing
  // voices referenced from narrations get synthesized.
  const voiceById = new Map<string, VoiceProfile>()
  if (hadVoiceProfiles) {
    for (const v of catalog.voiceProfiles!) voiceById.set(v.id, v)
  }
  for (const n of catalog.narrations) {
    if (!voiceById.has(n.voiceId)) {
      voiceById.set(n.voiceId, synthVoiceProfile(n))
    } else {
      // Update supportedLanguages to include this narration's language if missing
      const v = voiceById.get(n.voiceId)!
      if (!v.supportedLanguages.includes(n.language)) {
        v.supportedLanguages = [...v.supportedLanguages, n.language]
      }
    }
  }

  // Build characters — backend-provided rows take precedence; missing
  // characters referenced from voiceProfiles get synthesized.
  const characterById = new Map<string, Character>()
  if (hadCharacters) {
    for (const c of catalog.characters!) characterById.set(c.id, c)
  }
  for (const v of voiceById.values()) {
    if (!characterById.has(v.characterId)) {
      characterById.set(v.characterId, synthCharacter(v))
    }
  }

  // Build books — backend-provided rows take precedence; missing books
  // referenced from narrations get synthesized.
  const bookById = new Map<string, BookEntry>()
  if (hadBooks) {
    for (const b of catalog.books!) bookById.set(b.bookId, b)
  }
  for (const n of catalog.narrations) {
    if (!bookById.has(n.bookId)) {
      bookById.set(n.bookId, synthBookEntry(n))
    }
  }

  // ── Cross-reference validation (visible warnings, no silent failures) ──
  for (const n of catalog.narrations) {
    const v = voiceById.get(n.voiceId)
    if (!v) {
      console.warn(
        `[catalogIndex] Orphan narration: ${n.id} references voiceId "${n.voiceId}" that has no profile`,
      )
      continue
    }
    if (!characterById.has(v.characterId)) {
      console.warn(
        `[catalogIndex] Orphan voiceProfile: ${v.id} references characterId "${v.characterId}" with no character row`,
      )
    }
    if (n.characterId && n.characterId !== v.characterId) {
      console.warn(
        `[catalogIndex] Narration ${n.id} characterId="${n.characterId}" disagrees with voiceProfile.characterId="${v.characterId}"`,
      )
    }
    if (!v.supportedLanguages.includes(n.language)) {
      console.warn(
        `[catalogIndex] Voice ${v.id} narrates "${n.language}" but supportedLanguages does not list it`,
      )
    }
  }

  // ── Joins (precomputed once) ──
  const narrationsByCharacter = new Map<string, CatalogNarrationEntry[]>()
  const narrationsByBook = new Map<string, CatalogNarrationEntry[]>()
  const narrationsByVoiceProfile = new Map<string, CatalogNarrationEntry[]>()
  for (const n of catalog.narrations) {
    const v = voiceById.get(n.voiceId)
    const characterId = v?.characterId ?? n.characterId ?? ""
    push(narrationsByCharacter, characterId, n)
    push(narrationsByBook, n.bookId, n)
    push(narrationsByVoiceProfile, n.voiceId, n)
  }

  // Sorted character list for default rendering — by `order` (asc), then
  // displayName, with deprecated last.
  const characters = [...characterById.values()].sort(compareCharacters)
  const voiceProfiles = [...voiceById.values()].sort(compareVoiceProfiles)
  const books = [...bookById.values()].sort((a, b) => a.title.localeCompare(b.title))

  function getCharacter(id: string): Character | undefined {
    return characterById.get(id)
  }
  function getVoiceProfile(id: string): VoiceProfile | undefined {
    return voiceById.get(id)
  }
  function getBook(bookId: string): BookEntry | undefined {
    return bookById.get(bookId)
  }
  function getCharacterForVoice(voiceId: string): Character | undefined {
    const v = voiceById.get(voiceId)
    return v ? characterById.get(v.characterId) : undefined
  }
  function getCharacterForNarration(n: CatalogNarrationEntry): Character | undefined {
    if (n.characterId && characterById.has(n.characterId)) {
      return characterById.get(n.characterId)
    }
    return getCharacterForVoice(n.voiceId)
  }
  function getVoiceProfileForNarration(n: CatalogNarrationEntry): VoiceProfile | undefined {
    return voiceById.get(n.voiceId)
  }
  function getNarrationsForCharacter(characterId: string): CatalogNarrationEntry[] {
    return narrationsByCharacter.get(characterId) ?? []
  }
  function getNarrationsForBook(bookId: string): CatalogNarrationEntry[] {
    return narrationsByBook.get(bookId) ?? []
  }
  function getNarrationsForVoiceProfile(voiceProfileId: string): CatalogNarrationEntry[] {
    return narrationsByVoiceProfile.get(voiceProfileId) ?? []
  }
  function getCharacterBooks(characterId: string): BookEntry[] {
    const seen = new Set<string>()
    const result: BookEntry[] = []
    for (const n of getNarrationsForCharacter(characterId)) {
      if (seen.has(n.bookId)) continue
      seen.add(n.bookId)
      const b = bookById.get(n.bookId)
      if (b) result.push(b)
    }
    return result
  }
  function getCharacterLanguages(characterId: string): string[] {
    const set = new Set<string>()
    for (const n of getNarrationsForCharacter(characterId)) set.add(n.language)
    return [...set].sort()
  }
  function getVoiceDisplayName(n: CatalogNarrationEntry): string {
    const v = voiceById.get(n.voiceId)
    if (v) return v.displayName
    if (n.voiceName) return n.voiceName
    return resolveVoiceName(n.voiceId)
  }
  function getCoverUrl(
    bookId: string,
    fallbackFromNarration?: CatalogNarrationEntry,
  ): string {
    const b = bookById.get(bookId)
    if (b?.coverImageUrl) return b.coverImageUrl
    if (fallbackFromNarration?.coverImageUrl) return fallbackFromNarration.coverImageUrl
    return ""
  }
  function groupByCharacter(
    narrations: CatalogNarrationEntry[] = catalog.narrations,
  ): CharacterGroup[] {
    const charNarrations = new Map<string, CatalogNarrationEntry[]>()
    for (const n of narrations) {
      const c = getCharacterForNarration(n)
      if (!c) continue
      push(charNarrations, c.id, n)
    }
    const groups: CharacterGroup[] = []
    for (const [characterId, list] of charNarrations) {
      const character = characterById.get(characterId)
      if (!character) continue
      const bookIds = uniqueIn(list, (n) => n.bookId)
      const languages = uniqueIn(list, (n) => n.language).sort()
      groups.push({ character, narrations: list, bookIds, languages })
    }
    groups.sort((a, b) => compareCharacters(a.character, b.character))
    return groups
  }

  return {
    catalog,
    characters,
    voiceProfiles,
    books,
    hadCharacters,
    hadVoiceProfiles,
    hadBooks,
    getCharacter,
    getVoiceProfile,
    getBook,
    getCharacterForVoice,
    getCharacterForNarration,
    getVoiceProfileForNarration,
    getNarrationsForCharacter,
    getNarrationsForBook,
    getNarrationsForVoiceProfile,
    getCharacterBooks,
    getCharacterLanguages,
    getVoiceDisplayName,
    getCoverUrl,
    groupByCharacter,
  }
}

// ── Internal: synthesizers for legacy catalogs ──

function synthVoiceProfile(n: CatalogNarrationEntry): VoiceProfile {
  // Use the explicit characterId if present, else derive from voiceId prefix.
  // Mirrors `resolveVoiceName`'s prefix logic so legacy "ian-*" all collapse to "ian".
  const characterId = n.characterId || voiceIdToCharacterSlug(n.voiceId)
  return {
    id: n.voiceId,
    characterId,
    displayName: n.voiceName || resolveVoiceName(n.voiceId),
    provider: "chatterbox", // current production assumption when synthesizing
    source: { kind: "cloned", sourceWaveUrl: "", sourceWaveSha256: "", lengthSeconds: 0 },
    supportedLanguages: [n.language],
    status: "active",
  }
}

function synthCharacter(v: VoiceProfile): Character {
  // Use the voice's display name with the variant suffix stripped if obvious;
  // otherwise just capitalize the slug.
  const id = v.characterId
  const displayName = id.charAt(0).toUpperCase() + id.slice(1)
  return {
    id,
    displayName,
    avatarUrl: "",
    status: "active",
  }
}

function synthBookEntry(n: CatalogNarrationEntry): BookEntry {
  return {
    bookId: n.bookId,
    title: n.bookTitle || n.bookId,
    coverImageUrl: n.coverImageUrl ?? "",
    series: n.series,
    volume: n.volume,
    primaryLanguage: n.language,
  }
}

/**
 * Derive a character slug from a voiceId. Matches the legacy prefix-logic in
 * `resolveVoiceName`: all "ian-*" voiceIds collapse to character "ian".
 */
function voiceIdToCharacterSlug(voiceId: string): string {
  const first = voiceId.split("-")[0]
  return first || voiceId
}

// ── Internal: helpers ──

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

function uniqueIn<T, K>(list: T[], key: (t: T) => K): K[] {
  const seen = new Set<K>()
  const out: K[] = []
  for (const item of list) {
    const k = key(item)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(k)
  }
  return out
}

function compareCharacters(a: Character, b: Character): number {
  // Deprecated last
  if (a.status !== b.status) {
    if (a.status === "deprecated") return 1
    if (b.status === "deprecated") return -1
  }
  // Then by editorial order if provided
  const ao = a.order ?? Number.POSITIVE_INFINITY
  const bo = b.order ?? Number.POSITIVE_INFINITY
  if (ao !== bo) return ao - bo
  // Then by display name
  return a.displayName.localeCompare(b.displayName)
}

function compareVoiceProfiles(a: VoiceProfile, b: VoiceProfile): number {
  // Deprecated/experimental last
  const rankA = a.status === "deprecated" ? 2 : a.status === "experimental" ? 1 : 0
  const rankB = b.status === "deprecated" ? 2 : b.status === "experimental" ? 1 : 0
  if (rankA !== rankB) return rankA - rankB
  const ao = a.order ?? Number.POSITIVE_INFINITY
  const bo = b.order ?? Number.POSITIVE_INFINITY
  if (ao !== bo) return ao - bo
  return a.displayName.localeCompare(b.displayName)
}
