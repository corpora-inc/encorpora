/**
 * Phrase loader for Juice Squeeze (Fire rebuild).
 *
 * Ported VERBATIM from the shipped pack's data.ts: loadUtterance (20-attempt
 * retry loop), pickByLang, the Utterance type, and the min-words/length gates.
 * Console logging is kept (useful on-device).
 *
 * Difference from shipped: EntryOut now carries an optional `source` field, so
 * we capture it onto the Utterance to let history tag the phrase source.
 */

import type { HostApi, EntryOut } from "../sdk/types"
import { isCJKText, tokenizeText } from "./tokenizer"

export type Utterance = {
  id: string
  level: string // CEFR level (A0, A1, A2, B1, B2, C1)
  text: string
  words: string[]
  targetText?: string // Text in the OTHER language (to display at top)
  source?: string // "base" or a phrase-pack id; lets history tag the source
}

/**
 * Normalize language code (lowercase, trim)
 */
const normalizeLang = (lang: string): string => lang.trim().toLowerCase()

/**
 * Extract text for a specific language from translations
 */
export const pickByLang = (
  translations: { language_code: string; text: string }[],
  lang: string
): string | undefined => {
  const desired = normalizeLang(lang)
  const exact = translations.find((t) => normalizeLang(t.language_code) === desired)
  if (exact) return exact.text

  const base = desired.split("-")[0]
  const baseMatch = translations.find((t) => normalizeLang(t.language_code).split("-")[0] === base)
  if (baseMatch) return baseMatch.text

  // STRICT (Skylar review): NO silent fallback to translations[0]. Falling back
  // to a different language let a requested target/block silently become the same
  // language as the other (e.g. both English) → EN→EN. Missing language ⇒ skip.
  return undefined
}

/**
 * Load ONE complete utterance (phrase) from Corpán's database
 * Loads a single entry, extracts its text, and splits it into words
 * @param hostApi - Host API for accessing database and stack config
 * @param minWords - Minimum number of words required (default: 2)
 * @param blockLang - Language to use for word blocks (default: first language in stack)
 * @param targetLang - Language to show as target phrase at top (default: second language in stack, or first if only one)
 * @returns A single utterance with word array, or null if none found
 */
export const loadUtterance = async (
  hostApi: HostApi,
  minWords: number = 2,
  blockLang?: string,
  targetLang?: string
): Promise<Utterance | null> => {
  const stackConfig = hostApi.getStackConfig()
  // Use provided languages or fallback to stack config
  const blockLanguage = blockLang || stackConfig.languages[0] || "en"
  const targetLanguage =
    targetLang ||
    (stackConfig.languages.length > 1 ? stackConfig.languages[1] : stackConfig.languages[0]) ||
    "en"

  let attempts = 0
  const maxAttempts = 20 // Try more attempts to find a good phrase

  while (attempts < maxAttempts) {
    attempts++

    // Get ONE entry from database
    let entry: EntryOut | null = null
    let entries: EntryOut[] | null = null

    try {
      if (hostApi.getRandomEntries) {
        entries = await hostApi.getRandomEntries(1)
        if (entries && entries.length > 0) {
          entry = entries[0]
        } else {
          console.warn("[juice-squeeze:data] ⚠️  getRandomEntries returned empty array")
        }
      } else if (hostApi.getRandomEntry) {
        entry = await hostApi.getRandomEntry()
      } else {
        console.error("[juice-squeeze:data] ❌ No API methods available!")
        return null
      }
    } catch (error) {
      console.error("[juice-squeeze:data] ❌ Error calling hostApi:", error)
      continue
    }

    if (!entry) {
      continue
    }

    // Filter by level if specified (though backend should already filter)
    if (stackConfig.levels.length && !stackConfig.levels.includes(entry.level)) {
      continue
    }

    // Extract text for BLOCK language (the language for word blocks)
    const blockText = pickByLang(entry.translations, blockLanguage)
    if (!blockText) {
      continue
    }

    // Extract text for TARGET language (the language to show at top)
    const targetText = pickByLang(entry.translations, targetLanguage)
    if (!targetText) {
      continue
    }

    // Distinct languages are REQUIRED for this game mode — you translate the
    // target into the block language. Reject an entry whose block + target text
    // are identical (a same-language pair, or two codes that resolve to the same
    // translation) so the prompt and the blocks are never the same (Skylar: EN→EN).
    if (blockText.trim() === targetText.trim()) {
      continue
    }

    // Split block text into words (these are the blocks the player arranges)
    const words = tokenizeText(blockText)

    // Filter out single-word entries - only keep phrases with at least minWords words
    if (words.length < minWords) {
      continue
    }

    // Check if text looks like a complete phrase
    // Skip if text is too short (could be single word even after tokenization)
    // Note: CJK languages don't use spaces, so we skip the space check for them
    const isCJK = isCJKText(blockText)
    if (blockText.trim().length < 5 || (!isCJK && !blockText.includes(" "))) {
      continue
    }

    // Found a good phrase! Return it as ONE utterance
    // text = block language (for blocks), targetText = target language (for display)
    const utterance: Utterance = {
      id: `entry-${entry.entry_id}`,
      level: entry.level, // CEFR level from the entry
      text: blockText, // Block language text (for word blocks)
      words, // Words from block language
      targetText: targetText, // Target language text (to show at top)
      source: entry.source, // Tag for history (e.g. "base" or a phrase-pack id)
    }
    console.log(`\n[juice-squeeze:data] ========================================`)
    console.log(`[juice-squeeze:data] ✅ SUCCESS! ACCEPTED ENTRY ${entry.entry_id}`)
    console.log(`[juice-squeeze:data] ========================================`)
    console.log(`[juice-squeeze:data] Block text (${blockLanguage}): "${blockText}"`)
    console.log(`[juice-squeeze:data] Target text (${targetLanguage}): "${targetText}"`)
    console.log(`[juice-squeeze:data] Words (${words.length}): [${words.join(", ")}]`)
    console.log(`[juice-squeeze:data] ========================================\n`)
    return utterance
  }

  console.error(`\n[juice-squeeze:data] ========================================`)
  console.error(`[juice-squeeze:data] ❌ FAILED after ${maxAttempts} attempts`)
  console.error(`[juice-squeeze:data] ========================================\n`)
  return null
}
