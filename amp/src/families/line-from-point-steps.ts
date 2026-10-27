import {
  lineFromPointContent,
  lineFromPointFacetMappings,
} from "../content/line-from-point-steps-lessons";
import {
  lineFromPointGenerate,
  lineFromPointTemplates,
} from "../math/line-from-point-steps-practice";
import type { ContentFamily } from "./registry/types";

/** Write y = mx + b from a slope and a point or from two points, as labeled
 * steps and a typed equation (structured-work-v1). */
export const family = {
  id: "line-from-point-steps",
  practice: {
    templates: lineFromPointTemplates,
    generate: lineFromPointGenerate,
    preserveAlgebra: true,
  },
  lessons: lineFromPointContent.lessons,
  methods: lineFromPointContent.methods,
  principles: lineFromPointContent.principles,
  facetMappings: lineFromPointFacetMappings,
  archetypeLinks: {
    "line-from-point-steps": ["line.slope-equation"],
  },
} satisfies ContentFamily;
