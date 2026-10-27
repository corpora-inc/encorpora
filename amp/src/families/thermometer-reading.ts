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

/** Read a liquid thermometer in °F or °C (scenes-v2 thermometer figure). */
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
  archetypeLinks: {
    "thermometer-reading": ["measure.thermometer"],
  },
} satisfies ContentFamily;
