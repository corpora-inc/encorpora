import { expect, test } from "vitest";
import { ELLIPSIS, fitWords, leadingWords } from "../fit-words";

/** A box of `lines` lines of `width` characters, breaking at spaces as a
 * browser does; a word longer than a line overflows it. */
const box = (width: number, lines: number) => (candidate: string) => {
  let used = 0;
  let line = 0;
  for (const word of candidate.split(" ")) {
    if (word.length > width) return false;
    if (line === 0) line = word.length;
    else if (line + 1 + word.length <= width) line += 1 + word.length;
    else {
      used++;
      line = word.length;
    }
  }
  return used + 1 <= lines;
};

const TITLE = "Solving a linear and a nonlinear equation together";

test("a name that fits is shown whole", () => {
  expect(fitWords(TITLE, box(60, 1))).toBe(8);
  expect(leadingWords(TITLE, 8)).toBe(TITLE);
  expect(fitWords("Area of a rectangle", box(10, 2))).toBe(4);
});

test("a name that doesn't fit is cut after a whole word, never inside one", () => {
  for (const width of [8, 12, 16, 20, 24, 30, 40])
    for (const lines of [1, 2]) {
      const fits = box(width, lines);
      const count = fitWords(TITLE, fits);
      const shown = leadingWords(TITLE, count);
      if (count === 8) {
        expect(shown).toBe(TITLE);
        continue;
      }
      expect(shown.endsWith(ELLIPSIS)).toBe(true);
      const kept = shown.slice(0, -1);
      // Whole words from the start, and the next character a space.
      expect(TITLE.startsWith(kept)).toBe(true);
      if (kept) expect(TITLE[kept.length]).toBe(" ");
      // It fits, and one more word would not.
      if (count > 0) expect(fits(shown)).toBe(true);
      expect(fits(leadingWords(TITLE, count + 1))).toBe(false);
    }
});

test("the ellipsis has its room: a word that only fits without it is left out", () => {
  // "Area of a" is 9 wide and fits 9; "Area of a…" is 10 and does not.
  expect(fitWords("Area of a rectangle", box(9, 1))).toBe(2);
  expect(leadingWords("Area of a rectangle", 2)).toBe("Area of…");
});

test("when not even the first word fits, only the ellipsis shows", () => {
  expect(fitWords("Multiplication within 100", box(6, 1))).toBe(0);
  expect(leadingWords("Multiplication within 100", 0)).toBe(ELLIPSIS);
});
