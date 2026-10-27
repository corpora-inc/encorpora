import {
  multiPartFormatsFacetMappings,
  multiPartFormatsLessons,
  multiPartFormatsMethods,
  multiPartFormatsPrinciples,
} from "../content/multi-part-formats-lessons";
import {
  generateMultiPartFormatsProblem,
  multiPartFormatsTemplates,
} from "../math/multi-part-formats-practice";
import type { ContentFamily } from "./registry/types";

/** Complete the rule of a table, and mark each equation true or not true for
 * a value (multi-part-choice-v1). */
export const family = {
  id: "multi-part-formats",
  practice: {
    templates: multiPartFormatsTemplates,
    generate: generateMultiPartFormatsProblem,
    preserveAlgebra: true,
  },
  lessons: multiPartFormatsLessons,
  methods: multiPartFormatsMethods,
  principles: multiPartFormatsPrinciples,
  facetMappings: multiPartFormatsFacetMappings,
  archetypeLinks: {
    "table-rule-sentence": ["pattern.paired"],
    "substitution-match-table": ["equation.truth"],
  },
} satisfies ContentFamily;
