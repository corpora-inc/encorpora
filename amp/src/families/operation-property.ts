import type { ContentFamily } from "./registry/types";
import {
  operationPropertyGenerate,
  operationPropertyTemplates,
} from "../math/operation-property-practice";
import {
  operationPropertyFacetMappings,
  operationPropertyLessons,
  operationPropertyMethods,
  operationPropertyPrinciples,
} from "../content/operation-property-lessons";

export const family = {
  id: "operation-property",
  practice: {
    templates: operationPropertyTemplates,
    generate: operationPropertyGenerate,
    preserveAlgebra: true,
  },
  lessons: operationPropertyLessons,
  methods: operationPropertyMethods,
  principles: operationPropertyPrinciples,
  facetMappings: operationPropertyFacetMappings,
  archetypeLinks: {
    "operation-property-identify": ["whole.property-identify"],
  },
} satisfies ContentFamily;
