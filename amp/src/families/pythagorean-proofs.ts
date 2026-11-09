import type { ContentFamily } from "./registry/types";
import {
  generatePythagoreanProofs,
  pythagoreanProofsTemplates,
} from "../math/pythagorean-proofs-practice";
import {
  pythagoreanProofsFacetMappings,
  pythagoreanProofsLessons,
  pythagoreanProofsMethods,
  pythagoreanProofsPrinciples,
} from "../content/pythagorean-proofs-lessons";

/** Explain a proof of the Pythagorean theorem and its converse (8.G.B.6):
 * the rearrangement proof read as areas, ordered, completed and debugged,
 * and the congruence and hinge arguments for the converse. */
export const family = {
  id: "pythagorean-proofs",
  practice: {
    templates: pythagoreanProofsTemplates,
    generate: generatePythagoreanProofs,
    preserveAlgebra: true,
  },
  lessons: pythagoreanProofsLessons,
  methods: pythagoreanProofsMethods,
  principles: pythagoreanProofsPrinciples,
  facetMappings: pythagoreanProofsFacetMappings,
} satisfies ContentFamily;
