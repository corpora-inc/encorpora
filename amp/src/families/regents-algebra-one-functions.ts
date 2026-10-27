import type { ContentFamily } from "./registry/types";
import {
  regentsAlgebraOneFunctionGenerate,
  regentsAlgebraOneFunctionTemplates,
} from "../math/regents-algebra-one-functions-practice";
import {
  regentsAlgebraOneFunctionFacetMappings,
  regentsAlgebraOneFunctionLessons,
  regentsAlgebraOneFunctionMethods,
  regentsAlgebraOneFunctionPrinciples,
} from "../content/regents-algebra-one-functions-lessons";

export const family = {
  id: "regents-algebra-one-functions",
  practice: {
    templates: regentsAlgebraOneFunctionTemplates,
    generate: regentsAlgebraOneFunctionGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsAlgebraOneFunctionLessons,
  methods: regentsAlgebraOneFunctionMethods,
  principles: regentsAlgebraOneFunctionPrinciples,
  facetMappings: regentsAlgebraOneFunctionFacetMappings,
  archetypeLinks: {
    "function-missing-input": ["function.identify"],
    "shift-function-notation": ["nonlinear.transform"],
    "radical-function-value": ["nonlinear.input-output"],
    "zeros-of-factored-product": ["nonlinear.polynomial-zeros"],
    "quadratic-negative-output": [
      "nonlinear.input-output",
      "nonlinear.quadratic",
    ],
    "parabola-axis-rule": ["nonlinear.features"],
    "quadratic-formula-positive": ["nonlinear.quadratic"],
    "factor-large-trinomial": ["expression.factor"],
  },
} satisfies ContentFamily;
