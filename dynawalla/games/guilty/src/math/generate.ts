/**
 * Question generation for the stub host.
 *
 * Seeded and deterministic: `generate(seed, index, difficulty)` is a pure
 * function, so a run replays exactly. Every value is an integer and every
 * answer is the decimal string of one — a comparison is `===` on strings, never
 * a float subtraction with an epsilon.
 *
 * Distractors come from `malrules.ts` first, and only fall back to near-misses
 * when a mal-rule collides with the answer or with another rule. Same-length
 * candidates are preferred so a descending husk can never be ruled out on its
 * silhouette alone — the player has to actually do the arithmetic.
 */

import type { Question } from "../contract.ts";
import { makeRng, type Rng } from "./rng.ts";
import {
  addedInstead,
  borrowNotPaid,
  carryDropped,
  carryWrittenInline,
  digitsReversed,
  droppedStep,
  leftToRight,
  offByOne,
  remainderAsQuotient,
  smallerFromLarger,
  tableSlip,
} from "./malrules.ts";

export const MINUS = "−";
export const TIMES = "×";
export const DIVIDE = "÷";

type Draft = {
  prompt: string;
  answer: number;
  domain: string;
  /** Mal-rule outputs, best first. May contain junk; the caller filters. */
  wrong: number[];
};

/** Which shapes are legal at this difficulty, widest band last. */
function shapesFor(difficulty: number): string[] {
  if (difficulty < 0.16) return ["add10", "sub10"];
  if (difficulty < 0.3) return ["add20", "sub20", "add10", "sub10"];
  if (difficulty < 0.44) return ["add2d", "sub2d", "add20", "sub20"];
  if (difficulty < 0.56) return ["mul", "mul", "add2d", "sub2d"];
  if (difficulty < 0.68) return ["div", "mul", "mul", "sub2d"];
  if (difficulty < 0.82) return ["mul2d", "div", "mul", "twoStep"];
  return ["twoStep", "twoStep", "mul2d", "div"];
}

function draft(shape: string, rng: Rng): Draft {
  switch (shape) {
    case "add10": {
      const a = rng.int(1, 8);
      const b = rng.int(1, 9 - a);
      return {
        prompt: `${a} + ${b}`,
        answer: a + b,
        domain: "add-sub",
        wrong: [offByOne(a + b, 1), offByOne(a + b, -1), Math.abs(a - b), a + b + 2],
      };
    }
    case "sub10": {
      const a = rng.int(3, 10);
      const b = rng.int(1, a - 1);
      return {
        prompt: `${a} ${MINUS} ${b}`,
        answer: a - b,
        domain: "add-sub",
        wrong: [offByOne(a - b, 1), offByOne(a - b, -1), a + b, b],
      };
    }
    case "add20": {
      // Bridging ten is the point, so force a carry out of the units column.
      const a = rng.int(4, 9);
      const b = rng.int(11 - a, 9);
      return {
        prompt: `${a} + ${b}`,
        answer: a + b,
        domain: "add-sub",
        wrong: [carryDropped(a, b), offByOne(a + b, -1), offByOne(a + b, 1), Math.abs(a - b)],
      };
    }
    case "sub20": {
      // Force a borrow: minuend in the teens, subtrahend bigger than its units.
      const a = rng.int(11, 18);
      const units = a % 10;
      const b = rng.int(units + 1, 9);
      return {
        prompt: `${a} ${MINUS} ${b}`,
        answer: a - b,
        domain: "add-sub",
        wrong: [
          smallerFromLarger(a, b),
          borrowNotPaid(a, b),
          offByOne(a - b, 1),
          offByOne(a - b, -1),
        ],
      };
    }
    case "add2d": {
      const a = rng.int(14, 79);
      const b = rng.int(14, 79);
      return {
        prompt: `${a} + ${b}`,
        answer: a + b,
        domain: "add-sub",
        wrong: [
          carryDropped(a, b),
          offByOne(a + b, -1),
          carryWrittenInline(a, b),
          Math.abs(a - b),
          offByOne(a + b, 10),
        ],
      };
    }
    case "sub2d": {
      // Guarantee a regroup so smaller-from-larger has something to be wrong about.
      const a = rng.int(31, 98);
      const units = a % 10;
      const b = rng.int(10 + units + 1, a - 1);
      return {
        prompt: `${a} ${MINUS} ${b}`,
        answer: a - b,
        domain: "add-sub",
        wrong: [
          smallerFromLarger(a, b),
          borrowNotPaid(a, b),
          offByOne(a - b, -1),
          offByOne(a - b, 10),
          addedInstead(a, b),
        ],
      };
    }
    case "mul": {
      const a = rng.int(2, 9);
      const b = rng.int(2, 9);
      return {
        prompt: `${a} ${TIMES} ${b}`,
        answer: a * b,
        domain: "mul",
        wrong: [
          tableSlip(a, b, -1),
          tableSlip(a, b, 1),
          addedInstead(a, b),
          tableSlip(b, a, -1),
          offByOne(a * b, 1),
        ],
      };
    }
    case "mul2d": {
      const a = rng.int(12, 29);
      const b = rng.int(3, 9);
      return {
        prompt: `${a} ${TIMES} ${b}`,
        answer: a * b,
        domain: "mul",
        wrong: [
          // The classic: multiply the units, multiply the tens, never carry.
          (Math.trunc(a / 10) * b) * 10 + ((a % 10) * b) % 10,
          tableSlip(b, a, -1),
          tableSlip(b, a, 1),
          addedInstead(a, b),
          offByOne(a * b, 10),
        ],
      };
    }
    case "div": {
      const q = rng.int(2, 9);
      const b = rng.int(2, 9);
      const a = q * b;
      return {
        prompt: `${a} ${DIVIDE} ${b}`,
        answer: q,
        domain: "div",
        wrong: [
          offByOne(q, 1),
          offByOne(q, -1),
          remainderAsQuotient(a, b),
          a - b,
          b,
        ],
      };
    }
    default: {
      // twoStep — precedence is the whole point, so the second operator is
      // always ×, and `leftToRight` is a genuinely different number.
      const c = rng.int(2, 6);
      const b = rng.int(2, 6);
      const product = b * c;
      const subtractive = rng.int(0, 1) === 1;

      if (subtractive) {
        // Non-negative by construction: the minuend is built above the product.
        const a = product + rng.int(1, 14);
        return {
          prompt: `${a} ${MINUS} ${b} ${TIMES} ${c}`,
          answer: a - product,
          domain: "two-step",
          wrong: [
            leftToRight(a, "-", b, "*", c),
            droppedStep(a, "-", b),
            product,
            offByOne(a - product, -1),
            a - b - c,
          ],
        };
      }
      const a = rng.int(2, 14);
      return {
        prompt: `${a} + ${b} ${TIMES} ${c}`,
        answer: a + product,
        domain: "two-step",
        wrong: [
          leftToRight(a, "+", b, "*", c),
          droppedStep(a, "+", b),
          product,
          offByOne(a + product, -1),
          a + b + c,
        ],
      };
    }
  }
}

/** Near-misses used only when the mal-rules could not supply enough. */
function fallbacks(answer: number): number[] {
  const out = [answer + 1, answer - 1, answer + 10, answer - 10, answer + 2, answer - 2];
  if (answer >= 10) out.push(digitsReversed(answer));
  return out;
}

function acceptable(value: number, answer: number, taken: Set<number>): boolean {
  if (!Number.isInteger(value)) return false;
  if (value < 0) return false;
  if (value === answer) return false;
  if (taken.has(value)) return false;
  if (value > 9999) return false;
  return true;
}

/**
 * Six distractors, best first. Same digit-length as the answer is preferred, so
 * the player cannot shortcut the arithmetic by counting digits — but a
 * different-length mal-rule output is still allowed in rather than dropping to
 * a meaningless near-miss.
 */
export function distractorsFor(answer: number, wrong: readonly number[]): string[] {
  const taken = new Set<number>();
  const sameLength: number[] = [];
  const other: number[] = [];
  const width = String(answer).length;

  for (const value of wrong) {
    if (!acceptable(value, answer, taken)) continue;
    taken.add(value);
    (String(value).length === width ? sameLength : other).push(value);
  }
  for (const value of fallbacks(answer)) {
    if (!acceptable(value, answer, taken)) continue;
    taken.add(value);
    (String(value).length === width ? sameLength : other).push(value);
  }
  // Last resort: walk outwards until there are enough. Cannot loop forever —
  // every step produces a new integer and `acceptable` only rejects duplicates.
  let step = 3;
  while (sameLength.length + other.length < 6 && step < 40) {
    for (const value of [answer + step, answer - step]) {
      if (!acceptable(value, answer, taken)) continue;
      taken.add(value);
      (String(value).length === width ? sameLength : other).push(value);
    }
    step++;
  }
  return [...sameLength, ...other].slice(0, 6).map(String);
}

export function generate(seed: number, index: number, difficulty: number): Question {
  const rng = makeRng((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  const clamped = Math.max(0, Math.min(1, difficulty));
  const shapes = shapesFor(clamped);
  const shape = shapes[rng.int(0, shapes.length - 1)] as string;
  const d = draft(shape, rng);
  return {
    id: `q${index}-${shape}-${rng.state().toString(36)}`,
    prompt: d.prompt,
    answer: String(d.answer),
    distractors: distractorsFor(d.answer, d.wrong),
    domain: d.domain,
    difficulty: clamped,
  };
}
