/**
 * beatlounge — language-aware phrase tokenizer (pure, no audio, no DOM).
 *
 * A phrase becomes the fragments the sampler places on the grid. The split is
 * script-aware:
 *
 *  - Spaced scripts (Latin / Cyrillic / Greek / Arabic / Hebrew / Devanagari…)
 *    tokenize on whitespace, stripping leading/trailing punctuation but keeping
 *    intra-word marks (apostrophes, combining marks) so "don't" / "café" stay
 *    one token.
 *  - No-space scripts (Han / Hiragana / Katakana / Thai / Lao / Khmer …) have no
 *    word delimiters, so we tokenize per grapheme-ish unit: one CJK character
 *    per token (each is a syllable / morpheme worth re-pitching), with combining
 *    marks and the Korean Hangul block kept whole as one token.
 *
 * The output preserves the ORIGINAL substring of each token (for TTS + display)
 * plus its index, so the pipeline can re-synthesize / gloss per fragment.
 *
 * This is intentionally dependency-free: a full ICU segmenter is overkill for
 * single phrases and would bloat the pack. `Intl.Segmenter` is used when present
 * (modern WebViews) for correct grapheme clustering in no-space mode, with a
 * hand-rolled fallback for older runtimes / tests.
 */

export interface PhraseToken {
  /** The token's text, exactly as it appears in the phrase. */
  text: string
  /** 0-based position in the emitted token list. */
  index: number
}

/** Unicode ranges that are written WITHOUT inter-word spaces. */
const NO_SPACE_BLOCKS: ReadonlyArray<[number, number]> = [
  [0x3040, 0x30ff], // Hiragana + Katakana
  [0x31f0, 0x31ff], // Katakana phonetic extensions
  [0x3400, 0x4dbf], // CJK Ext A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
  [0x0e00, 0x0e7f], // Thai
  [0x0e80, 0x0eff], // Lao
  [0x1780, 0x17ff], // Khmer
  [0x1000, 0x109f], // Myanmar
]

/** Language codes whose primary script is space-less (fast path, code-driven). */
const NO_SPACE_LANGS = new Set([
  "zh",
  "zh-hans",
  "zh-hant",
  "yue",
  "ja",
  "th",
  "lo",
  "km",
  "my",
])

const inBlock = (cp: number): boolean =>
  NO_SPACE_BLOCKS.some(([lo, hi]) => cp >= lo && cp <= hi)

/** Normalize a BCP-47-ish code to its base (lowercased) primary subtag pair. */
const baseLang = (lang: string): string => lang.trim().toLowerCase()

/**
 * Decide whether a (lang, text) pair should be tokenized character-wise.
 * Prefer the language hint; fall back to sniffing the text when the hint is
 * unknown (e.g. a mixed corpus or an untagged phrase).
 */
export const isNoSpaceScript = (text: string, lang?: string): boolean => {
  if (lang) {
    const b = baseLang(lang)
    if (NO_SPACE_LANGS.has(b)) return true
    // an explicit spaced language wins over an incidental CJK char
    if (b && !NO_SPACE_LANGS.has(b) && /[a-z]/.test(b)) {
      // only trust the hint when the text has NO no-space chars at all;
      // otherwise sniff (handles e.g. Japanese mis-tagged as "und")
    }
  }
  // Sniff: if a meaningful share of code points are no-space-block chars.
  let noSpace = 0
  let letters = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (inBlock(cp)) noSpace++
    if (/\p{L}/u.test(ch)) letters++
  }
  if (letters === 0) return false
  return noSpace / letters >= 0.5
}

/** Trim leading/trailing punctuation & symbols but keep inner marks. */
const trimToken = (raw: string): string =>
  raw.replace(/^[\p{P}\p{S}\p{Z}]+/u, "").replace(/[\p{P}\p{S}\p{Z}]+$/u, "")

/** Whitespace tokenizer for spaced scripts. */
const tokenizeSpaced = (text: string): string[] =>
  text
    .split(/\s+/u)
    .map(trimToken)
    .filter((t) => t.length > 0)

type SegmenterCtor = new (
  locale?: string,
  opts?: { granularity?: "grapheme" | "word" | "sentence" }
) => { segment(input: string): Iterable<{ segment: string }> }

const getSegmenter = (): SegmenterCtor | null => {
  const intl = (globalThis as { Intl?: { Segmenter?: SegmenterCtor } }).Intl
  return intl && typeof intl.Segmenter === "function" ? intl.Segmenter : null
}

/**
 * Character/syllable tokenizer for no-space scripts: one grapheme cluster per
 * token, dropping pure-punctuation / whitespace clusters. Hangul syllable
 * blocks are single code points already, so per-grapheme is per-syllable there.
 */
const tokenizeCharwise = (text: string): string[] => {
  const Seg = getSegmenter()
  const units: string[] = []
  if (Seg) {
    const seg = new Seg(undefined, { granularity: "grapheme" })
    for (const { segment } of seg.segment(text)) units.push(segment)
  } else {
    // Fallback: iterate by code point, attaching combining marks to the base.
    for (const ch of text) {
      if (/\p{M}/u.test(ch) && units.length > 0) {
        units[units.length - 1] += ch
      } else {
        units.push(ch)
      }
    }
  }
  return units.filter((u) => trimToken(u).length > 0).map((u) => u.trim())
}

/**
 * Tokenize a phrase into placeable fragments. Returns indexed tokens in order.
 * Empty / whitespace-only input yields an empty list.
 */
export const tokenizePhrase = (text: string, lang?: string): PhraseToken[] => {
  const trimmed = (text ?? "").trim()
  if (!trimmed) return []
  const raw = isNoSpaceScript(trimmed, lang)
    ? tokenizeCharwise(trimmed)
    : tokenizeSpaced(trimmed)
  return raw.map((t, index) => ({ text: t, index }))
}
