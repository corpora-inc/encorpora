import type { ContentFamily } from "./registry/types";
import {
  multiselectExpressionGenerate,
  multiselectExpressionTemplates,
} from "../math/multiselect-expression-practice";
import { multiselectExpressionContent } from "../content/multiselect-expression-lessons";

export const family = {
  id: "multiselect-expression",
  practice: {
    templates: multiselectExpressionTemplates,
    generate: multiselectExpressionGenerate,
    preserveAlgebra: true,
  },
  lessons: multiselectExpressionContent.lessons,
  methods: multiselectExpressionContent.methods,
  principles: multiselectExpressionContent.principles,
  facetMappings: multiselectExpressionContent.facetMappings,
  archetypeLinks: {
    "story-expression-select": ["expression.verbal"],
    "equal-expression-select": ["expression.order-of-operations"],
    "customary-equivalent-select": ["measure.customary-units"],
    "additive-multiplicative-select": ["pattern.paired"],
    "equivalent-trinomial-select": ["expression.factor"],
    "regression-prediction-select": ["bivariate.linear-fit"],
    "function-pair-select": ["function.identify"],
    "root-approximation-select": ["number.approximate-roots"],
    "dot-plot-statement-select": ["univariate.displays"],
  },
  connections: [
    {
      from: "related-patterns",
      to: "ratios",
      kind: "extension",
      explanation:
        "In a multiplicative rule every pair of values has the same ratio of $y$ to $x$. That constant ratio is what equivalent ratios share.",
      templateIds: ["equivalent-ratios-select"],
    },
  ],
} satisfies ContentFamily;
