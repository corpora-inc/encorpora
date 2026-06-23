/**
 * Language-pair rotation for Juice Squeeze (Fire rebuild).
 *
 * Based on the shipped pack's `pickLanguagePair` (game.ts ~2127) with the
 * MODULE-LEVEL rotation index, HARDENED (Skylar review) so the pair is always
 * DISTINCT where possible — the shipped version returned same-language pairs for
 * empty/single/duplicate stacks, which produced an unplayable EN→EN. Returns
 * [targetLang, blockLang]:
 *   - targetLang = phrase shown at TOP
 *   - blockLang  = the language of the draggable word blocks
 *
 * Behavior (after dedupe):
 *   0 unique     -> ["en","en"]            (degenerate; host should prevent)
 *   1 unique [x] -> ["en", x]              (English prompt, build x) — or
 *                   ["en","en"] only if x IS English (can't avoid)
 *   2 unique     -> [u0, u1]
 *   3+ unique    -> display = u0; block rotates through uniq.slice(1)
 *
 * The rotation index is module-level so it survives across phrase loads (matches
 * shipped, where `targetLangRotationIndex` lived in the game closure for the
 * lifetime of the mounted game).
 */

let targetLangRotationIndex = 0

export function pickLanguagePair(languages: string[]): [string, string] {
  // HARDENED (Skylar review): the game translates the target INTO the block
  // language, so the pair must be DISTINCT — never the same language on both
  // sides (which produced EN→EN). Dedupe first, and pair a single-language stack
  // with English (the corpus base) so the prompt + blocks differ.
  const uniq = [...new Set(languages.map((l) => l.trim()).filter(Boolean))]

  if (uniq.length === 0) {
    return ["en", "en"] // degenerate: no stack languages (host should prevent)
  }
  if (uniq.length === 1) {
    const only = uniq[0]
    // English-only is the one case we can't make distinct; otherwise show the
    // English prompt and build the stack language.
    return only.toLowerCase().startsWith("en") ? ["en", "en"] : ["en", only]
  }
  if (uniq.length === 2) {
    return [uniq[0], uniq[1]]
  }

  // 3+ languages: display stays fixed, blocks rotate through the rest.
  const displayLang = uniq[0]
  const blockLangs = uniq.slice(1)
  const blockLang = blockLangs[targetLangRotationIndex % blockLangs.length]
  targetLangRotationIndex++

  return [displayLang, blockLang]
}

/** Test/reset helper — resets the module rotation index. */
export function resetLanguagePairRotation() {
  targetLangRotationIndex = 0
}
