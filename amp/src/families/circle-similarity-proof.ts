import {
  circleSimilarityProofFacetMappings,
  circleSimilarityProofLessons,
  circleSimilarityProofMethods,
  circleSimilarityProofPrinciples,
} from "../content/circle-similarity-proof-lessons";
import {
  circleSimilarityProofGenerate,
  circleSimilarityProofTemplates,
} from "../math/circle-similarity-proof-practice";
import type { ContentFamily } from "./registry/types";

/** HSG.C.A.1: the proof that all circles are similar, by a translation of
 * centers and a dilation by the ratio of the radii. */
export const family = {
  id: "circle-similarity-proof",
  practice: {
    templates: circleSimilarityProofTemplates,
    generate: circleSimilarityProofGenerate,
    preserveAlgebra: true,
  },
  lessons: circleSimilarityProofLessons,
  methods: circleSimilarityProofMethods,
  principles: circleSimilarityProofPrinciples,
  facetMappings: circleSimilarityProofFacetMappings,
  archetypeLinks: {
    "circle-similarity-proof-steps": [
      "proof.geometry-written",
      "transformation.dilation",
    ],
    "circle-similarity-justify-flaw": [
      "proof.geometry-written",
      "transformation.dilation",
    ],
    "circle-similarity-general-map": [
      "transformation.dilation",
      "measure.scale",
    ],
  },
} satisfies ContentFamily;
