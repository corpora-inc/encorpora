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
  return fitItems(total, (count) =>
    fits(count === total ? text : leadingWords(text, count)),
  );
}

/**
 * How many of `total` items fit, where `fits` says whether the first
 * `count` do (with whatever stands for the rest). All of them when they
 * fit; otherwise the most that do; 0 when not even the first does.
 *
 * Below `total`, `fits` must only get harder as items are added, as any
 * box's does; all of them is asked first, because what stands for the rest
 * can be longer than the last item itself.
 */
export function fitItems(total: number, fits: (count: number) => boolean) {
  if (fits(total)) return total;
  let low = 0;
  let high = total - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(middle)) low = middle;
    else high = middle - 1;
  }
  return Math.max(0, low);
}
