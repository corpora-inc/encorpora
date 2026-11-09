import type { ContentFamily } from "./registry/types";
import {
  algebraFormReasoningTemplates,
  generateAlgebraFormReasoning,
} from "../math/algebra-form-reasoning-practice";
import {
  algebraFormReasoningFacetMappings,
  algebraFormReasoningLessons,
  algebraFormReasoningMethods,
  algebraFormReasoningPrinciples,
} from "../content/algebra-form-reasoning-lessons";

/** Rewriting percent expressions in context and reading each form (7.EE.A.2);
 * explaining constant slope with similar triangles and deriving y = mx + b
 * (8.EE.B.6). */
export const family = {
  id: "algebra-form-reasoning",
  practice: {
    templates: algebraFormReasoningTemplates,
    generate: generateAlgebraFormReasoning,
    preserveAlgebra: true,
  },
  lessons: algebraFormReasoningLessons,
  methods: algebraFormReasoningMethods,
  principles: algebraFormReasoningPrinciples,
  facetMappings: algebraFormReasoningFacetMappings,
  archetypeLinks: {
    "percent-change-multiplier-form": ["percent.change"],
    "percent-change-multiplier-entry": ["percent.change", "percent.successive"],
    "expression-form-insight": ["linear.meaning"],
    "expression-form-two-part": ["linear.meaning"],
    "percent-rewrite-reasoning": ["percent.successive"],
    "slope-constant-similar-triangles": ["line.slope-triangles"],
    "slope-argument-order": ["line.slope-triangles"],
    "derive-line-equation": ["line.slope-equation"],
  },
} satisfies ContentFamily;
