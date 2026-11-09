import type { ContentFamily } from "./registry/types";
import {
  distributionShapeFitTemplates,
  generateDistributionShapeFit,
} from "../math/distribution-shape-fit-practice";
import {
  distributionShapeFitFacetMappings,
  distributionShapeFitLessons,
  distributionShapeFitMethods,
  distributionShapeFitPrinciples,
} from "../content/distribution-shape-fit-lessons";

/** Describe a distribution by its center, spread and shape (6.SP.A.2), and
 * judge how well a straight line fits a scatter plot (8.SP.A.2). */
export const family = {
  id: "distribution-shape-fit",
  practice: {
    templates: distributionShapeFitTemplates,
    generate: generateDistributionShapeFit,
    preserveAlgebra: true,
  },
  lessons: distributionShapeFitLessons,
  methods: distributionShapeFitMethods,
  principles: distributionShapeFitPrinciples,
  facetMappings: distributionShapeFitFacetMappings,
  archetypeLinks: {
    "distribution-describe-dot-plot": [
      "univariate.shape",
      "univariate.displays",
    ],
    "distribution-match-description": ["univariate.shape"],
    "distribution-read-description": ["univariate.shape"],
    "statistical-question-distribution-answer": [
      "study.statistical-question",
      "univariate.shape",
    ],
    "trend-line-best-fit-choice": ["bivariate.scatter"],
    "trend-line-fit-assess": ["bivariate.scatter"],
  },
  connections: [
    {
      from: "describe-distributions",
      to: "distribution-plots",
      kind: "extension",
      explanation:
        "Center, spread and shape describe a distribution in words. The median, the mean, the range and a box plot measure those same features with numbers.",
      templateIds: ["distribution-describe-dot-plot"],
    },
  ],
} satisfies ContentFamily;
