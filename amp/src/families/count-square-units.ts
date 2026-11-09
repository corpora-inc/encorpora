import type { ContentFamily } from "./registry/types";
import {
  countSquareTemplates,
  generateCountSquare,
} from "../math/area-clause-practice";
import {
  areaClauseLessons,
  areaClauseMethods,
  areaClausePrinciples,
} from "../content/area-clause-lessons";

const ids = countSquareTemplates.map((t) => t.id);

export const family = {
  id: "count-square-units",
  practice: {
    templates: countSquareTemplates,
    generate: generateCountSquare,
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
      templateId: "define-unit-square",
      facetId: "rectangle-area.core",
      extent: "partial",
      rationale:
        "Say what area one unit square covers. Does not assess counting a larger region or multiplying side lengths.",
    },
    {
      templateId: "which-is-a-unit-square",
      facetId: "rectangle-area.core",
      extent: "partial",
      rationale:
        "Choose the square that covers one square unit. Does not assess the area of a larger rectangle.",
    },
    {
      templateId: "count-square-units",
      facetId: "rectangle-area.core",
      extent: "partial",
      rationale:
        "Count the unit squares that cover a figure with no gaps or overlaps. Does not assess multiplying unlabeled side lengths.",
    },
    {
      templateId: "gaps-overlaps",
      facetId: "rectangle-area.core",
      extent: "partial",
      rationale:
        "Reject a covering that leaves a gap or stacks squares. Does not assess drawing a covering.",
    },
  ],
} satisfies ContentFamily;
