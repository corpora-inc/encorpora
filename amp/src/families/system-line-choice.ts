import type { ContentFamily } from "./registry/types";
import {
  systemLineChoiceGenerate,
  systemLineChoiceTemplates,
} from "../math/system-line-choice-practice";
import {
  systemLineChoiceFacetMappings,
  systemLineChoiceLessons,
  systemLineChoiceMethods,
  systemLineChoicePrinciples,
} from "../content/system-line-choice-lessons";

export const family = {
  id: "system-line-choice",
  practice: {
    templates: systemLineChoiceTemplates,
    generate: systemLineChoiceGenerate,
    preserveAlgebra: true,
  },
  lessons: systemLineChoiceLessons,
  methods: systemLineChoiceMethods,
  principles: systemLineChoicePrinciples,
  facetMappings: systemLineChoiceFacetMappings,
  archetypeLinks: {
    "system-second-equation": ["system.classify"],
    "parallel-line-intercept": [
      "line.slope-equation",
      "line.parallel-perpendicular",
    ],
    "table-standard-form": ["function.rule"],
  },
  satTaskTemplates: {
    "system.classify": ["system-second-equation"],
    "line.equation": ["parallel-line-intercept"],
    "function.rule": ["table-standard-form"],
  },
} satisfies ContentFamily;
