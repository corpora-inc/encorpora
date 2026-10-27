import type { ContentFamily } from "./registry/types";
import {
  regentsAlgebraTwoGraphGenerate,
  regentsAlgebraTwoGraphTemplates,
} from "../math/regents-algebra-two-graphs-practice";
import {
  regentsAlgebraTwoGraphFacetMappings,
  regentsAlgebraTwoGraphLessons,
  regentsAlgebraTwoGraphMethods,
  regentsAlgebraTwoGraphPrinciples,
} from "../content/regents-algebra-two-graphs-lessons";

export const family = {
  id: "regents-algebra-two-graphs",
  practice: {
    templates: regentsAlgebraTwoGraphTemplates,
    generate: regentsAlgebraTwoGraphGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsAlgebraTwoGraphLessons,
  methods: regentsAlgebraTwoGraphMethods,
  principles: regentsAlgebraTwoGraphPrinciples,
  facetMappings: regentsAlgebraTwoGraphFacetMappings,
  archetypeLinks: {
    "log-base-fraction-graph": ["logarithm.graph"],
    "remainder-zero-graph": ["expression.polynomial-division"],
    "repeated-zero-rule": ["nonlinear.representations"],
    "sinusoid-compare-rule": ["trig.sinusoid-features"],
    "tide-cosine-equation": ["trig.sinusoid-model"],
    "cubic-graph-statement": ["nonlinear.features"],
  },
  // figure-choice templates are listed in the practice templates above
} satisfies ContentFamily;
