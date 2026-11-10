import {
  unitCircleExtensionFacetMappings,
  unitCircleExtensionLessons,
  unitCircleExtensionMethods,
  unitCircleExtensionPrinciples,
} from "../content/unit-circle-extension-lessons";
import {
  unitCircleExtensionGenerate,
  unitCircleExtensionTemplates,
} from "../math/unit-circle-extension-practice";
import type { ContentFamily } from "./registry/types";

/** HSF.TF.A.2: the unit circle extends sine and cosine to every real number
 * (single-choice, multi-part-choice, figure-choice and multi-select). */
export const family = {
  id: "unit-circle-extension",
  practice: {
    templates: unitCircleExtensionTemplates,
    generate: unitCircleExtensionGenerate,
    preserveAlgebra: true,
  },
  lessons: unitCircleExtensionLessons,
  methods: unitCircleExtensionMethods,
  principles: unitCircleExtensionPrinciples,
  facetMappings: unitCircleExtensionFacetMappings,
  archetypeLinks: {
    "unit-circle-extension-reason": ["circle.unit-trig"],
    "unit-circle-extension-cloze": ["circle.unit-trig", "circle.arc-sector"],
    "real-number-terminal-point": ["circle.unit-trig"],
    "real-number-same-terminal-point": ["circle.unit-trig"],
  },
} satisfies ContentFamily;
