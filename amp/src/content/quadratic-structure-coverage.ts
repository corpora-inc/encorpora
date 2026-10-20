import type { FacetMapping } from "./coverage";
export const quadraticStructureFacetMappings: readonly FacetMapping[] = [
  [
    "parabola-vertex",
    "quadratic-graphs.vertex",
    "Choose a parabola's vertex from vertex form or standard form with integer coefficients, or read it from a graph on an integer grid. Does not assess sketching or fractional vertices.",
  ],
  [
    "parabola-axis",
    "quadratic-graphs.axis-of-symmetry",
    "Find the axis of symmetry from two integer zeros (factored form or a graph), from two points at the same height, or from x = −b/(2a), with exact fractions. Does not assess symmetry of other functions.",
  ],
  [
    "parabola-shift",
    "quadratic-graphs.translations",
    "Match a translation of y = x² by whole units with y = (x − h)² + k, in words, on a graph or in reverse. Does not assess stretches or reflections.",
  ],
  [
    "binomial-area-product",
    "expression-structure.binomial-products",
    "Expand a product of two binomials with small integer coefficients, from an algebra-tile area model, an expression or a garden's sides. Does not assess products of three or more factors.",
  ],
  [
    "structure-meaning",
    "expression-structure.interpret-parts",
    "Interpret the constant or coefficient of a projectile height, a fee-plus-rate cost, or the starting value or growth factor of an exponential model. Does not assess building the formula.",
  ],
  [
    "structure-rewrite",
    "expression-structure.rewrite-by-structure",
    "Rewrite x⁴ − n⁴, (x + p)² − q² or a perfect-square trinomial as a product by seeing A² − B² or A² + 2AB + B². Does not assess sums of cubes.",
  ],
  [
    "zeros-from-factors",
    "polynomial-zeros.factors-and-zeros",
    "Find the zeros of a cubic in factored form, choose a cubic with given integer zeros, or match a graph's x-intercepts and end behavior to factored form. Does not assess complex zeros.",
  ],
  [
    "zero-multiplicity",
    "polynomial-zeros.multiplicity",
    "Tell where (x − d)²(x − s) touches and crosses the x-axis, from the equation, from a description or from its graph. Does not assess multiplicities above two.",
  ],
  [
    "remainder-theorem",
    "polynomial-division.remainder-theorem",
    "Find the remainder of a cubic divided by x − a as p(a), from the synthetic-division layout, or the coefficient that makes x − a a factor. Does not assess divisors of degree two.",
  ],
  [
    "polynomial-quotient",
    "polynomial-division.divide-by-linear",
    "Choose the quotient and remainder of a cubic divided by x − a, from words, the synthetic-division layout or p(x) = (x − a)q(x) + R. Does not assess long division by quadratics or rational expressions.",
  ],
].map(([templateId, facetId, rationale]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: rationale!,
}));
