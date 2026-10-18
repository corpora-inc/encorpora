import type { FacetMapping } from "./coverage";

/** Task associations describe assessed response types; publication and review need separate evidence. */
export const inequalityFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "affine-linear-inequality",
    facetId: "linear-inequalities.affine-solution-set",
    extent: "partial",
    rationale:
      "Select an exact half-line solution set with positive or negative rational coefficients and all four comparison signs. Generated arithmetic has bounded numerators and denominators. Choices share the input comparison’s strictness, so endpoint inclusion, graph translation, contextual modeling, and written justification need separate assessment.",
  },
  {
    templateId: "grouped-linear-inequality",
    facetId: "linear-inequalities.grouped-solution-set",
    extent: "partial",
    rationale:
      "Select the complete solution set after distributing one group and collecting terms on both sides. Rational arithmetic is bounded and choices share the input comparison’s strictness. Endpoint inclusion, nested groups, context, and an independently written derivation need separate assessment.",
  },
  {
    templateId: "cancelled-linear-inequality",
    facetId: "linear-inequalities.cancellation-solution-set",
    extent: "partial",
    rationale:
      "Classify cancelling integer-coefficient inequalities as all real numbers or no real numbers, including equal constants with strict and inclusive signs. Rational-coefficient cancellation and written justification need separate assessment.",
  },
];
