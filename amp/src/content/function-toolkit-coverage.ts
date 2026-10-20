import type { FacetMapping } from "./coverage";
export const functionToolkitFacetMappings: readonly FacetMapping[] = [
  [
    "piecewise-evaluate",
    "piecewise-functions.evaluate",
    "Evaluate two- and three-piece linear functions at interior inputs and at boundaries, from the rule or from a graph with open and closed endpoints, and a two-rate pricing story. Does not assess step functions or nonlinear pieces.",
  ],
  [
    "piecewise-reading",
    "piecewise-functions.read-and-rewrite",
    "Rewrite a|x − h| + k as a linear rule on one side of its vertex, choose a piece's rule from its graph, and count solutions of f(x) = c on a piecewise-linear graph, open endpoints included. Does not assess graphing by hand.",
  ],
  [
    "transform-equation",
    "function-transformations.equations",
    "Match whole-unit shifts, integer vertical stretches and reflections of y = x², |x|, √x and x³ with their equations, from words or a graph, and describe f(x ± c), f(x) ± c, −f(x), f(−x), c·f(x) and f(cx). Does not assess horizontal stretches of named parents or combined horizontal stretch and shift.",
  ],
  [
    "transform-point",
    "function-transformations.points-and-symmetry",
    "Follow one point through a vertical change read from a graph, a horizontal shift or stretch, or a reflection, and use even and odd symmetry. Does not assess proving a function even or odd.",
  ],
  [
    "composition-value",
    "function-composition.evaluate",
    "Evaluate f(g(a)) and (f ∘ g)(a) in either order from formulas, a table or two graphs, and find the input excluded from the domain of f(g(x)) for f(x) = n/(x − c). Does not assess domains of compositions with roots.",
  ],
  [
    "composition-expression",
    "function-composition.expressions",
    "Choose f(g(x)) or g(f(x)) for a linear and a linear or quadratic function, and decompose (px + q)² + c into an outer and an inner function. Does not assess composing rational functions.",
  ],
  [
    "inverse-value",
    "inverse-functions.values",
    "Find f⁻¹(b) for a linear function, a quotient (x + q)/p or 2ˣ + c, from a table of a one-to-one function, or from the graph of a line, square root or exponential. Does not assess verifying inverses by composition.",
  ],
  [
    "inverse-expression",
    "inverse-functions.find-and-restrict",
    "Choose the inverse of a linear function or of (x − h)² + k on one side of its vertex, the point of f⁻¹ mirroring a point of f, and a domain on which a quadratic is one-to-one. Does not assess inverses of rational functions.",
  ],
  [
    "compare-representations",
    "cross-representation-comparison.features",
    "Compare the maximum, minimum, y-intercept or average rate of change from x = 0 to x = 2 of a quadratic or exponential formula with a quadratic or linear function given by a graph or a table. Does not assess comparing end behavior or growth over long intervals.",
  ],
].map(([templateId, facetId, rationale]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: rationale!,
}));
