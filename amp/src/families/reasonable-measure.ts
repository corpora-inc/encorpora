import type { ContentFamily } from "./registry/types";
import {
  reasonableMeasureGenerate,
  reasonableMeasureTemplates,
} from "../math/reasonable-measure-practice";
import {
  reasonableMeasureFacetMappings,
  reasonableMeasureLessons,
  reasonableMeasureMethods,
  reasonableMeasurePrinciples,
} from "../content/reasonable-measure-lessons";

export const family = {
  id: "reasonable-measure",
  practice: {
    templates: reasonableMeasureTemplates,
    generate: reasonableMeasureGenerate,
    preserveAlgebra: true,
  },
  lessons: reasonableMeasureLessons,
  methods: reasonableMeasureMethods,
  principles: reasonableMeasurePrinciples,
  facetMappings: reasonableMeasureFacetMappings,
  archetypeLinks: { "reasonable-measure-choice": ["measure.unit-choice"] },
} satisfies ContentFamily;
