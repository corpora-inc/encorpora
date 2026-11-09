import type { ContentFamily } from "./registry/types";
import {
  areaExhibitTemplates,
  generateAreaExhibit,
} from "../math/area-clause-practice";
import {
  areaClauseLessons,
  areaClauseMethods,
  areaClausePrinciples,
} from "../content/area-clause-lessons";

const ids = areaExhibitTemplates.map((t) => t.id);

export const family = {
  id: "area-exhibit",
  practice: {
    templates: areaExhibitTemplates,
    generate: generateAreaExhibit,
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
      templateId: "exhibit-same-perimeter",
      facetId: "area-perimeter-models.composite-formulas",
      extent: "partial",
      rationale:
        "Give a different whole-number rectangle with the same perimeter as the one shown, and give its area. Does not assess composite figures or a missing side of an L.",
    },
    {
      templateId: "exhibit-same-area",
      facetId: "area-perimeter-models.composite-formulas",
      extent: "partial",
      rationale:
        "Give a different whole-number rectangle with the same area as the one shown, and give its perimeter. Does not assess fractional side lengths.",
    },
  ],
} satisfies ContentFamily;
