import type { ContentFamily } from "./registry/types";
import {
  likelihoodGenerate,
  likelihoodTemplates,
} from "../math/likelihood-practice";
import {
  likelihoodFacetMappings,
  likelihoodLessons,
  likelihoodMethods,
  likelihoodPrinciples,
} from "../content/likelihood-lessons";

export const family = {
  id: "likelihood",
  practice: {
    templates: likelihoodTemplates,
    generate: likelihoodGenerate,
    preserveAlgebra: true,
  },
  lessons: likelihoodLessons,
  methods: likelihoodMethods,
  principles: likelihoodPrinciples,
  facetMappings: likelihoodFacetMappings,
  archetypeLinks: {
    "likelihood-in-words": ["probability.likelihood-scale"],
    "probability-on-number-line": ["probability.likelihood-scale"],
    // probability.fair-selection is merged into probability.likelihood-design.
    "equal-chance-choice": ["probability.likelihood-design"],
  },
  connections: [
    {
      from: "fractions-number-line",
      to: "probability",
      kind: "application",
      explanation:
        "The chance of an event with equally likely outcomes is a fraction between 0 and 1, so it sits on a number line cut into that many equal spaces, exactly where a fraction of that size is read.",
      templateIds: ["probability-on-number-line"],
    },
  ],
} satisfies ContentFamily;
