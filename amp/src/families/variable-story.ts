import type { ContentFamily } from "./registry/types";
import {
  variableStoryGenerate,
  variableStoryTemplates,
} from "../math/variable-story-practice";
import {
  variableStoryFacetMappings,
  variableStoryLessons,
  variableStoryMethods,
  variableStoryPrinciples,
} from "../content/variable-story-lessons";

export const family = {
  id: "variable-story",
  practice: {
    templates: variableStoryTemplates,
    generate: variableStoryGenerate,
    preserveAlgebra: true,
  },
  lessons: variableStoryLessons,
  methods: variableStoryMethods,
  principles: variableStoryPrinciples,
  facetMappings: variableStoryFacetMappings,
  archetypeLinks: {
    "variable-in-situation": ["equation.variable-identify"],
    "story-for-subtraction-sentence": ["whole.expression-story"],
  },
  connections: [
    {
      from: "multi-operation-stories",
      to: "variable-expressions",
      kind: "application",
      explanation:
        "A story with a quantity that changes needs a way to name that quantity. A letter stands for the changing amount, which is what a variable is.",
      templateIds: ["variable-in-situation"],
    },
  ],
} satisfies ContentFamily;
