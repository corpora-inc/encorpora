/**
 * Data layer for Juice Squeeze game
 * Loads utterances (phrases) from Corpán's phrase database
 */

import type { HostApi, EntryOut } from "./sdk/types"

export type Utterance = {
  id: string
  text: string
  words: string[]
  targetText?: string // Text in the OTHER language (to display at top)
}

/**
 * Normalize language code (lowercase, trim)
 */
const normalizeLang = (lang: string): string => lang.trim().toLowerCase()

/**
 * Extract text for a specific language from translations
 */
const pickByLang = (translations: { language_code: string; text: string }[], lang: string): string | undefined => {
  const desired = normalizeLang(lang)
  const exact = translations.find((t) => normalizeLang(t.language_code) === desired)
  if (exact) return exact.text
  
  const base = desired.split("-")[0]
  const baseMatch = translations.find((t) => normalizeLang(t.language_code).split("-")[0] === base)
  if (baseMatch) return baseMatch.text
  
  return translations[0]?.text
}

/**
 * Split text into words and punctuation tokens
 * Handles punctuation marks as separate tokens
 * Preserves contractions like "I'm", "don't", "can't" as single tokens
 * Preserves complete words like "am", "is", "the" as single tokens
 */
const tokenizeText = (text: string): string[] => {
  const tokens: string[] = []
  
  // More explicit regex pattern that handles:
  // 1. Contractions with apostrophes: "I'm", "don't", "can't", "it's", "we're"
  //    Pattern: letters + apostrophe + letters
  // 2. Regular words: "am", "hello", "the", "is" (letters, marks, numbers)
  //    Pattern: one or more letters/marks/numbers
  // 3. Punctuation and symbols: ".", ",", "?", "!", etc.
  //    Pattern: any punctuation or symbol
  
  // First, match contractions (word + apostrophe + word)
  // Then match regular words (letters/marks/numbers)
  // Finally match punctuation/symbols
  // Note: [''] matches both straight apostrophe (') and curly apostrophe (')
  const regex = /[\p{L}\p{M}\p{N}]+(?:[''][\p{L}\p{M}\p{N}]+)*|[\p{P}\p{S}]/gu
  
  let match
  let lastIndex = 0
  
    while ((match = regex.exec(text)) !== null) {
    // Skip whitespace between matches
    if (match.index > lastIndex) {
      const between = text.slice(lastIndex, match.index)
      // Only warn if there's non-whitespace content
      if (between.trim()) {
        // Commented out to reduce console noise
        // console.warn(`[juice-squeeze:data] Unmatched text in tokenization: "${between}" (at index ${lastIndex}-${match.index})`)
      }
    }
    
    const token = match[0]
    if (token.trim().length > 0) {
      tokens.push(token)
    }
    lastIndex = regex.lastIndex
  }
  
  // Handle any remaining text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim()
    if (remaining) {
      // Commented out to reduce console noise
      // console.warn(`[juice-squeeze:data] Remaining text after tokenization: "${remaining}"`)
      // Add remaining as token if it's not just whitespace
      if (remaining) {
        tokens.push(remaining)
      }
    }
  }
  
  const filtered = tokens.filter((token) => token.trim().length > 0)
  
  // Debug logging for problematic cases (single letter tokens that should be part of words)
  // Commented out to reduce console noise
  // const singleLetterWords = filtered.filter(t => t.length === 1 && /[a-zA-Z]/.test(t))
  // if (singleLetterWords.length > 0) {
  //   console.warn(`[juice-squeeze:data] ⚠️  WARNING: Single-letter tokens detected:`, singleLetterWords)
  //   console.warn(`[juice-squeeze:data]    Full tokenization result:`, filtered)
  //   console.warn(`[juice-squeeze:data]    Original text: "${text}"`)
  // }
  
  return filtered
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
  const targetLanguage = targetLang || (stackConfig.languages.length > 1 ? stackConfig.languages[1] : stackConfig.languages[0]) || "en"
  
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
    
    // Split block text into words (these are the blocks the player arranges)
    const words = tokenizeText(blockText)
    
    // Filter out single-word entries - only keep phrases with at least minWords words
    if (words.length < minWords) {
      continue
    }
    
    // Check if text looks like a complete phrase (has spaces, not just fragments)
    // Skip if text is too short or doesn't contain spaces (could be single word even after tokenization)
    if (blockText.trim().length < 5 || !blockText.includes(" ")) {
      continue
    }
    
    // Found a good phrase! Return it as ONE utterance
    // text = block language (for blocks), targetText = target language (for display)
    const utterance: Utterance = {
      id: `entry-${entry.entry_id}`,
      text: blockText, // Block language text (for word blocks)
      words, // Words from block language
      targetText: targetText, // Target language text (to show at top)
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

/**
 * Load utterances for the game (legacy function - now just wraps loadUtterance)
 * @deprecated Use loadUtterance instead
 */
export const loadUtterances = async (hostApi: HostApi, count: number = 1, minWords: number = 2): Promise<Utterance[]> => {
  const utterance = await loadUtterance(hostApi, minWords)
  return utterance ? [utterance] : []
}

