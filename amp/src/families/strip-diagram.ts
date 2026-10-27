import type { ContentFamily } from "./registry/types";
import {
  stripDiagramGenerate,
  stripDiagramTemplates,
} from "../math/strip-diagram-practice";
import {
  stripDiagramFacetMappings,
  stripDiagramLessons,
  stripDiagramMethods,
  stripDiagramPrinciples,
} from "../content/strip-diagram-lessons";

export const family = {
  id: "strip-diagram",
  practice: {
    templates: stripDiagramTemplates,
    generate: stripDiagramGenerate,
    preserveAlgebra: true,
  },
  lessons: stripDiagramLessons,
  methods: stripDiagramMethods,
  principles: stripDiagramPrinciples,
  facetMappings: stripDiagramFacetMappings,
  // equation.model-choice is merged into number.strip-diagram.
  archetypeLinks: { "strip-diagram-match": ["number.strip-diagram"] },
} satisfies ContentFamily;
