import type { ContentFamily } from "./registry/types";
import {
  regentsAlgebraOneLinearGenerate,
  regentsAlgebraOneLinearTemplates,
} from "../math/regents-algebra-one-linear-practice";
import {
  regentsAlgebraOneLinearFacetMappings,
  regentsAlgebraOneLinearLessons,
  regentsAlgebraOneLinearMethods,
  regentsAlgebraOneLinearPrinciples,
} from "../content/regents-algebra-one-linear-lessons";

export const family = {
  id: "regents-algebra-one-linear",
  practice: {
    templates: regentsAlgebraOneLinearTemplates,
    generate: regentsAlgebraOneLinearGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsAlgebraOneLinearLessons,
  methods: regentsAlgebraOneLinearMethods,
  principles: regentsAlgebraOneLinearPrinciples,
  facetMappings: regentsAlgebraOneLinearFacetMappings,
  archetypeLinks: {
    "decimal-both-sides-equation": ["linear.solve"],
    "grouped-both-sides-solve": ["linear.solve"],
    "point-slope-two-points": ["function.rule", "line.slope-equation"],
    "total-and-cost-equation": ["linear.context", "system.context"],
    "isolate-two-term-formula": ["nonlinear.literal"],
    "substitute-into-equation": ["system.solve"],
  },
} satisfies ContentFamily;
