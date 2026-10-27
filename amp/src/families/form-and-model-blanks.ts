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
    "decimal-mixed-number-blanks": [
      "decimal.read-model",
      "number.decimal-fraction-equivalent",
    ],
    "inequality-solution-blanks": ["inequality.solve"],
    "conversion-proportion-blanks": ["ratio.proportion", "ratio.units"],
    "exponential-parameters-blanks": [
      "exponential.context",
      "exponential.form",
    ],
    "circle-estimate-blanks": [
      "circle.parts",
      "circle.circumference",
      "measure.circle",
    ],
  },
  connections: [
    {
      from: "decimal-fractions",
      to: "percentages",
      kind: "extension",
      explanation:
        "Tenths and hundredths name fractions with denominator 10 and 100. A percent is a fraction with denominator 100, so a decimal and a percent are the same amount written with the point moved two places.",
      templateIds: ["fraction-forms-blanks"],
    },
  ],
} satisfies ContentFamily;
