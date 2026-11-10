import {
  congruenceRigidMotionContent,
  congruenceRigidMotionFacetMappings,
} from "../content/congruence-rigid-motion-lessons";
import {
  congruenceRigidMotionGenerate,
  congruenceRigidMotionTemplates,
} from "../math/congruence-rigid-motion-practice";
import type { ContentFamily } from "./registry/types";

/** HSG.CO.B.7: triangles are congruent if and only if their six pairs of
 * corresponding parts are, argued from the rigid-motion definition (a
 * two-column proof, reasoning choices and a coordinate construction). */
export const family = {
  id: "congruence-rigid-motion",
  practice: {
    templates: congruenceRigidMotionTemplates,
    generate: congruenceRigidMotionGenerate,
    preserveAlgebra: true,
  },
  lessons: congruenceRigidMotionContent.lessons,
  methods: congruenceRigidMotionContent.methods,
  principles: congruenceRigidMotionContent.principles,
  facetMappings: congruenceRigidMotionFacetMappings,
  archetypeLinks: {
    "six-parts-imply-rigid-motion-proof": [
      "triangle.congruence-transformations",
      "proof.geometry-written",
    ],
    "congruence-definition-reasoning": [
      "triangle.congruence-transformations",
      "transformation.invariants",
    ],
    "rigid-motion-from-six-parts-coordinates": [
      "triangle.congruence-transformations",
      "transformation.identify",
    ],
  },
} satisfies ContentFamily;
