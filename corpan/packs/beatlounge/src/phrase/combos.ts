/**
 * beatlounge — combinatorial phrase breakdown.
 *
 * Given a tokenized phrase, produce every CONTIGUOUS sub-phrase (n-gram),
 * ordered by length N then by position — the individual words, the full phrase,
 * and everything in between, in reading order:
 *
 *   "ella lo explicará" →
 *     N=1: ella · lo · explicará
 *     N=2: ella lo · lo explicará
 *     N=3: ella lo explicará
 *
 * Count for W tokens is W·(W+1)/2 (triangular), so it stays modest for normal
 * phrases (5 words → 15) but a 12-word sentence is 78 — the UI groups by N and
 * can cap, so the information architecture scales.
 */

export interface PhraseCombo {
  /** The joined sub-phrase text (rendered + auditioned + saved as one snippet). */
  text: string
  /** The tokens that make it up. */
  tokens: string[]
  /** Length in tokens (the N band). */
  n: number
  /** Start token index (reading-order position). */
  start: number
}

/** How many combos a W-token phrase yields (triangular number). */
export const comboCount = (tokenCount: number): number =>
  tokenCount <= 0 ? 0 : (tokenCount * (tokenCount + 1)) / 2

/**
 * All contiguous n-grams, ordered by N ascending then by start position.
 * `joiner` reconstructs the surface text — a space for spaced scripts, "" for
 * CJK/no-space scripts (the tokenizer knows which to pass).
 * `maxN` optionally caps the longest band (default: the whole phrase).
 */
export const phraseCombos = (
  tokens: string[],
  joiner = " ",
  maxN?: number
): PhraseCombo[] => {
  const out: PhraseCombo[] = []
  const top = Math.min(maxN ?? tokens.length, tokens.length)
  for (let n = 1; n <= top; n++) {
    for (let start = 0; start + n <= tokens.length; start++) {
      const slice = tokens.slice(start, start + n)
      out.push({ text: slice.join(joiner), tokens: slice, n, start })
    }
  }
  return out
}

/** Group combos by N band (1..W) for a grouped, expandable UI. */
export const combosByBand = (combos: PhraseCombo[]): { n: number; combos: PhraseCombo[] }[] => {
  const bands = new Map<number, PhraseCombo[]>()
  for (const c of combos) {
    const arr = bands.get(c.n) ?? []
    arr.push(c)
    bands.set(c.n, arr)
  }
  return [...bands.keys()].sort((a, b) => a - b).map((n) => ({ n, combos: bands.get(n)! }))
}
