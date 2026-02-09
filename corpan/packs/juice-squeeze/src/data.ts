/**
 * Data layer for Juice Squeeze game
 * Loads utterances (phrases) from Corpán's phrase database
 */

import type { HostApi, EntryOut } from "./sdk/types"

export type Utterance = {
  id: string
  level: string // CEFR level (A0, A1, A2, B1, B2, C1)
  text: string
  words: string[]
  targetText?: string // Text in the OTHER language (to display at top)
}

/**
 * Normalize language code (lowercase, trim)
 */
const normalizeLang = (lang: string): string => lang.trim().toLowerCase()

/**
 * Detect if text contains CJK (Chinese, Japanese, Korean) characters
 * Used to determine if we need character-by-character tokenization
 */
const isCJKText = (text: string): boolean => {
  // CJK Unified Ideographs (Chinese), Hiragana, Katakana (Japanese), Hangul (Korean)
  return /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(text)
}

/**
 * Tokenize CJK text by splitting each character into its own token
 * Punctuation is kept as separate tokens
 */
const tokenizeCJK = (text: string): string[] => {
  const tokens: string[] = []
  for (const char of text) {
    // Skip whitespace
    if (/\s/.test(char)) continue
    // Each character becomes its own token (including punctuation)
    if (char.trim()) {
      tokens.push(char)
    }
  }
  return tokens
}

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
 * Normalize text for consistent tokenization:
 * 1. Apply Unicode NFKC normalization (converts compatibility chars to canonical forms)
 * 2. Normalize remaining apostrophe-like characters to standard ' (U+0027)
 */
const normalizeForTokenization = (text: string): string => {
  // Step 1: NFKC normalization - converts many lookalike characters to canonical forms
  let normalized = text.normalize("NFKC")

  // Step 2: Explicitly normalize any remaining apostrophe/quote variants to standard '
  // This catches characters that NFKC doesn't convert
  normalized = normalized.replace(/[''ʼʻʽʹ′‚‛`ʾʿˈˊˋ˴ꞌ]/g, "'")

  return normalized
}

/**
 * Split text into words and punctuation tokens
 * Handles punctuation marks as separate tokens
 * Preserves contractions like "I'm", "don't", "can't" as single tokens
 * Preserves hyphenated words like "peut-être", "rendez-vous" as single tokens
 * For CJK languages (Chinese, Japanese, Korean), splits by character
 */
const tokenizeText = (text: string): string[] => {
  // For CJK text, use character-by-character tokenization
  if (isCJKText(text)) {
    return tokenizeCJK(text)
  }

  // Normalize text: NFKC + apostrophe variants → standard '
  const normalizedText = normalizeForTokenization(text)

  const tokens: string[] = []

  // Regex pattern that handles:
  // 1. Contractions with apostrophes: "I'm", "don't", "l'eau", "c'est"
  // 2. Hyphenated words: "peut-être", "rendez-vous", "aujourd'hui"
  // 3. Regular words: "am", "hello", "the", "is" (letters, marks, numbers)
  // 4. Punctuation and symbols: ".", ",", "?", "!", etc.

  // Apostrophe variants: ' (U+0027), ' (U+2019), ' (U+2018), ʼ (U+02BC), ʻ (U+02BB), ʽ (U+02BD), ʹ (U+02B9), ′ (U+2032), ‚ (U+201A), ‛ (U+201B), ` (backtick)
  // Hyphen variants: - (U+002D), ‐ (U+2010), − (U+2212), – (U+2013), — (U+2014)
  // Simplified regex - only need standard apostrophe now since we normalized
  const regex = /[\p{L}\p{M}\p{N}]+(?:['\-‐−–—][\p{L}\p{M}\p{N}]+)*|[\p{P}\p{S}]/gu

  let match
  let lastIndex = 0

  while ((match = regex.exec(normalizedText)) !== null) {
    // Skip whitespace between matches
    if (match.index > lastIndex) {
      const between = normalizedText.slice(lastIndex, match.index)
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
  if (lastIndex < normalizedText.length) {
    const remaining = normalizedText.slice(lastIndex).trim()
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

  // Post-process: merge any remaining letter + punctuation + letter sequences
  // This catches ANY edge cases - if a single punctuation is between letters, merge them
  const merged: string[] = []

  for (let i = 0; i < filtered.length; i++) {
    const current = filtered[i]
    const next = filtered[i + 1]
    const afterNext = filtered[i + 2]

    // Check if this is: single letter + single punctuation + word starting with letter
    // This is a universal catch-all for apostrophes and similar contractions
    if (current.length === 1 && /^[\p{L}]$/u.test(current) &&
        next && next.length === 1 && /^[\p{P}\p{S}]$/u.test(next) &&
        afterNext && /^[\p{L}]/u.test(afterNext)) {
      // Merge all three into one token
      merged.push(current + next + afterNext)
      i += 2 // Skip the next two tokens
    } else {
      merged.push(current)
    }
  }

  return merged
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
export const loadUtterances = async (hostApi: HostApi, _count: number = 1, minWords: number = 2): Promise<Utterance[]> => {
  const utterance = await loadUtterance(hostApi, minWords)
  return utterance ? [utterance] : []
}

