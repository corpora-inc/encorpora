import { defineAxis, type Random } from "./axes";

/**
 * Equation orientation. `operation-first` writes 63 ÷ 9 = 7; `result-first`
 * writes 7 = 63 ÷ 9; `mixed` writes some of a set each way (released items mix
 * them in one question). Equality is symmetric, so orientation never changes
 * an equation's truth — the oracle checks exactly that.
 */
export const orientationAxis = defineAxis("orientation", [
  "operation-first",
  "mixed",
  "result-first",
]);
export type Orientation = (typeof orientationAxis.values)[number];

/** TeX sides of one equation, without `$`. */
export interface EquationSides {
  operation: string;
  result: string;
}

export const writeEquation = (eq: EquationSides, resultFirst: boolean) =>
  resultFirst
    ? `${eq.result}=${eq.operation}`
    : `${eq.operation}=${eq.result}`;

/** Which of `n` equations are written result-first. A mixed set always shows
 * both orientations when it has two or more equations. */
export function resultFirstFlags(
  orientation: Orientation,
  n: number,
  surface: Random,
): boolean[] {
  if (orientation === "operation-first") return Array(n).fill(false);
  if (orientation === "result-first") return Array(n).fill(true);
  if (n < 2) return Array(n).fill(surface(0, 1) === 1);
  const flipped = surface(1, n - 1);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = surface(0, i);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const chosen = new Set(order.slice(0, flipped));
  return order.map((_, i) => chosen.has(i));
}
