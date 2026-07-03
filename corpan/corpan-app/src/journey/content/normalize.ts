// Journey content resolver — answer normalization for distractor validity
// checks (content-resolver.md §4.3).
//
// The pipeline is DELIBERATELY aggressive: a distractor differing only in
// case, punctuation, or diacritics from the correct answer is a
// valid-alternate hazard, not a distractor. Order (normative):
//   Unicode NFKC → toLocaleLowerCase(lang) → strip punctuation + symbols
//   (Unicode P*/S* classes) → NFD + strip combining marks (diacritic fold)
//   → collapse whitespace (+ trim).

const PUNCT_AND_SYMBOLS = /[\p{P}\p{S}]+/gu
const COMBINING_MARKS = /\p{M}+/gu
const WHITESPACE_RUNS = /\s+/g

/**
 * Normalize one answer face for equality comparison. `lang` drives the
 * locale-aware lowercase (e.g. Turkish dotted/dotless i); pass the language
 * the text surfaces in.
 */
export function normalizeAnswer(text: string, lang: string): string {
  let s = (text || "").normalize("NFKC")
  try {
    s = s.toLocaleLowerCase(lang || undefined)
  } catch {
    s = s.toLowerCase() // unknown/malformed tag — plain fold
  }
  s = s.replace(PUNCT_AND_SYMBOLS, " ")
  s = s.normalize("NFD").replace(COMBINING_MARKS, "")
  return s.replace(WHITESPACE_RUNS, " ").trim()
}

/** True when two faces normalize to the same string in `lang`. */
export function normalizedEquals(a: string, b: string, lang: string): boolean {
  return normalizeAnswer(a, lang) === normalizeAnswer(b, lang)
}
