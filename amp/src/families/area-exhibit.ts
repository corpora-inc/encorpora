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
  facetMappings: areaExhibitTemplates.map(({ id, skillId, description }) => ({
    templateId: id,
    facetId: `${skillId}.core`,
    extent: "partial",
    rationale: description,
  })),
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
} satisfies ContentFamily;
