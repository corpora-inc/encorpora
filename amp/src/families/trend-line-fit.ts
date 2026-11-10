import type { ContentFamily } from "./registry/types";
import {
  trendLineFitTemplates,
  generateTrendLineFit,
} from "../math/trend-line-fit-practice";
import {
  trendFitLesson,
  trendFitMethod,
  trendCompareMethod,
  trendReadMethod,
  trendFitPrinciple,
} from "../content/trend-line-fit-lessons";

export const family = {
  id: "trend-line-fit",
  practice: {
    templates: trendLineFitTemplates,
    generate: generateTrendLineFit,
    preserveAlgebra: true,
  },
  lessons: [trendFitLesson],
  methods: {
    "trend-line-fit": trendFitMethod,
    "trend-line-compare": trendCompareMethod,
    "trend-line-read": trendReadMethod,
  },
  principles: Object.fromEntries(
    trendLineFitTemplates.map((t) => [t.id, trendFitPrinciple]),
  ),
  facetMappings: trendLineFitTemplates.map((t) => ({
    templateId: t.id,
    facetId: "scatterplots.core",
    extent: "partial" as const,
    rationale:
      "Fits a line informally, compares closeness, or reads an estimate within the observed range. Curved-cloud assessment is covered by trend-line-fit-assess.",
  })),
  archetypeLinks: Object.fromEntries(
    trendLineFitTemplates.map((t) => [t.id, ["bivariate.scatter"]]),
  ),
} satisfies ContentFamily;
