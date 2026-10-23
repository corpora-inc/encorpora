import type { FacetMapping } from "./coverage";
const figureAndChoiceMappings: readonly FacetMapping[] = [
  ["name-polygon", "polygon-properties.polygon-names"],
  ["polygon-with-angles", "polygon-properties.polygon-names"],
  ["solid-parts", "polygon-properties.solid-parts"],
  ["classify-quadrilateral", "quadrilateral-categories.classify"],
  ["find-quadrilateral", "quadrilateral-categories.classify"],
  ["quadrilateral-names", "shape-hierarchy.every-name"],
  ["hierarchy-statement", "shape-hierarchy.inclusion"],
  ["inherited-property", "shape-hierarchy.inclusion"],
].map(([templateId, facetId]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale:
    "Items read exact drawn figures with standard marks, or category statements, and ask for a choice or a count. Drawing shapes with given attributes and justifying classifications in writing require separate assessment.",
}));

export const polygonFacetMappings: readonly FacetMapping[] = [
  ...figureAndChoiceMappings,
  {
    templateId: "quadrilateral-hierarchy-multiselect",
    facetId: "shape-hierarchy.inclusion",
    extent: "partial",
    rationale:
      "Select exactly three true statements from five or six about inclusive rectangle, rhombus, square, and parallelogram categories, inherited properties, and defining conditions. Does not assess drawing a hierarchy, constructing a counterexample, or writing a justification; trapezoid conventions are outside this family.",
  },
];
