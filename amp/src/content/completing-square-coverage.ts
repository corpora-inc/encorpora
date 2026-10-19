import type { FacetMapping } from "./coverage";
export const completingSquareFacetMappings: readonly FacetMapping[] = [
  {
    templateId: "complete-square-term",
    facetId: "complete-square.missing-square-constant",
    extent: "partial",
    rationale:
      "Construct the exact constant that completes x²+bx to a square for integer b from −18 through 18. Includes zero, negative, odd and even coefficients. Does not assess symbolic b, general rational coefficients or a complete quadratic rewrite.",
  },
  {
    templateId: "complete-square-monic",
    facetId: "complete-square.monic-square-rewrite",
    extent: "partial",
    rationale:
      "Recognize a completed-square identity for x²+bx+c with integer b from −16 through 16 and c from −24 through 24. Choices preserve the leading coefficient and require matching both remaining coefficients. Does not assess constructing an expression without choices, arbitrary rational givens, solving equations or vertex interpretation.",
  },
  {
    templateId: "complete-square-nonmonic",
    facetId: "complete-square.nonmonic-square-rewrite",
    extent: "partial",
    rationale:
      "Recognize an exact completed-square identity with integer a from −6 through 6 excluding 0 and 1, b from −18 through 18, and c from −24 through 24. Includes negative leading coefficients and fractional shifts and remainders. Does not assess constructing an expression without choices, arbitrary rational or symbolic givens, solving equations or extrema.",
  },
];
