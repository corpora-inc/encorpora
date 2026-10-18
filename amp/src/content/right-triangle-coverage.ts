import type { FacetMapping } from "./coverage";

/** Exact task-domain associations; review and publication require separate artifact evidence. */
export const rightTriangleFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "right-triangle",
    facetId: "pythagorean-theorem.integer-hypotenuse",
    extent: "complete",
    rationale:
      "The generator samples all twelve stated scaled triples and asks for their hypotenuse. It does not assess other triples, irrational lengths, or proof.",
  },
  {
    templateId: "right-triangle-missing-leg",
    facetId: "pythagorean-theorem.integer-missing-leg",
    extent: "complete",
    rationale:
      "The generator enumerates every positive integer right triangle with hypotenuse at most 50 and can omit either leg: 40 known-leg/hypotenuse cases. Responses assess the length, not an independent proof.",
  },
  {
    templateId: "pythagorean-converse",
    facetId: "pythagorean-theorem.integer-converse",
    extent: "complete",
    rationale:
      "The generator samples valid integer triangles with sides at most 30 from the right and both nonright square-comparison classes, varying side and answer order. It assesses classification, not construction or an independently written proof.",
  },
];
