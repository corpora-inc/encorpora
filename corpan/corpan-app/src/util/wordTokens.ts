/**
 * Word tokenization for the Phrase Flip long-press word-explanation popover.
 *
 * Unlike lingo-hero's `segmentPhrase` (which returns only the word strings, for
 * a falling-word game), this tokenizer preserves the ORIGINAL text verbatim —
 * every token, word OR separator, carries its substring — so we can render the
 * phrase as a sequence of inline spans without changing what the reader sees.
 * Only `word` tokens are long-pressable.
 *
 * It mirrors the script-handling philosophy of
 * `corpan/packs/lingo-hero/src/segment.ts` (Intl.Segmenter first, whitespace
 * fallback) but keeps positions and punctuation. For the es→en word pack the
 * relevant script is Latin, but this is script-agnostic so it won't break on
 * CJK / RTL phrases.
 */

export type WordToken = {
  /** The exact source substring for this token (word or separator). */
  text: string
  /** True when this token is a long-pressable word (vs. punctuation/space). */
  isWord: boolean
}

type SegmenterCtor = {
  new (
    locales?: string | string[],
    options?: { granularity?: "grapheme" | "word" | "sentence" },
  ): {
    segment(input: string): Iterable<{ segment: string; isWordLike?: boolean }>
  }
}

function makeWordSegmenter(lang: string) {
  const Seg = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter
  if (!Seg) return null
  try {
    return new Seg(lang || "und", { granularity: "word" })
  } catch {
    try {
      return new Seg("und", { granularity: "word" })
    } catch {
      return null
    }
  }
}

/** A token is "word-like" if it contains at least one letter or number. */
function looksWordLike(unit: string): boolean {
  return /[\p{L}\p{N}]/u.test(unit)
}

/**
 * Split `text` into ordered word + separator tokens, preserving the original
 * string exactly (concatenating all `token.text` reproduces `text`).
 */
export function tokenizePhrase(text: string, lang: string): WordToken[] {
  const raw = text || ""
  if (!raw) return []

  const seg = makeWordSegmenter(lang)
  if (seg) {
    const out: WordToken[] = []
    for (const piece of seg.segment(raw)) {
      const s = piece.segment
      if (!s) continue
      // Trust the segmenter's isWordLike when present; else fall back to our
      // own letter/number probe (some engines omit the flag).
      const isWord =
        typeof piece.isWordLike === "boolean" ? piece.isWordLike : looksWordLike(s)
      out.push({ text: s, isWord })
    }
    if (out.length) return out
  }

  // Fallback: split while keeping the separators (whitespace + punctuation).
  // The capturing group in split() retains the delimiters as their own tokens.
  const parts = raw.split(/(\s+|[.,!?;:¡¿"'“”‘’()\[\]{}…—–-]+)/u)
  return parts
    .filter((p) => p.length > 0)
    .map((p) => ({ text: p, isWord: looksWordLike(p) }))
}

/**
 * Normalize a surface word into the lookup key used by the word pack
 * (`word_explanation.word`). The seed stores lowercase surface words, so we
 * lowercase and strip surrounding punctuation/possessives that Intl.Segmenter
 * may include with the word run.
 */
export function lookupKeyFor(word: string): string {
  const trimmed = word
    .toLowerCase()
    .normalize("NFC")
    // Strip leading/trailing non-letter/number (quotes, brackets, etc.).
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}]+$/u, "")
    .trim()
  // Drop a trailing English possessive/contraction tail ("dog's" → "dog"), but
  // only when a base word survives — never reduce a standalone "'s" / "d" to "".
  const deTailed = trimmed.replace(/['’](s|re|ve|ll|d|m|t)$/u, "")
  return deTailed || trimmed
}
