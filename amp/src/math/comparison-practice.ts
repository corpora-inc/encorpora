import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  ProblemResponse,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { hasHave, isAre } from "./agreement";

type Random = (low: number, high: number) => number;
const definitions = [
  [
    "compare-groups",
    "Compare two groups",
    "compare-small-groups",
    "K–2",
    "Decide whether a row of circles or a row of squares has more, fewer or the same number, with spacing that can mislead.",
  ],
  [
    "greater-numeral",
    "Greater or less to ten",
    "compare-numerals",
    "K–2",
    "Choose the greater or lesser of two different written numbers from 0 to 10.",
  ],
  [
    "compare-two-digit",
    "Compare tens and ones",
    "compare-two-digit",
    "K–2",
    "Choose the greater or lesser of two two-digit numbers shown with base-ten blocks.",
  ],
  [
    "two-digit-symbol",
    "Compare with <, = or >",
    "compare-two-digit",
    "K–2",
    "Choose the true comparison statement for two two-digit numbers.",
  ],
  [
    "compare-three-digit",
    "Compare three-digit numbers",
    "compare-three-digit",
    "K–2",
    "Choose the greater or lesser of two three-digit numbers.",
  ],
  [
    "three-digit-symbol",
    "Three-digit <, = or >",
    "compare-three-digit",
    "K–2",
    "Choose the true comparison statement for two three-digit numbers.",
  ],
  [
    "multidigit-digit-value",
    "Value of a digit",
    "large-place-value",
    "3–5",
    "Name the value of one digit in a whole number from 1,000 to 999,999.",
  ],
  [
    "compare-multidigit",
    "Compare large numbers",
    "large-place-value",
    "3–5",
    "Choose the greater or lesser of two whole numbers up to 999,999.",
  ],
] as const;
const choiceIds = new Set([
  "compare-groups",
  "two-digit-symbol",
  "three-digit-symbol",
]);
export const comparisonTemplates: readonly TemplateMetadata[] = definitions.map(
  ([id, title, skillId, gradeBand, description]) => ({
    id,
    title,
    skillId,
    gradeBand,
    description,
    version: 1,
    ...(choiceIds.has(id)
      ? { requiredResponseCapability: "single-choice-v1" as const }
      : {}),
  }),
);

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

/** Thousands separators: 6,902 and 372,946. */
export const formatWhole = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const placeNames = [
  "ones",
  "tens",
  "hundreds",
  "thousands",
  "ten thousands",
  "hundred thousands",
];
const placeValues = [1, 10, 100, 1000, 10000, 100000];
const digitAt = (n: number, place: number) =>
  Math.floor(n / placeValues[place]!) % 10;
/** Unit name after a count: "1 ten", "4 tens", "0 hundreds". */
const unit = (count: number, place: number) =>
  `${count} ${count === 1 ? placeNames[place]!.replace(/s$/, "") : placeNames[place]}`;
const symbolOf = (a: number, b: number) => (a < b ? "<" : a > b ? ">" : "=");

/** The highest place where two equal-length numbers differ. */
function decidingPlace(a: number, b: number): number {
  for (let place = String(a).length - 1; place >= 0; place--)
    if (digitAt(a, place) !== digitAt(b, place)) return place;
  return -1;
}

/** Two numbers with `places` digits that first differ at `deciding`. Lower
 * places are free, so the lesser number often has the larger lower digits. */
function pairDecidedAt(r: Random, places: number, deciding: number) {
  const a: number[] = [],
    b: number[] = [];
  for (let place = places - 1; place >= 0; place--) {
    const low = place === places - 1 ? 1 : 0;
    if (place > deciding) {
      const d = r(low, 9);
      a.push(d);
      b.push(d);
    } else if (place === deciding) {
      const x = r(low, 8),
        y = r(x + 1, 9);
      a.push(x);
      b.push(y);
    } else {
      a.push(r(0, 9));
      b.push(r(0, 9));
    }
  }
  return [Number(a.join("")), Number(b.join(""))] as const;
}
/** The same digits in another order, such as 47 and 74 or 382 and 283. */
function reversedPair(r: Random, places: number) {
  for (;;) {
    const digits = Array.from({ length: places }, (_, i) =>
      r(i === 0 || i === places - 1 ? 1 : 0, 9),
    );
    const a = Number(digits.join("")),
      b = Number([...digits].reverse().join(""));
    if (a !== b) return [a, b] as const;
  }
}
/** A zero holds a place: 607 and 670, 405 and 450. */
function zeroPair(r: Random) {
  const h = r(1, 9),
    d = r(1, 9);
  return [h * 100 + d, h * 100 + d * 10] as const;
}

function placeSteps(a: number, b: number): string[] {
  const places = String(a).length,
    deciding = decidingPlace(a, b);
  const describe = (n: number) =>
    Array.from({ length: places }, (_, i) =>
      unit(digitAt(n, places - 1 - i), places - 1 - i),
    ).join(", ");
  const matched = placeNames.slice(deciding + 1, places).reverse();
  return [
    `Each digit is worth a different amount because of its place: a ten is 10 ones${places > 2 ? ", and a hundred is 10 tens" : ""}.`,
    `Line up the places. ${a} is ${describe(a)}. ${b} is ${describe(b)}.`,
    `${matched.length ? `The ${matched.join(" and the ")} match, so they cannot decide. ` : ""}Compare the ${placeNames[deciding]}: ${unit(digitAt(a, deciding), deciding)} ${digitAt(a, deciding) < digitAt(b, deciding) ? "is less than" : "is more than"} ${unit(digitAt(b, deciding), deciding)}.`,
    `${deciding > 0 ? `The places to the right cannot change that, because all the smaller places together are worth less than 1 more ${placeNames[deciding]!.replace(/s$/, "")}.` : `That is the last place, so it decides.`}`,
  ];
}

/** Where to look first when comparing two whole numbers. */
function placeCompareHint(a: number, b: number): string {
  const A = formatWhole(a),
    B = formatWhole(b),
    la = String(a).length,
    lb = String(b).length;
  if (la !== lb)
    return `Count the digits first: ${A} has ${la} and ${B} has ${lb}. A number with more digits is greater, whatever its first digit.`;
  if (a === b)
    return `Compare ${A} and ${B} one place at a time, starting from the left.`;
  const top = la - 1,
    d = decidingPlace(a, b);
  const same =
    [...String(a)].sort().join() === [...String(b)].sort().join()
      ? `${A} and ${B} use the same digits in a different order. `
      : "";
  if (d === top)
    return `${same}Start at the left: compare the ${placeNames[top]} digits of ${A} and ${B}. That place is worth the most, so it decides.`;
  return `${same}${A} and ${B} match from the left until the ${placeNames[d]} place. Compare those two digits.`;
}

function symbolResponse(a: number, b: number) {
  const symbols = ["<", "=", ">"] as const;
  const options = symbols.map((symbol, index) => ({
    id: `option-${"abc"[index]}`,
    label: `${formatWhole(a)} ${symbol} ${formatWhole(b)}`,
  }));
  const truth = symbolOf(a, b);
  const feedback: Record<string, string> = {};
  symbols.forEach((symbol, index) => {
    if (symbol === truth) return;
    const id = `option-${"abc"[index]}`;
    const deciding = decidingPlace(a, b);
    feedback[id] =
      symbol === "="
        ? `= means both numbers have the same value. ${formatWhole(a)} and ${formatWhole(b)} differ in the ${placeNames[deciding]} place.`
        : truth === "="
          ? `Every place matches, so the numbers are equal.`
          : `${formatWhole(a)} ${symbol} ${formatWhole(b)} says ${formatWhole(a)} is ${symbol === ">" ? "greater" : "less"}. The first place that differs is the ${placeNames[deciding]}: ${unit(digitAt(a, deciding), deciding)} and ${unit(digitAt(b, deciding), deciding)}.`;
  });
  return {
    response: {
      kind: "choice",
      label: "Choose the true statement",
      options,
    } satisfies ProblemResponse,
    answer: options[symbols.indexOf(truth)]!.id,
    feedback,
  };
}

function twoDigitPair(r: Random, allowEqual: boolean) {
  const shape = r(0, allowEqual ? 5 : 4);
  if (shape === 5) {
    const n = r(10, 99);
    return [n, n] as const;
  }
  let pair: readonly [number, number];
  if (shape === 0) pair = reversedPair(r, 2);
  else if (shape === 1) {
    // More ones but fewer tens: 39 and 41.
    const t = r(1, 8),
      u = r(t + 1, 9);
    pair = [t * 10 + r(5, 9), u * 10 + r(0, 4)];
  } else pair = pairDecidedAt(r, 2, shape === 4 ? 0 : 1);
  return r(0, 1) ? pair : ([pair[1], pair[0]] as const);
}
function threeDigitPair(r: Random, allowEqual: boolean) {
  const shape = r(0, allowEqual ? 6 : 5);
  if (shape === 6) {
    const n = r(100, 999);
    return [n, n] as const;
  }
  const pair =
    shape === 0
      ? reversedPair(r, 3)
      : shape === 1
        ? zeroPair(r)
        : pairDecidedAt(r, 3, [2, 1, 0, 1][shape - 2]!);
  return r(0, 1) ? pair : ([pair[1], pair[0]] as const);
}

export function generateComparisonProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = comparisonTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown comparison template: ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt = "",
    answer = "",
    hint = "",
    explanation: string[] = [],
    figure: SemanticFigure | undefined,
    response: ProblemResponse = { kind: "number", label: "Answer" },
    choiceFeedback: Record<string, string> | undefined;
  const pickExtreme = (a: number, b: number, greater: boolean) => {
    const pick = greater ? Math.max(a, b) : Math.min(a, b);
    prompt = `Which number is ${greater ? "greater" : "less"}: ${formatWhole(a)} or ${formatWhole(b)}?`;
    answer = String(pick);
    return pick;
  };
  switch (templateId) {
    case "compare-groups": {
      const equal = r(0, 3) === 0,
        small = r(2, 8),
        big = equal ? small : small + r(1, Math.min(3, 10 - small)),
        circlesBig = r(0, 1) === 1,
        circles = circlesBig ? big : small,
        squares = circlesBig ? small : big;
      const more = r(0, 2) > 0;
      const fewer = circles < squares ? "circles" : "squares";
      // Spread the smaller row half the time, so the longer row has fewer.
      const spreadDraw = r(0, 3);
      const spread: "circles" | "squares" | "none" = equal
        ? (["circles", "squares", "none", "none"] as const)[spreadDraw]!
        : spreadDraw < 2
          ? fewer
          : spreadDraw === 2
            ? fewer === "circles"
              ? "squares"
              : "circles"
            : "none";
      figure = {
        kind: "counter-rows",
        circles,
        squares,
        spread,
      };
      const word = more ? "more" : "fewer";
      prompt = `Are there ${word} circles or ${word} squares?`;
      const labels = [
        `${more ? "More" : "Fewer"} circles`,
        `${more ? "More" : "Fewer"} squares`,
        "The same number",
      ];
      const truth =
        circles === squares ? 2 : circles > squares === more ? 0 : 1;
      const options = labels.map((label, index) => ({
        id: `option-${"abc"[index]}`,
        label,
      }));
      response = { kind: "choice", label: "Choose one", options };
      answer = options[truth]!.id;
      const pairs = Math.min(circles, squares),
        extra = Math.abs(circles - squares);
      const spreadNote =
        spread === "none"
          ? ""
          : ` The ${spread} are spread farther apart, but spacing does not change how many there are.`;
      choiceFeedback = {};
      options.forEach((option, index) => {
        if (index === truth) return;
        choiceFeedback![option.id] =
          circles === squares
            ? `Every circle has a square partner, with none left over.${spreadNote}`
            : `Pair each circle with one square. ${extra} ${circles > squares ? "circles" : "squares"} ${hasHave(extra)} no partner.${spreadNote}`;
      });
      hint =
        spread === "none"
          ? "Pair each circle with one square, one pair at a time. Look at which shapes are left without a partner."
          : `The ${spread} are spread out, so their row looks longer. Pair each circle with one square instead of comparing row lengths.`;
      explanation = [
        `Count or pair them: ${circles} circles and ${squares} squares.`,
        circles === squares
          ? `All ${pairs} circles pair with all ${pairs} squares; none are left over.${spreadNote}`
          : `${pairs} pairs form, and ${extra} ${circles > squares ? "circles" : "squares"} ${isAre(extra)} left over.${spreadNote}`,
        circles === squares
          ? `The groups have the same number: ${circles} = ${squares}.`
          : more
            ? `There are more ${circles > squares ? "circles" : "squares"}: ${Math.max(circles, squares)} > ${Math.min(circles, squares)}.`
            : `There are fewer ${circles < squares ? "circles" : "squares"}: ${Math.min(circles, squares)} < ${Math.max(circles, squares)}.`,
      ];
      break;
    }
    case "greater-numeral": {
      const a = r(0, 10);
      let b = r(0, 9);
      if (b >= a) b++;
      const greater = r(0, 1) === 1;
      const pick = pickExtreme(a, b, greater),
        other = pick === a ? b : a;
      hint = `Count up from zero and listen for ${a} and ${b}. The number you say later is greater.`;
      explanation = [
        `Counting up: ${Array.from({ length: Math.max(a, b) + 1 }, (_, i) => i).join(", ")}.`,
        `In the count, ${Math.min(a, b)} is before ${Math.max(a, b)}, so ${Math.min(a, b)} is less and ${Math.max(a, b)} is greater.`,
        greater
          ? `${pick} is greater. We write ${pick} > ${other}; the open side of > faces the greater number.`
          : `${pick} is less. We write ${pick} < ${other}; the point of < faces the smaller number.`,
      ];
      break;
    }
    case "compare-two-digit": {
      const [a, b] = twoDigitPair(r, false);
      figure = { kind: "base-ten-pair", values: [a, b] };
      const greater = r(0, 1) === 1;
      const pick = pickExtreme(a, b, greater),
        other = pick === a ? b : a;
      hint = placeCompareHint(a, b);
      explanation = [
        ...placeSteps(a, b),
        `So ${pick} is ${greater ? "greater" : "less"}: ${pick} ${greater ? ">" : "<"} ${other}, read "${pick} is ${greater ? "greater" : "less"} than ${other}".`,
      ];
      break;
    }
    case "compare-three-digit": {
      const [a, b] = threeDigitPair(r, false);
      const greater = r(0, 1) === 1;
      const pick = pickExtreme(a, b, greater),
        other = pick === a ? b : a;
      hint = placeCompareHint(a, b);
      explanation = [
        ...placeSteps(a, b),
        `So ${pick} is ${greater ? "greater" : "less"}: ${pick} ${greater ? ">" : "<"} ${other}, read "${pick} is ${greater ? "greater" : "less"} than ${other}".`,
      ];
      break;
    }
    case "two-digit-symbol":
    case "three-digit-symbol": {
      const [a, b] =
        templateId === "two-digit-symbol"
          ? twoDigitPair(r, true)
          : threeDigitPair(r, true);
      prompt = `Compare ${a} and ${b}. Which statement is true?`;
      const choice = symbolResponse(a, b);
      response = choice.response;
      answer = choice.answer;
      choiceFeedback = choice.feedback;
      hint = `The symbol opens toward the greater number. ${placeCompareHint(a, b)}`;
      explanation =
        a === b
          ? [
              `Every place matches: ${a} and ${b} are the same number.`,
              `${a} = ${b}.`,
            ]
          : [
              ...placeSteps(a, b),
              `So ${a} is ${a < b ? "less than" : "greater than"} ${b}. The sign ${symbolOf(a, b)} means "is ${a < b ? "less than" : "greater than"}"; its open side faces the greater number.`,
              `The true statement is ${a} ${symbolOf(a, b)} ${b}.`,
            ];
      break;
    }
    case "multidigit-digit-value": {
      const length = r(4, 6);
      const place = r(1, length - 1),
        digit = r(1, 9);
      const digits: number[] = [];
      for (let p = length - 1; p >= 0; p--) {
        if (p === place) digits.push(digit);
        else {
          let d = r(p === length - 1 ? 1 : 0, 8);
          if (d >= digit) d++;
          digits.push(d);
        }
      }
      const n = Number(digits.join(""));
      prompt = `What is the value of the digit ${digit} in ${formatWhole(n)}?`;
      const value = digit * placeValues[place]!;
      answer = String(value);
      hint = `Read the places of ${formatWhole(n)} from the right (ones, tens, hundreds, …) until you reach the ${digit}. Its value is ${digit} of that place.`;
      explanation = [
        `Read the places from the right: ones, tens, hundreds, thousands${length > 4 ? ", ten thousands" : ""}${length > 5 ? ", hundred thousands" : ""}.`,
        `The ${digit} is in the ${placeNames[place]} place.`,
        `A digit's value is the digit times the value of its place: ${digit} × ${formatWhole(placeValues[place]!)} = ${formatWhole(value)}.`,
        `The digit ${digit} in ${formatWhole(n)} has the value ${formatWhole(value)}.`,
      ];
      break;
    }
    case "compare-multidigit": {
      let a: number, b: number;
      if (r(0, 3) === 0) {
        // Fewer digits but a larger leading digit: 98,765 and 102,345.
        const length = r(4, 5);
        a = r(5, 9) * 10 ** (length - 1) + r(0, 10 ** (length - 1) - 1);
        b = r(1, 2) * 10 ** length + r(0, 10 ** length - 1);
      } else {
        const length = r(4, 6);
        [a, b] = pairDecidedAt(r, length, r(0, length - 1));
      }
      if (r(0, 1)) [a, b] = [b, a];
      const greater = r(0, 1) === 1;
      const pick = pickExtreme(a, b, greater),
        other = pick === a ? b : a;
      const la = String(a).length,
        lb = String(b).length;
      if (la !== lb) {
        const [short, long] = la < lb ? [a, b] : [b, a];
        explanation = [
          `${formatWhole(short)} has ${String(short).length} digits; ${formatWhole(long)} has ${String(long).length} digits.`,
          `Every ${String(short).length}-digit number is less than ${formatWhole(10 ** String(short).length)}, and ${formatWhole(long)} is at least ${formatWhole(10 ** String(short).length)}. More digits means greater.`,
        ];
      } else {
        const deciding = decidingPlace(a, b);
        const matched = placeNames.slice(deciding + 1, la).reverse();
        explanation = [
          `Both numbers have ${la} digits. Compare from the left, because the leftmost place is worth the most.`,
          `${matched.length ? `The ${matched.join(", ")} match. ` : ""}In the ${placeNames[deciding]} place, ${digitAt(a, deciding)} ${digitAt(a, deciding) < digitAt(b, deciding) ? "<" : ">"} ${digitAt(b, deciding)}.`,
        ];
      }
      explanation.push(
        `So ${formatWhole(pick)} is ${greater ? "greater" : "less"}: ${formatWhole(pick)} ${greater ? ">" : "<"} ${formatWhole(other)}.`,
      );
      hint = placeCompareHint(a, b);
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
      response,
      ...(figure ? { figure } : {}),
    },
    answer,
    hint,
    explanation,
    ...(choiceFeedback ? { choiceFeedback } : {}),
  };
}
