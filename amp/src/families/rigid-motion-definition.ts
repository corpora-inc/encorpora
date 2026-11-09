import {
  rigidMotionDefinitionFacetMappings,
  rigidMotionDefinitionLessons,
  rigidMotionDefinitionMethods,
  rigidMotionDefinitionPrinciples,
} from "../content/rigid-motion-definition-lessons";
import {
  rigidMotionDefinitionGenerate,
  rigidMotionDefinitionTemplates,
} from "../math/rigid-motion-definition-practice";
import type { ContentFamily } from "./registry/types";

/** HSG.CO.A.4: definitions of reflections, rotations and translations in
 * terms of angles, circles, perpendicular and parallel lines and segments. */
export const family = {
  id: "rigid-motion-definition",
  practice: {
    templates: rigidMotionDefinitionTemplates,
    generate: rigidMotionDefinitionGenerate,
    preserveAlgebra: true,
  },
  lessons: rigidMotionDefinitionLessons,
  methods: rigidMotionDefinitionMethods,
  principles: rigidMotionDefinitionPrinciples,
  facetMappings: rigidMotionDefinitionFacetMappings,
  archetypeLinks: {
    "rigid-motion-definition-select": [
      "proof.definitions",
      "transformation.image",
    ],
    "rigid-motion-definition-check": [
      "transformation.image",
      "proof.definitions",
    ],
    "rigid-motion-definition-slots": ["proof.definitions"],
  },
} satisfies ContentFamily;
