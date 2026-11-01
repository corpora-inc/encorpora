import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import { isAre } from "./agreement.js";

// ID | title | skill | instructional grade | book page | bounded numeric objective
const rows = `
unit-piece-size|Size of one equal part|unit-fractions|3|units|Name one part of a whole partitioned into 2, 3, 4, 6, or 8 equal pieces.
fraction-unit-count|Count fractional units|unit-fractions|3|units|Count shaded equal units, including quantities greater than one.
fraction-line-position|Read a fraction location|fractions-number-line|3|measure|Read a marked position on a zero-based rational number line through three wholes.
fraction-whole-as-parts|Rename a whole in fractional units|equivalent-fractions|3|beyond|Find the numerator when a whole number is expressed using a specified denominator.
equivalent-numerator|Rename with smaller pieces|fraction-equivalence|4|subdivide|Find a missing numerator when both counts scale by an integer factor.
equivalent-denominator|Rename with larger pieces|fraction-equivalence|4|regroup|Find a missing denominator when equal groups are collected.
like-fraction-missing-part|Complete a fractional amount|like-fraction-addition|4|common-unit|Find the missing addend with a shared denominator.
like-fraction-difference|Remove like fractional units|like-fraction-addition|4|common-unit|Subtract positive like-denominator amounts with a nonnegative result.
mixed-to-improper-numerator|Count the parts in a mixed amount|mixed-numbers|4|beyond|Find the numerator of a mixed number renamed with its existing denominator.
improper-whole-part|Find full wholes in an amount|mixed-numbers|4|beyond|Count complete wholes in a positive improper fraction.
improper-fractional-part|Find the part beyond full wholes|mixed-numbers|4|beyond|Find the fractional remainder after removing complete wholes.
mixed-fraction-difference|Subtract through a whole|mixed-numbers|4|bridge-one|Subtract mixed numbers with like denominators, requiring one whole to be regrouped.
unlike-fraction-difference|Subtract using a shared unit|fraction-addition|5|subtract|Subtract distinct-denominator positive fractions with a nonnegative difference.
fraction-distance-gap|Measure a fractional gap|fraction-addition|5|subtract|Find the distance between two marked rational positions on a common-unit line.
whole-times-fraction|Several groups of a fraction|fraction-times-whole|4|groups-of|Find the total of a whole number of equal fractional-liter portions.
whole-sharing-fraction|Share whole quantities equally|fraction-as-division|5|sharing|Share a whole number of liters among a whole-number group, including improper shares.
unit-fraction-share|Share one fractional unit|unit-fraction-division|5|division-sharing|Divide a unit fraction of a liter among a positive whole-number group.
whole-unit-groups|Count unit-fraction groups|unit-fraction-division|5|division-fit|Count unit-fraction-liter containers in a whole number of liters.
fraction-group-count|Count full and partial groups|fraction-division|6|partial-group|Measure a rational total in fractional-liter container units, allowing partial groups.
fraction-share-amount|Share a fractional total|fraction-division|6|division-sharing|Share a positive non-unit fractional-liter amount among a whole-number group.
fraction-of-quantity|Scale a whole amount|fraction-multiplication|5|scale|Take a proper fraction of a positive whole-liter amount.
`;
export const fractionPracticeDefinitions = rows
  .trim()
  .split("\n")
  .map((row) => {
    const [id, title, skillId, grade, pageId, description] = row.split("|") as [
      string,
      string,
      string,
      "3" | "4" | "5" | "6",
      string,
      string,
    ];
    return { id, title, skillId, grade, pageId, description };
  });
export const fractionPracticeTemplates: readonly TemplateMetadata[] =
  fractionPracticeDefinitions.map(
    ({ id, title, skillId, grade, description }) => ({
      id,
      title,
      skillId,
      description,
      version: 1,
      gradeBand: grade === "6" ? "6–8" : "3–5",
    }),
  );
function random(id: string, seed: string) {
  let counter = 0;
  return (low: number, high: number) => {
    const range = high - low + 1,
      limit = Math.floor(0x100000000 / range) * range;
    let value: number;
    do {
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (value >= limit);
    return low + (value % range);
  };
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** "1 piece", "3 pieces". */
const count = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;
/** A unit after a fraction or whole: singular for amounts of at most 1. */
const unitAfter = (value: string, one: string) => {
  const [n, d = "1"] = value.split("/");
  const size = Math.abs(Number(n));
  return size > 0 && size <= Number(d) ? one : `${one}s`;
};
/** "8/4 = 2", or just "3/4" when the fraction is already simplest. */
const simplified = (n: number, d: number) => {
  const s = fraction(n, d);
  return s === `${n}/${d}` ? s : `${n}/${d} = ${s}`;
};
function fraction(n: number, d: number) {
  let a = Math.abs(n),
    b = d;
  while (b) [a, b] = [b, a % b];
  return d / a === 1 ? `${n / a}` : `${n / a}/${d / a}`;
}
export function generateFractionPracticeProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const template = fractionPracticeTemplates.find((t) => t.id === templateId);
  if (!template)
    throw new Error(`Unknown fraction practice template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed),
    choose = (xs: readonly number[]) => xs[r(0, xs.length - 1)]!;
  const d = choose([2, 3, 4, 6, 8]);
  let prompt = "",
    answer = "",
    hint = "",
    explanation: string[] = [],
    figure: SemanticFigure | undefined;
  let kind: "number" | "fraction" = "fraction",
    label = "Fraction or whole number";
  const strips = (
    parts: number,
    selected: number,
    unit: string,
    wholes = Math.ceil(selected / parts) || 1,
  ): SemanticFigure => ({
    kind: "fraction-strips",
    parts,
    wholes,
    unit,
    rows: [{ selected, label: "amount" }],
  });
  switch (templateId) {
    case "unit-piece-size": {
      prompt = `One whole strip is divided into ${d} equal pieces. What fraction of the whole is one piece?`;
      figure = strips(d, 1, "one whole", 1);
      answer = `1/${d}`;
      hint = `${d} equal pieces fill the whole. How much of the whole is one of them? The bottom number counts the pieces in the whole.`;
      explanation = [
        `A fraction names part of a whole. Its bottom number, the denominator, counts the equal pieces in one whole.`,
        `Here ${d} equal pieces fill the whole strip, so the denominator is ${d}.`,
        `Its top number, the numerator, counts the pieces you mean. You mean one piece, so the numerator is 1.`,
        `One piece is 1/${d} of the whole strip.`,
      ];
      break;
    }
    case "fraction-unit-count": {
      const n = r(1, 3 * d);
      figure = strips(d, n, "one whole");
      kind = "number";
      label = "Number of pieces";
      prompt = `Each whole is cut into ${d} equal pieces. How many pieces are shaded?`;
      answer = `${n}`;
      hint = `Each strip is one whole of ${d} pieces. Count every shaded piece across all the strips; crossing into the next whole does not change a piece.`;
      explanation = [
        `Each whole is cut into ${d} equal pieces, so each small piece is 1/${d} of a whole.`,
        `Count every shaded piece, one at a time, across all the strips.`,
        `Moving into the next whole strip does not restart the count, because each piece is still one piece.`,
        `There ${isAre(n)} ${count(n, "shaded piece")}, which is ${n}/${d} of a whole.`,
      ];
      break;
    }
    case "fraction-line-position": {
      const n = r(1, 3 * d);
      figure = {
        kind: "rational-line",
        denominator: d,
        maxWhole: 3,
        points: [{ numerator: n, label: "P" }],
        unit: "one whole",
      };
      prompt = `What number is at $P$? Each whole interval has ${d} equal steps.`;
      answer = fraction(n, d);
      hint = `Each whole is split into ${d} equal steps. Count the steps from 0 to $P$${n > d ? ", past 1 if needed," : ""} and write that count over ${d}.`;
      explanation = [
        `Each whole on the line is split into ${d} equal steps, so one step is 1/${d}.`,
        `Count the steps from 0 to $P$: $P$ is ${count(n, "step")} from 0.`,
        `${n} steps of 1/${d} make ${n}/${d}${answer === `${n}/${d}` ? "" : `, which is the same as ${answer}`}.`,
        `The number at $P$ is ${answer}.`,
      ];
      break;
    }
    case "fraction-whole-as-parts": {
      const w = r(1, 3);
      figure = strips(d, w * d, "one whole", w);
      kind = "number";
      label = "Missing numerator";
      prompt = `Write ${w} wholes as ?/${d}. What is the missing numerator?`;
      answer = `${w * d}`;
      hint = `Each whole contains ${d} pieces of size 1/${d}.`;
      explanation = [
        `The bottom number, ${d}, says each whole is cut into ${d} equal pieces of size 1/${d}.`,
        `The top number, the numerator, counts how many of those pieces you have.`,
        `${w === 1 ? "1 whole holds" : `${w} wholes hold`} ${w} × ${d} = ${w * d} pieces.`,
        `So ${w} = ${w * d}/${d}, and the missing numerator is ${w * d}.`,
      ];
      break;
    }
    case "equivalent-numerator": {
      const b = choose([2, 3, 4]),
        a = r(1, b - 1),
        k = r(2, Math.floor(12 / b));
      kind = "number";
      label = "Missing numerator";
      prompt = `Rename ${a}/${b} as ?/${b * k}. What is the missing numerator?`;
      answer = `${a * k}`;
      figure = {
        kind: "fraction-strips",
        parts: b * k,
        wholes: 1,
        unit: "one whole",
        rows: [{ selected: a * k, label: "same amount" }],
      };
      hint = `How many times ${b} is ${b * k}? Each 1/${b} piece splits into that many smaller pieces, so multiply ${a} by the same number.`;
      explanation = [
        `Equivalent fractions name the same amount with different-sized pieces.`,
        `${b * k} ÷ ${b} = ${k}, so each 1/${b} piece is cut into ${k} smaller pieces.`,
        `The whole now has ${k} times as many pieces, so the bottom number becomes ${b} × ${k} = ${b * k}.`,
        `You also have ${k} times as many pieces shaded, so the top number becomes ${a} × ${k} = ${a * k}.`,
        `${a}/${b} = ${a * k}/${b * k}, so the missing numerator is ${a * k}.`,
      ];
      break;
    }
    case "equivalent-denominator": {
      const b = choose([2, 3, 4]),
        a = r(1, b - 1),
        k = r(2, Math.floor(12 / b));
      kind = "number";
      label = "Missing denominator";
      prompt = `Rename ${a * k}/${b * k} as ${a}/?. What is the missing denominator?`;
      answer = `${b}`;
      hint = `What was ${a * k} divided by to make ${a}? Divide ${b * k} by that same number.`;
      explanation = [
        `Equivalent fractions name the same amount with different-sized pieces.`,
        `The top number goes from ${a * k} to ${a}, because ${a * k} ÷ ${k} = ${a}. Every ${k} small pieces join into one bigger piece.`,
        `The whole joins up the same way, so divide the bottom number by ${k} too: ${b * k} ÷ ${k} = ${b}.`,
        `${a * k}/${b * k} = ${a}/${b}, so the missing denominator is ${b}.`,
      ];
      break;
    }
    case "like-fraction-missing-part": {
      const total = r(2, 2 * d),
        part = r(1, total - 1);
      prompt = `${part}/${d} + □ = ${total}/${d}. What fraction is missing?`;
      answer = fraction(total - part, d);
      hint = `${part}/${d} and ${total}/${d} count the same size of piece. You have ${part} of them and need ${total}: how many more?`;
      explanation = [
        `Both fractions have bottom number ${d}, so they count the same size of piece, 1/${d}.`,
        `The total needs ${count(total, "piece")}, and ${part} ${isAre(part)} already there.`,
        `The missing part is the pieces still needed: ${total} − ${part} = ${total - part}.`,
        `${count(total - part, "piece")} of size 1/${d} ${total - part === 1 ? "makes" : "make"} ${simplified(total - part, d)}.`,
        `The missing fraction is ${answer}.`,
      ];
      break;
    }
    case "like-fraction-difference": {
      const a = r(1, 2 * d),
        b = r(1, a);
      prompt = `A cord is ${a}/${d} meter long. You remove ${b}/${d} meter. How many meters remain?`;
      label = "Meters remaining";
      answer = fraction(a - b, d);
      hint = `${a}/${d} and ${b}/${d} meter count the same size of piece. Take ${b} pieces away from ${a} pieces.`;
      explanation = [
        `Both lengths have bottom number ${d}, so both count pieces of size 1/${d} meter.`,
        `Taking away ${b}/${d} meter takes away ${count(b, "piece")} from the ${a}.`,
        `${a} − ${b} = ${a - b}, so ${count(a - b, "piece")} of 1/${d} meter ${a - b === 1 ? "remains" : "remain"}.`,
        a === b
          ? `You removed the whole cord, so 0 meters remain.`
          : `That is ${simplified(a - b, d)} ${unitAfter(answer, "meter")}, so ${answer} ${unitAfter(answer, "meter")} of cord ${answer === "1" || unitAfter(answer, "meter") === "meter" ? "remains" : "remain"}.`,
      ];
      break;
    }
    case "mixed-to-improper-numerator": {
      const w = r(1, 2),
        n = r(1, d - 1);
      prompt = `Write ${w} ${n}/${d} as ?/${d}. What is the numerator?`;
      kind = "number";
      label = "Missing numerator";
      answer = `${w * d + n}`;
      figure = strips(d, w * d + n, "one whole");
      hint = `Each whole is ${d} pieces, so ${w} ${w === 1 ? "whole holds" : "wholes hold"} ${w} × ${d} pieces. Then add the ${n} extra pieces.`;
      explanation = [
        `${w} ${n}/${d} is a mixed number: ${w === 1 ? "1 whole" : `${w} wholes`} plus ${n}/${d} more.`,
        `Each whole holds ${d} pieces of size 1/${d}, so ${w === 1 ? "1 whole holds" : `${w} wholes hold`} ${w} × ${d} = ${w * d} pieces.`,
        `Add the ${count(n, "extra piece")}: ${w * d} + ${n} = ${w * d + n}.`,
        `So ${w} ${n}/${d} = ${w * d + n}/${d}, and the numerator is ${w * d + n}.`,
      ];
      break;
    }
    case "improper-whole-part":
    case "improper-fractional-part": {
      const w = r(1, 2),
        n = r(1, d - 1),
        total = w * d + n;
      figure = strips(d, total, "one whole");
      if (templateId === "improper-whole-part") {
        prompt = `How many complete wholes are in ${total}/${d}?`;
        kind = "number";
        label = "Complete wholes";
        answer = `${w}`;
      } else {
        prompt = `Remove all complete wholes from ${total}/${d}. What fraction of one whole remains?`;
        answer = fraction(n, d);
      }
      hint =
        templateId === "improper-whole-part"
          ? `Every ${d} pieces make one whole. How many full groups of ${d} fit in ${total} pieces?`
          : `Take full groups of ${d} out of the ${total} pieces; each group is one whole. How many pieces are left, out of ${d}?`;
      explanation = [
        `${total}/${d} means ${total} pieces, each 1/${d} of a whole.`,
        `${d} pieces make one complete whole, so group the pieces in sets of ${d}.`,
        `${total} pieces make ${count(w, "group")} of ${d}, because ${w} × ${d} = ${w * d}, with ${total} − ${w * d} = ${count(n, "piece")} left over.`,
        `So ${total}/${d} = ${w} ${n}/${d}.`,
        templateId === "improper-whole-part"
          ? `There ${isAre(w)} ${count(w, "complete whole")} in ${total}/${d}.`
          : `After removing the wholes, ${n}/${d} of one whole remains${answer === `${n}/${d}` ? "" : `, which is the same as ${answer}`}.`,
      ];
      break;
    }
    case "mixed-fraction-difference": {
      const d = choose([3, 4, 6, 8]),
        whole = r(2, 4),
        other = r(1, whole - 1),
        a = r(1, d - 2),
        b = r(a + 1, d - 1);
      prompt = `Find ${whole} ${a}/${d} − ${other} ${b}/${d}. Give a fraction or whole number.`;
      answer = fraction((whole - other) * d + a - b, d);
      hint = `${a}/${d} is less than ${b}/${d}, so first rename one whole of ${whole} ${a}/${d} as ${d}/${d}: it becomes ${whole - 1} ${d + a}/${d}.`;
      explanation = [
        `Subtract the fraction parts and the whole parts separately.`,
        `${a}/${d} is less than ${b}/${d}, so there are not enough pieces to take ${b} away.`,
        `Trade one whole for ${d}/${d}, which is the same amount: ${whole} ${a}/${d} becomes ${whole - 1} ${d + a}/${d}.`,
        `Fraction parts: ${d + a}/${d} − ${b}/${d} = ${d + a - b}/${d}. Whole parts: ${whole - 1} − ${other} = ${whole - 1 - other}.`,
        `Together that is ${whole - 1 - other === 0 ? `${d + a - b}/${d}` : `${whole - 1 - other} ${d + a - b}/${d}`}. As one fraction in simplest form, the difference is ${answer}.`,
      ];
      break;
    }
    case "unlike-fraction-difference": {
      const b = choose([2, 3, 4]),
        q = choose([5, 6, 8].filter((x) => x !== b)),
        a = r(1, b),
        c = r(1, q);
      const left = a * q >= c * b ? [a, b] : [c, q],
        right = a * q >= c * b ? [c, q] : [a, b];
      prompt = `Find ${left[0]}/${left[1]} − ${right[0]}/${right[1]}.`;
      answer = fraction(
        left[0]! * right[1]! - right[0]! * left[1]!,
        left[1]! * right[1]!,
      );
      const common = (left[1]! * right[1]!) / gcd(left[1]!, right[1]!);
      hint = `Rename ${left[0]}/${left[1]} and ${right[0]}/${right[1]} with the common denominator ${common}, so both count the same size of piece. Then subtract the numerators.`;
      const [ln, rn] = [
        (left[0]! * common) / left[1]!,
        (right[0]! * common) / right[1]!,
      ];
      explanation = [
        `The bottom number, the denominator, gives the size of each piece. Pieces of size 1/${left[1]} and 1/${right[1]} are different, so you cannot subtract yet.`,
        `${common} is a multiple of both ${left[1]} and ${right[1]}, so both fractions can be cut into pieces of size 1/${common}.`,
        `${left[0]}/${left[1]} = ${ln}/${common} and ${right[0]}/${right[1]} = ${rn}/${common}.`,
        `Now the pieces match, so subtract the top numbers: ${ln} − ${rn} = ${ln - rn}.`,
        `That leaves ${simplified(ln - rn, common)}, so ${left[0]}/${left[1]} − ${right[0]}/${right[1]} = ${answer}.`,
      ];
      break;
    }
    case "fraction-distance-gap": {
      const a = r(0, 3 * d - 1),
        b = r(a + 1, 3 * d);
      figure = {
        kind: "rational-line",
        denominator: d,
        maxWhole: 3,
        points: [
          { numerator: a, label: "A" },
          { numerator: b, label: "B" },
        ],
        unit: "meters",
      };
      prompt = `How many meters separate $A$ and $B$? Each meter has ${d} equal steps.`;
      label = "Distance in meters";
      answer = fraction(b - a, d);
      hint = `Count the steps between $A$ and $B$ on the line, not from 0. Each meter has ${d} steps, so write that count over ${d}.`;
      explanation = [
        `Each meter is split into ${d} equal steps, so one step is 1/${d} meter.`,
        `$A$ is ${count(a, "step")} from 0, at ${a}/${d}. $B$ is ${count(b, "step")} from 0, at ${b}/${d}.`,
        `The distance between them is the steps from $A$ to $B$: ${b} − ${a} = ${b - a}.`,
        `${b - a} steps of 1/${d} meter make ${simplified(b - a, d)} ${unitAfter(answer, "meter")}.`,
        `$A$ and $B$ are ${answer} ${unitAfter(answer, "meter")} apart.`,
      ];
      break;
    }
    case "whole-times-fraction": {
      const n = r(1, d - 1),
        groups = r(2, 5);
      prompt = `Each of ${groups} containers holds ${n}/${d} liter. How many liters do they hold altogether?`;
      label = "Total liters";
      answer = fraction(groups * n, d);
      figure = {
        kind: "fraction-strips",
        parts: d,
        wholes: 1,
        unit: "one liter",
        rows: [{ selected: n, label: "one container" }],
      };
      hint = `${groups} containers of ${n}/${d} liter is ${groups} groups of ${n} pieces, each piece 1/${d} liter. Count all the pieces.`;
      explanation = [
        `Each container holds ${n}/${d} liter: ${count(n, "piece")} of size 1/${d} liter.`,
        `${groups} containers make ${groups} equal groups of ${n} pieces, so multiply: ${groups} × ${n} = ${groups * n} pieces.`,
        `${groups * n} pieces of 1/${d} liter make ${simplified(groups * n, d)} ${unitAfter(answer, "liter")}.`,
        `Altogether the containers hold ${answer} ${unitAfter(answer, "liter")}.`,
      ];
      break;
    }
    case "whole-sharing-fraction": {
      const total = r(1, 3),
        people = r(2, 6);
      prompt = `Share ${total} liters equally among ${people} people. How many liters does each person receive?`;
      label = "Liters per person";
      answer = fraction(total, people);
      hint = `Split each of the ${total} liters into ${people} equal parts. Each person gets one part from every liter.`;
      explanation = [
        `Sharing equally means dividing: ${total} ÷ ${people}.`,
        `Cut each liter into ${people} equal parts. Each part is 1/${people} liter.`,
        `Each person takes one part from every liter, so each gets ${count(total, "part")} of 1/${people} liter: ${simplified(total, people)}.`,
        `Check: ${people} people × ${total}/${people} liter = ${total} ${unitAfter(`${total}`, "liter")}, all of the water.`,
        `Each person receives ${answer} ${unitAfter(answer, "liter")}.`,
      ];
      break;
    }
    case "unit-fraction-share":
    case "fraction-share-amount": {
      const n = templateId === "unit-fraction-share" ? 1 : r(2, d),
        people = r(2, 5);
      prompt = `Share ${n}/${d} liter equally among ${people} people. How many liters does each person receive?`;
      label = "Liters per person";
      answer = fraction(n, d * people);
      figure = strips(d, n, "one liter", 1);
      hint =
        n === 1
          ? `Cut the 1/${d} liter into ${people} equal parts. How big is one part, compared with a whole liter?`
          : n % people === 0
            ? `${n}/${d} liter is ${n} equal pieces. Share the ${n} pieces among ${people} people, then name one person's part.`
            : `${n}/${d} liter is ${n} pieces of 1/${d} liter, which do not share evenly among ${people}. Cut every piece into ${people} parts first.`;
      explanation = [
        `Sharing equally among ${people} people means dividing by ${people}.`,
        n % people === 0
          ? `${n}/${d} liter is ${n} pieces of 1/${d} liter. ${n} ÷ ${people} = ${n / people}, so each person gets ${count(n / people, "piece")}.`
          : `Cut each 1/${d}-liter piece into ${people} equal parts. Each new part is 1/${d * people} liter, because a liter now holds ${d} × ${people} = ${d * people} of them.`,
        n % people === 0
          ? `${count(n / people, "piece")} of 1/${d} liter is ${simplified(n / people, d)} ${unitAfter(answer, "liter")}.`
          : n === 1
            ? `Each person gets one of those parts, so 1/${d} ÷ ${people} = 1/${d * people}.`
            : `Each person takes one part from each of the ${n} pieces, so ${n}/${d} ÷ ${people} = ${simplified(n, d * people)}.`,
        `Each person receives ${answer} ${unitAfter(answer, "liter")}.`,
      ];
      break;
    }
    case "whole-unit-groups": {
      const total = r(1, 3);
      prompt = `How many 1/${d}-liter containers can be filled from ${total} liters?`;
      kind = "number";
      label = "Number of containers";
      answer = `${total * d}`;
      figure = strips(d, total * d, "one liter", total);
      hint = `One liter fills ${d} containers of 1/${d} liter. How many do ${total} liters fill?`;
      explanation = [
        `Each container holds 1/${d} liter, so ${d} containers fill exactly one liter.`,
        `Every liter fills ${d} containers, so ${total === 1 ? "1 liter fills" : `${total} liters fill`} ${total} × ${d} = ${total * d} containers.`,
        `${total * d} containers can be filled.`,
      ];
      break;
    }
    case "fraction-group-count": {
      const divisor = r(2, d),
        total = r(1, 3 * d);
      prompt = `A container holds ${divisor}/${d} liter. How many containerfuls are in ${total}/${d} liters? Count a partial containerful as a fraction.`;
      label = "Containerfuls, including a partial one";
      answer = fraction(total, divisor);
      figure = {
        kind: "fraction-strips",
        parts: d,
        wholes: Math.ceil(total / d),
        unit: "one liter",
        rows: [
          { selected: total, label: "total water" },
          { selected: divisor, label: "one container" },
        ],
      };
      hint = `Both amounts count pieces of 1/${d} liter: the water is ${total} pieces and one container holds ${divisor}. How many groups of ${divisor} are in ${total}, counting a part group as a fraction?`;
      explanation = [
        `Both amounts count pieces of size 1/${d} liter, so compare the piece counts.`,
        `The water is ${count(total, "piece")}, and one container holds ${count(divisor, "piece")}.`,
        `How many groups of ${divisor} fit in ${total}? Divide: ${total} ÷ ${divisor} = ${simplified(total, divisor)}.`,
        `A part of a group counts as a fraction of a containerful. The answer counts containers, not liters.`,
        `The water fills ${answer} ${unitAfter(answer, "containerful")}.`,
      ];
      break;
    }
    case "fraction-of-quantity": {
      const n = r(1, d - 1),
        total = r(2, 9);
      prompt = `A jug holds ${total} liters. You use ${n}/${d} of its water. How many liters do you use?`;
      label = "Liters used";
      answer = fraction(n * total, d);
      hint = `Split the ${total} liters into ${d} equal shares, then take ${n} of those shares.`;
      explanation = [
        `${n}/${d} of the water means: split it into ${d} equal shares and take ${n} of them.`,
        `One share is ${total} ÷ ${d} = ${simplified(total, d)} ${unitAfter(fraction(total, d), "liter")}.`,
        ...(n === 1
          ? []
          : [
              `Take ${n} shares: ${n} × ${total}/${d} = ${simplified(n * total, d)} ${unitAfter(answer, "liter")}.`,
            ]),
        `You use ${answer} ${unitAfter(answer, "liter")} of water.`,
      ];
      break;
    }
    default:
      throw new Error(`Unsupported fraction template: ${templateId}`);
  }
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      prompt,
      skillId: template.skillId,
      response: { kind, label },
      ...(figure ? { figure } : {}),
    },
    answer,
    hint,
    explanation,
  };
}
