/** Final copy-edit for generated text. Generators build sentences from
 * numbers; this pass makes them read correctly for every number, including 1. */
const invariant = new Set([
  "is",
  "has",
  "was",
  "plus",
  "minus",
  "times",
  "less",
  "this",
]);
function singular(word: string) {
  if (invariant.has(word)) return word;
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
export function polish(text: string): string {
  return (
    text
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
