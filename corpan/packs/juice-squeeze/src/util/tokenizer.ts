/**
 * Tokenizer for Juice Squeeze (Fire rebuild)
 *
 * Ported VERBATIM from the shipped pack's data.ts. Splits block-language text
 * into word/punctuation tokens. CJK languages are split character-by-character.
 * Contractions ("don't", "l'eau") and hyphenated words ("peut-être") are kept
 * as single tokens.
 */

/**
 * Detect if text contains CJK (Chinese, Japanese, Korean) characters
 * Used to determine if we need character-by-character tokenization
 */
export const isCJKText = (text: string): boolean => {
  // CJK Unified Ideographs (Chinese), Hiragana, Katakana (Japanese), Hangul (Korean)
  return /[一-鿿぀-ゟ゠-ヿ가-힯]/.test(text)
}

/**
 * Tokenize CJK text by splitting each character into its own token
 * Punctuation is kept as separate tokens
 */
export const tokenizeCJK = (text: string): string[] => {
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
 * Normalize text for consistent tokenization:
 * 1. Apply Unicode NFKC normalization (converts compatibility chars to canonical forms)
 * 2. Normalize remaining apostrophe-like characters to standard ' (U+0027)
 */
export const normalizeForTokenization = (text: string): string => {
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
export const tokenizeText = (text: string): string[] => {
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
 * Check if text is only punctuation (don't speak these in TTS)
 * Uses Unicode property escapes to catch ALL punctuation from any language.
 * Ported verbatim from game.ts.
 */
export const isOnlyPunctuation = (text: string): boolean => {
  return /^[\p{P}\s]+$/u.test(text)
}

/**
 * Join an ordered list of word tokens into a TTS-ready sentence:
 * punctuation tokens attach directly to the previous word, other words are
 * space-separated. Ported verbatim from game.ts's checkWin TTS build.
 */
export const joinForTTS = (wordsInSentence: string[]): string => {
  let completeSentence = ""
  wordsInSentence.forEach((word, i) => {
    if (isOnlyPunctuation(word)) {
      // Attach punctuation directly to previous word
      completeSentence += word
    } else {
      // Add space before non-punctuation words (except first word)
      if (i > 0 && !isOnlyPunctuation(wordsInSentence[i - 1])) {
        completeSentence += " "
      }
      completeSentence += word
    }
  })
  return completeSentence
}
