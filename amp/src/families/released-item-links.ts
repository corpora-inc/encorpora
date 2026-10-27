import type { ContentFamily } from "./registry/types";

/** Archetype links for templates that already practice a released-item task
 * but had no link, so a ledger row can cite them as coverage. Adds no
 * template, lesson or content. */
export const family = {
  id: "released-item-links",
  archetypeLinks: {
    "percent-forms-and-parts": ["percent.of"],
    "system-equation-choice": ["system.from-graph"],
    "stem-leaf-construct": ["data.stem-leaf-read"],
    "graph-estimate-system-solution": ["system.graph"],
    "credit-cost-concepts": ["finance.credit-concept"],
    "number-set-venn": ["number.number-classification"],
    "tally-and-t-chart": ["data.frequency-table-read"],
    "net-worth-statement": ["finance.net-worth"],
  },
} satisfies ContentFamily;
