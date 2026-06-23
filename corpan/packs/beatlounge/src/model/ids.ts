/**
 * Stable short ids for document entities. Every track / event / bus / effect
 * carries one so two documents diff to a minimal, addressable patch and
 * undo/redo + (future) collaboration stay tractable.
 *
 * No external dependency — a tiny nanoid-style generator. Uses crypto when
 * available (browser/WebView), falls back to Math.random otherwise.
 */

export type Id = string

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"

const randomBytes = (n: number): Uint8Array => {
  const out = new Uint8Array(n)
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(out)
    return out
  }
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256)
  return out
}

/** Generate a short id, e.g. "t_k3f9a2qd". `prefix` aids debugging. */
export const newId = (prefix = ""): Id => {
  const bytes = randomBytes(8)
  let s = ""
  for (let i = 0; i < bytes.length; i++) s += ALPHABET[bytes[i] % ALPHABET.length]
  return prefix ? `${prefix}_${s}` : s
}
