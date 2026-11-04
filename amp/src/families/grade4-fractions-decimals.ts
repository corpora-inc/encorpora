import type { ContentFamily } from "./registry/types";
import {
  grade4FractionsDecimalsGenerate,
  grade4FractionsDecimalsTemplates,
} from "../math/grade4-fractions-decimals-practice";
import {
  grade4FractionsDecimalsFacetMappings,
  grade4FractionsDecimalsLessons,
  grade4FractionsDecimalsMethods,
  grade4FractionsDecimalsPrinciples,
} from "../content/grade4-fractions-decimals-lessons";

export const family = {
  id: "grade4-fractions-decimals",
  practice: {
    templates: grade4FractionsDecimalsTemplates,
    generate: grade4FractionsDecimalsGenerate,
    preserveAlgebra: true,
  },
  lessons: grade4FractionsDecimalsLessons,
  methods: grade4FractionsDecimalsMethods,
  principles: grade4FractionsDecimalsPrinciples,
  facetMappings: grade4FractionsDecimalsFacetMappings,
  archetypeLinks: {
    "fraction-decompositions-select": ["fractions.add-subtract-like"],
    "mixed-fraction-sum": ["fractions.add-subtract-like"],
    "like-fraction-sum-story": ["fractions.add-subtract-like"],
    "unit-fraction-multiple-blanks": ["fractions.multiply-whole"],
    "equivalent-fractions-number-line": ["fractions.number-line"],
    "compare-fractions-symbol-blanks": ["fractions.compare"],
    "compare-decimals-symbol-blanks": ["number.decimal-expanded-compare"],
    "decimal-fraction-locate": ["decimal.read-model"],
    "decimal-place-value-hundredths": ["decimal.read-model"],
  },
} satisfies ContentFamily;
