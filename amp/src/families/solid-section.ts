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
} satisfies ContentFamily;
