import type { ContentFamily } from "./registry/types";
import {
  expandedFormGenerate,
  expandedFormTemplates,
} from "../math/expanded-form-practice";
import {
  expandedFormFacetMappings,
  expandedFormLessons,
  expandedFormMethods,
  expandedFormPrinciples,
} from "../content/expanded-form-lessons";

export const family = {
  id: "expanded-form",
  practice: {
    templates: expandedFormTemplates,
    generate: expandedFormGenerate,
    preserveAlgebra: true,
  },
  lessons: expandedFormLessons,
  methods: expandedFormMethods,
  principles: expandedFormPrinciples,
  facetMappings: expandedFormFacetMappings,
  archetypeLinks: {
    "expanded-sum-to-standard": ["number.expanded-form-whole"],
    "standard-to-expanded-choice": ["number.expanded-form-whole"],
  },
  connections: [
    {
      from: "decimal-place-value",
      to: "powers-of-ten",
      kind: "application",
      explanation:
        "Every place in a number is ten times the place to its right, so the place values 1,000, 100, 10, 1, 0.1 and 0.01 are powers of ten. Writing a number as digit-times-place-value sums is the base for multiplying and dividing by powers of ten.",
      templateIds: ["multiply-power-of-ten"],
    },
  ],
} satisfies ContentFamily;
