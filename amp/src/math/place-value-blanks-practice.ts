import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  defineGenerate,
  entry,
  grouped,
  inlineSentence,
  multiPartCapability,
  multiPartProblem,
  need,
  pick,
  plain,
  shuffle,
  type Random,
  type Slot,
} from "./multi-part-support";

/** Place value and rounding, answered by choosing the value for each blank,
 * slot or sentence gap (multi-part-choice-v1): the place name of every digit,
 * several roundings of one number, the parts of an expanded sum, and a symbol
 * for each comparison. */
export const placeValueBlanksTemplates: readonly TemplateMetadata[] = [
  {
    id: "digit-place-names",
    version: 1,
    title: "Name the place of every digit",
    skillId: "large-place-value",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Name the place (ones through hundred thousands) of each digit of a five- or six-digit number with all different digits, choosing one place for every digit.",
  },
  {
    id: "round-place-blanks",
    version: 1,
    title: "Round one number three ways",
    skillId: "round-whole-numbers",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Round one four-digit number to the nearest thousand, hundred and ten, as slots or as a sentence with three gaps; distractors are truncating, rounding the other way and rounding to a neighboring place.",
  },
  {
    id: "round-decimal-blanks",
    version: 1,
    title: "Round a decimal to two places",
    skillId: "decimal-place-value",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Round a decimal with thousandths to the nearest tenth and to the nearest hundredth by choosing the number for each gap, including values where a nine carries into the next place.",
  },
  {
    id: "round-addends-sum",
    version: 1,
    title: "Round each addend, then add",
    skillId: "round-whole-numbers",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Round two addends to the nearest ten or hundred and choose the two rounded values and the estimated sum, with the sum of the unrounded numbers as a distractor.",
  },
  {
    id: "expanded-whole-slots",
    version: 1,
    title: "Build a number from its place values",
    skillId: "large-place-value",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Write a five-digit number as a sum by choosing the value of each nonzero digit, either as the value itself or as the digit times its place; distractors put the digit in the wrong place.",
  },
  {
    id: "expanded-decimal-slots",
    version: 1,
    title: "Build a decimal from its place values",
    skillId: "decimal-place-value",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Write a decimal with thousands, ones and tenths or hundredths as a sum by choosing the value of each nonzero digit, as the value or as the digit times its place.",
  },
  {
    id: "compare-symbol-blanks",
    version: 1,
    title: "Choose the symbol for two comparisons",
    skillId: "large-place-value",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "Choose less than, equal to or greater than for two comparisons of whole numbers, one of them an equal pair written two ways, with a larger number that has smaller trailing digits.",
  },
  {
    id: "digit-value-blanks",
    version: 1,
    title: "Compare two places of the same digit",
    skillId: "powers-of-ten",
    gradeBand: "3–5",
    ...multiPartCapability,
    description:
      "In a six-digit number with the same digit in two places, complete a sentence by choosing the place of the greater digit and how many times as great its value is than the value of the other digit.",
  },
];

const PLACES = [
  "ones",
  "tens",
  "hundreds",
  "thousands",
  "ten thousands",
  "hundred thousands",
] as const;
const VALUE_OF = [1, 10, 100, 1000, 10000, 100000];
const digitsOf = (n: number) => String(n).split("").map(Number);
/** The thousands separator in TeX: 40{,}382. */
const texGrouped = (n: number) => grouped(n).replaceAll(",", "{,}");
const textGrouped = (n: number) => grouped(n);
const roundTo = (n: number, unit: number) => Math.round(n / unit) * unit;
const rightOf = (n: number, unit: number) =>
  Math.floor((n % unit) / (unit / 10));

/* ---------- the place of each digit ---------- */
export const digitPlaceAxes = {
  length: defineAxis("length", ["five-digit", "six-digit"] as const),
} as const;

/* ---------- rounding one number three ways ---------- */
export const roundPlaceAxes = {
  surface: defineAxis("surface", ["slots", "sentence"] as const),
  halfway: defineAxis("halfway", ["any-digit", "digit-five"] as const),
} as const;
const UNIT_NAMES = new Map<number, string>([
  [1000, "thousand"],
  [100, "hundred"],
  [10, "ten"],
]);

/* ---------- rounding a decimal ---------- */
export const roundDecimalAxes = {
  whole: defineAxis("whole", ["one-digit", "two-digit"] as const),
  carry: defineAxis("carry", ["plain", "carry"] as const),
} as const;

/* ---------- rounding addends ---------- */
export const roundAddendsAxes = {
  unit: defineAxis("unit", ["ten", "hundred"] as const),
} as const;

/* ---------- expanded sums ---------- */
export const expandedAxes = {
  "term-form": defineAxis("term-form", ["value", "digit-times-place"] as const),
  zeros: defineAxis("zeros", ["no-zero", "has-zero"] as const),
} as const;
const timesTex = (digit: number, value: number) =>
  `$${digit}\\times ${texGrouped(value / digit)}$`;

/* ---------- comparison symbols ---------- */
export const compareSymbolAxes = {
  "equal-pair": defineAxis("equal-pair", ["first", "second"] as const),
  sizes: defineAxis("sizes", [
    "three-and-four-digit",
    "four-and-five-digit",
  ] as const),
} as const;
const SYMBOLS = ["$<$", "$=$", "$>$"] as const;
const symbolFor = (a: number, b: number) =>
  a < b ? SYMBOLS[0] : a === b ? SYMBOLS[1] : SYMBOLS[2];

/* ---------- value of a digit in two places ---------- */
export const digitValueAxes = {
  gap: defineAxis("gap", [
    "two-places",
    "three-places",
    "four-places",
  ] as const),
} as const;
const GAP = { "two-places": 2, "three-places": 3, "four-places": 4 } as const;

function pickDistinctDigits(r: Random, count: number, leadingNonzero = true) {
  const pool = shuffle(r, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const digits = pool.slice(0, count);
  if (leadingNonzero && digits[0] === 0) {
    const swap = digits.findIndex((d) => d !== 0);
    [digits[0], digits[swap]] = [digits[swap]!, digits[0]!];
  }
  return digits;
}

export const placeValueBlanksGenerate = defineGenerate(
  placeValueBlanksTemplates,
  {
    "digit-place-names": entry(digitPlaceAxes, ({ meta, seed, r, axes }) => {
      const count = axes.length === "six-digit" ? 6 : 5;
      const digits = pickDistinctDigits(r, count);
      const n = Number(digits.join(""));
      const bank = [...PLACES.slice(0, count)].reverse();
      const slots: Slot[] = digits.map((d, i) => ({
        id: `d${i + 1}`,
        label: `The place of the digit ${d}`,
        correct: bank[i]!,
        fixed: bank,
      }));
      return multiPartProblem(meta, seed, r, {
        prompt: `Every digit of ${textGrouped(n)} is different. Choose the place of each digit.`,
        layout: "slots",
        label: "Choose the place of each digit",
        slots,
        hint: `Start at the rightmost digit, ${digits.at(-1)}, and move left one place at a time, saying the place names in order. Then find where the digit ${digits[0]} sits.`,
        explanation: [
          `Count places from the right: ${[...bank].reverse().join(", ")}.`,
          ...digits.map(
            (d, i) =>
              `The digit ${d} of ${textGrouped(n)} is in the ${bank[i]} place, so it stands for ${grouped(d * VALUE_OF[count - 1 - i]!)}.`,
          ),
        ],
      });
    }),

    "round-place-blanks": entry(roundPlaceAxes, ({ meta, seed, r, axes }) => {
      const n = r(1100, 9899);
      need(n % 10 !== 0, "a number that is not a multiple of ten");
      if (axes.halfway === "digit-five")
        need(
          [
            n % 10,
            Math.floor((n % 100) / 10),
            Math.floor((n % 1000) / 100),
          ].includes(5),
          "a digit five",
        );
      const units = [1000, 100, 10] as const;
      const makeSlot = (unit: (typeof units)[number]): Slot => {
        const correct = roundTo(n, unit);
        const down = Math.floor(n / unit) * unit;
        const up = down + unit;
        const larger = unit * 10;
        return {
          id: `u${unit}`,
          label: `The number rounded to the nearest ${UNIT_NAMES.get(unit)}`,
          correct: grouped(correct),
          wrong: [
            down,
            up,
            roundTo(n, larger),
            roundTo(n, unit / 10 || 1),
            n,
          ].map(grouped),
        };
      };
      const slots = units.map(makeSlot);
      const text = textGrouped(n);
      let layout: "slots" | "inline" = "slots";
      let sentence;
      let finalSlots = slots;
      if (axes.surface === "sentence") {
        layout = "inline";
        const built = inlineSentence([
          `Rounded to the nearest thousand, ${text} is `,
          slots[0]!,
          "; to the nearest hundred it is ",
          slots[1]!,
          "; and to the nearest ten it is ",
          slots[2]!,
          ".",
        ]);
        sentence = built.sentence;
        finalSlots = built.slots;
      }
      const why = units.map((unit) => {
        const digit = rightOf(n, unit);
        return `To the nearest ${UNIT_NAMES.get(unit)}, look at the digit to the right of that place, ${digit}: it is ${digit >= 5 ? "5 or more, so round up" : "less than 5, so round down"}, giving ${grouped(roundTo(n, unit))}.`;
      });
      return multiPartProblem(meta, seed, r, {
        prompt:
          axes.surface === "slots"
            ? `Round ${text} three ways. Choose each rounded number.`
            : "Complete the sentence about the rounded values of one number.",
        layout,
        label: "Choose the rounded numbers",
        slots: finalSlots,
        ...(sentence ? { sentence } : {}),
        hint: `For ${text}, find the digit that is one place to the right of the rounding place. A digit of 5 or more rounds up; a digit under 5 rounds down. Do this three times, once for each place.`,
        explanation: why,
      });
    }),

    "round-decimal-blanks": entry(
      roundDecimalAxes,
      ({ meta, seed, r, axes }) => {
        const whole = axes.whole === "two-digit" ? r(10, 49) : r(1, 9);
        let thousandths: number;
        if (axes.carry === "carry") {
          // A 9 in the tenths place carries into the ones when the tenth
          // rounds up; a 9 in the hundredths place carries into the tenths.
          thousandths = pick(r, [
            900 + r(5, 8) * 10 + r(1, 9),
            r(1, 8) * 100 + 90 + r(1, 4),
          ]);
        } else thousandths = r(101, 999);
        need(
          thousandths % 10 !== 0 && thousandths < 1000,
          "a thousandths digit",
        );
        const v = whole * 1000 + thousandths;
        const text = plain(v / 1000);
        const hundredth = Math.round(v / 10) / 100;
        const tenth = Math.round(v / 100) / 10;
        const tenthTruncated = Math.floor(v / 100) / 10;
        const hundredthTruncated = Math.floor(v / 10) / 100;
        need(tenth !== hundredth, "different roundings");
        const built = inlineSentence([
          `Rounded to the nearest tenth, ${text} is `,
          {
            id: "tenth",
            label: "The number rounded to the nearest tenth",
            correct: plain(tenth),
            wrong: [
              tenthTruncated,
              Math.floor(v / 100) / 10 + 0.1,
              hundredth,
              hundredthTruncated,
              Math.round(v / 1000),
            ].map(plain),
          },
          ". Rounded to the nearest hundredth, it is ",
          {
            id: "hundth",
            label: "The number rounded to the nearest hundredth",
            correct: plain(hundredth),
            wrong: [
              hundredthTruncated,
              hundredthTruncated + 0.01,
              tenth,
              tenthTruncated,
              v / 1000,
            ].map(plain),
          },
          ".",
        ]);
        const tenthsDigit = Math.floor((v % 1000) / 100);
        const hundredthsDigit = Math.floor((v % 100) / 10);
        const thousandthsDigit = v % 10;
        return multiPartProblem(meta, seed, r, {
          prompt: `Round ${text} to two different places. Choose the number for each gap.`,
          layout: "inline",
          label: "Choose the rounded numbers",
          slots: built.slots,
          sentence: built.sentence,
          hint: `To round ${text} to the nearest tenth, look at the digit ${hundredthsDigit} in the hundredths place. For the nearest hundredth, look at the digit ${thousandthsDigit} in the thousandths place.`,
          explanation: [
            `Nearest tenth: the hundredths digit is ${hundredthsDigit}, which is ${hundredthsDigit >= 5 ? "5 or more, so the tenths digit goes up" : "less than 5, so the tenths digit stays"}. The result is ${plain(tenth)}.`,
            `Nearest hundredth: the thousandths digit is ${thousandthsDigit}, which is ${thousandthsDigit >= 5 ? "5 or more, so the hundredths digit goes up" : "less than 5, so the hundredths digit stays"}. The result is ${plain(hundredth)}.`,
            tenthsDigit === 9 && hundredthsDigit >= 5
              ? `The tenths digit 9 rounds up to 10, so write 0 in the tenths place and carry 1 to the ones place.`
              : `Each rounding starts from ${text}, not from the other rounded number.`,
          ],
        });
      },
    ),

    "round-addends-sum": entry(roundAddendsAxes, ({ meta, seed, r, axes }) => {
      const unit = axes.unit === "ten" ? 10 : 100;
      const a = axes.unit === "ten" ? r(21, 98) : r(120, 980);
      const b = axes.unit === "ten" ? r(21, 98) : r(120, 980);
      need(a % unit !== 0 && b % unit !== 0, "addends that need rounding");
      const ra = roundTo(a, unit);
      const rb = roundTo(b, unit);
      need(
        ra !== a && rb !== b && ra + rb !== a + b,
        "an estimate that differs",
      );
      const unitName = axes.unit;
      const first = (n: number, k: number) => {
        const down = Math.floor(n / unit) * unit;
        return [down, down + unit, n, roundTo(n, unit * 10)].filter(
          (x) => x !== k,
        );
      };
      const slots: Slot[] = [
        {
          id: "a",
          label: `${grouped(a)} rounded to the nearest ${unitName}`,
          correct: grouped(ra),
          wrong: first(a, ra).map(grouped),
        },
        {
          id: "b",
          label: `${grouped(b)} rounded to the nearest ${unitName}`,
          correct: grouped(rb),
          wrong: first(b, rb).map(grouped),
        },
        {
          id: "sum",
          label: "The sum of the rounded numbers",
          correct: grouped(ra + rb),
          wrong: [
            a + b,
            ra + rb + unit,
            ra + rb - unit,
            roundTo(a + b, unit * 10),
          ].map(grouped),
        },
      ];
      return multiPartProblem(meta, seed, r, {
        prompt: `Estimate ${grouped(a)} + ${grouped(b)} by rounding each addend to the nearest ${unitName}. Choose the two rounded numbers and their sum.`,
        layout: "slots",
        label: "Choose the rounded numbers and the sum",
        slots,
        hint: `Round ${grouped(a)} first: the digit one place to the right of the ${unitName}s place decides whether it goes up or down. Then round ${grouped(b)} the same way, and add the two rounded numbers.`,
        explanation: [
          `${grouped(a)} rounds to ${grouped(ra)} and ${grouped(b)} rounds to ${grouped(rb)}.`,
          `The estimate is $${grouped(ra)} + ${grouped(rb)} = ${grouped(ra + rb)}$.`,
          `The exact sum, ${grouped(a + b)}, is a different number: the question asks for the sum of the rounded addends.`,
        ],
      });
    }),

    "expanded-whole-slots": entry(expandedAxes, ({ meta, seed, r, axes }) => {
      const digits =
        axes.zeros === "has-zero"
          ? (() => {
              const d = [r(1, 9), r(0, 9), r(1, 9), r(1, 9), r(1, 9)];
              d[r(1, 3)] = 0;
              return d;
            })()
          : Array.from({ length: 5 }, () => r(1, 9));
      const n = Number(digits.join(""));
      const parts = digits
        .map((d, i) => ({ d, value: d * 10 ** (4 - i), place: 4 - i }))
        .filter((p) => p.d !== 0);
      need(parts.length >= 3, "three nonzero digits");
      const label = (p: { d: number; value: number }) =>
        axes["term-form"] === "value"
          ? grouped(p.value)
          : timesTex(p.d, p.value);
      const wrongFor = (p: { d: number; value: number; place: number }) => {
        const other = digits.filter((d) => d !== p.d && d !== 0);
        return [
          { d: p.d, value: p.value * 10 },
          { d: p.d, value: p.value / 10 },
          ...(p.place < 4 ? [{ d: p.d, value: p.value * 100 }] : []),
          ...other.slice(0, 2).map((d) => ({ d, value: d * 10 ** p.place })),
        ]
          .filter(
            (q) =>
              Number.isInteger(q.value) && q.value >= 1 && q.value / q.d >= 1,
          )
          .map(label);
      };
      const slots: Slot[] = parts.map((p, i) => ({
        id: `t${i + 1}`,
        label: `Part ${i + 1} of the sum`,
        correct: label(p),
        wrong: wrongFor(p),
      }));
      const eq = axes["term-form"] === "value" ? "+" : "+";
      const built = inlineSentence([
        `$${texGrouped(n)}=$ `,
        ...slots.flatMap((s, i) => (i ? [` $${eq}$ `, s] : [s])),
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt: `Write ${textGrouped(n)} as a sum of the values of its digits. Choose each part of the sum, from the greatest place to the least.`,
        layout: "inline",
        label: "Choose each part of the sum",
        slots: built.slots,
        sentence: built.sentence,
        hint: `The leftmost digit of ${textGrouped(n)} is ${digits[0]}. Count how many places it is from the right end to find what that digit is worth, then do the same for the next digit that is not 0.`,
        explanation: [
          `Each digit is worth the digit times its place value. ${axes.zeros === "has-zero" ? "A digit 0 adds nothing, so it has no part in the sum. " : ""}`.trim(),
          ...parts.map(
            (p) =>
              `The digit ${p.d} is in the ${PLACES[p.place]} place, so its part is $${axes["term-form"] === "value" ? texGrouped(p.value) : `${p.d}\\times ${texGrouped(p.value / p.d)} = ${texGrouped(p.value)}`}$.`,
          ),
          `The sum is $${parts.map((p) => texGrouped(p.value)).join("+")}=${texGrouped(n)}$.`,
        ],
      });
    }),

    "expanded-decimal-slots": entry(expandedAxes, ({ meta, seed, r, axes }) => {
      // thousands, hundreds, tens, ones, tenths, hundredths digits.
      const raw = [r(1, 9), r(0, 9), r(0, 9), r(1, 9), r(1, 9), r(0, 9)];
      if (axes.zeros === "has-zero") raw[r(1, 2)] = 0;
      else for (let i = 1; i < 3; i++) raw[i] = Math.max(raw[i]!, 1);
      const scale = [1000, 100, 10, 1, 0.1, 0.01];
      const parts = raw
        .map((d, i) => ({
          d,
          unit: scale[i]!,
          value: Math.round(d * scale[i]! * 100) / 100,
        }))
        .filter((p) => p.d !== 0);
      need(parts.length >= 4 && parts.length <= 6, "four to six parts");
      const whole = raw[0]! * 1000 + raw[1]! * 100 + raw[2]! * 10 + raw[3]!;
      const decimals = `${raw[4]}${raw[5] === 0 ? "" : raw[5]}`;
      const n = `${grouped(whole)}.${decimals}`;
      const unitTex = (u: number) =>
        u >= 1 ? texGrouped(u) : u === 0.1 ? "\\frac{1}{10}" : "\\frac{1}{100}";
      const label = (p: { d: number; unit: number; value: number }) =>
        axes["term-form"] === "value"
          ? plainGrouped(p.value)
          : `$${p.d}\\times ${unitTex(p.unit)}$`;
      const wrongFor = (p: { d: number; unit: number; value: number }) => {
        const near = [p.unit * 10, p.unit / 10].filter(
          (u) => u >= 0.01 && u <= 1000,
        );
        const otherDigits = raw.filter((d) => d !== p.d && d !== 0).slice(0, 2);
        return [
          ...near.map((u) => ({
            d: p.d,
            unit: u,
            value: Math.round(p.d * u * 100) / 100,
          })),
          ...otherDigits.map((d) => ({
            d,
            unit: p.unit,
            value: Math.round(d * p.unit * 100) / 100,
          })),
        ].map(label);
      };
      const slots: Slot[] = parts.map((p, i) => ({
        id: `t${i + 1}`,
        label: `Part ${i + 1} of the sum`,
        correct: label(p),
        wrong: wrongFor(p),
      }));
      const built = inlineSentence([
        `$${n.replaceAll(",", "{,}")}=$ `,
        ...slots.flatMap((s, i) => (i ? [" $+$ ", s] : [s])),
      ]);
      const names = [
        "thousands",
        "hundreds",
        "tens",
        "ones",
        "tenths",
        "hundredths",
      ];
      return multiPartProblem(meta, seed, r, {
        prompt: `Write ${n} as a sum of the values of its digits. Choose each part of the sum, from the greatest place to the least.`,
        layout: "inline",
        label: "Choose each part of the sum",
        slots: built.slots,
        sentence: built.sentence,
        hint: `In ${n}, the digit ${raw[3]} is in the ones place. Places to its left are worth 10 times as much each step, and places to its right are worth one tenth as much each step, so the digit ${raw[4]} after the decimal point is in the tenths place.`,
        explanation: [
          `A digit is worth the digit times its place value${axes.zeros === "has-zero" ? ", and a digit 0 adds nothing" : ""}.`,
          ...parts.map(
            (p) =>
              `The digit ${p.d} is in the ${names[scale.indexOf(p.unit)]} place, so its part is $${axes["term-form"] === "value" ? plainTex(p.value) : `${p.d}\\times ${unitTex(p.unit)} = ${plainTex(p.value)}`}$.`,
          ),
          `The sum is $${parts.map((p) => plainTex(p.value)).join("+")}=${n.replaceAll(",", "{,}")}$.`,
        ],
      });
    }),

    "compare-symbol-blanks": entry(
      compareSymbolAxes,
      ({ meta, seed, r, axes }) => {
        const [small, big] =
          axes.sizes === "three-and-four-digit" ? [3, 4] : [4, 5];
        const make = (digits: number, equal: boolean) => {
          const base = r(10 ** (digits - 1) + 1, 10 ** digits - 1);
          need(
            base % 10 !== 0 && String(base).length === digits,
            "a base number",
          );
          if (equal) {
            // The same value written as standard form and as an expanded sum.
            const parts = String(base)
              .split("")
              .map((d, i) => Number(d) * 10 ** (digits - 1 - i))
              .filter((v) => v !== 0);
            return {
              left: textGrouped(base),
              right: parts.map(textGrouped).join(" + "),
              a: base,
              b: base,
              expanded: true,
            };
          }
          // Differ at the first place, with trailing digits that mislead.
          const position = r(0, 1);
          const digitsList = String(base).split("").map(Number);
          const other = [...digitsList];
          const d = other[position]!;
          other[position] = d === 9 ? 8 : d + 1;
          other[digits - 1] = Math.max(0, Math.min(9, 9 - other[digits - 1]!));
          const b = Number(other.join(""));
          need(b !== base && String(b).length === digits, "a different number");
          return {
            left: textGrouped(base),
            right: textGrouped(b),
            a: base,
            b,
            expanded: false,
          };
        };
        const sizes = [small, big];
        const equalAt = axes["equal-pair"] === "first" ? 0 : 1;
        const rows = sizes.map((d, i) => make(d, i === equalAt));
        const slots: Slot[] = rows.map((row, i) => ({
          id: `c${i + 1}`,
          label: `The symbol for the ${i ? "second" : "first"} comparison`,
          correct: symbolFor(row.a, row.b),
          fixed: SYMBOLS,
        }));
        const built = inlineSentence([
          `First comparison: $${rows[0]!.left.replaceAll(",", "{,}")}$ `,
          slots[0]!,
          ` $${rows[0]!.right.replaceAll(",", "{,}").replaceAll(" + ", "+")}$.  Second comparison: $${rows[1]!.left.replaceAll(",", "{,}")}$ `,
          slots[1]!,
          ` $${rows[1]!.right.replaceAll(",", "{,}").replaceAll(" + ", "+")}$.`,
        ]);
        return multiPartProblem(meta, seed, r, {
          prompt:
            "Choose the symbol that makes each comparison true: less than, equal to or greater than.",
          layout: "inline",
          label: "Choose a symbol for each comparison",
          slots: built.slots,
          sentence: built.sentence,
          hint: `In the pair with ${rows[0]!.left}, compare the digits from the left and stop at the first place that differs. If one number is written as a sum, add its parts first.`,
          explanation: rows.map((row, i) =>
            row.expanded
              ? `Comparison ${i + 1}: ${row.right} is ${grouped(row.b)}, the same number as ${row.left}, so the symbol is equal to.`
              : `Comparison ${i + 1}: ${row.left} and ${row.right} first differ at the digit in place ${[...row.left.replaceAll(",", "")].findIndex((c, k) => c !== row.right.replaceAll(",", "")[k]) + 1} from the left, so ${row.a < row.b ? "the first is less than the second" : "the first is greater than the second"}.`,
          ),
        });
      },
    ),

    "digit-value-blanks": entry(digitValueAxes, ({ meta, seed, r, axes }) => {
      const k = GAP[axes.gap];
      const low = r(0, 5 - k);
      const high = low + k;
      const eight = 8;
      const digits = Array.from({ length: 6 }, () => r(0, 9)).map((d) =>
        d === eight ? 3 : d,
      );
      digits[0] = digits[0] === 0 ? 4 : digits[0]!;
      // digits[i] is the digit in place 5 - i (hundred thousands first).
      digits[5 - high] = eight;
      digits[5 - low] = eight;
      need(
        String(digits[0]).length === 1 && digits[0] !== 0,
        "a leading digit",
      );
      const n = Number(digits.join(""));
      const times = 10 ** k;
      const timesLabel = (t: number) => grouped(t);
      const built = inlineSentence([
        `In ${textGrouped(n)}, the 8 in the `,
        {
          id: "place",
          label: "The place of the greater 8",
          correct: PLACES[high],
          wrong: PLACES.filter((p) => p !== PLACES[high]),
        },
        " place is worth ",
        {
          id: "times",
          label: "How many times as much",
          correct: timesLabel(times),
          wrong: [times / 10, times * 10, times / 100, times * 100, 10]
            .filter((t) => t >= 2)
            .map(timesLabel),
        },
        ` times as much as the 8 in the ${PLACES[low]} place.`,
      ]);
      return multiPartProblem(meta, seed, r, {
        prompt: `The number ${textGrouped(n)} has an 8 in two places. Complete the sentence.`,
        layout: "inline",
        label: "Complete the sentence",
        slots: built.slots,
        sentence: built.sentence,
        hint: `Find both 8s in ${textGrouped(n)} and count how many places apart they are. Each step to the left multiplies the value by 10.`,
        explanation: [
          `The 8 in the ${PLACES[low]} place is worth ${grouped(8 * VALUE_OF[low]!)}, and the 8 in the ${PLACES[high]} place is worth ${grouped(8 * VALUE_OF[high]!)}.`,
          `They are ${k} places apart, so the greater 8 is worth $10^{${k}} = ${times}$ times as much as the other: $${grouped(8 * VALUE_OF[high]!)}\\div ${grouped(8 * VALUE_OF[low]!)} = ${times}$.`,
        ],
      });
    }),
  },
);

const plainGrouped = (v: number) => {
  const [whole, decimals] = String(Math.round(v * 100) / 100).split(".");
  return `${grouped(Number(whole))}${decimals ? `.${decimals}` : ""}`;
};
const plainTex = (v: number) => plainGrouped(v).replaceAll(",", "{,}");

export const placeValueBlanksAxes = {
  "digit-place-names": digitPlaceAxes,
  "round-place-blanks": roundPlaceAxes,
  "round-decimal-blanks": roundDecimalAxes,
  "round-addends-sum": roundAddendsAxes,
  "expanded-whole-slots": expandedAxes,
  "expanded-decimal-slots": expandedAxes,
  "compare-symbol-blanks": compareSymbolAxes,
  "digit-value-blanks": digitValueAxes,
} as const;
