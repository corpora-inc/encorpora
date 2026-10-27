import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  numberSurface,
} from "./chain-kit";

export const expandedToStandardTemplate: TemplateMetadata = {
  id: "expanded-sum-to-standard",
  version: 1,
  title: "Write the number from its expanded form",
  skillId: "decimal-place-value",
  gradeBand: "3–5",
  difficultyOffset: 0.1,
  description:
    "Write the standard form of a whole number or decimal given as a sum of digit-times-place-value products, with a zero in any place that has no product.",
};
export const standardToExpandedTemplate: TemplateMetadata = {
  id: "standard-to-expanded-choice",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Choose the expanded form of a number",
  skillId: "decimal-place-value",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Choose the expanded form of a whole number or decimal given in standard form or in words, against sums that move a digit to another place or leave out a zero place.",
};

type R = (lo: number, hi: number) => number;
const places = [
  { value: 10000, tex: "10{,}000", word: "ten thousands" },
  { value: 1000, tex: "1{,}000", word: "thousands" },
  { value: 100, tex: "100", word: "hundreds" },
  { value: 10, tex: "10", word: "tens" },
  { value: 1, tex: "1", word: "ones" },
  { value: 0.1, tex: "0.1", word: "tenths" },
  { value: 0.01, tex: "0.01", word: "hundredths" },
  { value: 0.001, tex: "0.001", word: "thousandths" },
] as const;
/** Digits for places[from..to], never all zero, with at least one zero inside. */
function digitsFor(r: R, from: number, to: number): number[] {
  const out = Array.from({ length: to - from + 1 }, () => r(0, 9));
  out[0] = r(1, 9);
  out[out.length - 1] = r(1, 9);
  return out;
}
const digitsToNumber = (ds: number[], from: number) =>
  // Exact: sum digits as integers over the smallest place.
  ds.reduce(
    (s, d, i) => s + d * Math.round(places[from + i]!.value * 1000),
    0,
  ) / 1000;
const standardText = (ds: number[], from: number) => {
  const whole = ds.slice(0, Math.max(0, 5 - from)).join("");
  const frac = ds.slice(Math.max(0, 5 - from)).join("");
  return frac ? `${whole}.${frac}` : whole;
};
const sumText = (ds: number[], from: number) =>
  ds
    .map((d, i) => [d, places[from + i]!] as const)
    .filter(([d]) => d !== 0)
    .map(([d, p]) => `${d}\\times ${p.tex}`)
    .join("+");
const commaTex = (text: string) =>
  text.replace(/^(\d+)/, (_, w: string) =>
    w.replace(/\B(?=(\d{3})+(?!\d))/g, "{,}"),
  );
const commaPlain = (text: string) =>
  text.replace(/^(\d+)/, (_, w: string) =>
    w.replace(/\B(?=(\d{3})+(?!\d))/g, ","),
  );

/* --------------------------------------------------- expanded to standard */
const toStandardAxes = {
  kind: defineAxis("kind", ["whole", "decimal"] as const),
};
interface ToStandardModel {
  kind: "whole" | "decimal";
  from: number;
  to: number;
  digits: number[];
}
export const expandedToStandard = chainFamily({
  template: expandedToStandardTemplate,
  axes: toStandardAxes,
  model: (r: R, a): ToStandardModel => {
    const from = a.kind === "whole" ? r(0, 1) : 1;
    const to = a.kind === "whole" ? 4 : r(5, 7);
    const digits = digitsFor(r, from, to);
    if (!digits.includes(0)) throw new Error("Need three retries");
    return { kind: a.kind, from, to, digits };
  },
  variant: (m) => m.kind,
  render: (m) => {
    const sum = `$${sumText(m.digits, m.from)}$`;
    const answer = standardText(m.digits, m.from);
    const zeros = m.digits
      .map((d, i) => [d, places[m.from + i]!.word] as const)
      .filter(([d]) => d === 0)
      .map(([, w]) => w);
    const first = m.digits.findIndex((d) => d !== 0);
    const last = m.digits.length - 1;
    const firstPlace = places[m.from + first]!;
    return numberSurface({
      prompt: `Write this number in standard form: ${sum}`,
      answer: String(digitsToNumber(m.digits, m.from)),
      hint: `Each product is a digit times its place value. The first product, $${m.digits[first]}\\times ${firstPlace.tex}$, puts the digit ${m.digits[first]} in the ${firstPlace.word} place. The last product, $${m.digits[last]}\\times ${places[m.from + last]!.tex}$, puts the digit ${m.digits[last]} in the ${places[m.from + last]!.word} place. Find each product's place and write a 0 in any place that has no product.`,
      explanation: [
        `Each product puts its digit in the place of its place value: ${m.digits
          .map((d, i) => [d, places[m.from + i]!] as const)
          .filter(([d]) => d !== 0)
          .map(([d, p]) => `${d} in the ${p.word} place`)
          .join(", ")}.`,
        zeros.length
          ? zeros.length === 1
            ? `There is no product for the ${zeros[0]} place, so it holds a 0.`
            : `There is no product for the ${zeros.join(" or the ")} places, so each holds a 0.`
          : "Every place has a product.",
        `The standard form is ${commaPlain(answer)}.`,
      ],
      label: "Answer (standard form)",
    });
  },
});

/* ---------------------------------------------------- standard to expanded */
const ones = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const tens = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];
const below100 = (n: number) =>
  n < 20
    ? ones[n]!
    : `${tens[Math.floor(n / 10)]}${n % 10 ? `-${ones[n % 10]}` : ""}`;
const below1000 = (n: number) =>
  n >= 100
    ? `${ones[Math.floor(n / 100)]} hundred${n % 100 ? ` ${below100(n % 100)}` : ""}`
    : below100(n);
const words = (n: number) =>
  n >= 1000
    ? `${below1000(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${below1000(n % 1000)}` : ""}`
    : below1000(n);
const toExpandedAxes = {
  given: defineAxis("given", ["standard", "words"] as const),
};
interface ToExpandedModel {
  given: "standard" | "words";
  from: number;
  to: number;
  digits: number[];
  options: { digits: number[]; from: number; slip: string }[];
}
export const standardToExpanded = chainFamily({
  template: standardToExpandedTemplate,
  axes: toExpandedAxes,
  model: (r: R, a): ToExpandedModel => {
    const from = 1; // thousands to the smallest place
    const to = r(5, 7);
    const digits = digitsFor(r, from, to);
    // A zero in the middle, with a nonzero digit just before it, so a digit
    // can be moved one place into the zero.
    const z = r(1, digits.length - 2);
    digits[z] = 0;
    if (digits[z - 1] === 0) digits[z - 1] = r(1, 9);
    const nz = digits.map((d, i) => [d, i] as const).filter(([d]) => d);
    if (nz.length < 3) throw new Error("Need three retries");
    // Slip 1: the digit before the zero moves one place to the right.
    const shifted = digits.slice();
    shifted[z] = shifted[z - 1]!;
    shifted[z - 1] = 0;
    // Slip 2: two digits swap places.
    const swapped = digits.slice();
    const i0 = nz[0]![1];
    const i1 = nz[nz.length - 1]![1];
    [swapped[i0], swapped[i1]] = [swapped[i1]!, swapped[i0]!];
    // Slip 3: the whole number is written one place higher (a zero place is left out).
    const noZero = digits.filter((d) => d !== 0);
    const options = [
      { digits, from, slip: "correct" },
      { digits: shifted, from, slip: "A digit is in the wrong place." },
      { digits: swapped, from, slip: "Two digits have swapped places." },
      {
        digits: noZero,
        from,
        slip: "A zero place was left out, so the later digits sit in the wrong places.",
      },
    ];
    const keys = new Set(options.map((o) => sumText(o.digits, o.from)));
    if (keys.size !== 4) throw new Error("Need three retries");
    return { given: a.given, from, to, digits, options };
  },
  variant: (m) => m.given,
  render: (m, _a, r) => {
    const standard = commaPlain(standardText(m.digits, m.from));
    const fracDigits = m.digits.slice(5 - m.from);
    const wholeValue = Number(standardText(m.digits, m.from).split(".")[0]!);
    const fracWord = fracDigits.length
      ? ` and ${below1000(Number(fracDigits.join("")))} ${places[5 + fracDigits.length - 1 + 0]!.word}`
      : "";
    const given =
      m.given === "standard"
        ? `$${commaTex(standardText(m.digits, m.from))}$`
        : `${words(wholeValue)}${fracWord}`;
    const label = (o: ToExpandedModel["options"][number]) =>
      `$${sumText(o.digits, o.from)}$`;
    const correct = m.options[0]!;
    const wrongPlaces = (o: ToExpandedModel["options"][number]) => {
      const nz = o.digits.map((d, i) => [d, i] as const).filter(([d]) => d);
      return nz
        .map(([d, i]) => `${d} in the ${places[o.from + i]!.word} place`)
        .join(", ");
    };
    const surface = choiceSurface(r, {
      prompt: `Which expanded form is equal to ${m.given === "standard" ? given : `the number ${given}`}?`,
      options: m.options.map((o, i) =>
        i === 0
          ? { label: label(o), correct: true as const }
          : {
              label: label(o),
              feedback: `${o.slip} This sum has ${wrongPlaces(o)}, but ${standard} has ${wrongPlaces(correct)}.`,
            },
      ),
      hint:
        m.given === "standard"
          ? `Read ${standard} one digit at a time and name each digit's place. The first digit, ${m.digits[0]}, is in the ${places[m.from]!.word} place.`
          : `Write the number in standard form first, then name the place of each digit. ${words(wholeValue).split(" ")[0]} is the thousands part, and a zero holds any place that is not said.`,
      explanation: [
        `Name the place of each digit of ${standard}: ${wrongPlaces(correct)}.`,
        `Each digit is multiplied by the value of its place, and the products are added; a 0 digit needs no product.`,
        `The expanded form is ${label(correct)}.`,
      ],
    });
    return surface;
  },
});

export const expandedFormTemplates = [
  expandedToStandardTemplate,
  standardToExpandedTemplate,
] as const;
export const expandedFormGenerate = dispatch(expandedFormTemplates, {
  "expanded-sum-to-standard": (seed) =>
    expandedToStandard.generate(seed).problem,
  "standard-to-expanded-choice": (seed) =>
    standardToExpanded.generate(seed).problem,
});
