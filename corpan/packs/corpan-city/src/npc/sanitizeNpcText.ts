/**
 * sanitizeNpcText — strip emoji / pictographs out of generated NPC prose (#79).
 *
 * The on-device LLM sometimes sprinkles emoji into a line ("…frutas frescas! 🍓"),
 * which breaks the grounded, dignified tone AND would be handed to TTS (which
 * can't speak a pictograph). The NPC runtime runs every model-produced prose
 * string through here — at the streaming bubble AND at the finalize step that
 * feeds TTS + the saved history — so the bubble, the spoken text, and the history
 * are all clean, for every NPC, every turn. ONE function, one place.
 *
 * WHAT GOES: anything in Unicode's `Extended_Pictographic` set (all emoji + the
 * decorative pictographs/dingbats like ★ ☂ a small model reaches for), the
 * skin-tone modifiers, the regional-indicator pairs (flags), the ZWJ that joins
 * emoji sequences, the keycap combiner, and the emoji/text variation selectors.
 *
 * WHAT STAYS (the over-strip trap — tested explicitly in npc.test.ts): every real
 * SCRIPT — CJK 你好, Arabic مرحبا, Devanagari नमस्ते, accented Latin café — plus
 * ASCII digits, `#`/`*` (which `\p{Emoji}` WOULD wrongly catch, so we deliberately
 * use `\p{Extended_Pictographic}` instead), currency (€ $ ¥), arrows (→), the
 * check mark ✓, quotes/dashes, and ordinary punctuation. Only emoji/pictographs go.
 *
 * Idempotent + prefix-stable, so it's safe to run on the streaming accumulator
 * every token: removals only collapse INTERNAL whitespace and never reorder. It
 * deliberately does NOT trim the ENDS — the streaming caller needs the trailing
 * space/newline a token may carry, and the finalize path trims the completed
 * prose itself. An all-emoji line collapses to blank (then finalize trims it to ""
 * and the turn falls back to a scripted line).
 *
 * No DOM, no host — a pure string function.
 */

/**
 * Emoji + pictograph code points. `\p{Extended_Pictographic}` is the right
 * property (covers emoji + decorative pictographs, but NOT ASCII digits/`#`/`*`);
 * the explicit ranges add the regional-indicator flag halves and skin-tone
 * modifiers, and the literal chars are ZWJ (U+200D), the text/emoji variation
 * selectors (U+FE0E/U+FE0F), and the keycap combining enclosure (U+20E3).
 */
const PICTOGRAPH_RE =
  /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}‍︎️⃣]/gu

export function sanitizeNpcText(text: string): string {
  if (!text) return text
  return text
    .replace(PICTOGRAPH_RE, "")
    // collapse the double-spaces a mid-line removal leaves (spaces/tabs only, so
    // intentional newlines survive), pull a stranded space off punctuation, and
    // off a line end. No end-trim (see the doc note) — that's the finalizer's job.
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?…;:])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
}
