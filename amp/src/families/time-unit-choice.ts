import type { ContentFamily } from "./registry/types";
import {
  timeUnitChoiceGenerate,
  timeUnitChoiceTemplates,
} from "../math/time-unit-choice-practice";
import {
  timeUnitChoiceFacetMappings,
  timeUnitChoiceLessons,
  timeUnitChoiceMethods,
  timeUnitChoicePrinciples,
} from "../content/time-unit-choice-lessons";

export const family = {
  id: "time-unit-choice",
  practice: {
    templates: timeUnitChoiceTemplates,
    generate: timeUnitChoiceGenerate,
    preserveAlgebra: true,
  },
  lessons: timeUnitChoiceLessons,
  methods: timeUnitChoiceMethods,
  principles: timeUnitChoicePrinciples,
  facetMappings: timeUnitChoiceFacetMappings,
  archetypeLinks: {
    "elapsed-time-hm": ["time.elapsed", "time.read-clock"],
    "object-for-measure": ["measure.unit-choice"],
    "approximate-unit-factor": ["ratio.units", "measure.metric-length"],
  },
  satTaskTemplates: {
    "ratio.units": ["approximate-unit-factor"],
  },
} satisfies ContentFamily;
