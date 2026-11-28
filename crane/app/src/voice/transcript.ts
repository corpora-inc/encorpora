/**
 * Whisper writes sound events in brackets ("[BLANK_AUDIO]", "(engine
 * running)") and, on noise alone, tends to produce a few stock phrases. None
 * of that is a question: strip the markers, and treat a transcript that is
 * only a stock phrase as nothing heard, so the person is asked to try again
 * instead of seeing "Thank you." in the question box.
 */
const STOCK = /^(thank you|thanks for watching|thank you for watching|you|bye|okay|so)[.!?]*$/i;

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * `prompt` is the vocabulary prompt whisper was primed with: on noise alone it
 * may repeat it back, which is not a question either.
 */
export function cleanTranscript(raw: string, prompt = ""): string {
  const text = raw
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (STOCK.test(text)) return "";
  const w = words(text);
  if (prompt && w.split(" ").length >= 3 && words(prompt).includes(w)) return "";
  return text;
}
