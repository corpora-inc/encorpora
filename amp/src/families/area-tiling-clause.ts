import type { ContentFamily } from "./registry/types";
import {
  areaTilingClauseTemplates,
  generateAreaTilingClause,
} from "../math/area-clause-practice";
import {
  areaClauseLessons,
  areaClauseMethods,
  areaClausePrinciples,
} from "../content/area-clause-lessons";

const ids = areaTilingClauseTemplates.map((t) => t.id);

export const family = {
  id: "area-tiling-clause",
  practice: {
    templates: areaTilingClauseTemplates,
    generate: generateAreaTilingClause,
    preserveAlgebra: true,
  },
  lessons: areaClauseLessons.filter((l) =>
    l.templateIds.some((id) => ids.includes(id)),
  ),
  methods: Object.fromEntries(ids.map((id) => [id, areaClauseMethods[id]!])),
  principles: Object.fromEntries(
    ids.map((id) => [id, areaClausePrinciples[id]!]),
  ),
  facetMappings: [
    {
      templateId: "tile-then-multiply",
      facetId: "rectangle-area.core",
      extent: "partial",
      rationale:
        "Match a rectangle's unit-square count to the product of its sides. Does not assess a non-rectangular region.",
    },
    {
      templateId: "split-tiled-count",
      facetId: "rectangle-area.core",
      extent: "partial",
      rationale:
        "Add the two products of a tiled rectangle split into two smaller rectangles. Does not assess a split the learner draws.",
    },
    {
      templateId: "choose-the-split",
      facetId: "rectangle-area.core",
      extent: "partial",
      rationale:
        "Choose the two facts that add to a rectangle's area. Does not assess an L-shaped figure.",
    },
    {
      templateId: "your-own-cut",
      facetId: "rectangle-area.core",
      extent: "partial",
      rationale:
        "Cut an L into two rectangles and add their areas. Does not assess a figure made of more than two rectangles.",
    },
    {
      templateId: "which-cut",
      facetId: "rectangle-area.core",
      extent: "partial",
      rationale:
        "Choose the cut of an L that makes two rectangles. Does not assess computing a product from unlabeled sides.",
    },
  ],
} satisfies ContentFamily;
