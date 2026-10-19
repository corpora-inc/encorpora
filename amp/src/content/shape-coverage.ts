import type { FacetMapping } from "./coverage";
export const shapeFacetMappings: readonly FacetMapping[] = [
  ["name-flat-shape", "name-shapes.flat-names"],
  ["find-named-shape", "name-shapes.flat-names"],
  ["name-solid-shape", "name-shapes.solid-names"],
  ["compose-shape-name", "compose-shapes.compose-outline"],
  ["complete-the-shape", "compose-shapes.fill-gap"],
  ["count-sides-corners", "shape-attributes.sides-corners"],
  ["defining-attribute", "shape-attributes.defining"],
].map(([templateId, facetId]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale:
    "Items show exact drawn figures and ask for a choice or a count. Drawing, building and describing shapes in the learner's own words, and positional language, require separate assessment.",
}));
