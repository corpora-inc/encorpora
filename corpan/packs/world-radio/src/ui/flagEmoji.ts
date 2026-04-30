/**
 * Convert an ISO 3166-1 alpha-2 country code to its flag emoji.
 *
 * Flag emoji are formed from two regional-indicator codepoints, one per letter.
 * "US" → 🇺🇸. Returns an empty string for unrecognized inputs so callers can
 * skip rendering without conditionals.
 */
export function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return ""
  const upper = code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(upper)) return ""
  const A = 0x1f1e6 // regional indicator A
  const codePoints = [
    A + (upper.charCodeAt(0) - 65),
    A + (upper.charCodeAt(1) - 65),
  ]
  return String.fromCodePoint(...codePoints)
}
