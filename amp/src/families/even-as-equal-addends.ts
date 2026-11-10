import type { ContentFamily } from "./registry/types";
import {
  generateEvenAsEqualAddends,
  evenAsEqualAddendsTemplates,
} from "../math/even-as-equal-addends-practice";
import {
  evenAsEqualAddendsFacetMappings,
  evenAsEqualAddendsLessons,
  evenAsEqualAddendsMethods,
  evenAsEqualAddendsPrinciples,
} from "../content/even-as-equal-addends-lessons";

/** Write an even number as two equal addends (2.OA.C.3). */
export const family = {
  id: "even-as-equal-addends",
  practice: {
    templates: evenAsEqualAddendsTemplates,
    generate: generateEvenAsEqualAddends,
    preserveAlgebra: true,
  },
  lessons: evenAsEqualAddendsLessons,
  methods: evenAsEqualAddendsMethods,
  principles: evenAsEqualAddendsPrinciples,
  facetMappings: evenAsEqualAddendsFacetMappings,
  archetypeLinks: {
    "even-as-equal-addends": ["early.odd-even"],
  },
} satisfies ContentFamily;
