import type { FacetMapping } from "./coverage";
export const multiplyDivideFacetMappings: readonly FacetMapping[] = [
  [
    "multiply-by-tens",
    "multiply-tens.one-digit-times-tens",
    "A one-digit factor from 2 to 9 times a multiple of ten from 10 to 90, in either order, including facts that end in zero.",
  ],
  [
    "multiply-by-one-digit",
    "whole-multiplication.one-digit-factor",
    "A two- to four-digit factor times a one-digit factor from 3 to 9, including zeros and several regroupings.",
  ],
  [
    "area-model-product",
    "whole-multiplication.two-digit-area-model",
    "A two-digit by two-digit product from a to-scale area model split into four place-value regions.",
  ],
  [
    "multiply-multidigit",
    "multidigit-products.two-digit-multiplier",
    "A two- or three-digit factor times a two-digit factor, including zeros in either factor.",
  ],
  [
    "divide-by-one-digit",
    "whole-division.one-digit-divisor",
    "Exact quotients of two- and three-digit size for dividends up to 9,999 and divisors 2 to 9, including zeros in the quotient.",
  ],
  [
    "division-remainder",
    "whole-division.one-digit-divisor",
    "The nonzero remainder of a dividend up to 9,999 divided by 3 to 9, including the largest possible remainder.",
  ],
  [
    "divide-by-two-digit",
    "multidigit-quotients.two-digit-divisor",
    "Exact quotients of two- or three-digit size for dividends up to 9,999 and divisors 11 to 99, including zeros in the quotient.",
  ],
].map(([templateId, facetId, scope]) => ({
  templateId: templateId!,
  facetId: facetId!,
  extent: "partial",
  rationale: `${scope} Only the numeric result is assessed; written algorithms, models, estimates and interpretation of remainders in context require separate assessment.`,
}));
