import {
  showWorkContent,
  showWorkFacetMappings,
} from "../content/show-work-word-problem-lessons";
import {
  showWorkGenerate,
  showWorkTemplates,
} from "../math/show-work-word-problem-practice";
import type { ContentFamily } from "./registry/types";

/** Multi-part word problems answered as labeled steps: exact values, typed
 * expressions and an inequality (structured-work-v1). */
export const family = {
  id: "show-work-word-problem",
  practice: {
    templates: showWorkTemplates,
    generate: showWorkGenerate,
    preserveAlgebra: true,
  },
  lessons: showWorkContent.lessons,
  methods: showWorkContent.methods,
  principles: showWorkContent.principles,
  facetMappings: showWorkFacetMappings,
  archetypeLinks: {
    "show-work-box-cost": [
      "expression.verbal",
      "linear.context",
      "function.input-output",
    ],
    "show-work-percent-count": [
      "number.percent-fraction-decimal",
      "percent.of",
    ],
    "show-work-rental-plans": ["inequality.context"],
  },
} satisfies ContentFamily;
