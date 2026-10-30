import type { ContentFamily } from "./registry/types";
import {
  operationSentenceGenerate,
  operationSentenceTemplates,
} from "../math/operation-sentence-practice";
import {
  operationSentenceFacetMappings,
  operationSentenceLessons,
  operationSentenceMethods,
  operationSentencePrinciples,
} from "../content/operation-sentence-lessons";

export const family = {
  id: "operation-sentence",
  practice: {
    templates: operationSentenceTemplates,
    generate: operationSentenceGenerate,
    preserveAlgebra: true,
  },
  lessons: operationSentenceLessons,
  methods: operationSentenceMethods,
  principles: operationSentencePrinciples,
  facetMappings: operationSentenceFacetMappings,
  archetypeLinks: {
    "operation-sentence-choice": [
      "whole.multiplicative-stories",
      "whole.expression-story",
      "early.number-line-hops",
    ],
    "related-division-sentence": [
      "whole.related-equation",
      "whole.division-facts",
      "whole.missing-factor",
    ],
    "related-subtraction-sentence": [
      "early.subtract-within-20",
      "whole.related-equation",
    ],
    "whole-number-equality-choice": ["equation.truth"],
    // Existing story templates that the ledger now cites without an archetype link.
    "story-equation-choice": [
      "linear.context",
      "expression.verbal",
      "whole.add-subtract-1000",
    ],
    "story-sentence-match-1000": [
      "whole.add-subtract-1000",
      "expression.verbal",
    ],
  },
  connections: [
    {
      from: "addition-facts",
      to: "division-facts",
      kind: "related",
      explanation:
        "Subtraction undoes addition the same way division undoes multiplication, so choosing the subtraction an addition fact helps solve prepares choosing the division a multiplication fact helps solve.",
      templateIds: ["related-division-sentence"],
    },
    {
      from: "multi-operation-stories",
      to: "one-step-equations",
      kind: "application",
      explanation:
        "Writing $x + 6 = 21$ from a story is the same modeling step that comes before solving a one-operation equation with a letter.",
      templateIds: ["one-step-equation-story"],
    },
  ],
} satisfies ContentFamily;
