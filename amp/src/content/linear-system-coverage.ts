import type { FacetMapping } from "./coverage";

export const linearSystemFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "linear-system-pair",
    facetId: "linear-systems.ordered-pair-solutions",
    extent: "partial",
    rationale:
      "Choose the unique exact ordered pair satisfying two equations with bounded signed integer coefficients and rational constants. Each equation separately admits two displayed pairs. Recognition does not establish independently constructed answers, a chosen solving method, modeling, graph reading, symbolic parameters, or arbitrary rational coefficients.",
  },
  {
    templateId: "linear-system-solution-count",
    facetId: "linear-systems.solution-count",
    extent: "partial",
    rationale:
      "Classify bounded two-variable linear systems as exactly one, no, or infinitely many shared ordered pairs, including vertical, horizontal, and negative proportionality cases. Selecting a count does not assess a complete parametrized solution set, written justification, graphical interpretation, or symbolic parameter conditions.",
  },
];
