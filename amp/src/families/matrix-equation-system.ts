import {
  matrixEquationSystemContent,
  matrixEquationSystemFacetMappings,
} from "../content/matrix-equation-system-lessons";
import {
  matrixEquationSystemGenerate,
  matrixEquationSystemTemplates,
} from "../math/matrix-equation-system-practice";
import type { ContentFamily } from "./registry/types";

/** HSA.REI.C.8: write a system as one matrix equation AX = B in the column
 * of unknowns X (structured-work-v1 entry), and read one back as its
 * system (single-choice-v1). */
export const family = {
  id: "matrix-equation-system",
  practice: {
    templates: matrixEquationSystemTemplates,
    generate: matrixEquationSystemGenerate,
    preserveAlgebra: true,
  },
  lessons: matrixEquationSystemContent.lessons,
  methods: matrixEquationSystemContent.methods,
  principles: matrixEquationSystemContent.principles,
  facetMappings: matrixEquationSystemFacetMappings,
  archetypeLinks: {
    "system-to-matrix-equation": ["matrix.system"],
    "matrix-equation-reading": ["matrix.system", "matrix.operations"],
  },
} satisfies ContentFamily;
