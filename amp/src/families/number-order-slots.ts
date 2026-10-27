import {
  numberOrderSlotsFacetMappings,
  numberOrderSlotsLessons,
  numberOrderSlotsMethods,
  numberOrderSlotsPrinciples,
} from "../content/number-order-slots-lessons";
import {
  numberOrderSlotsGenerate,
  numberOrderSlotsTemplates,
} from "../math/number-order-slots-practice";
import type { ContentFamily } from "./registry/types";

/** Put three to five numbers in order by choosing the number for each
 * position (multi-part-choice-v1 labeled slots). */
export const family = {
  id: "number-order-slots",
  practice: {
    templates: numberOrderSlotsTemplates,
    generate: numberOrderSlotsGenerate,
    preserveAlgebra: true,
  },
  lessons: numberOrderSlotsLessons,
  methods: numberOrderSlotsMethods,
  principles: numberOrderSlotsPrinciples,
  facetMappings: numberOrderSlotsFacetMappings,
  archetypeLinks: {
    "order-whole-numbers-slots": ["place.compare-whole"],
    "order-fractions-slots": ["fractions.compare"],
    "order-rationals-slots": ["rational.order-absolute", "number.real-order"],
  },
} satisfies ContentFamily;
