import type { FacetMapping } from "./coverage";
export const addSubtractFacetMappings: readonly FacetMapping[] = [
  [
    "add-two-digit-regroup",
    "addition-within-100.two-digit-sums",
    "Two two-digit addends with sums to 100, mostly regrouping ones, with no-regroup controls and sums of exactly 100; shown with base-ten blocks.",
  ],
  [
    "make-hundred",
    "addition-within-100.two-digit-sums",
    "The missing addend that makes 100 from a two-digit number, including whole tens.",
  ],
  [
    "subtract-two-digit-regroup",
    "subtraction-within-100.two-digit-differences",
    "Two-digit subtrahends from 30 to 100, including whole-ten minuends, 100 and no-regroup controls.",
  ],
  [
    "add-three-digit",
    "add-subtract-thousands.three-digit-algorithms",
    "Three-digit sums to 1000 that regroup in the ones, the tens, both or neither.",
  ],
  [
    "subtract-three-digit",
    "add-subtract-thousands.three-digit-algorithms",
    "Three-digit differences that regroup in the ones, the tens, both, across a zero, from 1000, or not at all.",
  ],
  [
    "add-multidigit",
    "whole-add-subtract.six-digit-algorithms",
    "Four- to six-digit addends with sums to 999,999, including carry chains and a new leading place.",
  ],
  [
    "subtract-multidigit",
    "whole-add-subtract.six-digit-algorithms",
    "Four- to six-digit numbers, including regrouping across two or more zeros.",
  ],
].map(([templateId, facetId, scope]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: `${scope} The response is the numeric result only; written work, estimation and choice of strategy require separate assessment.`,
}));
