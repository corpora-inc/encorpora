import {
  solveJustifyContent,
  solveJustifyFacetMappings,
} from "../content/solve-and-justify-lessons";
import {
  solveJustifyGenerate,
  solveJustifyTemplates,
} from "../math/solve-and-justify-practice";
import type { ContentFamily } from "./registry/types";

/** Solve an equation, inequality or formula line by line and name the
 * reason for each line (structured-work-v1). */
export const family = {
  id: "solve-and-justify",
  practice: {
    templates: solveJustifyTemplates,
    generate: solveJustifyGenerate,
    preserveAlgebra: true,
  },
  lessons: solveJustifyContent.lessons,
  methods: solveJustifyContent.methods,
  principles: solveJustifyContent.principles,
  facetMappings: solveJustifyFacetMappings,
  archetypeLinks: {
    "solve-justify-linear": ["linear.solve", "linear.step-justification"],
    "solve-justify-inequality": ["inequality.solve"],
    "solve-justify-formula": ["linear.literal"],
    "solve-justify-quadratic": ["nonlinear.quadratic"],
  },
} satisfies ContentFamily;
