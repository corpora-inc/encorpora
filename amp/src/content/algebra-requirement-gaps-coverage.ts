import type { FacetMapping } from "./coverage";

export const algebraRequirementGapFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "arithmetic-sequence-as-function",
    facetId: "arithmetic-sequences.HSF.IF.A.3",
    extent: "partial",
    rationale:
      "Choose the domain of an arithmetic sequence, evaluate a(n) in function notation, identify an undefined non-integer or non-positive input, describe the discrete graph, and decide whether a value is a term. Does not assess recursive notation, graphing by hand, or sequences with a domain starting at other than 1.",
  },
  {
    templateId: "geometric-sequence-as-function",
    facetId: "geometric-sequences.HSF.IF.A.3",
    extent: "partial",
    rationale:
      "Choose the domain of a geometric sequence, evaluate a(n) in function notation including negative ratios, identify an undefined non-integer or non-positive input, describe the discrete graph, and decide whether a value is a term. Does not assess recursive notation, graphing by hand, or sequences with a domain starting at other than 1.",
  },
  {
    templateId: "geometric-rule-forms",
    facetId: "geometric-sequences.HSF.BF.A.2",
    extent: "partial",
    rationale:
      "Translate a geometric sequence between recursive and explicit rules, build the rule from a context or from two consecutive terms, with integer, negative and unit-fraction or simple-fraction ratios. Choices only; does not assess writing a rule without options or arithmetic sequences.",
  },
  {
    templateId: "solve-by-completing-square",
    facetId: "complete-square.HSA.REI.B.4",
    extent: "partial",
    rationale:
      "Solve a quadratic equation by completing the square with integer or odd middle coefficient, a leading coefficient other than 1, rational and irrational real roots, and the correct intermediate square step. Choices only; does not assess nonreal solutions, justification written in words, or the quadratic formula.",
  },
  {
    templateId: "complex-quadratic-solve",
    facetId: "complex-numbers.HSN.CN.C.7",
    extent: "partial",
    rationale:
      "Solve a quadratic equation with integer coefficients whose solutions are nonreal complex numbers, by completing the square, and choose the equation with given conjugate solutions. Does not assess odd middle coefficients, the quadratic formula or complex coefficients.",
  },
  {
    templateId: "complex-quadratic-solve",
    facetId: "complex-numbers.HSA.REI.B.4",
    extent: "partial",
    rationale:
      "Solve a quadratic equation with nonreal solutions by completing the square. Does not assess real-solution cases, the quadratic formula or justification in words.",
  },
  {
    templateId: "complex-parts",
    facetId: "complex-numbers.HSN.CN.A.1",
    extent: "partial",
    rationale:
      "Name the real and imaginary parts of a+bi including zero parts, simplify powers of i and multiples of powers of i, write a+sqrt(-k^2) as a+bi, and identify a real number among powers of i. Does not assess the definition of i itself or the plane representation.",
  },
  {
    templateId: "interpret-linear-parameters",
    facetId: "linear-equation-modeling.HSF.LE.B.5",
    extent: "partial",
    rationale:
      "Choose the meaning of the slope and of the initial value in a linear model in context with units, including decreasing models and a model whose input is measured from a nonzero starting year, and a combined interpretation. Does not assess writing a model from data or explaining in words.",
  },
  {
    templateId: "quadratic-form-conversion",
    facetId: "quadratic-graphs.HSF.IF.C.8",
    extent: "partial",
    rationale:
      "Rewrite a quadratic by completing the square or factoring to reveal the vertex form, extreme value, zeros or axis of symmetry, and choose which form shows a feature. Does not assess graphing, exponential forms or complex zeros.",
  },
  {
    templateId: "rational-extraneous-single",
    facetId: "rational-equation-one-denominator.HSA.REI.A.2",
    extent: "partial",
    rationale:
      "Solve a rational equation with one linear variable denominator, including a difference-of-squares numerator, decide whether the candidate is excluded, and explain why it arises. Does not assess two different denominators or quadratic denominators.",
  },
  {
    templateId: "square-root-extraneous",
    facetId: "square-root-equations.HSA.REI.A.2",
    extent: "partial",
    rationale:
      "Solve a square-root equation with a linear right side by squaring, identify the extraneous candidate including a zero boundary and an isolate-first form, and explain why squaring creates it. Does not assess cube roots, two radicals or written proof.",
  },
];
