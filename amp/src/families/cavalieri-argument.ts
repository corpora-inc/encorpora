import {
  cavalieriArgumentFacetMappings,
  cavalieriArgumentLessons,
  cavalieriArgumentMethods,
  cavalieriArgumentPrinciples,
} from "../content/cavalieri-argument-lessons";
import {
  cavalieriArgumentGenerate,
  cavalieriArgumentTemplates,
} from "../math/cavalieri-argument-practice";
import type { ContentFamily } from "./registry/types";

/** HSG.GMD.A.2: Cavalieri arguments for the sphere's volume and for
 * oblique solids, cones and pyramids (single choice and multi-part). */
export const family = {
  id: "cavalieri-argument",
  practice: {
    templates: cavalieriArgumentTemplates,
    generate: cavalieriArgumentGenerate,
    preserveAlgebra: true,
  },
  lessons: cavalieriArgumentLessons,
  methods: cavalieriArgumentMethods,
  principles: cavalieriArgumentPrinciples,
  facetMappings: cavalieriArgumentFacetMappings,
  archetypeLinks: {
    "cavalieri-sphere-argument": [
      "measure.cavalieri",
      "proof.measurement-formulas",
    ],
    "cavalieri-slice-area-check": ["measure.cavalieri", "measure.volume"],
    "cavalieri-other-solids-argument": [
      "measure.cavalieri",
      "proof.measurement-formulas",
    ],
  },
} satisfies ContentFamily;
