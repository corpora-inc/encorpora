import type { ContentFamily } from "./registry/types";
import {
  generatePlaceClause,
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
const decimalMethod: TemplateMetadata = {
  id: "decimal-model-written-method",
  version: 1,
  title: "Connect decimal models to written methods",
  skillId: "decimal-arithmetic",
  gradeBand: "3–5",
  difficultyOffset: 0.45,
  requiredResponseCapability: "multi-part-choice-v1",
  requiredFigureCapability: "scenes-v1",
  description:
    "Choose the equation and place-value reason that match a decimal addition, subtraction, multiplication or division model.",
};
const types = [numberNamesTemplate, grade8, decimalMethod];
const variantOf = (id: string) =>
  id === numberNamesTemplate.id
    ? "number-names"
    : id === decimalMethod.id
      ? "model-to-written-method"
      : "grade-8-origin";
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
        : id === decimalMethod.id
          ? generatePlaceClause(c)
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
      templateId: decimalMethod.id,
      facetId: "decimal-arithmetic.core",
      extent: "partial",
      rationale:
        "Connects decimal models to written equations and place-value reasons across all four operations.",
    },
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
    "decimal-model-written-method": ["number.decimal-model-operation"],
    "three-digit-number-names": ["number.number-word-form"],
    "similarity-by-transformation-grade-8": ["transformation.image"],
  },
  // A coverage facet belongs to a template's primary skill. Cross-skill
  // discovery uses the registry's explicit instructional connections.
  // Rigid motions → invariants and similarity proofs → theorems are already
  // prerequisite edges in the curriculum; do not duplicate those links here.
  connections: [
    {
      from: "rigid-motions",
      to: "transformation-constructions",
      kind: "related",
      explanation:
        "Plot transformed vertices using off-origin turns, reflections and compositions described geometrically (HSG.CO.A.5 and HSG.CO.B.6).",
      templateIds: ["place-transformed-image"],
    },
  ],
} satisfies ContentFamily;
