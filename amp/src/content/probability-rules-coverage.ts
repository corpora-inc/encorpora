import type { FacetMapping } from "./coverage";
export const probabilityRulesFacetMappings: readonly FacetMapping[] = [
  ["event-set-count", "event-sets.set-operations"],
  ["addition-rule-probability", "probability-addition.overlap-correction"],
  [
    "conditional-probability-value",
    "conditional-probability.restricted-sample-space",
  ],
  [
    "multiplication-rule-probability",
    "probability-multiplication.sequential-products",
  ],
].map(([templateId, facetId]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale:
    "Items give two events as counts in a Venn diagram, a two-way table, a list of whole-number outcomes, a standard deck, a two-stage story or stated probabilities, and ask for one exact count or probability. Three or more events, written set-builder notation, interpreting independence from data and justifying the rules in writing require separate assessment.",
}));
