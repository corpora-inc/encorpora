/**
 * Tokenizer utilities for Juice Squeeze 2
 * Handles word tokenization for various languages including CJK
 */

/**
 * Detect if text contains CJK (Chinese, Japanese, Korean) characters
 */
export const isCJKText = (text: string): boolean => {
  return /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(text)
}

/**
 * Tokenize CJK text by splitting each character into its own token
 */
const tokenizeCJK = (text: string): string[] => {
  const tokens: string[] = []
  for (const char of text) {
    if (/\s/.test(char)) continue
    if (char.trim()) {
      tokens.push(char)
    }
  }
  return tokens
}

/**
 * Normalize text for consistent tokenization
 */
const normalizeForTokenization = (text: string): string => {
  let normalized = text.normalize("NFKC")
  normalized = normalized.replace(/[''ʼʻʽʹ′‚‛`ʾʿˈˊˋ˴ꞌ]/g, "'")
  return normalized
}

/**
 * Split text into words and punctuation tokens
 * Handles punctuation marks as separate tokens
 * Preserves contractions and hyphenated words as single tokens
 * For CJK languages, splits by character
 */
export const tokenizeText = (text: string): string[] => {
  if (isCJKText(text)) {
    return tokenizeCJK(text)
  }

  const normalizedText = normalizeForTokenization(text)
  const tokens: string[] = []
  const regex = /[\p{L}\p{M}\p{N}]+(?:['\-‐−–—][\p{L}\p{M}\p{N}]+)*|[\p{P}\p{S}]/gu

  let match
  while ((match = regex.exec(normalizedText)) !== null) {
    const token = match[0]
    if (token.trim().length > 0) {
      tokens.push(token)
    }
  }

  const filtered = tokens.filter((token) => token.trim().length > 0)

  // Post-process: merge letter + punctuation + letter sequences
  const merged: string[] = []
  for (let i = 0; i < filtered.length; i++) {
    const current = filtered[i]
    const next = filtered[i + 1]
    const afterNext = filtered[i + 2]

    if (current.length === 1 && /^[\p{L}]$/u.test(current) &&
        next && next.length === 1 && /^[\p{P}\p{S}]$/u.test(next) &&
        afterNext && /^[\p{L}]/u.test(afterNext)) {
      merged.push(current + next + afterNext)
      i += 2
    } else {
      merged.push(current)
    }
  }

  return merged
}
