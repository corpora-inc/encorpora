import {
  trigModelEquationsFacetMappings,
  trigModelEquationsLessons,
  trigModelEquationsMethods,
  trigModelEquationsPrinciples,
} from "../content/trig-model-equations-lessons";
import {
  trigModelEquationsGenerate,
  trigModelEquationsTemplates,
} from "../math/trig-model-equations-practice";
import type { ContentFamily } from "./registry/types";

/** HSF.TF.B.7: trigonometric equations from sinusoidal models, solved with
 * inverse functions in radians and interpreted in context. */
export const family = {
  id: "trig-model-equations",
  practice: {
    templates: trigModelEquationsTemplates,
    generate: trigModelEquationsGenerate,
    preserveAlgebra: true,
  },
  lessons: trigModelEquationsLessons,
  methods: trigModelEquationsMethods,
  principles: trigModelEquationsPrinciples,
  facetMappings: trigModelEquationsFacetMappings,
  archetypeLinks: {
    "trig-model-inverse-setup": [
      "trig.equation",
      "trig.inverse",
      "trig.sinusoid-model",
    ],
    "trig-model-solve-interval": ["trig.equation", "trig.sinusoid-model"],
    "trig-model-interpret-solutions": ["trig.equation", "trig.sinusoid-model"],
  },
} satisfies ContentFamily;
