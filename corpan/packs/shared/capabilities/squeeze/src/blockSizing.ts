/**
 * blockSizing — READABILITY-FIRST chip sizing.
 *
 * The old model filled the available width with a worst-case single-row
 * estimate, which collapsed long phrases (C2, 20-30 words) to ~9px clipped
 * specks. We replace it: chips are CONTENT-sized at a shared, readable font that
 * shrinks with word count but FLOORS at a readable size, and text is NEVER
 * clipped. The chip grows to fit its text (CSS padding in `em`); the bank wraps
 * across rows and scrolls when needed.
 *
 * - Shared font by word count `n` (readable floor 14px):
 *     n<=4 →22; n<=6 →20; n<=9 →18; n<=12 →16; n<=18 →15; else →14
 * - Per-word safeguard for a giant single word: if the word would exceed
 *   `maxChipWidthPx` (= availableWidth * 0.8) at the shared font, give THAT word
 *   a reduced font so it still fits on one line (CSS caps it at max-width:80vw).
 *   Never clip.
 */

/** Shared font size (px) for the whole phrase, by word count. Readable floor 14. */
export function sharedFontSize(words: string[]): number {
  const n = words.length
  if (n <= 4) return 22
  if (n <= 6) return 20
  if (n <= 9) return 18
  if (n <= 12) return 16
  if (n <= 18) return 15
  return 14
}

/**
 * Font (px) for a single word. Usually the shared font; only a word that would
 * be wider than `maxChipWidthPx` at the shared font shrinks — to a size that
 * makes it fit on one line — clamped to [11, sharedFont] so it stays readable.
 *
 * Width estimate: a bold pill's content width ≈ word.length * 0.56 * fontPx
 * (plus padding handled in CSS). We invert that with the 0.84 fit factor used by
 * the original auto-fit so the word lands inside the chip's content box.
 */
export function fontForWord(word: string, sharedFont: number, maxChipWidthPx: number): number {
  if (maxChipWidthPx <= 0) return sharedFont
  const estWidth = word.length * 0.56 * sharedFont
  if (estWidth <= maxChipWidthPx) return sharedFont
  const fitted = Math.floor((maxChipWidthPx * 0.84) / (word.length * 0.56))
  return Math.max(11, Math.min(sharedFont, fitted))
}
