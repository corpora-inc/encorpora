import type { ContentFamily } from "./registry/types";
import {
  generateTiltedRectangle,
  tiltedRectangleTemplates,
} from "../math/area-clause-practice";
import {
  areaClauseLessons,
  areaClauseMethods,
  areaClausePrinciples,
} from "../content/area-clause-lessons";

const ids = tiltedRectangleTemplates.map((t) => t.id);

export const family = {
  id: "tilted-rectangle",
  practice: {
    templates: tiltedRectangleTemplates,
    generate: generateTiltedRectangle,
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
