import type { ContentFamily } from "./registry/types";
import {
  generateSolidSection,
  solidSectionTemplates,
} from "../math/area-clause-practice";
import {
  areaClauseLessons,
  areaClauseMethods,
  areaClausePrinciples,
} from "../content/area-clause-lessons";

const ids = solidSectionTemplates.map((t) => t.id);

export const family = {
  id: "solid-section",
  practice: {
    templates: solidSectionTemplates,
    generate: generateSolidSection,
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
      templateId: "cone-section-area",
      facetId: "measurement-formula-proofs.HSG.GMD.A.3",
      extent: "partial",
      rationale:
        "Find the cross-section of a pyramid halfway up, or the volume of a cone with the same base area and height. Does not assess deriving the cone formula.",
    },
    {
      templateId: "cavalieri-coin-stack",
      facetId: "measurement-formula-proofs.HSG.GMD.A.1",
      extent: "partial",
      rationale:
        "A slanted stack of equal coins keeps the volume of the straight stack: the number of coins times the volume of one. Does not assess spheres or a new formula.",
    },
  ],
} satisfies ContentFamily;
