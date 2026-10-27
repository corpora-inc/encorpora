import type { ContentFamily } from "./registry/types";
import {
  solidPropertyGenerate,
  solidPropertyTemplates,
} from "../math/solid-property-practice";
import {
  solidPropertyFacetMappings,
  solidPropertyLessons,
  solidPropertyMethods,
  solidPropertyPrinciples,
} from "../content/solid-property-lessons";

export const family = {
  id: "solid-property",
  practice: {
    templates: solidPropertyTemplates,
    generate: solidPropertyGenerate,
    preserveAlgebra: true,
  },
  lessons: solidPropertyLessons,
  methods: solidPropertyMethods,
  principles: solidPropertyPrinciples,
  facetMappings: solidPropertyFacetMappings,
  archetypeLinks: { "solid-property-select": ["shape.solid-properties"] },
} satisfies ContentFamily;
