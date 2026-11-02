import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { formatWhole as f } from "./comparison-practice";

type Random = (low: number, high: number) => number;
const definitions = [
  [
    "multiply-by-tens",
    "Multiply by a multiple of ten",
    "multiply-tens",
    "3–5",
    "Multiply a one-digit number by a multiple of ten from 10 to 90.",
  ],
  [
    "multiply-by-one-digit",
    "Multiply by one digit",
    "whole-multiplication",
    "3–5",
    "Multiply a two- to four-digit number by a one-digit number.",
  ],
  [
    "area-model-product",
    "Multiply with an area model",
    "whole-multiplication",
    "3–5",
    "Find a two-digit by two-digit product from an area model split by place value.",
  ],
  [
    "multiply-multidigit",
    "Multiply multidigit numbers",
    "multidigit-products",
    "3–5",
    "Multiply a two- or three-digit number by a two-digit number.",
  ],
  [
    "divide-by-one-digit",
    "Divide by one digit",
    "whole-division",
    "3–5",
    "Divide a two- to four-digit number by a one-digit divisor with no remainder.",
  ],
  [
    "division-remainder",
    "Find the remainder",
    "whole-division",
    "3–5",
    "Find the remainder when a two- to four-digit number is divided by a one-digit divisor.",
  ],
  [
    "divide-by-two-digit",
    "Divide by a two-digit number",
    "multidigit-quotients",
    "3–5",
    "Divide a three- or four-digit number by a two-digit divisor with no remainder.",
  ],
] as const;
export const multiplyDivideTemplates: readonly TemplateMetadata[] =
  definitions.map(([id, title, skillId, gradeBand, description]) => ({
    id,
    title,
    skillId,
    gradeBand,
    description,
    version: 1,
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

/** Nonzero place parts, greatest first: 346 → [300, 40, 6]; 305 → [300, 5]. */
export function placeParts(n: number): number[] {
  const digits = String(n);
  return [...digits]
    .map((d, i) => Number(d) * 10 ** (digits.length - 1 - i))
    .filter((part) => part > 0);
}
/** A number with `length` digits, with a zero in an inner place when asked. */
function digitsNumber(r: Random, length: number, innerZero: boolean) {
  const digits = Array.from({ length }, (_, i) => r(i === 0 ? 1 : 0, 9));
  if (innerZero && length > 2) digits[r(1, length - 2)] = 0;
  else if (innerZero && length === 2) digits[1] = 0;
  return Number(digits.join(""));
}
/** A quotient of `length` digits whose product with `d` stays at most `max`. */
function quotient(
  r: Random,
  d: number,
  length: number,
  innerZero: boolean,
  max: number,
) {
  for (;;) {
    const q = digitsNumber(r, length, innerZero);
    if (q * d <= max && q * d >= 10) return q;
  }
}

/** Long division as partial quotients by place: the steps a learner writes. */
function longDivisionSteps(dividend: number, d: number): string[] {
  const steps: string[] = [
    `Division asks how many groups of ${d} fit in ${f(dividend)}. Take away big, easy groups first, then smaller ones.`,
  ];
  let rest = dividend;
  const length = String(dividend).length;
  for (let place = length - 1; place >= 0; place--) {
    const unit = 10 ** place,
      digit = Math.floor(rest / (d * unit));
    if (!digit) continue;
    const chunk = digit * unit;
    steps.push(
      `${f(chunk)} groups of ${d} is ${f(chunk)} × ${d} = ${f(chunk * d)}. Take ${f(chunk * d)} away: ${f(rest)} − ${f(chunk * d)} = ${f(rest - chunk * d)}.`,
    );
    rest -= chunk * d;
  }
  return steps;
}
function partialQuotients(dividend: number, d: number) {
  const parts: number[] = [];
  let rest = dividend;
  for (let place = String(dividend).length - 1; place >= 0; place--) {
    const unit = 10 ** place,
      digit = Math.floor(rest / (d * unit));
    if (digit) {
      parts.push(digit * unit);
      rest -= digit * unit * d;
    }
  }
  return { parts, rest };
}

export function generateMultiplyDivideProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = multiplyDivideTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown multiply-divide template: ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt = "",
    answer = 0,
    hint = "",
    explanation: string[] = [],
    figure: SemanticFigure | undefined;
  switch (templateId) {
    case "multiply-by-tens": {
      const a = r(2, 9),
        t = r(1, 9);
      const [left, right] = r(0, 1) ? [a, t * 10] : [t * 10, a];
      prompt = `What is ${left} × ${right}?`;
      answer = a * t * 10;
      hint = `Think of ${t * 10} as ${t} ${t === 1 ? "ten" : "tens"}. Multiply ${a} × ${t}, then name that many tens.`;
      explanation = [
        `${t * 10} is ${t} ${t === 1 ? "ten" : "tens"}, so ${left} × ${right} is ${a} × ${t} tens.`,
        `Multiply the basic fact first: ${a} × ${t} = ${a * t}. So the answer is ${a * t} tens.`,
        `${a * t} tens is ${a * t} × 10 = ${f(answer)}, because each ten is worth 10.`,
        `So ${left} × ${right} = ${f(answer)}.`,
      ];
      break;
    }
    case "multiply-by-one-digit": {
      const length = r(2, 4),
        n = digitsNumber(r, length, r(0, 3) === 0),
        d = r(3, 9);
      prompt = `What is ${f(n)} × ${d}?`;
      answer = n * d;
      const parts = placeParts(n);
      hint = `Split ${f(n)} into ${parts.map(f).join(" + ")}. Multiply each part by ${d}, then add the partial products.`;
      explanation =
        parts.length > 1
          ? [
              `Split ${f(n)} by place value, because each part is easy to multiply: ${parts.map(f).join(" + ")}.`,
              `Multiply each part by ${d}: ${parts.map((p) => `${f(p)} × ${d} = ${f(p * d)}`).join("; ")}. Each result is a partial product.`,
              `The parts together make ${f(n)}, so add the partial products: ${parts.map((p) => f(p * d)).join(" + ")} = ${f(answer)}.`,
              `So ${f(n)} × ${d} = ${f(answer)}.`,
            ]
          : (() => {
              const unit = 10 ** (String(n).length - 1),
                digit = n / unit,
                name = { 10: "tens", 100: "hundreds", 1000: "thousands" }[unit];
              return [
                `${f(n)} is ${digit} ${name}, so ${f(n)} × ${d} is ${digit} × ${d} ${name}.`,
                `Multiply the basic fact: ${digit} × ${d} = ${digit * d}. So the answer is ${digit * d} ${name}.`,
                `${digit * d} ${name} is ${digit * d} × ${f(unit)} = ${f(answer)}.`,
                `So ${f(n)} × ${d} = ${f(answer)}.`,
              ];
            })();
      break;
    }
    case "area-model-product": {
      // Ones of 3 or more keep every region wide enough to see at scale.
      const a = r(2, 8) * 10 + r(3, 9),
        b = r(1, 6) * 10 + r(3, 9);
      const columns = placeParts(a),
        rows = placeParts(b);
      figure = { kind: "area-model", columns, rows };
      prompt = `The area model splits ${a} × ${b} by place value. What is ${a} × ${b}?`;
      answer = a * b;
      const products = rows.flatMap((y) => columns.map((x) => x * y));
      hint = `The edges split ${a} into ${columns.join(" + ")} and ${b} into ${rows.join(" + ")}. Multiply width by height in each region, then add the four.`;
      explanation = [
        `An area model draws the product as a rectangle ${a} by ${b}, cut by place value into smaller rectangles.`,
        `${a} = ${columns.join(" + ")} and ${b} = ${rows.join(" + ")}.`,
        `Each small rectangle's area is its width times its height: ${rows.flatMap((y) => columns.map((x) => `${x} × ${y} = ${f(x * y)}`)).join("; ")}.`,
        `The small rectangles fill the whole one, so add them: ${products.map(f).join(" + ")} = ${f(answer)}.`,
        `So ${a} × ${b} = ${f(answer)}.`,
      ];
      break;
    }
    case "multiply-multidigit": {
      const zero = r(0, 3) === 0,
        three = r(0, 2) > 0;
      // A zero in either factor: 305 × 42 or 46 × 30.
      const a = digitsNumber(r, three ? 3 : 2, zero && r(0, 1) === 0),
        b = zero && r(0, 1) === 0 ? r(1, 9) * 10 : r(1, 9) * 10 + r(1, 9);
      const [tens, ones] = [Math.floor(b / 10) * 10, b % 10];
      prompt = `What is ${f(a)} × ${b}?`;
      answer = a * b;
      hint = `Split ${b} into ${tens}${ones ? ` + ${ones}` : ""}. Multiply ${f(a)} by each part, then add.`;
      explanation = ones
        ? [
            `Split ${b} into tens and ones, ${tens} + ${ones}, so each part is easier to multiply.`,
            `Multiply ${f(a)} by each part: ${f(a)} × ${ones} = ${f(a * ones)} and ${f(a)} × ${tens} = ${f(a * tens)}.`,
            `${ones} and ${tens} together make ${b}, so add the two results: ${f(a * ones)} + ${f(a * tens)} = ${f(answer)}.`,
            `So ${f(a)} × ${b} = ${f(answer)}.`,
          ]
        : [
            `${b} is ${tens / 10} tens, so multiply by ${tens / 10} and then make it tens.`,
            `${f(a)} × ${tens / 10} = ${f((a * tens) / 10)}.`,
            `${f((a * tens) / 10)} tens is ${f((a * tens) / 10)} × 10 = ${f(answer)}.`,
            `So ${f(a)} × ${b} = ${f(answer)}.`,
          ];
      break;
    }
    case "divide-by-one-digit": {
      const d = r(2, 9),
        length = r(2, 3),
        q = quotient(r, d, length, r(0, 3) === 0, 9999),
        n = q * d;
      prompt = `What is ${f(n)} ÷ ${d}?`;
      answer = q;
      const { parts } = partialQuotients(n, d);
      hint = `Ask how many ${d}s fit in ${f(n)}, place by place, starting with the greatest place.`;
      explanation = [
        ...longDivisionSteps(n, d),
        parts.length > 1
          ? `Nothing is left, so add the groups taken: ${parts.map(f).join(" + ")} = ${f(q)}.`
          : `Nothing is left, so ${f(q)} groups fit.`,
        `Check: ${f(q)} × ${d} = ${f(n)}. So ${f(n)} ÷ ${d} = ${f(q)}.`,
      ];
      break;
    }
    case "division-remainder": {
      const d = r(3, 9),
        q = quotient(r, d, r(1, 3), r(0, 4) === 0, 9990),
        rem = r(1, d - 1),
        n = q * d + rem;
      prompt = `What is the remainder when ${f(n)} is divided by ${d}?`;
      answer = rem;
      const { parts } = partialQuotients(n, d);
      hint = `Find the largest multiple of ${d} that fits in ${f(n)}. The remainder is what is left, and it is less than ${d}.`;
      explanation = [
        ...longDivisionSteps(n, d),
        `The groups taken add up to ${parts.length > 1 ? `${parts.map(f).join(" + ")} = ` : ""}${f(q)}. That count is the quotient.`,
        `${rem} ${rem === 1 ? "is" : "are"} left, fewer than ${d}, so no more full groups fit. What is left is the remainder.`,
        `Check: ${f(q)} × ${d} + ${rem} = ${f(n)}. The remainder is ${rem}.`,
      ];
      break;
    }
    case "divide-by-two-digit": {
      let d = r(12, 98);
      if (d % 10 === 0) d++;
      const length = 2 + (r(0, 3) === 0 && d < 90 ? 1 : 0),
        q = quotient(r, d, length, length === 3 && r(0, 1) === 0, 9999),
        n = q * d;
      prompt = `What is ${f(n)} ÷ ${d}?`;
      answer = q;
      const { parts } = partialQuotients(n, d);
      hint = `Estimate with a rounded divisor: about ${Math.round(d / 10) * 10}. Subtract a multiple of ${d} for each place.`;
      explanation = [
        ...longDivisionSteps(n, d),
        parts.length > 1
          ? `Nothing is left, so add the groups taken: ${parts.map(f).join(" + ")} = ${f(q)}.`
          : `Nothing is left, so ${f(q)} groups fit.`,
        `Check: ${f(q)} × ${d} = ${f(n)}. So ${f(n)} ÷ ${d} = ${f(q)}.`,
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
    answer: String(answer),
    hint,
    explanation,
  };
}
