import type { InventorySource } from "../source-reconciliation";

export const arkansasPdf = "ar-k8-math-2023";

const retrievedAt = "2026-11-04";
/** Official K-8 standards PDF. Grade 4 is printed pages 18-20. */
export const arkansasSources: readonly InventorySource[] = [
  {
    id: arkansasPdf,
    url: "https://dese.ade.arkansas.gov/Files/AR_2023_K-8%2C_Alg%2C_Geo_Math_Standards_LS_6.21.23_LS.pdf",
    edition:
      "Arkansas Mathematics Standards, Grades K-8, Algebra I, Geometry, file dated 21 June 2023",
    retrievedAt,
    sha256: "b6dae5fb0fcf0fafafe3eebb940f5b91a9b66550fe4000c0ad00b9475bcdcc3f",
  },
];
