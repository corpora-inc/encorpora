import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";

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
      hint = "The denominator counts the equal pieces in one whole.";
      explanation = [
        `${d} equal pieces make the whole.`,
        `One piece is 1/${d} of that whole.`,
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
      hint =
        "Count shaded pieces; crossing a whole boundary does not change their size.";
      explanation = [
        `Each small piece represents 1/${d} of a whole.`,
        `There are ${n} shaded pieces, so the shaded amount is ${n}/${d}.`,
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
      prompt = `What number is at P? Each whole interval has ${d} equal steps.`;
      answer = fraction(n, d);
      hint = "Count equal intervals from zero, including those beyond one.";
      explanation = [
        `P lies ${n} steps from zero; each step is 1/${d}.`,
        `Its position is ${n}/${d} = ${answer}.`,
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
        `${w} wholes contain ${w} × ${d} = ${w * d} pieces.`,
        `So ${w} = ${w * d}/${d}.`,
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
      hint = "Find how many new pieces replace each old piece.";
      explanation = [
        `Each 1/${b} piece is split into ${k} smaller pieces.`,
        `Both counts multiply by ${k}: ${a}/${b} = ${a * k}/${b * k}.`,
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
      hint = "The same grouping factor must change both counts.";
      explanation = [
        `The numerator changes from ${a * k} to ${a} by division by ${k}.`,
        `Divide the denominator by ${k} too: ${b * k} ÷ ${k} = ${b}.`,
      ];
      break;
    }
    case "like-fraction-missing-part": {
      const total = r(2, 2 * d),
        part = r(1, total - 1);
      prompt = `${part}/${d} + ? = ${total}/${d}. What fraction is missing?`;
      answer = fraction(total - part, d);
      hint = "All pieces have the same size; find how many more are needed.";
      explanation = [
        `The total needs ${total} pieces and ${part} are present.`,
        `${total} − ${part} = ${total - part}, so the missing amount is ${total - part}/${d} = ${answer}.`,
      ];
      break;
    }
    case "like-fraction-difference": {
      const a = r(1, 2 * d),
        b = r(1, a);
      prompt = `A cord is ${a}/${d} meter long. You remove ${b}/${d} meter. How many meters remain?`;
      label = "Meters remaining";
      answer = fraction(a - b, d);
      hint = "Subtract the counts of equal meter-parts.";
      explanation = [
        `Both lengths use pieces of size 1/${d} meter.`,
        `${a}/${d} − ${b}/${d} = ${a - b}/${d} = ${answer} meter(s).`,
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
      hint =
        "Count the fractional units inside the wholes, then include the extra pieces.";
      explanation = [
        `${w} wholes contain ${w * d} pieces of size 1/${d}.`,
        `Add ${n} more pieces: ${w * d}+${n}=${w * d + n}. Thus ${w} ${n}/${d} = ${w * d + n}/${d}.`,
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
      hint = `Group ${d} equal pieces into each whole.`;
      explanation = [
        `${total} pieces form ${w} complete groups of ${d}, with ${n} pieces left.`,
        `${total}/${d} = ${w} + ${n}/${d}. The requested answer is ${answer}.`,
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
      hint =
        "Rename one whole as fractional units before subtracting the fractional parts.";
      explanation = [
        `${whole} ${a}/${d} = ${whole - 1} + ${d + a}/${d}.`,
        `${whole - 1} + ${d + a}/${d} − (${other} + ${b}/${d}) = ${whole - 1 - other} + ${d + a - b}/${d} = ${answer}.`,
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
      hint = "Rename both fractions in equal-sized units before subtracting.";
      explanation = [
        `A shared denominator is ${left[1]! * right[1]!}.`,
        `The difference is (${left[0]! * right[1]!} − ${right[0]! * left[1]!})/${left[1]! * right[1]!} = ${answer}.`,
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
      prompt = `How many meters separate A and B? Each meter has ${d} equal steps.`;
      label = "Distance in meters";
      answer = fraction(b - a, d);
      hint =
        "Count the intervals between the markers, not their distances added together.";
      explanation = [
        `A is at ${a}/${d} meter(s); B is at ${b}/${d} meter(s).`,
        `Their distance is (${b} − ${a})/${d} = ${answer} meter(s).`,
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
      hint = "Count the same fractional-liter amount once for each container.";
      explanation = [
        `There are ${groups} groups of ${n} pieces of size 1/${d} liter.`,
        `${groups} × ${n}/${d} = ${groups * n}/${d} = ${answer} liter(s).`,
      ];
      break;
    }
    case "whole-sharing-fraction": {
      const total = r(1, 3),
        people = r(2, 6);
      prompt = `Share ${total} liters equally among ${people} people. How many liters does each person receive?`;
      label = "Liters per person";
      answer = fraction(total, people);
      hint =
        "Divide each liter equally among the people, then combine one person’s shares.";
      explanation = [
        `Each person receives 1/${people} liter from each of the ${total} liters.`,
        `Each share is ${total}/${people} = ${answer} liter(s). Multiplying by ${people} recovers ${total} liters.`,
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
        "Sharing among people makes each person’s amount smaller than the total.";
      explanation = [
        `Divide the total amount by the ${people} equal shares.`,
        `${n}/${d} ÷ ${people} = ${n}/${d * people} = ${answer} liter(s) per person.`,
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
      hint =
        "Each liter fills several small containers; count the fractional-liter units.";
      explanation = [
        `One liter contains ${d} units of size 1/${d} liter.`,
        `${total} liters contains ${total * d} such units, so ${total * d} containers can be filled.`,
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
      hint =
        "Both amounts use the same small unit. Compare the total unit-count with the count in one container.";
      explanation = [
        `The total has ${total} pieces of size 1/${d} liter; one container holds ${divisor} such pieces.`,
        `${total} ÷ ${divisor} = ${answer} containerful(s). This answer counts containers, not liters.`,
      ];
      break;
    }
    case "fraction-of-quantity": {
      const n = r(1, d - 1),
        total = r(2, 9);
      prompt = `A jug holds ${total} liters. You use ${n}/${d} of its water. How many liters do you use?`;
      label = "Liters used";
      answer = fraction(n * total, d);
      hint =
        "Split the entire water amount into denominator-many shares, then take numerator-many shares.";
      explanation = [
        `One of ${d} equal shares is ${total}/${d} liter(s).`,
        `${n} shares contain ${n} × ${total}/${d} = ${n * total}/${d} = ${answer} liter(s).`,
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
