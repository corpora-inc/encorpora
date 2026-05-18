/**
 * Rasmapan — Unicode-aware tokenizer.
 *
 * Lifted with light adaptation from juice-squeeze
 * `src/data.ts:31-141` (Apache-2.0, same repo). Splits text into
 * word/punctuation tokens, preserving contractions and hyphenated
 * compounds; CJK falls back to per-character.
 *
 * For Arabic, the regex path produces one token per word —
 * whitespace and punctuation are token boundaries, and the
 * diacritics that may sit on a letter stay attached because the
 * regex class `\p{M}` matches combining marks.
 */

const isCJKText = (text) =>
  // Han / Hiragana / Katakana / Hangul / Bopomofo ranges
  /[㐀-鿿豈-﫿぀-ゟ゠-ヿ가-힯㄀-ㄯ]/.test(
    text,
  )

const tokenizeCJK = (text) => {
  const tokens = []
  for (const ch of text) {
    if (/\s/.test(ch)) continue
    if (ch.trim()) tokens.push(ch)
  }
  return tokens
}

const normalizeForTokenization = (text) => {
  let s = text.normalize("NFKC")
  // Fold all apostrophe / single-quote variants to a single canonical
  // `'` so the regex below stays simple.
  s = s.replace(/[’‘ʼʻʽʹ′‚‛`ʾʿˈˊˋ˴ꞌ]/g, "'")
  return s
}

const TOKEN_REGEX = /[\p{L}\p{M}\p{N}]+(?:['\-‐−–—][\p{L}\p{M}\p{N}]+)*|[\p{P}\p{S}]/gu

/**
 * Tokenize `text` into an array of word/punctuation tokens.
 * - CJK scripts: per-character.
 * - All other scripts (incl. Arabic, Latin, Cyrillic, etc.): regex
 *   match — letters/marks/numbers plus contractions and hyphenated
 *   compounds collapse into a single token; punctuation/symbols
 *   each become their own token.
 *
 * Returns tokens in source order. Whitespace is dropped.
 */
export const tokenizeText = (text) => {
  if (!text) return []
  if (isCJKText(text)) return tokenizeCJK(text)
  const normalized = normalizeForTokenization(text)
  const tokens = []
  let m
  // Reset the regex's lastIndex (it's stateful when /g is set).
  TOKEN_REGEX.lastIndex = 0
  while ((m = TOKEN_REGEX.exec(normalized)) !== null) {
    const tok = m[0]
    if (tok.trim().length > 0) tokens.push(tok)
  }
  return tokens
}

/** Returns true if `word` contains the given `baseLetter` (single
 *  Unicode character) — used to highlight word chips that include
 *  the active letter family. */
export const wordContainsLetter = (word, baseLetter) => {
  if (!word || !baseLetter) return false
  // Compare as plain JS string includes — JS strings are UTF-16,
  // but Arabic letters are in the BMP so this works correctly.
  return word.includes(baseLetter)
}
