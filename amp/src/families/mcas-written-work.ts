import {
  mcasWrittenWorkContent,
  mcasWrittenWorkFacetMappings,
} from "../content/mcas-written-work-lessons";
import {
  mcasWrittenWorkGenerate,
  mcasWrittenWorkTemplates,
} from "../math/mcas-written-work-practice";
import type { ContentFamily } from "./registry/types";

/** Multipart "show or explain" measurement problems answered as labeled
 * exact steps: similar triangles, scale drawings, scientific notation
 * (structured-work-v1). */
export const family = {
  id: "mcas-written-work",
  practice: {
    templates: mcasWrittenWorkTemplates,
    generate: mcasWrittenWorkGenerate,
    preserveAlgebra: true,
  },
  lessons: mcasWrittenWorkContent.lessons,
  methods: mcasWrittenWorkContent.methods,
  principles: mcasWrittenWorkContent.principles,
  facetMappings: mcasWrittenWorkFacetMappings,
  archetypeLinks: {
    "similar-triangles-work": ["triangle.relationships", "angle.relationships"],
    "scale-drawing-work": ["measure.scale"],
    "scientific-notation-work": [
      "number.scientific-notation",
      "number.scientific-operations",
    ],
  },
} satisfies ContentFamily;
