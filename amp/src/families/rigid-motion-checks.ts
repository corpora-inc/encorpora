import type { ContentFamily } from "./registry/types";
import {
  generateRigidMotionChecks,
  rigidMotionChecksTemplates,
} from "../math/rigid-motion-checks-practice";
import {
  rigidMotionChecksFacetMappings,
  rigidMotionChecksLessons,
  rigidMotionChecksMethods,
  rigidMotionChecksPrinciples,
} from "../content/rigid-motion-checks-lessons";

/** What slides, flips and turns keep (8.G.A.1): measure a figure and its
 * image on the coordinate plane, judge claims, and test candidate images. */
export const family = {
  id: "rigid-motion-checks",
  practice: {
    templates: rigidMotionChecksTemplates,
    generate: generateRigidMotionChecks,
    preserveAlgebra: true,
  },
  lessons: rigidMotionChecksLessons,
  methods: rigidMotionChecksMethods,
  principles: rigidMotionChecksPrinciples,
  facetMappings: rigidMotionChecksFacetMappings,
  archetypeLinks: {
    "rigid-motion-measure-verify": ["transformation.invariants"],
    "rigid-motion-property-claims": ["transformation.invariants"],
    "rigid-motion-image-check": [
      "transformation.invariants",
      "transformation.image",
    ],
    "rigid-motion-image-flaw": ["transformation.invariants"],
  },
  connections: [
    {
      from: "rigid-motion-properties",
      to: "dilations-similarity",
      kind: "extension",
      explanation:
        "Slides, flips and turns keep every length, every angle and every pair of parallel lines. A dilation keeps the angles and the parallel lines too, but it multiplies every length by the scale factor.",
      templateIds: ["rigid-motion-property-claims"],
    },
  ],
} satisfies ContentFamily;
