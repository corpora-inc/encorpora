import type { ContentFamily } from "./registry/types";
import {
  generateKBuildRepresent,
  kBuildRepresentTemplates,
} from "../math/k-build-represent-practice";
import {
  kBuildRepresentFacetMappings,
  kBuildRepresentLessons,
  kBuildRepresentMethods,
  kBuildRepresentPrinciples,
} from "../content/k-build-represent-lessons";

/** Kindergarten building and representing: stick-and-ball models and shape
 * drawings (K.G.B.5), and pictures, stories and number sentences of joining
 * and taking away (K.OA.A.1). */
export const family = {
  id: "k-build-represent",
  practice: {
    templates: kBuildRepresentTemplates,
    generate: generateKBuildRepresent,
    preserveAlgebra: true,
  },
  lessons: kBuildRepresentLessons,
  methods: kBuildRepresentMethods,
  principles: kBuildRepresentPrinciples,
  facetMappings: kBuildRepresentFacetMappings,
} satisfies ContentFamily;
