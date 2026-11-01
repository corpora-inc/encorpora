/** Words that agree with an interpolated count. Generators build sentences
 * from numbers; these make them read correctly for every number, including
 * 1 ("1 square counter", "3 square counters", "an 8-foot ladder"). */

/** Verb forms that agree with a count ("1 was", "3 were"). */
export const isAre = (n: number) => (n === 1 ? "is" : "are");
export const wasWere = (n: number) => (n === 1 ? "was" : "were");
export const hasHave = (n: number) => (n === 1 ? "has" : "have");

const IRREGULAR: Record<string, string> = {
  foot: "feet",
  child: "children",
  person: "people",
  man: "men",
  woman: "women",
  tooth: "teeth",
  mouse: "mice",
  goose: "geese",
  leaf: "leaves",
  half: "halves",
  shelf: "shelves",
  loaf: "loaves",
  wolf: "wolves",
  life: "lives",
  knife: "knives",
  sheep: "sheep",
  fish: "fish",
  deer: "deer",
};

/** The plural of a noun phrase; only its last word changes ("square
 * counter" → "square counters", "box" → "boxes", "story" → "stories"). */
export function plural(phrase: string): string {
  const at = phrase.lastIndexOf(" ") + 1;
  const head = phrase.slice(0, at);
  const word = phrase.slice(at);
  const irregular = IRREGULAR[word.toLowerCase()];
  if (irregular) return head + irregular;
  if (/[^aeiou]y$/i.test(word)) return `${head}${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${head}${word}es`;
  return `${head}${word}s`;
}

/** A count with its noun in agreement: count(1, "square counter") is
 * "1 square counter", count(3, "square counter") is "3 square counters".
 * `many` names an irregular plural the rules above do not know. */
export function count(n: number, noun: string, many = plural(noun)): string {
  return `${n} ${n === 1 ? noun : many}`;
}

/** "a" or "an" before a number as it is said: an 8, an 11, an 18, an 80,
 * an 800, an 8,000, an 11,000 and an 18,000; a for every other number. */
export function article(n: number | string): "a" | "an" {
  const digits = String(n).replace(/[,\s]/g, "").replace(/^\$/, "");
  return /^8/.test(digits) || /^1[18](\d{3})*(?!\d)/.test(digits) ? "an" : "a";
}

/** The noun alone, in agreement with a count written elsewhere (a typeset
 * value: "$1$ mile per hour", "$\frac{3}{2}$ miles"). A value is singular
 * only when it is exactly 1. */
export function nounFor(
  n: number | string,
  one: string,
  many = plural(one),
): string {
  const value = typeof n === "number" ? n : Number(n.replace(/[$\s{}]/g, ""));
  return value === 1 ? one : many;
}
