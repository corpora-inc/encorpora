import type { ContentFamily } from "./registry/types";
import {
  regentsSequenceGenerate,
  regentsSequenceTemplates,
} from "../math/regents-sequences-practice";
import {
  regentsSequenceFacetMappings,
  regentsSequenceLessons,
  regentsSequenceMethods,
  regentsSequencePrinciples,
} from "../content/regents-sequences-lessons";

export const family = {
  id: "regents-sequences",
  practice: {
    templates: regentsSequenceTemplates,
    generate: regentsSequenceGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsSequenceLessons,
  methods: regentsSequenceMethods,
  principles: regentsSequencePrinciples,
  facetMappings: regentsSequenceFacetMappings,
  archetypeLinks: {
    "arithmetic-distant-term": ["sequence.arithmetic"],
    "geometric-signed-term": ["sequence.geometric"],
  },
} satisfies ContentFamily;
