/**
 * Mal-rules: the wrong answers children actually produce.
 *
 * Every rule here *runs the buggy procedure* instead of computing a shortcut
 * from the correct answer. That is the house rule in `dynawalla/curriculum`
 * (see `malrules/columnOp.ts`) and it matters for the same reason: a shortcut
 * happens to agree with the procedure on the cases you thought of, and silently
 * stops agreeing the moment the borrow chain has a different shape.
 *
 * Everything is integer arithmetic. No float ever reaches an answer or a
 * comparison — that is what makes "is this the guilty one" a `===` on strings.
 */

const digitsOf = (n: number, cols: number): number[] => {
  const out: number[] = [];
  let rest = Math.abs(n);
  for (let i = 0; i < cols; i++) {
    out.push(rest % 10);
    rest = Math.trunc(rest / 10);
  }
  return out;
};

const fromDigits = (digits: readonly number[]): number => {
  let value = 0;
  for (let i = digits.length - 1; i >= 0; i--) value = value * 10 + (digits[i] ?? 0);
  return value;
};

const columnCount = (...values: number[]): number => {
  let cols = 1;
  for (const v of values) cols = Math.max(cols, String(Math.abs(v)).length);
  return cols;
};

/**
 * `mis.sub.smaller-from-larger` — the single most common subtraction bug. In
 * every column the child takes the smaller digit from the larger, whichever way
 * round it sits, and never regroups. 52 − 27 → |2−7| |5−2| → 35.
 */
export function smallerFromLarger(a: number, b: number): number {
  const cols = columnCount(a, b);
  const top = digitsOf(a, cols);
  const bot = digitsOf(b, cols);
  const out: number[] = [];
  for (let i = 0; i < cols; i++) out.push(Math.abs((top[i] ?? 0) - (bot[i] ?? 0)));
  return fromDigits(out);
}

/**
 * `mis.sub.borrow-not-paid` — the child *does* add ten to the top digit but
 * never decrements the column it borrowed from. 52 − 27 → 12−7=5, 5−2=3 → 35.
 * (It collides with smaller-from-larger on many two-digit pairs; callers
 * de-duplicate, and on three digits the two separate cleanly.)
 */
export function borrowNotPaid(a: number, b: number): number {
  const cols = columnCount(a, b);
  const top = digitsOf(a, cols);
  const bot = digitsOf(b, cols);
  const out: number[] = [];
  for (let i = 0; i < cols; i++) {
    const t = top[i] ?? 0;
    const s = bot[i] ?? 0;
    out.push(t < s ? t + 10 - s : t - s);
  }
  return fromDigits(out);
}

/**
 * `mis.add.carry-dropped` — columns summed independently, the carry written
 * nowhere. 27 + 45 → (7+5) mod 10 = 2, (2+4) mod 10 = 6 → 62.
 */
export function carryDropped(a: number, b: number): number {
  const cols = columnCount(a, b) + 1;
  const top = digitsOf(a, cols);
  const bot = digitsOf(b, cols);
  const out: number[] = [];
  for (let i = 0; i < cols; i++) out.push(((top[i] ?? 0) + (bot[i] ?? 0)) % 10);
  return fromDigits(out);
}

/**
 * `mis.add.carry-written-inline` — the carry is not carried, it is written into
 * the same column, so the tens digit of a column sum lands beside its units.
 * 27 + 45 → 7+5 = 12, 2+4 = 6 → 612. Wildly wrong, and children do it.
 */
export function carryWrittenInline(a: number, b: number): number {
  const cols = columnCount(a, b);
  const top = digitsOf(a, cols);
  const bot = digitsOf(b, cols);
  let text = "";
  for (let i = cols - 1; i >= 0; i--) text += String((top[i] ?? 0) + (bot[i] ?? 0));
  return Number(text);
}

/**
 * `mis.mul.table-slip` — the times table recited one step short or one step
 * long. 7 × 6 → 36 or 48. `step` is the number of rungs missed (signed).
 */
export function tableSlip(a: number, b: number, step: number): number {
  return a * (b + step);
}

/** `mis.mul.added-instead` — the operator was read but not obeyed. */
export const addedInstead = (a: number, b: number): number => a + b;

/** `mis.arith.off-by-one` — a counting-on error, one short or one long. */
export const offByOne = (value: number, step: number): number => value + step;

/**
 * `mis.div.remainder-as-quotient` — the child divides, finds it does not go
 * evenly at the digit they tried, and reports what is left over instead.
 */
export function remainderAsQuotient(a: number, b: number): number {
  if (b === 0) return 0;
  return a % b === 0 ? a - b : a % b;
}

/**
 * `mis.arith.left-to-right` — precedence ignored, the expression evaluated
 * strictly left to right. 2 + 3 × 4 → 20. A real and very durable bug.
 */
export type Op = "+" | "-" | "*";

export function leftToRight(a: number, op1: Op, b: number, op2: Op, c: number): number {
  const step = apply(a, op1, b);
  return apply(step, op2, c);
}

/**
 * `mis.arith.dropped-step` — the last operation of a two-step problem is never
 * performed; the intermediate value is handed in as the answer.
 */
export function droppedStep(a: number, op1: Op, b: number): number {
  return apply(a, op1, b);
}

function apply(a: number, op: Op, b: number): number {
  return op === "+" ? a + b : op === "-" ? a - b : a * b;
}

/** Digits reversed on the way onto the page. 71 → 17. */
export function digitsReversed(value: number): number {
  return Number(String(value).split("").reverse().join(""));
}
