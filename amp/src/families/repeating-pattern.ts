import type { ContentFamily } from "./registry/types";
import {
  repeatingPatternGenerate,
  repeatingPatternTemplates,
} from "../math/repeating-pattern-practice";
import {
  repeatingPatternFacetMappings,
  repeatingPatternLessons,
  repeatingPatternMethods,
  repeatingPatternPrinciples,
} from "../content/repeating-pattern-lessons";

export const family = {
  id: "repeating-pattern",
  practice: {
    templates: repeatingPatternTemplates,
    generate: repeatingPatternGenerate,
    preserveAlgebra: true,
  },
  lessons: repeatingPatternLessons,
  methods: repeatingPatternMethods,
  principles: repeatingPatternPrinciples,
  facetMappings: repeatingPatternFacetMappings,
  archetypeLinks: { "repeating-shape-pattern": ["pattern.repeating-unit"] },
} satisfies ContentFamily;
