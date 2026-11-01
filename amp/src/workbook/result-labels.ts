import { templates } from "../math/engine";
import { historicalTemplates } from "../math/historical-templates";

/**
 * How a problem is named on the results page and the results screen: its
 * problem type's authored title, sentence case. A title too long for the
 * narrowest results tile (more than three lines in the 4-column grid of a
 * long workbook; `npm run workbook:audit` measures every one) uses the short
 * authored label below instead. Never a de-slugged id.
 */
export const shortResultLabels: Readonly<Record<string, string>> = {
  "transformation-sequence-mapping": "Transformations that map a figure",
  "compass-straightedge-reasoning": "Reason about a construction",
  "exponential-passes-linear": "When an exponential passes a linear",
  "two-way-share": "Percents from a two-way table",
  "budget-whole-items": "Items that fit a budget",
  "polynomial-structure": "Polynomial from degree and terms",
  "parabola-axis-vertex-graph": "Axis and vertex of a parabola",
  "inequality-both-sides-number-line": "Inequality with x on both sides",
  "decimal-both-sides-equation": "Decimal equation, x on both sides",
  "nonmonic-complex-quadratic": "Quadratic with nonreal solutions",
  "inverse-exponential-root": "Inverse of an exponential or root",
  "rational-two-denominators": "Rational equation, two denominators",
  "cubic-quotient-remainder": "Divide a cubic by a binomial",
  "two-radical-equation": "Equation with two square roots",
  "geometric-series-total": "Total of a geometric series",
  "exponential-parameter-log": "Base-10 exponential equation",
  "normal-probability": "Normal model probability",
  "parabola-vertex-distance": "Parabola vertex from directrix",
  "remainder-zero-graph": "Graph of a divisible polynomial",
  "repeated-zero-rule": "Rule with a repeated zero",
  "quartic-factored-form": "Factor a quartic binomial",
  "cubic-quotient-factored": "Factored quotient of a cubic",
  "exponential-points-statement": "Exponential model through points",
  "rational-abs-solution-count": "Rational equals absolute value",
  "geo-rigid-statement": "True after rigid motions",
  "geo-altitude-ratio": "Trig ratio from an altitude",
  "geo-parallel-statement": "Triangles from parallel segments",
  "geometric-signed-term": "Term of a geometric sequence",
  "density-volume-steps": "Show the work: volume and density",
  "trig-leg-steps": "Show the work: a right-triangle leg",
  "isosceles-perimeter-steps": "Show the work: isosceles perimeter",
  "parallelogram-angle-steps": "Show the work: parallelogram angle",
  "parallel-segment-steps": "Show the work: a parallel segment",
  "two-radical-steps": "Show the work: two square roots",
  "grouped-both-sides-steps": "Show the work: grouped linear equation",
};

const titles = new Map(
  [...historicalTemplates, ...templates].map((t) => [t.id, t.title]),
);

export function resultLabel(templateId: string): string {
  return shortResultLabels[templateId] ?? titles.get(templateId) ?? "Problem";
}
