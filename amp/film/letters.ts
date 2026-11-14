/** Letter names in speech; bare letters everywhere the script is shown. */
import type { Script, WordTime } from "./schema";

const LETTER = /\*([a-z])\*/gi;
/**
 * What the voice is sent for a marked letter. A capital "A" is read as the letter's name;
 * the respelling "ay" was often read as two letters ("A, Y"), and a bare "a" as the article.
 */
const RESPELLINGS: Record<string, string> = { a: "A" };
/** Bumped when RESPELLINGS changes, so takes voiced with an older respelling are not reused. */
const RESPELLING_VERSION = "letters-2";
/** Part of a take's cache key when the text has a marked letter the voice is sent respelled. */
export const respellingKey = (text: string): string | undefined =>
  [...text.matchAll(LETTER)].some(([, letter]) => RESPELLINGS[letter!.toLowerCase()]) ? RESPELLING_VERSION : undefined;
const LETTER_AFTER = new Set(["and", "or", "plus", "minus", "times", "squared", "cubed", "equals", "over"]);
const LETTER_BEFORE = new Set(["side", "leg", "point", "angle", "length", "letter"]);
export const MIN_LETTER_HOLD = 0.12;

export const displayText = (text: string) => text.replace(LETTER, "$1");
export const voiceText = (text: string) => text.replace(LETTER, (_, letter: string) => RESPELLINGS[letter.toLowerCase()] ?? letter);
export const displayScript = (script: Script): Script => ({
  ...script,
  shots: script.shots.map((shot) => ({ ...shot, beats: shot.beats.map((beat) => ({ ...beat, say: displayText(beat.say) })) })),
});

/** Match tokens, not whitespace: the service may split a hyphenated word. */
function alignedLetters(text: string, words: WordTime[]) {
  const marked = [...text.matchAll(LETTER)];
  if (!marked.length) return [];
  const tokens = (s: string) => [...s.matchAll(/[a-z0-9]+/gi)];
  const sent = tokens(voiceText(text));
  const got = words.flatMap((word, index) => tokens(word.text).map((token) => ({ token, word, index })));
  if (sent.length !== got.length || sent.some((token, i) => token[0].toLowerCase() !== got[i]!.token[0].toLowerCase()))
    throw new Error(`Voice alignment does not match the marked script: ${displayText(text)}`);
  return marked.map((mark) => {
    const i = tokens(voiceText(text.slice(0, mark.index))).length;
    return { ...got[i]!, letter: mark[1]! };
  });
}

/** Restore only marked tokens, preserving punctuation, word count and times. */
export function scriptWords(text: string, words: WordTime[]): WordTime[] {
  const letters = alignedLetters(text, words);
  const out = words.map((word) => ({ ...word }));
  // Work backwards so a shorter replacement cannot move an earlier token.
  for (const { index, token, letter } of letters.reverse()) {
    const word = out[index]!;
    word.text = word.text.slice(0, token.index) + letter + word.text.slice(token.index + token[0].length);
  }
  return out;
}

export function heldLetterFaults(text: string, words: WordTime[]): string[] {
  return alignedLetters(text, words)
    .filter(({ letter, word }) => letter.toLowerCase() === "a" && word.end - word.start < MIN_LETTER_HOLD - 1e-6)
    .map(({ letter, word }) => `at ${word.start.toFixed(1)} s the letter "${letter}" was read as a word, not as a letter`);
}

/** Likely letter names are notes, never errors: the author decides the meaning. */
export function letterNotes(script: Pick<Script, "shots">): string[] {
  return script.shots.flatMap((shot, si) => shot.beats.flatMap(({ say }) => {
    const words = [...say.matchAll(/\*([a-z])\*|[a-z0-9]+(?:[’'][a-z]+)?/gi)];
    // another lone letter in the sentence ("a longer and b shorter") makes a lone "a" a name too
    const others = words.some((word) => !!word[1] || /^[b-hj-z]$/i.test(word[0]));
    const likely = words.some((word, i) => !word[1] && word[0].toLowerCase() === "a" && (
      others ||
      /^\s*[.,:;?]/.test(say.slice(word.index + word[0].length)) ||
      LETTER_AFTER.has(words[i + 1]?.[0].toLowerCase() ?? "") ||
      LETTER_BEFORE.has(words[i - 1]?.[0].toLowerCase() ?? "")
    ));
    return likely ? [`shot ${si + 1}: "${displayText(say)}": if this is the letter a, write *a* so the voice says its name`] : [];
  }));
}
