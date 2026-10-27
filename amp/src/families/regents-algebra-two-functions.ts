import type { ContentFamily } from "./registry/types";
import {
  regentsAlgebraTwoFunctionsGenerate,
  regentsAlgebraTwoFunctionsTemplates,
} from "../math/regents-algebra-two-functions-practice";
import {
  regentsAlgebraTwoFunctionsFacetMappings,
  regentsAlgebraTwoFunctionsLessons,
  regentsAlgebraTwoFunctionsMethods,
  regentsAlgebraTwoFunctionsPrinciples,
} from "../content/regents-algebra-two-functions-lessons";

export const family = {
  id: "regents-algebra-two-functions",
  practice: {
    templates: regentsAlgebraTwoFunctionsTemplates,
    generate: regentsAlgebraTwoFunctionsGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsAlgebraTwoFunctionsLessons,
  methods: regentsAlgebraTwoFunctionsMethods,
  principles: regentsAlgebraTwoFunctionsPrinciples,
  facetMappings: regentsAlgebraTwoFunctionsFacetMappings,
  archetypeLinks: {
    "normal-probability": ["distribution.normal"],
    "tangent-quadrant-cosine": ["trig.identity"],
    "special-angle-match": ["circle.unit-trig"],
    "odd-sine-parameters": ["function.parity"],
    "parabola-vertex-distance": ["conic.parabola"],
    "event-complement-set": ["probability.event-sets"],
  },
} satisfies ContentFamily;
