/** Final copy-edit for generated text. Generators build sentences from
 * numbers; this pass makes them read correctly for every number, including 1. */
const invariant = new Set([
  "is",
  "as",
  "us",
  "its",
  "thus",
  "has",
  "was",
  "plus",
  "minus",
  "times",
  "less",
  "this",
  "bus",
  "makes",
  "leaves",
]);
function singular(word: string) {
  if (word === "buses") return "bus";
  if (invariant.has(word) || word.endsWith("ss")) return word;
  if (/(ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
  return word.endsWith("s") ? word.slice(0, -1) : word;
}
function agree(verb: string) {
  if (verb === " are") return " is";
  if (verb === " have") return " has";
  return `${verb}s`;
}
function atMostOne(token: string) {
  const fraction = /^(\d+)\/(\d+)$/.exec(token);
  if (fraction) return Number(fraction[1]) <= Number(fraction[2]);
  return Number(token) === 1;
}
/** Words that describe a counted noun: "1 square counters" → "1 square counter". */
const describing =
  "red|blue|green|yellow|orange|purple|pink|black|white|gray|brown|round|square|cubic|long|short|tall|small|big|large|shaded|unshaded|extra|complete|full|empty|equal|whole";
/** Words ending in s after a describing word that are not plural nouns. */
const notPlural =
  "is|as|has|was|its|this|thus|plus|minus|times|less|contains|makes|holds|uses|gives|stays|remains|equals|means|goes|does|leaves|takes|needs|fits|shows|sits|lies|ends|starts|stands|represents|awards";
const describedPlural = new RegExp(
  `(^|[^\\d./−+×÷*-]\\s|^\\s|[^\\d./−+×÷*\\s-])1 (${describing}) (?!(?:${notPlural})\\b)([a-z]+s)\\b( (?:contain|use|have|are|make|remain|hold|become|give|cover)\\b)?`,
  "g",
);
/** A noun shared by a list keeps its plural: "3 purple and 1 green sections". */
const sharedByList = /\d [a-z]+,? (?:and|or) $/;
export function polish(text: string): string {
  return (
    text
      // "1 square counters" → "1 square counter"
      .replace(
        describedPlural,
        (
          match: string,
          before: string,
          word: string,
          noun: string,
          verb: string | undefined,
          offset: number,
          whole: string,
        ) =>
          sharedByList.test(whole.slice(0, offset + before.length))
            ? match
            : `${before}1 ${word} ${singular(noun)}${verb ? agree(verb) : ""}`,
      )
      // "There are 1 dots" → "There is 1 dot"
      .replace(/\b([Tt]here) are 1 /g, "$1 is 1 ")
      .replace(/\b([Tt]here) were 1 /g, "$1 was 1 ")
      // "1 trays" → "1 tray" (not "1/4", "-1", "21", "1.5")
      .replace(
        /(^|[^\d./−-])1 ([a-z]+s)\b( (?:contain|use|have|are|make|remain|hold|become|give)\b)?/g,
        (_, before: string, word: string, verb?: string) =>
          `${before}1 ${singular(word)}${verb ? agree(verb) : ""}`,
      )
      // "2 liter(s)" → "2 liters"; "1/4 liter(s)" → "1/4 liter"
      .replace(
        /(\S+) ([a-z]+)\(s\)/g,
        (_, amount: string, word: string) =>
          `${amount} ${atMostOne(amount) ? word : `${word}s`}`,
      )
      // "Slope = 8/5 = 8/5" → "Slope = 8/5"
      .replace(
        /((?:^|[=:]) ?)(-?[\d/.]+) = \2(?=[.,;]?$|[.,;] |\s[a-z])/g,
        "$1$2",
      )
      // "11 − (5)" → "11 − 5"; "(18) + (13)" → "18 + 13"; keep "f(4)" and "(−5)"
      .replace(/(^|[^A-Za-z\d)])\((\d[\d/.]*)\)/g, "$1$2")
      // "1x²" → "x²"
      .replace(/(^|[^\d./])1([a-z])(?![a-z])/g, "$1$2")
  );
}

/** Shows tenths, hundredths and thousandths as decimals: 8379/100 → 83.79.
 * Other fractions stay fractions; they are the answer's natural form. */
export function displayAnswer(value: string): string {
  const match = /^(-?\d+)\/(10|100|1000)$/.exec(value);
  if (!match) return value;
  const places = match[2]!.length - 1;
  return (Number(match[1]) / Number(match[2]))
    .toFixed(places)
    .replace(/\.?0+$/, "");
}

/** A plain formula ("y < −1/2x − 2") as explicit TeX for both typesetters. A
 * fraction that multiplies a letter or a group is set as \tfrac, so 1/2x reads
 * as one half of x. */
export const formula = (plain: string) =>
  plain.includes("$")
    ? plain
    : `$${plain.replace(/(\d+)\/(\d+)(?=\s*[A-Za-z(])/g, "\\tfrac{$1}{$2}")}$`;

/** An answer-field label that names a variable is set as math: "x" reads
 * "Value of $x$", "x-coordinate" reads "$x$-coordinate", "sin A" reads
 * "$\sin A$". Any other label is returned unchanged. */
export function mathLabel(label: string): string {
  if (/^[A-Za-z]$/.test(label)) return `Value of $${label}$`;
  const coordinate = /^([xy])-coordinate$/.exec(label);
  if (coordinate) return `$${coordinate[1]}$-coordinate`;
  const trig = /^(sin|cos|tan) ([A-Z]|θ)$/.exec(label);
  if (trig) return `$\\${trig[1]} ${trig[2] === "θ" ? "\\theta" : trig[2]}$`;
  return label;
}
