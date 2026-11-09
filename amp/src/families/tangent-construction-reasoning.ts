import {
  tangentConstructionReasoningFacetMappings,
  tangentConstructionReasoningLessons,
  tangentConstructionReasoningMethods,
  tangentConstructionReasoningPrinciples,
} from "../content/tangent-construction-reasoning-lessons";
import {
  tangentConstructionReasoningGenerate,
  tangentConstructionReasoningTemplates,
} from "../math/tangent-construction-reasoning-practice";
import type { ContentFamily } from "./registry/types";

/** HSG.C.A.4: the steps and the justification of the construction of a
 * tangent from a point outside a circle. */
export const family = {
  id: "tangent-construction-reasoning",
  practice: {
    templates: tangentConstructionReasoningTemplates,
    generate: tangentConstructionReasoningGenerate,
    preserveAlgebra: true,
  },
  lessons: tangentConstructionReasoningLessons,
  methods: tangentConstructionReasoningMethods,
  principles: tangentConstructionReasoningPrinciples,
  facetMappings: tangentConstructionReasoningFacetMappings,
  archetypeLinks: {
    "tangent-construct-steps": [
      "construction.compass-straightedge",
      "circle.parts",
    ],
    "tangent-construct-justify": [
      "construction.compass-straightedge",
      "circle.parts",
    ],
  },
} satisfies ContentFamily;
