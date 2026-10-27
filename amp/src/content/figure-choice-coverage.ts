import type { FacetMapping } from "./coverage";

/** Figure-choice responses: the learner chooses one of several drawn graphs
 * or number lines. */
export const figureChoiceFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "graph-of-linear-rule",
    facetId: "linear-models.core",
    extent: "partial",
    rationale:
      "Choose the graph of a line given by y = mx + b, by its slope and y-intercept in words, by a four-row table or by ax + y = c, with whole or fractional slopes and whole intercepts, among lines with the slope's sign flipped, slope and intercept swapped (or rise and run swapped) and the intercept placed on the x-axis. Does not assess contexts, interpreting the rate and initial value, or writing the function.",
  },
  {
    templateId: "graph-of-proportional-rate",
    facetId: "proportional-relationships.core",
    extent: "partial",
    rationale:
      "Choose the first-quadrant graph of a constant rate given as a total over two to four units or as a unit rate from 2 to 4, among lines that start above the origin, use the total as the rate, invert the rate or add the rate once. Does not assess reading the constant from a graph, tables, or rates with fractions.",
  },
  {
    templateId: "graph-of-inequality-number-line",
    facetId: "linear-inequalities.core",
    extent: "partial",
    rationale:
      "Solve ax (op) c or ax + b (op) c with whole coefficients, mostly negative, and choose its number line among graphs with the endpoint open or closed wrongly, the ray reversed (an unreversed sign) and a boundary from a sign slip or an inverse-operation slip. Does not assess compound inequalities, variables on both sides, writing inequalities from contexts or interpreting solutions.",
  },
  {
    templateId: "graph-of-quadratic-or-exponential",
    facetId: "function-transformations.core",
    extent: "partial",
    rationale:
      "Choose the graph of y = a(x − h)² + k, of y = f(x − h) + k for f(x) = x², or of y = a·bˣ for whole or unit-fraction bases, among graphs shifted the wrong way, reflected, with the shifts swapped, with growth and decay swapped, with the intercept read at x = 1, or drawn as a line through the same two points. Does not assess stretches, reflections across the y-axis written as f(−x), or other parent functions.",
  },
];
