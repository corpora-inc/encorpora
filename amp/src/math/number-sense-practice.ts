import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { formatWhole } from "./comparison-practice";
import { numberLine, scene } from "./scene/author";
import type { Element, Scene } from "./scene/spec";

/** A window of the hundred chart as a scene: numbered squares, one left
 * empty and shaded. The empty square carries no value. */
export function hundredChartScene(
  first: number,
  rows: number,
  columns: number,
  blank: [number, number],
): Scene {
  const elements: Element[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const empty = r === blank[0] && c === blank[1];
      const at: [number, number] = [c, rows - 1 - r];
      elements.push({
        type: "rect",
        id: empty ? "blank" : `cell-${r}-${c}`,
        at,
        size: [1, 1],
        fill: empty ? "gold-fill" : "paper",
        stroke: empty ? "warm" : "ink",
        width: empty ? 2.5 : 1.25,
      });
      if (!empty)
        elements.push({
          type: "text",
          id: `n-${r}-${c}`,
          at: [c + 0.5, rows - 1 - r + 0.5],
          text: String(first + 10 * r + c),
          font: "sans",
          size: "lg",
          bold: true,
          align: [0, 0],
        });
    }
  return scene(...elements).build({
    title: `Part of the hundred chart: ${rows} rows of ${columns} squares from ${first}, one square empty`,
    width: 64 * columns,
  });
}
/** Only the tens are labeled, so no tick label names a landing. */
const tenLabels = (min: number, max: number) =>
  Array.from({ length: (max - min) / 10 + 1 }, (_, i) => min + 10 * i);
/** Templates whose figures are scenes: sent only to clients that draw them. */
const sceneTemplates = new Set([
  "hundred-chart-missing",
  "number-line-hops",
  "number-line-missing-hop",
]);

type Random = (low: number, high: number) => number;
const definitions = [
  [
    "count-sequence-missing",
    "Find the missing count",
    "count-to-100",
    "K–2",
    "Find a missing number when counting by ones or by tens within 100, including counts that cross a ten.",
  ],
  [
    "hundred-chart-missing",
    "Complete the hundred chart",
    "count-to-100",
    "K–2",
    "Find the number in an empty square of a window of the hundred chart.",
  ],
  [
    "numeral-for-quantity",
    "Write the number",
    "write-numerals",
    "K–2",
    "Write the numeral for 0 to 20 counters in ten-frames.",
  ],
  [
    "number-line-hops",
    "Hop on a number line",
    "number-line-arithmetic",
    "K–2",
    "Add or subtract a two-digit number as a hop of tens and a hop of ones.",
  ],
  [
    "number-line-missing-hop",
    "Find the length of a hop",
    "number-line-arithmetic",
    "K–2",
    "Find the distance between two whole numbers within 100 on a number line.",
  ],
  [
    "round-to-ten",
    "Round to the nearest ten",
    "round-whole-numbers",
    "3–5",
    "Round a whole number below 1,000 to the nearest ten.",
  ],
  [
    "round-to-hundred",
    "Round to the nearest hundred",
    "round-whole-numbers",
    "3–5",
    "Round a three-digit whole number to the nearest hundred.",
  ],
  [
    "round-large",
    "Round large numbers",
    "large-place-value",
    "3–5",
    "Round a whole number up to 999,999 to the nearest hundred, thousand or ten thousand.",
  ],
  [
    "multiply-power-of-ten",
    "Multiply by 10, 100 or 1,000",
    "powers-of-ten",
    "3–5",
    "Multiply a whole number or a decimal by 10, 100 or 1,000, written plainly or as a power of ten.",
  ],
  [
    "divide-power-of-ten",
    "Divide by 10, 100 or 1,000",
    "powers-of-ten",
    "3–5",
    "Divide a whole number by 10, 100 or 1,000, with a whole or decimal quotient.",
  ],
  [
    "digit-value-ratio",
    "Ten times the place to its right",
    "powers-of-ten",
    "3–5",
    "Compare the values of the same digit in two places of a whole number.",
  ],
] as const;
export const numberSenseTemplates: readonly TemplateMetadata[] =
  definitions.map(([id, title, skillId, gradeBand, description]) => ({
    id,
    title,
    skillId,
    gradeBand,
    description,
    version: 1,
    ...(sceneTemplates.has(id)
      ? { requiredFigureCapability: "scenes-v1" as const }
      : {}),
  }));

function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do {
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (value >= limit);
    return low + (value % span);
  };
}

/** Exact decimal text for an integer scaled by 10^-places: (52, 2) → "0.52". */
export function decimalText(units: number, places: number): string {
  if (places <= 0) return formatWhole(units * 10 ** -places);
  const digits = String(units).padStart(places + 1, "0");
  const whole = digits.slice(0, -places),
    fraction = digits.slice(-places).replace(/0+$/, "");
  return fraction
    ? `${formatWhole(Number(whole))}.${fraction}`
    : formatWhole(Number(whole));
}
const plain = (text: string) => text.replaceAll(",", "");
const powerWord = ["1", "10", "100", "1,000"];
const superscript = ["⁰", "¹", "²", "³"];
const placeName = [
  "ones",
  "tens",
  "hundreds",
  "thousands",
  "ten thousands",
  "hundred thousands",
];
const singularPlace = [
  "one",
  "ten",
  "hundred",
  "thousand",
  "ten thousand",
  "hundred thousand",
];

/** Round half up to a multiple of `unit`. */
const roundTo = (n: number, unit: number) =>
  Math.floor((n + unit / 2) / unit) * unit;

function roundingSteps(n: number, unit: number, name: string): string[] {
  const below = Math.floor(n / unit) * unit,
    above = below + unit,
    result = roundTo(n, unit);
  if (n === below)
    return [
      `${formatWhole(n)} is already a multiple of ${formatWhole(unit)}.`,
      `Rounded to the nearest ${name}, it stays ${formatWhole(n)}.`,
    ];
  const half = below + unit / 2;
  return [
    `${formatWhole(n)} is between ${formatWhole(below)} and ${formatWhole(above)}. Halfway between them is ${formatWhole(half)}.`,
    n === half
      ? `${formatWhole(n)} is exactly halfway. A halfway number rounds up.`
      : n > half
        ? `${formatWhole(n)} is past halfway, so it is closer to ${formatWhole(above)}.`
        : `${formatWhole(n)} is before halfway, so it is closer to ${formatWhole(below)}.`,
    `${formatWhole(n)} rounds to ${formatWhole(result)}.`,
  ];
}

export function generateNumberSenseProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = numberSenseTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown number-sense template: ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt = "",
    answer = "",
    hint = "",
    explanation: string[] = [],
    figure: SemanticFigure | undefined;
  switch (templateId) {
    case "count-sequence-missing": {
      const byTens = r(0, 1) === 1,
        gap = r(1, 3);
      let values: number[];
      if (byTens) {
        const first = 10 * r(1, 7);
        values = [0, 1, 2, 3].map((i) => first + 10 * i);
      } else {
        // Usually cross a ten: 68, 69, □, 71.
        const ten = 10 * r(1, 9),
          first = r(0, 2) ? ten - r(1, 3) : r(1, 96);
        values = [0, 1, 2, 3].map((i) => first + i);
      }
      const missing = values[gap]!;
      prompt = `Count by ${byTens ? "tens" : "ones"}: ${values.map((v, i) => (i === gap ? "□" : v)).join(", ")}. What number is missing?`;
      answer = String(missing);
      const before = values[gap - 1]!;
      hint = byTens
        ? `Counting by tens adds one ten each time. Start from ${before} and count one ten more.`
        : `Each count is one more. Start from ${before}${before % 10 === 9 ? ": after a 9 in the ones place, the next ten begins" : " and count one more"}.`;
      explanation = [
        `Each number is ${byTens ? "10" : "1"} more than the one before.`,
        `${values[gap - 1]} + ${byTens ? 10 : 1} = ${missing}.`,
        ...(gap < 3
          ? [`Check: ${missing} + ${byTens ? 10 : 1} = ${values[gap + 1]}.`]
          : []),
      ];
      break;
    }
    case "hundred-chart-missing": {
      const rows = r(2, 3),
        columns = r(3, 5),
        column = r(0, 10 - columns),
        row = r(0, 10 - rows);
      const first = row * 10 + column + 1;
      const blank: [number, number] = [r(0, rows - 1), r(0, columns - 1)];
      // Avoid the top-left square, which has no square above or to its left
      // in some windows; any other blank has a neighbor to reason from.
      if (blank[0] === 0 && blank[1] === 0) blank[1] = 1;
      figure = {
        kind: "scene",
        scene: hundredChartScene(first, rows, columns, blank),
      };
      const value = first + blank[0] * 10 + blank[1];
      prompt =
        "This is part of the hundred chart. What number belongs in the empty square?";
      answer = String(value);
      const left = blank[1] > 0,
        neighbor = left ? value - 1 : value - 10;
      hint = left
        ? `The square to its left is ${neighbor}. Moving right on the chart adds 1.`
        : `The square above it is ${neighbor}. Moving down a row adds 10, because each row holds ten numbers.`;
      explanation = left
        ? [
            `The square to its left is ${neighbor}.`,
            `One square right is one more: ${neighbor} + 1 = ${value}.`,
            ...(blank[0] > 0
              ? [`Check from above: ${value - 10} + 10 = ${value}.`]
              : []),
          ]
        : [
            `The square above it is ${neighbor}.`,
            `One row down is ten more: ${neighbor} + 10 = ${value}.`,
          ];
      break;
    }
    case "numeral-for-quantity": {
      const n = r(0, 4) === 0 ? [0, 10, 20][r(0, 2)]! : r(1, 20);
      figure = {
        kind: "ten-frame",
        first: n,
        second: 0,
        capacity: n > 10 ? 20 : 10,
      };
      prompt = "How many counters are in the frames? Write the number.";
      answer = String(n);
      hint =
        n > 10
          ? "A full ten-frame holds 10. Count on from 10 for counters in the second frame."
          : "Each row of a ten-frame holds 5. Count on from 5 for the bottom row.";
      explanation =
        n === 0
          ? ["Every place is empty.", "No counters is written 0."]
          : n <= 10
            ? [
                `The top row holds ${Math.min(n, 5)}${n > 5 ? `; the bottom row holds ${n - 5}` : ""}.`,
                n > 5 ? `5 + ${n - 5} = ${n}.` : `There are ${n} counters.`,
                n === 10 ? "A full frame is 10." : `Write ${n}.`,
              ]
            : [
                "The first frame is full: 10.",
                `The second frame has ${n - 10}.`,
                `10 + ${n - 10} = ${n}. Write ${n}: 1 ten and ${n - 10} ones.`,
              ];
      break;
    }
    case "number-line-hops": {
      const add = r(0, 1) === 1,
        tens = 10 * r(1, 3),
        ones = r(1, 9),
        jump = tens + ones;
      const start = add ? r(10, 99 - jump) : r(jump + 1, 98);
      const middle = add ? start + tens : start - tens,
        end = add ? middle + ones : middle - ones;
      const low = Math.min(start, end),
        high = Math.max(start, end);
      let min = Math.floor(low / 10) * 10,
        max = Math.ceil(high / 10) * 10;
      if (max === high && max < 100) max += 10;
      if (min === low && min > 0) min -= 10;
      const sign = add ? 1 : -1;
      figure = {
        kind: "scene",
        scene: numberLine({ min, max, labels: tenLabels(min, max) })
          .id("line")
          .mark(start, { color: "warm" })
          .hop(start, sign * tens, { landing: "none" })
          .then(sign * ones, { landing: "derived" })
          .scene(),
      };
      prompt = `Start at ${start}. Hop ${add ? "forward" : "back"} ${tens}, then ${add ? "forward" : "back"} ${ones}. Where do you land?`;
      answer = String(end);
      hint = `A hop of ${tens} moves ${tens / 10} ${tens === 10 ? "ten" : "tens"} ${add ? "right" : "left"}; then count ${ones} ${add ? "right" : "left"} by ones.`;
      explanation = [
        `The tens hop: ${start} ${add ? "+" : "−"} ${tens} = ${middle}.`,
        `The ones hop: ${middle} ${add ? "+" : "−"} ${ones} = ${end}.`,
        `Together: ${start} ${add ? "+" : "−"} ${jump} = ${end}.`,
      ];
      break;
    }
    case "number-line-missing-hop": {
      const from = r(10, 80),
        length = r(12, Math.min(40, 95 - from)),
        forward = r(0, 1) === 1;
      const [a, b] = forward ? [from, from + length] : [from + length, from];
      figure = {
        kind: "scene",
        scene: numberLine({
          min: Math.floor(Math.min(a, b) / 10) * 10,
          max: Math.ceil((Math.max(a, b) + 1) / 10) * 10,
          labels: tenLabels(
            Math.floor(Math.min(a, b) / 10) * 10,
            Math.ceil((Math.max(a, b) + 1) / 10) * 10,
          ),
        })
          .id("line")
          .mark(a, { color: "warm" })
          .mark(b, { color: "warm" })
          .hop(a, b - a, { label: "?", landing: "none" })
          .scene(),
      };
      prompt = `A hop goes from ${a} to ${b}. How long is the hop?`;
      answer = String(length);
      const low = Math.min(a, b),
        high = Math.max(a, b),
        nextTen = Math.ceil(low / 10) * 10,
        lastTen = Math.floor(high / 10) * 10;
      hint = `Count up from ${low} to ${high}: first to the next ten, then by tens, then by ones. Add the jumps.`;
      const pieces = [
        [low, nextTen],
        [nextTen, lastTen],
        [lastTen, high],
      ].filter(([x, y]) => y! > x!);
      explanation =
        pieces.length > 1
          ? [
              `${pieces.map(([x, y]) => `from ${x} to ${y} is ${y! - x!}`).join("; ")}.`.replace(
                /^f/,
                "F",
              ),
              `${pieces.map(([x, y]) => y! - x!).join(" + ")} = ${length}.`,
              `Check: ${high} − ${low} = ${length}.`,
            ]
          : [
              `The hop covers the distance between ${low} and ${high}.`,
              `${high} − ${low} = ${length}.`,
            ];
      break;
    }
    case "round-to-ten": {
      const kind = r(0, 9);
      let n: number;
      if (kind < 2)
        n = 10 * r(1, 99) + 5; // halfway
      else if (kind < 4)
        n = 100 * r(0, 9) + 90 + r(5, 9); // across a hundred
      else if (kind === 4)
        n = 10 * r(2, 99); // already a ten
      else n = r(11, 999);
      prompt = `Round ${n} to the nearest ten.`;
      answer = String(roundTo(n, 10));
      hint = `Look at the ones digit of ${n}, ${n % 10}: 5 or more rounds up to the next ten; less keeps the ten it is in.`;
      explanation = roundingSteps(n, 10, "ten");
      break;
    }
    case "round-to-hundred": {
      const kind = r(0, 9);
      let n: number;
      if (kind < 2)
        n = 100 * r(1, 9) + 50; // halfway
      else if (kind < 4)
        n = 100 * r(1, 9) + 40 + r(5, 9); // 449 stays 400
      else if (kind < 6)
        n = 900 + r(50, 99); // across a thousand
      else if (kind === 6) n = 100 * r(1, 9);
      else n = r(101, 999);
      prompt = `Round ${n} to the nearest hundred.`;
      answer = String(roundTo(n, 100));
      hint = `Look only at the tens digit of ${n}, ${Math.floor(n / 10) % 10}: 5 or more rounds up to the next hundred; less keeps the hundred it is in.`;
      explanation = roundingSteps(n, 100, "hundred");
      break;
    }
    case "round-large": {
      const place = r(2, 4),
        unit = 10 ** place,
        kind = r(0, 5),
        length = r(5, 6),
        lowest = 10 ** (length - 1),
        highest = 10 ** length - 1;
      const top =
        r(Math.ceil(lowest / unit), Math.floor((highest - unit + 1) / unit)) *
        unit;
      let n: number;
      if (kind === 0)
        n = top + unit / 2; // exactly halfway
      else if (kind === 1)
        n = top + unit / 2 - 1; // 46,499 stays 46,000
      else if (kind === 2)
        // A 9 that rounds up carries: 49,700 → 50,000.
        n =
          Math.floor(top / (10 * unit)) * 10 * unit +
          9 * unit +
          r(unit / 2, unit - 1);
      else n = top + r(0, unit - 1);
      const name = singularPlace[place]!;
      prompt = `Round ${formatWhole(n)} to the nearest ${name}.`;
      answer = String(roundTo(n, unit));
      hint = `In ${formatWhole(n)}, look at the ${placeName[place - 1]} digit, ${Math.floor(n / 10 ** (place - 1)) % 10}: 5 or more rounds up; less rounds down.`;
      explanation = roundingSteps(n, unit, name);
      break;
    }
    case "multiply-power-of-ten": {
      const k = r(1, 3),
        decimal = r(0, 2) === 0,
        places = decimal ? r(1, 2) : 0;
      const units = !decimal
        ? r(2, 99) * (r(0, 3) ? 1 : 10)
        : places === 1
          ? 10 * r(1, 9) + r(1, 9)
          : 100 * r(0, 9) + 10 * r(0, 9) + r(1, 9);
      const value = decimalText(units, places);
      const exponent = r(0, 2) === 0;
      prompt = `What is ${value} × ${exponent ? `10${superscript[k]}` : powerWord[k]}?`;
      const result = decimalText(units, places - k);
      answer = plain(result);
      hint = `Multiplying ${value} by ${powerWord[k]} makes each digit worth ${powerWord[k]} times as much: every digit moves ${k} ${k === 1 ? "place" : "places"} left.`;
      explanation = [
        ...(exponent
          ? [
              `10${superscript[k]} = ${powerWord[k]}: ${k} ${k === 1 ? "factor" : "factors"} of 10.`,
            ]
          : []),
        `Each factor of 10 moves every digit one place left.`,
        `${value} × ${powerWord[k]} = ${result}.`,
      ];
      break;
    }
    case "divide-power-of-ten": {
      const k = r(1, 3),
        trailing = r(0, k),
        size = r(0, 2);
      let core = size === 0 ? r(2, 9) : size === 1 ? r(11, 99) : r(101, 999);
      if (core % 10 === 0) core += 1;
      const units = core * 10 ** trailing;
      const value = formatWhole(units),
        exponent = r(0, 3) === 0;
      prompt = `What is ${value} ÷ ${exponent ? `10${superscript[k]}` : powerWord[k]}?`;
      const result = decimalText(units, k);
      answer = plain(result);
      hint = `Dividing ${value} by ${powerWord[k]} makes each digit worth one ${powerWord[k] === "10" ? "tenth" : powerWord[k] === "100" ? "hundredth" : "thousandth"} as much: every digit moves ${k} ${k === 1 ? "place" : "places"} right.`;
      explanation = [
        ...(exponent
          ? [
              `10${superscript[k]} = ${powerWord[k]}: ${k} ${k === 1 ? "factor" : "factors"} of 10.`,
            ]
          : []),
        `Each division by 10 moves every digit one place right.`,
        `${value} ÷ ${powerWord[k]} = ${result}.`,
      ];
      break;
    }
    case "digit-value-ratio": {
      const length = r(4, 6),
        high = r(1, length - 1),
        low = r(Math.max(0, high - 3), high - 1),
        digit = r(1, 9);
      const digits: number[] = [];
      for (let p = length - 1; p >= 0; p--) {
        if (p === high || p === low) digits.push(digit);
        else {
          let d = r(p === length - 1 ? 1 : 0, 8);
          if (d >= digit) d++;
          digits.push(d);
        }
      }
      const n = Number(digits.join(""));
      prompt = `In ${formatWhole(n)}, the first ${digit} is worth how many times as much as the second ${digit}?`;
      const ratio = 10 ** (high - low);
      answer = String(ratio);
      hint = `Name the place of each ${digit} in ${formatWhole(n)}. Each place is worth ten times the place to its right.`;
      explanation = [
        `The first ${digit} is in the ${placeName[high]} place: ${formatWhole(digit * 10 ** high)}. The second is in the ${placeName[low]} place: ${formatWhole(digit * 10 ** low)}.`,
        high - low === 1
          ? "The places are next to each other, so the first is worth 10 times as much."
          : `The places are ${high - low} apart, so the ratio is ${Array(
              high - low,
            )
              .fill("10")
              .join(" × ")} = ${formatWhole(ratio)}.`,
        `${formatWhole(digit * 10 ** low)} × ${formatWhole(ratio)} = ${formatWhole(digit * 10 ** high)}.`,
      ];
      break;
    }
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
      skillId: meta.skillId,
      response: { kind: "number", label: "Answer" },
      ...(figure ? { figure } : {}),
    },
    answer,
    hint,
    explanation,
  };
}
