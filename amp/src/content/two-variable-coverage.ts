import type { FacetMapping } from "./coverage";
export const twoVariableFacetMappings: readonly FacetMapping[] = [
  [
    "system-model-value",
    "systems-modeling.two-unknowns",
    "Write and solve a count equation and a value equation for tickets, flowers, test questions or coins, with whole-number answers. Does not assess systems with three unknowns or non-integer solutions.",
  ],
  [
    "constraint-feasible",
    "systems-modeling.feasible-combination",
    "Choose the whole-number combination that meets an at-most capacity and an at-least income constraint, with the feasible region shaded, against points that break one constraint. Does not assess optimizing an objective.",
  ],
  [
    "half-plane-inequality",
    "inequality-regions.read-region",
    "Choose the inequality or two-inequality system shown by a shaded half-plane or overlap, with slope-intercept, standard-form, vertical or horizontal boundaries, solid or dashed. Does not assess graphing by the learner.",
  ],
  [
    "inequality-solution-point",
    "inequality-regions.test-point",
    "Choose the point that solves a slope-intercept or standard-form inequality, including points on solid and dashed boundaries. Does not assess nonlinear inequalities.",
  ],
  [
    "literal-equation-solve",
    "symbolic-linear-constraints.letter-coefficients",
    "Choose the solution of kx + b = c, kx + b = qx + d, k(x − h) = c, or kx + b < c with the sign of k given, keeping the stated condition. Does not assess equations with two letter coefficients.",
  ],
  [
    "parameter-solution-count",
    "symbolic-linear-constraints.exceptional-cases",
    "Find the parameter value that gives a linear equation no solution or infinitely many, or a two-equation system no solution. Does not assess explaining the cases in writing.",
  ],
  [
    "equation-step-property",
    "equation-reasoning.justify-steps",
    "Name the distributive property, combining like terms, or the addition, subtraction, multiplication or division property of equality for a step solving a linear equation, or find the one broken step. Does not assess writing a full justification.",
  ],
  [
    "elimination-equivalent",
    "elimination-proof.sum-keeps-solutions",
    "Choose the equation from adding two equations or a multiple of one to the other, the system equivalent to a given one, or the reason the sum keeps every solution. Does not assess writing the proof.",
  ],
].map(([templateId, facetId, rationale]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: rationale!,
}));
