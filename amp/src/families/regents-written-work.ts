import {
  regentsWrittenWorkContent,
  regentsWrittenWorkFacetMappings,
} from "../content/regents-written-work-lessons";
import {
  regentsWrittenWorkGenerate,
  regentsWrittenWorkTemplates,
} from "../math/regents-written-work-practice";
import type { ContentFamily } from "./registry/types";

/** Two-credit Regents responses whose rating guides credit the shown work,
 * answered as labeled exact steps (structured-work-v1). */
export const family = {
  id: "regents-written-work",
  practice: {
    templates: regentsWrittenWorkTemplates,
    generate: regentsWrittenWorkGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsWrittenWorkContent.lessons,
  methods: regentsWrittenWorkContent.methods,
  principles: regentsWrittenWorkContent.principles,
  facetMappings: regentsWrittenWorkFacetMappings,
  archetypeLinks: {
    "recursion-term-steps": ["sequence.recursive"],
    "remainder-steps": ["expression.polynomial-division"],
    "addition-rule-steps": ["probability.addition-rule"],
    "average-rate-steps": ["function.average-rate-change"],
    "budget-items-steps": ["inequality.context"],
  },
} satisfies ContentFamily;
