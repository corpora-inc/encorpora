/**
 * Cleaning for tutor replies before they are shown OR spoken.
 *
 * The model often emits Markdown (`**bold**`, `### headings`, `- bullet`,
 * `[text](url)`) and decorative symbols. Left in, they (a) show literal `**`
 * on screen and (b) make iOS/Android TTS read the punctuation aloud — e.g.
 * "asterisk asterisk", "number sign", and, for `;`, "semicolon". The reply we
 * speak goes to `AVSpeechUtterance(string:)` verbatim (no SSML), so whatever
 * survives here is pronounced.
 *
 * Two passes:
 *   - `scrubOutput`  — display-safe: removes Markdown *syntax* but keeps stray
 *                      single symbols that can be legitimate prose (e.g. the
 *                      `#` in "C#", a `~` in "~5").
 *   - `scrubForSpeech` — speech-safe: `scrubOutput` plus turning any remaining
 *                      TTS-verbalized punctuation into a pause or nothing, so
 *                      the synthesizer never says a symbol's name.
 */

// Pictographs, dingbats, arrows, regional-indicator flags. These add nothing to
// a spoken reply and clutter the transcript.
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F0FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/gu

/** Strip Markdown markup while preserving the readable text. Display-safe. */
export function stripMarkdown(s: string): string {
  // Fenced code blocks: drop the ``` fences, keep the inner text.
  s = s.replace(/```[^\n`]*\n?/g, "").replace(/```/g, "")
  // Images before links: ![alt](url) → "" , [text](url) → text.
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  // ATX headings: a run of leading #'s.
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "")
  // Horizontal rules: a line of only -, * or _ (three or more).
  s = s.replace(/^\s{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, "")
  // Blockquote and list markers at the start of a line. Ordered-list numbers
  // are meaningful, so they stay.
  s = s.replace(/^\s{0,3}>+[ \t]?/gm, "")
  s = s.replace(/^([ \t]*)[-*+•][ \t]+/gm, "$1")
  // Emphasis, strikethrough, inline code.
  s = s.replace(/\*\*([^*]+?)\*\*/g, "$1")
  s = s.replace(/__([^_]+?)__/g, "$1")
  s = s.replace(/~~([^~]+?)~~/g, "$1")
  s = s.replace(/\*([^*\n]+?)\*/g, "$1")
  s = s.replace(/(^|[^\p{L}\p{N}])_([^_\n]+?)_(?=[^\p{L}\p{N}]|$)/gu, "$1$2")
  s = s.replace(/`([^`\n]+?)`/g, "$1")
  // Residual paired markers / lone asterisks left by malformed Markdown.
  s = s.replace(/\*\*/g, "").replace(/__/g, "").replace(/\*/g, "")
  return s
}

/** Clean a reply for on-screen display. */
export function scrubOutput(s: string): string {
  s = s.replace(EMOJI_RE, "")
  s = stripMarkdown(s)
  s = s.replace(/<\/?reference\b[^>]*>/gi, "")
  // Orphaned combining marks → the "dotted-circle" artifact. A combining mark
  // (Unicode M*) only renders correctly attached to a base letter; when the
  // model drops the base (common for small models in Indic/Tamil/Arabic/Thai),
  // the leftover sign draws on a ◌ dotted circle. Strip any run of combining
  // marks with no base before it — at the start or right after whitespace.
  s = s.replace(/(^|\s)\p{M}+/gu, "$1")
  s = s.replace(/[ \t]+(?=\n)/g, "")
  s = s.replace(/[ \t]{2,}/g, " ")
  s = s.replace(/\n{3,}/g, "\n\n")
  return s.trim()
}

/**
 * Clean a reply for TTS. On top of `scrubOutput`, neutralize the punctuation a
 * synthesizer would otherwise read aloud by name.
 *
 * `locale` matters for one character: in Greek, ASCII `;` is the question mark,
 * so it must survive (and keep its interrogative intonation) rather than being
 * flattened to a comma.
 */
export function scrubForSpeech(s: string, locale = ""): string {
  let out = scrubOutput(s)
  const base = locale.toLowerCase().split("-")[0]

  // A spaced dash used as a separator ("word — gloss", "word - gloss") is read
  // as "dash" by some voices. A comma gives the intended pause instead.
  out = out.replace(/[ \t]*[—–][ \t]*/g, ", ")
  out = out.replace(/[ \t]+-[ \t]+/g, ", ")

  // Semicolons become a pause rather than the spoken word "semicolon" — except
  // in Greek, where ";" is the question mark.
  if (base !== "el") {
    out = out.replace(/;/g, ",").replace(/；/g, "，").replace(/؛/g, "،")
  }

  // Any remaining symbol a synthesizer would name aloud.
  out = out.replace(/[*_~#|^`\\•·>]/g, "")

  // Tidy spacing left by the removals.
  out = out.replace(/[ \t]{2,}/g, " ")
  out = out.replace(/[ \t]+([,.!?])/g, "$1")
  out = out.replace(/,{2,}/g, ",")
  return out.trim()
}
