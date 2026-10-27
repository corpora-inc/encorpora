import type { ContentFamily } from "./registry/types";
import {
  thermometerReadingGenerate,
  thermometerReadingTemplates,
} from "../math/thermometer-reading-practice";
import {
  thermometerReadingFacetMappings,
  thermometerReadingLessons,
  thermometerReadingMethods,
  thermometerReadingPrinciples,
} from "../content/thermometer-reading-lessons";

export const family = {
  id: "thermometer-reading",
  practice: {
    templates: thermometerReadingTemplates,
    generate: thermometerReadingGenerate,
    preserveAlgebra: true,
  },
  lessons: thermometerReadingLessons,
  methods: thermometerReadingMethods,
  principles: thermometerReadingPrinciples,
  facetMappings: thermometerReadingFacetMappings,
  // measure.thermometer is merged into measure.read-scale (see the archetype
  // rule in docs/assessment-coverage.md).
  archetypeLinks: { "read-thermometer": ["measure.read-scale"] },
  connections: [
    {
      from: "mass-volume",
      to: "scaled-graphs",
      kind: "related",
      explanation:
        "Reading the top of a thermometer's liquid and reading the top of a bar both mean finding what one gridline is worth and counting up from a labeled line.",
      templateIds: ["scaled-bar-graph"],
    },
  ],
} satisfies ContentFamily;
