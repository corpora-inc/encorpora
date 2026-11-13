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

/** "a" or "an" before a number or a word as it is said (`capital`: "A" or
 * "An"). A number: an 8, an 11, an 18, an 80, an 800, an 8,000, an 11,000
 * and an 18,000; a for every other number. A word by its first sound: an
 * apple, an hour, an equilateral triangle; a unit, a one-digit number, a
 * European. Initialisms and single letters use their names: an LCD, a GCF,
 * an L shape, an x-value, a B. MAD is spoken as the word "mad". Math
 * set in $…$ is read for what it says ("$85^\circ$" is eighty-five). */
export function article(n: number | string, capital = false): string {
  const said = String(n)
    .trim()
    .replace(/^[\s"'“‘([{*_$]+|\\(?:text|mathrm|mathit)\{/g, "")
    .replace(/^[\s"'“‘([{*_$]+/, "");
  let an: boolean;
  if (/^[−-]\s?\d/.test(said))
    an = false; // "a negative 8"
  else if (/^\d/.test(said)) {
    const digits = said.replace(/[,\s]/g, "");
    an = /^8/.test(digits) || /^1[18](\d{3})*(?!\d)/.test(digits);
  } else {
    const word = said.toLowerCase();
    if (/^MAD\b/.test(said)) an = false;
    else if (
      /^[A-Z]{2,}(?=$|[^A-Za-z])/.test(said) ||
      /^[a-z](?![a-z])/.test(word)
    )
      an = /^[aefhilmnorsx]/.test(word);
    else if (
      /^(uni(?:corn|cycle|direction|f|lateral|modal|on|que|sex|son|t|v)|use|usu|ut[ie]|ur[aeio]|eu|ewe|ones?(?![a-z])|once|ubiq)/.test(
        word,
      )
    )
      an = false;
    else if (/^(hour|honest|honou?r|heir|nth\b)/.test(word)) an = true;
    else an = /^[aeiou]/.test(word);
  }
  return capital ? (an ? "An" : "A") : an ? "an" : "a";
}

/** The word with its article: withArticle("apple") is "an apple",
 * withArticle(8) is "an 8", withArticle("cube", true) is "A cube". */
export function withArticle(word: number | string, capital = false): string {
  return `${article(word, capital)} ${word}`;
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

/** A factor or addend next to an operation. Only a negative is wrapped, so
 * "+(3)" and "x-(2)" print as "+3" and "x-2", while "-3" stays "(-3)". */
export function term(value: number | string): string {
  const text = String(value);
  return text.startsWith("-") || text.startsWith("−") ? `(${text})` : text;
}
