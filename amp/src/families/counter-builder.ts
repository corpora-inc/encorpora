import type { ContentFamily } from "./registry/types";
import {
  counterBuilderTemplates,
  generateCounterBuilder,
} from "../math/counter-builder-practice";
import {
  counterBuilderLesson,
  counterBuilderMethod,
  counterBuilderPrinciple,
} from "../content/counter-builder-lessons";

export const family = {
  id: "counter-builder",
  practice: {
    templates: counterBuilderTemplates,
    generate: generateCounterBuilder,
    preserveAlgebra: true,
  },
  lessons: [counterBuilderLesson],
  methods: { "build-the-number-sentence": counterBuilderMethod },
  principles: { "build-the-number-sentence": counterBuilderPrinciple },
  facetMappings: [
    {
      templateId: "build-the-number-sentence",
      facetId: "represent-join-separate.core",
      extent: "partial",
      rationale:
        "Builds virtual object models and number sentences for joining and taking away within 10. Fingers, claps, sounds and physical acting out are not assessed.",
    },
  ],
} satisfies ContentFamily;
