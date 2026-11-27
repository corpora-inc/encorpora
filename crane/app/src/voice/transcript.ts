/**
 * Whisper writes sound events in brackets ("[BLANK_AUDIO]", "(engine
 * running)") and, on noise alone, tends to produce a few stock phrases. None
 * of that is a question: strip the markers, and treat a transcript that is
 * only a stock phrase as nothing heard, so the person is asked to try again
 * instead of seeing "Thank you." in the question box.
 */
const STOCK = /^(thank you|thanks for watching|thank you for watching|you|bye|okay|so)[.!?]*$/i;

export function cleanTranscript(raw: string): string {
  const text = raw
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return STOCK.test(text) ? "" : text;
}
