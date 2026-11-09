import type { ContentFamily } from "./registry/types";
import {
  numberNames,
  numberNamesTemplate,
} from "../math/clause-place-value-practice";
import { generateTransformationClause } from "../math/clause-transformation-practice";
import { random } from "../math/clause-support";
import {
  clauseMethod,
  clausePrinciple,
} from "../content/clause-variant-lessons";
import type { TemplateMetadata } from "../math/contracts";
import { clauseAdditionLessons } from "../content/clause-addition-lessons";

const grade8: TemplateMetadata = {
  id: "similarity-by-transformation-grade-8",
  version: 1,
  title: "Similarity from a dilation and a rigid motion",
  skillId: "dilations-similarity",
  gradeBand: "6–8",
  description:
    "Decide similarity from corresponding side ratios and identify an origin dilation followed by a rigid motion.",
  requiredResponseCapability: "single-choice-v1",
  requiredFigureCapability: "scenes-v1",
};
const types = [numberNamesTemplate, grade8];
const variantOf = (id: string) =>
  id === numberNamesTemplate.id ? "number-names" : "grade-8-origin";
export const family = {
  id: "clause-additions",
  practice: {
    templates: types,
    preserveAlgebra: true,
    generate: (id: string, seed: string) => {
      const meta = types.find((t) => t.id === id)!;
      const variant = variantOf(id);
      const c = {
        meta,
        seed,
        family: variant,
        r: random(`${id}:${variant}`, seed),
      };
      return id === numberNamesTemplate.id
        ? numberNames(c)
        : generateTransformationClause(c);
    },
  },
  methods: Object.fromEntries(
    types.map((t) => [t.id, clauseMethod(variantOf(t.id))!]),
  ),
  lessons: clauseAdditionLessons,
  principles: Object.fromEntries(
    types.map((t) => [t.id, clausePrinciple(variantOf(t.id))!]),
  ),
  facetMappings: [
    {
      templateId: numberNamesTemplate.id,
      facetId: "hundreds-place-value.core",
      extent: "partial",
      rationale:
        "Reads three-digit number names and produces numerals, including zeros, teens and round hundreds.",
    },
    {
      templateId: grade8.id,
      facetId: "dilations-similarity.core",
      extent: "partial",
      rationale:
        "Grade-8 selection route for the grade-8-origin variant: compare corresponding sides and identify an origin dilation followed by a rigid motion.",
    },
    {
      templateId: "geo-reflection-side",
      facetId: "transformation-constructions.HSG.CO.B.6",
      extent: "partial",
      rationale:
        "Uses geometric descriptions of two reflections to determine the image of a side.",
    },
    {
      templateId: "similarity-proof-aa",
      facetId: "similarity-proofs.HSG.SRT.B.4",
      extent: "partial",
      rationale:
        "Reason-selection proofs establish the proportional-side converse and derive the Pythagorean theorem from triangle similarity.",
    },
  ],
  archetypeLinks: {
    "three-digit-number-names": ["number.number-word-form"],
    "similarity-by-transformation-grade-8": ["transformation.image"],
  },
  // A coverage facet belongs to a template's primary skill. Cross-skill
  // discovery uses the registry's explicit instructional connections.
  connections: [
    {
      from: "rigid-motions",
      to: "transformation-invariants",
      kind: "related",
      explanation:
        "Evaluate a transformation as a point function, recover its input, and decide whether it preserves distance (HSG.CO.A.2).",
      templateIds: ["transformation-rule-slots"],
    },
    {
      from: "rigid-motions",
      to: "transformation-constructions",
      kind: "related",
      explanation:
        "Plot transformed vertices using off-origin turns, reflections and compositions described geometrically (HSG.CO.A.5 and HSG.CO.B.6).",
      templateIds: ["place-transformed-image"],
    },
    {
      from: "similarity-proofs",
      to: "similarity-theorems",
      kind: "related",
      explanation:
        "Use similarity to prove the proportional-side converse and the Pythagorean theorem (HSG.SRT.B.4).",
      templateIds: ["similarity-proof-aa"],
    },
  ],
} satisfies ContentFamily;
