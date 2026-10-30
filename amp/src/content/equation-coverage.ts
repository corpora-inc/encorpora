import type { FacetMapping } from "./coverage";
export const equationFacetMappings: readonly FacetMapping[] = [
  [
    "one-step-equation",
    "one-step-equations.inverse-operation",
    "Solve x + p = q, p + x = q, x − p = q, px = q and x ÷ p = q with nonnegative whole numbers to 95, terminating decimals or fractions with denominators to 12, entering an exact value. Does not assess negative values, fraction coefficients or written checks.",
  ],
  [
    "one-step-equation-story",
    "one-step-equations.story-equation",
    "Choose the equation and solution together for eight story contexts (joining, taking away, equal groups and equal sharing) with whole numbers. Does not assess writing the equation without choices, decimal or fraction stories, or comparison stories.",
  ],
  [
    "balance-one-step",
    "one-step-equations.balance-model",
    "Find the whole-number weight of one block on a drawn level balance showing x + a = b or px = b with at most 24 cubes on the right pan. Does not assess balances with unknowns on both pans.",
  ],
  [
    "two-step-equation",
    "two-step-equations.symbolic-solve",
    "Solve px + q = r, q + px = r and p(x + q) = r with signed integer coefficients up to 9 and constants up to 15, or terminating decimal coefficients, with integer solutions from −12 to 12. Does not assess fraction coefficients or non-integer solutions.",
  ],
  [
    "two-step-word-problem",
    "two-step-equations.story-solve",
    "Solve seven story types leading to px + q = r, q − px = r, p(x + q) = r or p(x − q) = r (fees, savings, taxi fares with cents, draining tanks, tickets, perimeters, sale prices), entering a whole-number answer. Does not assess interpreting the solution's reasonableness in writing.",
  ],
  [
    "two-step-equation-model",
    "two-step-equations.story-equation",
    "Choose the equation for the same seven story types from distractors that swap the repeated and one-time amounts, change the grouping or reverse a sign; every distractor has a different solution. Does not assess writing the equation without choices.",
  ],
  [
    "balance-two-step",
    "two-step-equations.balance-model",
    "Find the whole-number weight of one block on a drawn level balance showing px + q = r (p from 2 to 4) or p(x + q) = r with 2 or 3 identical bags, at most 30 cubes. Does not assess negative quantities.",
  ],
  [
    "inequality-context-bound",
    "simple-inequalities.context-inequality",
    "Choose x > c, x < c, x ≥ c or x ≤ c for ten real-world conditions (taller than, above, colder than, at least, at most, no more than, or more), including negative temperature boundaries. Does not assess compound conditions or writing the inequality without choices.",
  ],
  [
    "inequality-from-number-line",
    "simple-inequalities.graph-reading",
    "Choose the inequality shown by one graphed half-line with an integer boundary from −9 to 12 on a ten-unit window, among all four signs. Does not assess non-integer boundaries or graphs of compound inequalities.",
  ],
  [
    "inequality-number-line-choice",
    "simple-inequalities.graph-choice",
    "Choose among four graphs that differ in circle and direction the one showing x > c, x < c, x ≥ c or x ≤ c, stated symbolically or in words. Does not assess drawing the graph.",
  ],
  [
    "inequality-solution-set",
    "simple-inequalities.solution-recognition",
    "Choose the list of numbers (integers and tenths) that are all solutions, or the true statement about the solution set, including that there are infinitely many solutions and whether the boundary is one. Does not assess written explanations.",
  ],
].map(([templateId, facetId, rationale]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: rationale!,
}));
