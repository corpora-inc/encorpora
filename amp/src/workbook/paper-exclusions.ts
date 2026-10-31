/** Templates whose printed form fails the paper audit
 * (`npm run workbook:audit`): content wider than its column, or one problem
 * taller than a page. Daily workbooks skip them until their print is fixed.
 * Audit of 2026-10-31: 6 of 1,151 templates. */
export const paperExclusions: ReadonlySet<string> = new Set<string>([
  "absolute-value-transformed-equation",
  "complex-plane-forms",
  "operation-property-identify",
  "polynomial-subtraction",
  "similarity-proof-aa",
  "triangle-law-reasoning",
]);
