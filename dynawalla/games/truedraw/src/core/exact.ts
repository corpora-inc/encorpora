// Exact comparison of the numeric text the curriculum hands out.
//
// This is the load-bearing module of the whole game. A statement is FALSE only
// if the value it claims is genuinely not the answer, and "genuinely" cannot be
// decided by `===` on the raw strings — `"072"`, `"72"`, `"72.0"` and `"+72"`
// are the same number written four ways, and a game that treated one of them as
// a falsehood would be asking a child to reject a true sentence.
//
// It also cannot be decided by `Number(...)`: the curriculum computes in
// rationals and serialises exact decimal text on purpose, and parsing that into
// a float would introduce the first floating-point error in the system. So the
// comparison is done on a canonical *string* form, digit by digit. No float
// ever appears here.

/**
 * Canonical decimal text, or `null` when the text is not a decimal numeral at
 * all. Strips a leading `+`, leading zeros, trailing fractional zeros, and
 * normalises every spelling of zero to `"0"`.
 *
 *   "072"  → "0" + "72"  → "72"
 *   "72.0" → "72"
 *   "-0"   → "0"
 *   "1 234"→ null (a grouping separator is not something we decide about)
 */
export function canonicalNumeral(text: string): string | null {
  const trimmed = text.trim()
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(trimmed)
  if (!match) return null
  const sign = match[1] === "-" ? "-" : ""
  const rawInt = match[2] ?? ""
  const rawFrac = match[3] ?? ""
  // "." and "" and "+" are not numerals; at least one digit is required.
  if (rawInt.length === 0 && rawFrac.length === 0) return null

  const int = rawInt.replace(/^0+(?=\d)/, "") || "0"
  const frac = rawFrac.replace(/0+$/, "")
  const magnitude = frac.length > 0 ? `${int}.${frac}` : int
  // Negative zero is zero.
  if (/^0(\.0*)?$/.test(magnitude)) return "0"
  return `${sign}${magnitude}`
}

/** True when both texts are decimal numerals denoting the same value. */
export function sameValue(a: string, b: string): boolean {
  const ca = canonicalNumeral(a)
  const cb = canonicalNumeral(b)
  if (ca === null || cb === null) return false
  return ca === cb
}

/**
 * How many digit glyphs are in a piece of text. The draw window is sized from
 * this: `4,003 − 87 = 3,916` is more to verify than `12 + 5 = 17`, and the
 * child gets proportionally longer for it.
 */
export function digitCount(text: string): number {
  let n = 0
  for (const ch of text) if (ch >= "0" && ch <= "9") n++
  return n
}
