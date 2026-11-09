import { triangleTheoremProofContent } from "../content/triangle-theorem-proof-lessons";
import {
  triangleProofProblem,
  triangleProofTemplate,
} from "../math/geometric-proof-clauses";
import type { ContentFamily } from "./registry/types";

export const family = {
  id: "triangle-theorem-proof",
  practice: {
    templates: [triangleProofTemplate],
    generate: (_id, seed) => triangleProofProblem(seed),
    preserveAlgebra: true,
  },
  lessons: triangleTheoremProofContent.lessons,
  methods: triangleTheoremProofContent.methods,
  principles: triangleTheoremProofContent.principles,
  archetypeLinks: {
    "two-column-triangle-proof": [
      "proof.geometry-written",
      "triangle.relationships",
    ],
  },
  facetMappings: [
    {
      templateId: "two-column-triangle-proof",
      facetId: "triangle-proofs.HSG.CO.C.10",
      extent: "partial",
      rationale:
        "Proof assembly and reason completion for isosceles base angles, the converse, midsegments and median concurrency; longer arguments have front/back parts.",
    },
    {
      templateId: "two-column-triangle-proof",
      facetId: "line-angle-proofs.HSG.CO.C.9",
      extent: "partial",
      rationale:
        "Prove both directions of the perpendicular-bisector theorem, with the converse distinguished from a contrapositive.",
    },
  ],
} satisfies ContentFamily;
