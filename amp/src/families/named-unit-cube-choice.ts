import type { ContentFamily } from "./registry/types";
import { generateNamedUnitCubeChoice, namedUnitCubeChoiceTemplates } from "../math/named-unit-cube-choice-practice";
import {
  namedUnitCubeChoiceFacetMappings,
  namedUnitCubeChoiceLessons,
  namedUnitCubeChoiceMethods,
  namedUnitCubeChoicePrinciples,
} from "../content/named-unit-cube-choice-lessons";

export const family = {
  id: "named-unit-cube-choice",
  practice: {
    templates: namedUnitCubeChoiceTemplates,
    generate: generateNamedUnitCubeChoice,
    preserveAlgebra: true,
  },
  lessons: namedUnitCubeChoiceLessons,
  methods: namedUnitCubeChoiceMethods,
  principles: namedUnitCubeChoicePrinciples,
  facetMappings: namedUnitCubeChoiceFacetMappings,
  archetypeLinks: {
    "named-unit-cube-choice": ["measure.unit-cube-volume"],
  },
} satisfies ContentFamily;
