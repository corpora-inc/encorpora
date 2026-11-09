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
  facetMappings: countSquareTemplates.map(({ id, skillId, description }) => ({
    templateId: id,
    facetId: `${skillId}.core`,
    extent: "partial",
    rationale: description,
  })),
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
} satisfies ContentFamily;
