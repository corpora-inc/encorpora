/**
 * Language-pair rotation for Juice Squeeze (Fire rebuild).
 *
 * Ported VERBATIM from the shipped pack's `pickLanguagePair` (game.ts ~2127)
 * including the MODULE-LEVEL rotation index. Returns [targetLang, blockLang]:
 *   - targetLang = phrase shown at TOP
 *   - blockLang  = the language of the draggable word blocks
 *
 * Behavior:
 *   0 languages -> ["en","en"]
 *   1 language  -> [languages[0], languages[0]]
 *   2 languages -> [languages[0], languages[1]]
 *   3+          -> display = languages[0]; block rotates through languages.slice(1)
 *
 * The rotation index is module-level so it survives across phrase loads (matches
 * shipped, where `targetLangRotationIndex` lived in the game closure for the
 * lifetime of the mounted game).
 */

let targetLangRotationIndex = 0

export function pickLanguagePair(languages: string[]): [string, string] {
  if (languages.length === 0) {
    return ["en", "en"]
  }
  if (languages.length === 1) {
    return [languages[0], languages[0]]
  }
  if (languages.length === 2) {
    return [languages[0], languages[1]]
  }

  // 3+ languages: display stays fixed, blocks rotate through the rest.
  const displayLang = languages[0]
  const blockLangs = languages.slice(1)
  const blockLang = blockLangs[targetLangRotationIndex % blockLangs.length]
  targetLangRotationIndex++

  return [displayLang, blockLang]
}

/** Test/reset helper — resets the module rotation index. */
export function resetLanguagePairRotation() {
  targetLangRotationIndex = 0
}
