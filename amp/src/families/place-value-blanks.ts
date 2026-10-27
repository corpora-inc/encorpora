import {
  placeValueBlanksFacetMappings,
  placeValueBlanksLessons,
  placeValueBlanksMethods,
  placeValueBlanksPrinciples,
} from "../content/place-value-blanks-lessons";
import {
  placeValueBlanksGenerate,
  placeValueBlanksTemplates,
} from "../math/place-value-blanks-practice";
import type { ContentFamily } from "./registry/types";

/** Place names, roundings, expanded sums and comparison symbols chosen blank
 * by blank (multi-part-choice-v1). */
export const family = {
  id: "place-value-blanks",
  practice: {
    templates: placeValueBlanksTemplates,
    generate: placeValueBlanksGenerate,
    preserveAlgebra: true,
  },
  lessons: placeValueBlanksLessons,
  methods: placeValueBlanksMethods,
  principles: placeValueBlanksPrinciples,
  facetMappings: placeValueBlanksFacetMappings,
  archetypeLinks: {
    "digit-place-names": ["place.digit-value"],
    "round-place-blanks": ["number.round-whole"],
    "round-decimal-blanks": ["number.round-decimal"],
    "round-addends-sum": ["number.round-whole", "number.estimate"],
    "expanded-whole-slots": ["place.digit-value", "number.expanded-form-whole"],
    "expanded-decimal-slots": [
      "number.decimal-expanded-compare",
      "number.expanded-form-whole",
    ],
    "compare-symbol-blanks": ["place.compare-whole"],
    "digit-value-blanks": ["place.digit-value", "number.place-value-ratio"],
  },
  connections: [
    {
      from: "large-place-value",
      to: "decimal-place-value",
      kind: "extension",
      explanation:
        "Rounding a whole number looks at the digit just right of the rounding place. The same rule rounds a decimal to the nearest tenth or hundredth, with places that are worth one tenth as much each step to the right.",
      templateIds: ["round-decimal-blanks"],
    },
  ],
} satisfies ContentFamily;
