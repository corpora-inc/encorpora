import type { FacetMapping } from "./coverage";

/** Bounded, partial coverage: what each early data family assesses. */
export const earlyDataFacetMappings: readonly FacetMapping[] = [
  [
    "sort-shapes-count",
    "sort-and-count.shape-groups",
    "Sort three to fifteen circles, squares and triangles by kind and count one group of one to five.",
  ],
  [
    "sort-shapes-most",
    "sort-and-count.compare-groups",
    "Choose the shape group with the unique most or fewest after sorting.",
  ],
  [
    "picture-graph-questions",
    "categorical-data.three-category-questions",
    "Answer total, how-many-more and how-many-fewer questions from a three-category picture graph with one symbol per student and counts one to nine.",
  ],
  [
    "scaled-picture-graph",
    "scaled-graphs.scaled-picture-graphs",
    "Read four-category picture graphs keyed 2, 5 or 10, with half symbols, for one category, a difference or a two-category sum compared with a third.",
  ],
  [
    "scaled-bar-graph",
    "scaled-graphs.scaled-bar-graphs",
    "Read four-category bar graphs on scales of 2, 5 or 10, including halfway values, for differences, totals and two-step comparisons.",
  ],
].map(([templateId, facetId, scope]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: `${scope} Drawing a graph from collected data and choosing categories require separate assessment.`,
}));
