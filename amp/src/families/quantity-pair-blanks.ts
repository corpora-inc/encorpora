import {
  quantityPairBlanksFacetMappings,
  quantityPairBlanksLessons,
  quantityPairBlanksMethods,
  quantityPairBlanksPrinciples,
} from "../content/quantity-pair-blanks-lessons";
import {
  quantityPairBlanksGenerate,
  quantityPairBlanksTemplates,
} from "../math/quantity-pair-blanks-practice";
import type { ContentFamily } from "./registry/types";

/** Two or more related quantities of one situation, each chosen in its own
 * gap (multi-part-choice-v1). */
export const family = {
  id: "quantity-pair-blanks",
  practice: {
    templates: quantityPairBlanksTemplates,
    generate: quantityPairBlanksGenerate,
    preserveAlgebra: true,
  },
  lessons: quantityPairBlanksLessons,
  methods: quantityPairBlanksMethods,
  principles: quantityPairBlanksPrinciples,
  facetMappings: quantityPairBlanksFacetMappings,
  archetypeLinks: {
    "quotient-remainder-blanks": ["whole.divide-two-digit"],
    "meters-to-kilometers-blanks": ["measure.mixed-units"],
    "simple-interest-blanks": ["percent.of"],
    "loan-offer-compare-blanks": ["percent.of"],
    "scale-factor-effects-blanks": ["measure.scale"],
    "expected-count-blanks": ["probability.direct", "inference.estimate"],
    "unit-rate-pair-blanks": ["ratio.proportion"],
    "ratio-pair-blanks": ["ratio.proportion"],
    "mean-median-blanks": ["univariate.center"],
    "median-mode-compare-blanks": [
      "univariate.center",
      "univariate.compare-distributions",
    ],
    "rectangle-chain-blanks": ["measure.area"],
    "wage-and-cost-blanks": ["function.rule", "linear.meaning"],
    "percent-amounts-blanks": ["percent.of"],
    "check-register-blanks": ["rational.signed-context"],
  },
} satisfies ContentFamily;
