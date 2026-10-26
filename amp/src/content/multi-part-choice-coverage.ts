import type { FacetMapping } from "./coverage";

/** Multi-part choice responses: one option per blank, row or slot. */
export const multiPartChoiceFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "inline-linear-features",
    facetId: "linear-models.core",
    extent: "partial",
    rationale:
      "Find a line's slope, y-intercept and direction, or the m and b of y = mx + b, from a graph with two labeled lattice points, two given points or a four-row table, choosing each value in a sentence with blanks. Integer and fractional slopes; integer intercepts. Does not assess writing the equation, contexts or interpreting the rate and initial value.",
  },
  {
    templateId: "proportional-match-table",
    facetId: "proportional-relationships.core",
    extent: "partial",
    rationale:
      "Mark four or five equations or lists of pairs as proportional or not in a match table, including y = kx with whole or fractional k, x divided by a constant, equations that simplify to y = kx, linear relationships with a nonzero intercept, squares, inverse variation and pairs with a constant difference. Does not assess graphs, tables of contexts or finding the constant of proportionality.",
  },
  {
    templateId: "label-expression-parts",
    facetId: "variable-expressions.core",
    extent: "partial",
    rationale:
      "Label the coefficient, a term, the constant term and the number of terms of ax + by + c; the coefficients, exponent and constant of ax^2 + bx + c; and the kind of expression, the factor that is a sum and its number of terms in a(x + c), by choosing parts for labeled slots. Does not assess translating words to expressions or evaluating them.",
  },
];
