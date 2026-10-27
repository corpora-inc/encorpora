import {
  polynomialProductContent,
  polynomialProductFacetMappings,
} from "../content/polynomial-product-steps-lessons";
import {
  polynomialProductGenerate,
  polynomialProductTemplates,
} from "../math/polynomial-product-steps-practice";
import type { ContentFamily } from "./registry/types";

/** Multiply polynomials as typed partial products, combined coefficients and
 * a product in standard form (structured-work-v1). */
export const family = {
  id: "polynomial-product-steps",
  practice: {
    templates: polynomialProductTemplates,
    generate: polynomialProductGenerate,
    preserveAlgebra: true,
  },
  lessons: polynomialProductContent.lessons,
  methods: polynomialProductContent.methods,
  principles: polynomialProductContent.principles,
  facetMappings: polynomialProductFacetMappings,
  archetypeLinks: {
    "polynomial-product-steps": ["expression.polynomial"],
  },
} satisfies ContentFamily;
