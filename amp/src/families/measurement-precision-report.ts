import {
  measurementPrecisionContent,
  measurementPrecisionFacetMappings,
} from "../content/measurement-precision-report-lessons";
import {
  measurementPrecisionGenerate,
  measurementPrecisionTemplates,
} from "../math/measurement-precision-report-practice";
import type { ContentFamily } from "./registry/types";

/** HSN.Q.A.3: report quantities to the accuracy their measurements support
 * (single-choice-v1 and multi-select-v1). */
export const family = {
  id: "measurement-precision-report",
  practice: {
    templates: measurementPrecisionTemplates,
    generate: measurementPrecisionGenerate,
    preserveAlgebra: true,
  },
  lessons: measurementPrecisionContent.lessons,
  methods: measurementPrecisionContent.methods,
  principles: measurementPrecisionContent.principles,
  facetMappings: measurementPrecisionFacetMappings,
  archetypes: [
    {
      id: "number.measurement-precision",
      domain: "number",
      summary:
        "Report a measured or computed quantity to the accuracy its measurements support, or judge a report's precision",
    },
  ],
  archetypeLinks: {
    "justified-report-from-measurements": [
      "number.measurement-precision",
      "number.round-decimal",
    ],
    "measurement-report-meaning": [
      "number.measurement-precision",
      "number.measurement-error-bound",
    ],
    "precision-report-critique": ["number.measurement-precision"],
  },
} satisfies ContentFamily;
