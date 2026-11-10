import type { ContentFamily } from "./registry/types";
import {
  coordinatePlotTemplates,
  generateCoordinatePlot,
} from "../math/area-clause-practice";
import {
  areaClauseLessons,
  areaClauseMethods,
  areaClausePrinciples,
} from "../content/area-clause-lessons";

const ids = coordinatePlotTemplates.map((t) => t.id);

export const family = {
  id: "coordinate-vertex-plot",
  practice: {
    templates: coordinatePlotTemplates,
    generate: generateCoordinatePlot,
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
      templateId: "plot-the-polygon",
      facetId: "coordinate-polygons.core",
      extent: "partial",
      rationale:
        "Plot the four vertices of an axis-aligned rectangle from their coordinates. Does not assess side lengths, perimeter, or area.",
    },
    {
      templateId: "missing-vertex",
      facetId: "coordinate-polygons.core",
      extent: "partial",
      rationale:
        "Plot the fourth vertex of an axis-aligned rectangle from the other three. Does not assess diagonal lengths or area.",
    },
  ],
} satisfies ContentFamily;
