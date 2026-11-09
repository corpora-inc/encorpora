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
  principles: Object.fromEntries(
    types.map((t) => [t.id, clausePrinciple(variantOf(t.id))!]),
  ),
  facetMappings: [
    {
      templateId: numberNamesTemplate.id,
      facetId: "hundreds-place-value.2.NBT.A.3",
      extent: "partial",
      rationale:
        "Reads three-digit number names and produces numerals, including zeros, teens and round hundreds.",
    },
    {
      templateId: grade8.id,
      facetId: "dilations-similarity.8.G.A.4",
      extent: "partial",
      rationale:
        "Grade-8 selection route for the grade-8-origin variant: compare corresponding sides and identify an origin dilation followed by a rigid motion.",
    },
    {
      templateId: "transformation-rule-slots",
      facetId: "transformation-invariants.HSG.CO.A.2",
      extent: "partial",
      rationale:
        "The function-notation variant evaluates and inverts a point rule and classifies distance preservation.",
    },
    {
      templateId: "place-transformed-image",
      facetId: "transformation-constructions.HSG.CO.A.5",
      extent: "partial",
      rationale:
        "The geometry-draw variant places the vertices of an image after off-origin turns, reflections, translations or a two-step composition.",
    },
    {
      templateId: "place-transformed-image",
      facetId: "transformation-constructions.HSG.CO.B.6",
      extent: "partial",
      rationale:
        "Computes and plots every image vertex from geometric descriptions of rigid motions.",
    },
    {
      templateId: "geo-reflection-side",
      facetId: "transformation-invariants.HSG.CO.B.6",
      extent: "partial",
      rationale:
        "Uses geometric descriptions of two reflections to determine the image of a side.",
    },
    {
      templateId: "similarity-proof-aa",
      facetId: "similarity-theorems.HSG.SRT.B.4",
      extent: "partial",
      rationale:
        "Reason-selection proofs establish the proportional-side converse and derive the Pythagorean theorem from triangle similarity.",
    },
  ],
  archetypeLinks: {
    "three-digit-number-names": ["number.number-word-form"],
    "similarity-by-transformation-grade-8": ["transformation.image"],
  },
} satisfies ContentFamily;
