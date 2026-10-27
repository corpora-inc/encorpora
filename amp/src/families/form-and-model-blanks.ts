import {
  formBlanksFacetMappings,
  formBlanksLessons,
  formBlanksMethods,
  formBlanksPrinciples,
} from "../content/form-blanks-lessons";
import {
  formBlanksGenerate,
  formBlanksTemplates,
} from "../math/form-blanks-practice";
import type { ContentFamily } from "./registry/types";

/** Other forms of a number or relation, chosen piece by piece
 * (multi-part-choice-v1). */
export const family = {
  id: "form-and-model-blanks",
  practice: {
    templates: formBlanksTemplates,
    generate: formBlanksGenerate,
    preserveAlgebra: true,
  },
  lessons: formBlanksLessons,
  methods: formBlanksMethods,
  principles: formBlanksPrinciples,
  facetMappings: formBlanksFacetMappings,
  archetypeLinks: {
    "fraction-forms-blanks": [
      "number.percent-fraction-decimal",
      "number.decimal-fraction-equivalent",
    ],
    "decimal-mixed-number-blanks": ["decimal.read-model"],
    "inequality-solution-blanks": ["inequality.solve"],
    "conversion-proportion-blanks": ["ratio.proportion"],
    "exponential-parameters-blanks": ["exponential.context"],
    "circle-estimate-blanks": ["circle.parts", "circle.circumference"],
  },
} satisfies ContentFamily;
