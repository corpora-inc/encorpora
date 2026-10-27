import type { ContentFamily } from "./registry/types";
import {
  interceptPointGenerate,
  interceptPointTemplates,
} from "../math/intercept-point-practice";
import {
  interceptPointFacetMappings,
  interceptPointLessons,
  interceptPointMethods,
  interceptPointPrinciples,
} from "../content/intercept-point-lessons";

export const family = {
  id: "intercept-point",
  practice: {
    templates: interceptPointTemplates,
    generate: interceptPointGenerate,
    preserveAlgebra: true,
  },
  lessons: interceptPointLessons,
  methods: interceptPointMethods,
  principles: interceptPointPrinciples,
  facetMappings: interceptPointFacetMappings,
  archetypeLinks: {
    "intercept-point-choice": ["function.intercepts", "line.slope-equation"],
  },
  connections: [
    {
      from: "graph-solution-sets",
      to: "linear-systems",
      kind: "extension",
      explanation:
        "An intercept is a shared point of a line and an axis. A linear system asks for the shared point of two lines, found with the same substitution of known coordinates.",
      templateIds: ["linear-system-pair"],
    },
  ],
  satTaskTemplates: {
    "function.representations": ["intercept-point-choice"],
  },
} satisfies ContentFamily;
