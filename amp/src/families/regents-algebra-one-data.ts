import type { ContentFamily } from "./registry/types";
import {
  regentsAlgebraOneDataGenerate,
  regentsAlgebraOneDataTemplates,
} from "../math/regents-algebra-one-data-practice";
import {
  regentsAlgebraOneDataFacetMappings,
  regentsAlgebraOneDataLessons,
  regentsAlgebraOneDataMethods,
  regentsAlgebraOneDataPrinciples,
} from "../content/regents-algebra-one-data-lessons";

export const family = {
  id: "regents-algebra-one-data",
  practice: {
    templates: regentsAlgebraOneDataTemplates,
    generate: regentsAlgebraOneDataGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsAlgebraOneDataLessons,
  methods: regentsAlgebraOneDataMethods,
  principles: regentsAlgebraOneDataPrinciples,
  facetMappings: regentsAlgebraOneDataFacetMappings,
  archetypeLinks: {
    "exponential-initial-value": ["exponential.context"],
    "exponential-decay-table": ["bivariate.growth"],
    "exponential-passes-linear": ["exponential.compare-linear"],
    "two-way-share": ["probability.conditional"],
    "quartile-list": ["univariate.quartiles"],
    "average-rate-table-rounded": ["function.average-rate-change"],
    "correlation-causation-choice": ["bivariate.scatter", "study.scope"],
    "budget-whole-items": ["inequality.context"],
    "abs-equals-linear-unique": [
      "nonlinear.absolute",
      "equation.graphical-solution",
    ],
  },
} satisfies ContentFamily;
