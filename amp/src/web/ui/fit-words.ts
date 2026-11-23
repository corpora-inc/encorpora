/** What stands for the words left out. */
export const ELLIPSIS = "…";

/** The first `count` whole words of `text`, with the mark that some were
 * left out; all of them, the text itself. */
export function leadingWords(text: string, count: number) {
  const words = text.split(" ");
  return count >= words.length
    ? text
    : words.slice(0, Math.max(0, count)).join(" ") + ELLIPSIS;
}

/**
 * How many whole words of `text` fit, where `fits` says whether a string
 * does (the box measures it: `ui/FitText.tsx`). All of them when the text
 * fits; otherwise the most whose words, followed by the ellipsis, fit; 0
 * when not even the first does (the box then shows what it can of that
 * word). Never part of a word.
 *
 * `fits` must only get harder as words are added, as any box's does.
 */
export function fitWords(text: string, fits: (candidate: string) => boolean) {
  const total = text.split(" ").length;
  if (fits(text)) return total;
  let low = 0;
  let high = total - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(leadingWords(text, middle))) low = middle;
    else high = middle - 1;
  }
  return low;
}
