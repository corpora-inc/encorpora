import type { FacetMapping } from "./coverage";
export const patternFunctionFacetMappings: readonly FacetMapping[] = [
  [
    "rule-pattern-term",
    "rule-patterns.number-rule-terms",
    "Find the 4th to 10th term of a whole-number pattern from its start and an add, subtract or multiply-by rule (steps 2 to 12, factors 2 and 3). Does not assess shape patterns or rules that use the term number.",
  ],
  [
    "rule-pattern-feature",
    "rule-patterns.rule-features",
    "Choose the feature every term shares for an add rule: always odd, always even, alternating, a common factor of 3 to 6, or a fixed ones digit for steps that are multiples of 10. Does not assess written explanations or features of multiplication rules.",
  ],
  [
    "related-patterns-relationship",
    "related-patterns.paired-terms",
    "Two add rules starting at 0 with B's step 2 to 6 times A's (A's step 1 to 5): find the multiplier, or the B-term paired with a later A-term, from a table of pairs and their first-quadrant graph. Does not assess patterns with nonzero starts or plotting by the learner.",
  ],
  [
    "dependent-variable-equation",
    "dependent-variables.equation-from-table-graph",
    "Choose the equation y = kx or y = x + c that gives the dependent variable for a context table and graph (distance, pay, printing, tickets, ages, temperature), against swapped, additive/multiplicative and per-row distractors. Does not assess writing the equation freely or constructing the graph.",
  ],
  [
    "dependent-variable-value",
    "dependent-variables.use-equation",
    "Find the dependent value from y = kx, or the independent value from y = kx or y = x + c, in a stated context with whole-number results. Does not assess equations with both a multiplier and a constant.",
  ],
  [
    "compare-function-rates",
    "compare-functions.rate-and-initial-value",
    "Compare the rates of change (integers or halves, possibly negative) and initial values of two linear functions given as a table, graph, equation or description. Does not assess nonlinear functions or comparisons at a given input.",
  ],
  [
    "linear-function-choice",
    "compare-functions.linear-or-nonlinear",
    "Choose the linear (or the nonlinear) rule among four, including linear rules written as constants, with parentheses, with x divided by a number or with terms reordered, and nonlinear rules with x², k/x or x(x + h). Does not assess linearity from tables or graphs.",
  ],
].map(([templateId, facetId, rationale]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: rationale!,
}));
